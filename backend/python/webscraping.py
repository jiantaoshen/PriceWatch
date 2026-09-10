"""
File: webscraping.py
Purpose:
    Runs PriceWatch scraping, validates large price jumps, writes latest status
    for every product, and writes only accepted/successful prices to history.
    Suspicious/failed products remain visible so users can review them instead
    of being mistaken for products that have never run.

Main functions:
    - check_source(...): scrape or read one manual store price.
    - check_product(...): choose winners, validate price, return success/failed/suspicious.
    - run_product(...): record every latest result and accepted history results separately.
    - main(): run all products and atomically persist latest/run/history files.

Inputs:
    Current-format python/products.json, scraped/manual source prices, and accepted history.
    Product IDs, sources, currency and scraping flags are required by the current schema.

Outputs:
    data/latest.json (full latest statuses), data/history/*.json (compact accepted prices),
    run metadata, debug artifacts, and optional notifications.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from playwright.async_api import async_playwright

from pricewatch.debug import get_debug_dir, save_debug_artifacts
from pricewatch.history import get_previous_price, get_previous_unit_price
from pricewatch.models import PriceHistoryEntry, PriceHistoryFile, ScrapeError, ScrapeResult
from pricewatch.notifications import (
    handle_product_notification,
    handle_run_notification,
    load_notification_state,
    mark_notification_events_sent,
    save_notification_state,
    send_summary_notification,
)
from pricewatch.run import build_run_metadata
from pricewatch.run_lock import acquire_run_lock, release_run_lock
from pricewatch.validation import PriceValidationStatus, validate_price
from pricewatch.json_ld import extract_json_ld_price


# ============================================================
# Console / paths
# ============================================================

for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

PYTHON_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PYTHON_DIR.parent
PRODUCTS_FILE = PYTHON_DIR / "products.json"
DATA_DIR = PROJECT_DIR / "data"
HISTORY_DIR = DATA_DIR / "history"
LATEST_FILE = DATA_DIR / "latest.json"
HISTORY_INDEX_FILE = HISTORY_DIR / "index.json"
DEBUG_DIR = PROJECT_DIR / "debug"
RUNS_DIR = DATA_DIR / "runs"
RUN_LATEST_FILE = RUNS_DIR / "latest.json"
ENV_FILE = PROJECT_DIR / ".env"
STATE_DIR = PYTHON_DIR / ".state"
NOTIFICATION_STATE_FILE = STATE_DIR / "notifications.json"

load_dotenv(ENV_FILE)


# ============================================================
# Small helpers
# ============================================================

def positive_float(value, default=None):
    if value is None:
        return default

    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default

    return parsed if parsed > 0 else default


def should_scrape_source(product, source) -> bool:
    return product["scraping_enabled"] and source["scraping_enabled"]


def get_product_sources(product):
    """Return sources from the current ProductConfig schema."""
    return product["sources"]


def product_uses_scraper(product) -> bool:
    return any(
        should_scrape_source(product, source)
        for source in get_product_sources(product)
    )


def unit_suffix(unit):
    return f"/{unit}" if unit else ""


def quantity_label(quantity, unit):
    return f"{quantity:g} {unit}" if unit else f"{quantity:g} units"


def make_error(error_type, message):
    return ScrapeError(type=error_type, message=message)


def make_result(
    *,
    product_id,
    name,
    target_price,
    currency,
    status,
    url="",
    store=None,
    unit=None,
    target_unit_price=None,
    current_price=None,
    previous_price=None,
    below_target=None,
    difference=None,
    unit_url=None,
    unit_store=None,
    current_unit_price=None,
    previous_unit_price=None,
    unit_below_target=None,
    unit_difference=None,
    offers=None,
    error=None,
):
    return ScrapeResult(
        product_id=product_id,
        name=name,
        url=url,
        store=store,
        target_price=target_price,
        current_price=current_price,
        previous_price=previous_price,
        below_target=below_target,
        difference=difference,
        unit=unit,
        unit_url=unit_url,
        unit_store=unit_store,
        target_unit_price=target_unit_price,
        current_unit_price=current_unit_price,
        previous_unit_price=previous_unit_price,
        unit_below_target=unit_below_target,
        unit_difference=unit_difference,
        status=status,
        currency=currency,
        offers=offers or [],
        error=error,
    )


# ============================================================
# Source price
# ============================================================

async def get_source_price(page, product, source) -> tuple[float | None, str]:
    if not should_scrape_source(product, source):
        return positive_float(source.get("manual_price")), "manual"

    if page is None:
        raise RuntimeError("Browser page is unavailable for a scraping source.")

    url = source["url"]

    await page.goto(url, wait_until="domcontentloaded", timeout=60000)

    for attempt in range(4):
        current_price = await extract_json_ld_price(
            page,
            product_name=product["name"],
            product_url=url,
        )

        if current_price is not None:
            return float(current_price), "scrape"

        if attempt < 3:
            await page.wait_for_timeout(1000)

    return None, "scrape"


# ============================================================
# Source checking
# ============================================================

async def check_source(page, product, source, index, unit, currency, comparison_quantity):
    url = source["url"]
    store = source.get("store") or f"Source {index}"
    note = source.get("note")
    unit_quantity = positive_float(source.get("unit_quantity"))
    is_scraping = should_scrape_source(product, source)

    print("\n" + "-" * 70)
    print(f"Store: {store}")
    print(f"URL: {url}")
    print(f"Mode: {'scraper' if is_scraping else 'manual'}")

    if unit_quantity is not None:
        print(f"Unit quantity: {unit_quantity:g}" + (f" {unit}" if unit else ""))

    if note:
        print(f"Note: {note}")

    try:
        current_price, price_source = await get_source_price(page, product, source)

        if current_price is None:
            message = (
                "Could not extract a product price"
                if is_scraping
                else "Manual price is missing or invalid"
            )
            print(f"❌ {store}: {message}")
            return None, f"{store}: {message}"

        unit_price = (
            round(current_price / unit_quantity, 4)
            if unit_quantity is not None
            else None
        )

        comparison_price = (
            round(unit_price * comparison_quantity, 2)
            if comparison_quantity is not None and unit_price is not None
            else None
        )

        print(f"✅ {store}: {current_price:.2f} {currency}")
        print(f"   Source: {price_source}")

        if unit_price is not None:
            print(f"   Unit price: {unit_price:.4f} {currency}{unit_suffix(unit)}")

        if comparison_quantity is not None:
            if comparison_price is not None:
                label = quantity_label(comparison_quantity, unit)
                print(f"   Price for {label}: {comparison_price:.2f} {currency}")
            else:
                print(
                    "   ⚠️ Not eligible for total-price comparison: "
                    "unit quantity is missing."
                )

        return {
            "store": store,
            "url": url,
            "price": current_price,
            "price_source": price_source,
            "unit_quantity": unit_quantity,
            "unit_price": unit_price,
            "comparison_price": comparison_price,
            "note": note,
        }, None

    except Exception as error:
        print(f"❌ {store}: {error}")
        return None, f"{store}: {error}"


# ============================================================
# Winner / status helpers
# ============================================================

def choose_winners(offers, comparison_quantity):
    if comparison_quantity is not None:
        comparable = [offer for offer in offers if offer["comparison_price"] is not None]

        if not comparable:
            return None, None

        best_offer = min(comparable, key=lambda offer: offer["comparison_price"])
        current_price = float(best_offer["comparison_price"])
    else:
        best_offer = min(offers, key=lambda offer: offer["price"])
        current_price = float(best_offer["price"])

    unit_offers = [offer for offer in offers if offer["unit_price"] is not None]
    best_unit_offer = (
        min(unit_offers, key=lambda offer: offer["unit_price"])
        if unit_offers
        else None
    )

    return (best_offer, current_price), best_unit_offer


def print_winners(best_offer, current_price, best_unit_offer, comparison_quantity, unit, currency):
    print("\n" + "=" * 70)

    if comparison_quantity is not None:
        print(f"🏆 Cheapest comparable total: {best_offer['store']}")
        print(f"🏆 Actual package price: {best_offer['price']:.2f} {currency}")
        print(
            f"🏆 Price for {quantity_label(comparison_quantity, unit)}: "
            f"{current_price:.2f} {currency}"
        )
    else:
        print(f"🏆 Cheapest total: {best_offer['store']}")
        print(f"🏆 Total price: {current_price:.2f} {currency}")

    if best_unit_offer is not None:
        print(f"🏆 Cheapest unit: {best_unit_offer['store']}")
        print(
            f"🏆 Unit price: {best_unit_offer['unit_price']:.4f} "
            f"{currency}{unit_suffix(unit)}"
        )


def print_target_status(
    current_price,
    target_price,
    current_unit_price,
    target_unit_price,
    comparison_quantity,
    unit,
    currency,
):
    below_target = current_price <= target_price
    difference = round(current_price - target_price, 2)
    total_label = "comparable total" if comparison_quantity is not None else "total"

    print(
        f"{'🟢' if below_target else '⚪'} Current {total_label}: "
        f"{current_price:.2f} {currency}"
    )

    if below_target:
        print(f"🎯 Below {total_label} target: {abs(difference):.2f} {currency}")
    else:
        print(f"{total_label.capitalize()} needs to drop by: {difference:.2f} {currency}")

    unit_below_target = None
    unit_difference = None

    if current_unit_price is not None and target_unit_price is not None:
        unit_below_target = current_unit_price <= target_unit_price
        unit_difference = round(current_unit_price - target_unit_price, 4)
        suffix = unit_suffix(unit)

        if unit_below_target:
            print(
                f"🟢 Unit price below target: "
                f"{abs(unit_difference):.4f} {currency}{suffix}"
            )
        else:
            print(
                f"⚪ Unit price needs to drop by: "
                f"{unit_difference:.4f} {currency}{suffix}"
            )

    return below_target, difference, unit_below_target, unit_difference


# ============================================================
# Check one product
# ============================================================

async def check_product(page, product, period):
    name = product["name"]
    product_id = product["id"]
    currency = product["currency"]
    target_price = float(product["target_price"])
    unit = product.get("unit")
    target_unit_price = (
        float(product["target_unit_price"])
        if product.get("target_unit_price") is not None
        else None
    )

    comparison_raw = product.get("comparison_quantity")
    comparison_quantity = positive_float(comparison_raw)

    # Read the newest accepted baseline before any source can fail. This allows
    # failed results to still tell the frontend what the last valid price was.
    previous_price = get_previous_price(
        history_dir=HISTORY_DIR,
        current_period=period,
        product_id=product_id,
    )
    previous_unit_price = get_previous_unit_price(
        history_dir=HISTORY_DIR,
        current_period=period,
        product_id=product_id,
    )

    if comparison_raw is not None and comparison_quantity is None:
        message = "comparison_quantity must be greater than 0"
        return make_result(
            product_id=product_id,
            name=name,
            target_price=target_price,
            currency=currency,
            status="failed",
            unit=unit,
            target_unit_price=target_unit_price,
            previous_price=previous_price,
            previous_unit_price=previous_unit_price,
            error=make_error("INVALID_COMPARISON_QUANTITY", message),
        )

    sources = get_product_sources(product)

    print("\n" + "=" * 70)
    print(f"Product: {name}")

    if comparison_quantity is not None:
        print(f"Comparison quantity: {quantity_label(comparison_quantity, unit)}")
        print(f"Target comparable total: {target_price:.2f} {currency}")
    else:
        print(f"Target total price: {target_price:.2f} {currency}")

    if target_unit_price is not None:
        print(f"Target unit price: {target_unit_price:.4f} {currency}{unit_suffix(unit)}")

    print(f"Sources: {len(sources)}")

    if not sources:
        print("❌ No product URLs configured")
        return make_result(
            product_id=product_id,
            name=name,
            target_price=target_price,
            currency=currency,
            status="failed",
            unit=unit,
            target_unit_price=target_unit_price,
            previous_price=previous_price,
            previous_unit_price=previous_unit_price,
            error=make_error("NO_URL", "No product URLs configured"),
        )

    offers = []
    errors = []

    for index, source in enumerate(sources, start=1):
        offer, error = await check_source(
            page,
            product,
            source,
            index,
            unit,
            currency,
            comparison_quantity,
        )

        if offer is not None:
            offers.append(offer)
        elif error:
            errors.append(error)

    if not offers:
        print("\n❌ All sources failed")
        message = "; ".join(errors) or "Could not extract a price from any source"

        return make_result(
            product_id=product_id,
            name=name,
            target_price=target_price,
            currency=currency,
            status="failed",
            url=sources[0]["url"],
            unit=unit,
            target_unit_price=target_unit_price,
            previous_price=previous_price,
            previous_unit_price=previous_unit_price,
            error=make_error("ALL_SOURCES_FAILED", message),
        )

    winner, best_unit_offer = choose_winners(offers, comparison_quantity)

    if winner is None:
        message = (
            "Comparison quantity is enabled, but no source has a valid unit quantity."
        )
        print(f"\n❌ {message}")

        return make_result(
            product_id=product_id,
            name=name,
            target_price=target_price,
            currency=currency,
            status="failed",
            url=offers[0]["url"],
            unit=unit,
            target_unit_price=target_unit_price,
            previous_price=previous_price,
            previous_unit_price=previous_unit_price,
            offers=offers,
            error=make_error("NO_COMPARABLE_OFFERS", message),
        )

    best_offer, current_price = winner
    current_unit_price = (
        float(best_unit_offer["unit_price"])
        if best_unit_offer is not None
        else None
    )
    unit_store = best_unit_offer["store"] if best_unit_offer is not None else None
    unit_url = best_unit_offer["url"] if best_unit_offer is not None else None

    print_winners(
        best_offer,
        current_price,
        best_unit_offer,
        comparison_quantity,
        unit,
        currency,
    )

    if len(offers) < len(sources):
        print(f"⚠️ Successful sources: {len(offers)}/{len(sources)}")

    if previous_price is None:
        print("Previous total price: not available")
    else:
        print(f"Previous total price: {previous_price:.2f} {currency}")

    if previous_unit_price is not None:
        print(
            f"Previous unit price: {previous_unit_price:.4f} "
            f"{currency}{unit_suffix(unit)}"
        )

    common = dict(
        product_id=product_id,
        name=name,
        target_price=target_price,
        currency=currency,
        url=best_offer["url"],
        store=best_offer["store"],
        unit=unit,
        target_unit_price=target_unit_price,
        current_price=current_price,
        previous_price=previous_price,
        unit_url=unit_url,
        unit_store=unit_store,
        current_unit_price=current_unit_price,
        previous_unit_price=previous_unit_price,
        offers=offers,
    )

    # A manual source price was explicitly entered by the user, so the normal
    # >80% suspicious-change guard should not reject it. Scraped prices still
    # go through the full validation rule.
    validation = validate_price(
        price=current_price,
        previous_price=(
            None
            if best_offer.get("price_source") == "manual"
            else previous_price
        ),
    )

    if validation.status == PriceValidationStatus.INVALID:
        message = validation.message or "Invalid price"
        print(f"❌ {message}")
        return make_result(
            **common,
            status="failed",
            error=make_error("INVALID_PRICE", message),
        )

    if validation.status == PriceValidationStatus.SUSPICIOUS:
        message = validation.message or "Suspicious price"
        print(f"⚠️ Suspicious price: {current_price:.2f} {currency}")

        if validation.change_ratio is not None:
            print(f"⚠️ Price change: {validation.change_ratio * 100:.1f}%")

        print(f"⚠️ Reason: {message}")

        return make_result(
            **common,
            status="suspicious",
            error=make_error("SUSPICIOUS_PRICE", message),
        )

    (
        below_target,
        difference,
        unit_below_target,
        unit_difference,
    ) = print_target_status(
        current_price,
        target_price,
        current_unit_price,
        target_unit_price,
        comparison_quantity,
        unit,
        currency,
    )

    return make_result(
        **common,
        status="success",
        below_target=below_target,
        difference=difference,
        unit_below_target=unit_below_target,
        unit_difference=unit_difference,
    )


# ============================================================
# JSON / history
# ============================================================

def save_json(file_path: Path, data) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temp_file = file_path.with_suffix(file_path.suffix + ".tmp")

    try:
        with temp_file.open("w", encoding="utf-8", newline="\n") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())

        os.replace(temp_file, file_path)
    finally:
        temp_file.unlink(missing_ok=True)


def to_history_entry(result_data):
    """Reduce one accepted ScrapeResult dict to the compact history schema."""
    return PriceHistoryEntry(
        product_id=result_data["product_id"],
        current_price=result_data["current_price"],
        current_unit_price=result_data.get("current_unit_price"),
    ).model_dump(mode="json")


def merge_successful_history(period, generated_at, successful_results):
    """
    Upsert accepted prices into the compact history period.

    Failed/suspicious products keep their last accepted value in the current
    period; full scraper details remain only in latest.json.
    """
    history_file = HISTORY_DIR / f"{period}.json"
    existing_products = []

    if history_file.exists():
        try:
            with history_file.open("r", encoding="utf-8") as file:
                existing = PriceHistoryFile.model_validate(json.load(file))
                existing_products = [
                    item.model_dump(mode="json")
                    for item in existing.data
                ]
        except Exception:
            existing_products = []

    by_id = {
        item["product_id"]: item
        for item in existing_products
        if isinstance(item, dict) and "product_id" in item
    }

    for item in successful_results:
        history_entry = to_history_entry(item)
        by_id[history_entry["product_id"]] = history_entry

    return {
        "period": period,
        "generated_at": generated_at,
        "data": list(by_id.values()),
    }


def update_history_index(period):
    periods = []

    if HISTORY_INDEX_FILE.exists():
        try:
            with HISTORY_INDEX_FILE.open("r", encoding="utf-8") as file:
                periods = json.load(file).get("periods", [])
        except (OSError, json.JSONDecodeError, AttributeError):
            periods = []

    if period not in periods:
        periods.append(period)

    periods.sort(reverse=True)
    save_json(HISTORY_INDEX_FILE, {"periods": periods})


# ============================================================
# Run one product
# ============================================================

async def run_product(
    *,
    product,
    period,
    run_id,
    page,
    context,
    latest_results,
    successful_results,
    counts,
    notification_state,
    notification_events,
):
    product_id = product["id"]
    uses_scraper = product_uses_scraper(product)
    tracing = context is not None and uses_scraper

    if tracing:
        await context.tracing.start_chunk(title=f"Price check: {product['name']}")

    result = await check_product(page, product, period)
    serialized = result.model_dump(mode="json")

    # latest.json represents the latest ATTEMPT, not only successful prices.
    # This is what keeps suspicious/failed products visible in the frontend.
    latest_results.append(serialized)

    if result.status == "success":
        counts["successful"] += 1
        successful_results.append(serialized)

        if tracing:
            await context.tracing.stop_chunk()
    else:
        counts[result.status if result.status in counts else "failed"] += 1

        if tracing:
            debug_dir = get_debug_dir(
                debug_root=DEBUG_DIR,
                run_id=run_id,
                product_id=product_id,
            )

            await save_debug_artifacts(
                page=page,
                debug_dir=debug_dir,
                result=result,
            )
            await context.tracing.stop_chunk(path=debug_dir / "trace.zip")
            print(f"🐞 Debug artifacts: {debug_dir}")

        if result.status == "suspicious":
            print(f"⚠️ Suspicious result was NOT added to history: {result.name}")
        elif result.status == "failed":
            print(f"❌ Scrape failed: {result.name}")
        else:
            print(f"❓ Unknown result status ({result.status}): {result.name}")

    event = handle_product_notification(result, notification_state)

    if event is not None:
        notification_events.append(event)

    if uses_scraper:
        await asyncio.sleep(2)


# ============================================================
# Run products with / without browser
# ============================================================

async def run_products(
    *,
    products,
    period,
    run_id,
    latest_results,
    successful_results,
    counts,
    notification_state,
    notification_events,
):
    needs_browser = any(product_uses_scraper(product) for product in products)

    if not needs_browser:
        print("[SCRAPER] All configured sources are manual. Browser launch skipped.")

        for product in products:
            await run_product(
                product=product,
                period=period,
                run_id=run_id,
                page=None,
                context=None,
                latest_results=latest_results,
                successful_results=successful_results,
                counts=counts,
                notification_state=notification_state,
                notification_events=notification_events,
            )

        return

    async with async_playwright() as playwright:
        browser = await playwright.firefox.launch(headless=True)
        context = await browser.new_context(
            locale="sv-SE",
            timezone_id="Europe/Stockholm",
            viewport={"width": 1440, "height": 1000},
        )
        page = await context.new_page()

        await context.tracing.start(
            screenshots=True,
            snapshots=True,
            sources=True,
        )

        try:
            for product in products:
                await run_product(
                    product=product,
                    period=period,
                    run_id=run_id,
                    page=page,
                    context=context,
                    latest_results=latest_results,
                    successful_results=successful_results,
                    counts=counts,
                    notification_state=notification_state,
                    notification_events=notification_events,
                )
        finally:
            await context.tracing.stop()
            await browser.close()


# ============================================================
# Main
# ============================================================

async def main():
    if not PRODUCTS_FILE.exists():
        print(f"File not found: {PRODUCTS_FILE}")
        return

    with PRODUCTS_FILE.open("r", encoding="utf-8-sig") as file:
        products = json.load(file)

    notification_state = load_notification_state(NOTIFICATION_STATE_FILE)
    notification_events = []

    stockholm = ZoneInfo("Europe/Stockholm")
    started_at = datetime.now(stockholm)
    monday = (started_at - timedelta(days=started_at.weekday())).date()
    period = monday.isoformat()
    generated_at = started_at.isoformat()
    run_id = started_at.strftime("%Y-%m-%d_%H-%M-%S")

    print("\n" + "=" * 70)
    print("Price check started")
    print(f"Period: {period}")
    print(f"Time: {generated_at}")
    print("=" * 70)

    latest_results = []
    successful_results = []
    counts = {"successful": 0, "failed": 0, "suspicious": 0}

    await run_products(
        products=products,
        period=period,
        run_id=run_id,
        latest_results=latest_results,
        successful_results=successful_results,
        counts=counts,
        notification_state=notification_state,
        notification_events=notification_events,
    )

    finished_at = datetime.now(stockholm)
    run_metadata = build_run_metadata(
        run_id=run_id,
        started_at=started_at,
        finished_at=finished_at,
        total_products=len(products),
        successful=counts["successful"],
        failed=counts["failed"],
        suspicious=counts["suspicious"],
    )

    run_file = RUNS_DIR / f"{run_id}.json"
    run_data = run_metadata.model_dump(mode="json")
    save_json(run_file, run_data)
    save_json(RUN_LATEST_FILE, run_data)

    run_event = handle_run_notification(run_metadata, notification_state)

    if run_event is not None:
        notification_events.append(run_event)

    if notification_events:
        sent = send_summary_notification(notification_events)

        if sent:
            mark_notification_events_sent(
                notification_events,
                notification_state,
            )

    save_notification_state(
        NOTIFICATION_STATE_FILE,
        notification_state,
    )

    # latest.json must always reflect the latest ATTEMPT so failed/suspicious
    # products remain visible and reviewable instead of becoming "Not run yet".
    latest_output = {
        "period": period,
        "generated_at": generated_at,
        "data": latest_results,
    }
    save_json(LATEST_FILE, latest_output)

    history_file = HISTORY_DIR / f"{period}.json"

    if successful_results:
        history_output = merge_successful_history(
            period,
            generated_at,
            successful_results,
        )
        save_json(history_file, history_output)
        update_history_index(period)
    else:
        print("⚠️ No accepted prices were collected; history was left unchanged.")

    print("\n" + "=" * 70)
    print("Run completed")
    print("=" * 70)
    print(f"Status: {run_metadata.status.upper()}")
    print(f"Successful: {run_metadata.successful}")
    print(f"Suspicious: {run_metadata.suspicious}")
    print(f"Failed: {run_metadata.failed}")
    print(f"Total: {run_metadata.total_products}")
    print(f"Duration: {run_metadata.duration_seconds:.2f}s")
    print(f"Run metadata: {run_file}")
    print(f"Latest data: {LATEST_FILE}")
    print(
        f"History data: {history_file}"
        if successful_results
        else "History data: unchanged (no accepted prices)"
    )
    print(f"History index: {HISTORY_INDEX_FILE}")


if __name__ == "__main__":
    if not acquire_run_lock():
        print("⚠️ Another Price Watch scraper process is already running.")
        raise SystemExit(2)

    try:
        asyncio.run(main())
    finally:
        release_run_lock()