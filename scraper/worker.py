"""Run the existing Playwright extractors once; accept jobs as stdin JSON."""
import asyncio
from datetime import datetime, timezone
import json
import re
import sys

from playwright.async_api import async_playwright
from pricewatch.extractors import extract_price
from pricewatch.network_guard import PublicNetworkGuard, UnsafeNetworkTargetError


def now():
    return datetime.now(timezone.utc).isoformat()


def failed(job, error):
    return {"item_id": job["item_id"], "source_id": job["source_id"],
            "ok": False, "price": None, "error": str(error)[:1000],
            "observed_at": now()}


async def run():
    payload = json.load(sys.stdin)
    jobs = payload.get("jobs", [])
    if not jobs:
        print(json.dumps({"results": []}))
        return
    guard = PublicNetworkGuard()
    results = []
    async with async_playwright() as playwright:
        browser = await playwright.firefox.launch(headless=payload.get("headless", True))
        context = await browser.new_context(locale="sv-SE", viewport={"width": 1440, "height": 1100})
        page = await context.new_page()
        blocked = False

        async def route_check(route, request):
            nonlocal blocked
            main = request.is_navigation_request() and request.frame == page.main_frame
            try:
                await guard.validate_url(request.url, use_cache=not main)
                await route.continue_()
            except UnsafeNetworkTargetError:
                if main:
                    blocked = True
                await route.abort("blockedbyclient")

        await context.route(re.compile(r"^https?://", re.I), route_check)
        try:
            for job in jobs:
                blocked = False
                print(f'[{job["store"]}] {job["url"]}', file=sys.stderr, flush=True)
                try:
                    await guard.validate_url(job["url"], use_cache=False)
                    await page.goto(job["url"], wait_until="domcontentloaded", timeout=60000)
                    if blocked:
                        raise UnsafeNetworkTargetError("Unsafe redirect blocked")
                    await guard.validate_url(page.url, use_cache=False)
                    price, method = None, None
                    for attempt in range(4):
                        price, method = await extract_price(page, job["name"], job["url"])
                        if price is not None:
                            break
                        if attempt < 3:
                            await page.wait_for_timeout(1000)
                    if price is None:
                        results.append(failed(job, "Could not extract product price"))
                    else:
                        results.append({"item_id": job["item_id"], "source_id": job["source_id"],
                                        "ok": True, "price": price, "method": method,
                                        "observed_at": now()})
                except Exception as exc:
                    results.append(failed(job, "Unsafe navigation" if blocked else exc))
        finally:
            await context.close()
            await browser.close()
    print(json.dumps({"results": results}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except Exception as error:
        print(json.dumps({"error": str(error)[:1000], "results": []}))
        print(f"fatal: {error}", file=sys.stderr)
        sys.exit(1)
