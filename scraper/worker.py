"""Run Playwright price extraction with guarded browser traffic; jobs via stdin JSON."""
import asyncio
from datetime import datetime, timezone
import json
import re
import sys

from playwright.async_api import async_playwright
from pricewatch.extractors import extract_price
from pricewatch.network_guard import PublicNetworkGuard, UnsafeNetworkTargetError
from pricewatch.safe_routes import RequestBudget, guarded_route


def now():
    return datetime.now(timezone.utc).isoformat()


def failed(job, error):
    return {"item_id": job["item_id"], "source_id": job["source_id"],
            "ok": False, "price": None, "error": str(error)[:1000],
            "observed_at": now()}


async def scrape_job(browser, job):
    guard = PublicNetworkGuard()
    budget = RequestBudget()
    blocked = False
    context = await browser.new_context(
        locale="sv-SE",
        viewport={"width": 1440, "height": 1100},
        service_workers="block",  # Service Workers otherwise bypass route().
        accept_downloads=False,
    )
    try:
        # Register both interceptors before constructing any page.
        # Price extraction does not need WebSockets; block ALL ws/wss to avoid
        # a second network channel that HTTP routing cannot see.
        await context.route_web_socket(re.compile(r"^wss?://", re.I),
                                       lambda socket_route: socket_route.close(
                                           code=1008, reason="PriceWatch blocks WebSockets"))

        async def checked_route(route):
            nonlocal blocked
            request = route.request
            main = request.is_navigation_request()
            try:
                await guarded_route(route, guard, budget, context.request)
            except UnsafeNetworkTargetError as error:
                if main:
                    blocked = True
                print(f"Blocked unsafe browser request: {error}", file=sys.stderr, flush=True)
            except Exception as error:
                if main:
                    blocked = True
                print(f"Browser request failed: {type(error).__name__}", file=sys.stderr, flush=True)

        await context.route("**/*", checked_route)
        page = await context.new_page()
        page.on("popup", lambda popup: asyncio.create_task(popup.close()))
        await guard.validate_url(job["url"], use_cache=False)
        await page.goto(job["url"], wait_until="domcontentloaded", timeout=60000)
        if blocked:
            raise UnsafeNetworkTargetError("Unsafe navigation blocked")
        # The URL stays at the original address for manually fulfilled
        # redirects, but every response in the redirect chain was validated.
        await guard.validate_url(page.url, use_cache=False)
        price, method = None, None
        for attempt in range(4):
            price, method = await extract_price(page, job["name"], job["url"])
            if price is not None:
                break
            if attempt < 3:
                await page.wait_for_timeout(1000)
        if price is None:
            return failed(job, "Could not extract product price")
        return {"item_id": job["item_id"], "source_id": job["source_id"],
                "ok": True, "price": price, "method": method, "observed_at": now()}
    except Exception as error:
        return failed(job, "Unsafe navigation blocked" if blocked else error)
    finally:
        await context.close()


async def run():
    payload = json.load(sys.stdin)
    jobs = payload.get("jobs", [])
    if not jobs:
        print(json.dumps({"results": []}))
        return
    results = []
    async with async_playwright() as playwright:
        browser = await playwright.firefox.launch(
            headless=payload.get("headless", True),
            firefox_user_prefs={
                "media.peerconnection.enabled": False,  # WebRTC bypasses HTTP routing.
                "network.dns.disablePrefetch": True,
                "network.prefetch-next": False,
                "network.http.speculative-parallel-limit": 0,
            },
        )
        try:
            for job in jobs:
                print(f'[{job["store"]}] {job["url"]}', file=sys.stderr, flush=True)
                results.append(await scrape_job(browser, job))
        finally:
            await browser.close()
    print(json.dumps({"results": results}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except Exception as error:
        print(json.dumps({"error": str(error)[:1000], "results": []}))
        print(f"fatal: {error}", file=sys.stderr)
        sys.exit(1)
