import asyncio
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone

from playwright.async_api import Request, Route, async_playwright

from pricewatch.extractors import extract_price
from pricewatch.network_guard import PublicNetworkGuard, UnsafeNetworkTargetError


@dataclass
class Job:
    item_id: str
    source_id: int
    name: str
    store: str
    url: str


def _log(message: str):
    print(message, file=sys.stderr, flush=True)


def _load_request():
    payload_bytes = sys.stdin.buffer.read()

    if not payload_bytes:
        raise ValueError(
            "stdin JSON payload is empty"
        )

    # utf-8-sig accepts both:
    # - normal UTF-8
    # - UTF-8 with BOM
    payload = payload_bytes.decode(
        "utf-8-sig"
    )

    if not payload.strip():
        raise ValueError(
            "stdin JSON payload is empty"
        )

    data = json.loads(payload)

    jobs = [
        Job(**job)
        for job in data.get(
            "jobs",
            []
        )
    ]

    return (
        bool(
            data.get(
                "headless",
                True
            )
        ),
        jobs,
    )


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _blocked_result(job: Job):
    return {
        "item_id": job.item_id,
        "source_id": job.source_id,
        "ok": False,
        "price": None,
        "method": None,
        "final_url": None,
        "error": "Blocked unsafe network target.",
        "observed_at": _now_iso(),
    }


async def _run():
    headless, jobs = _load_request()
    results = []

    if not jobs:
        print(json.dumps({"results": []}))
        return

    network_guard = PublicNetworkGuard()

    async with async_playwright() as playwright:
        browser = await playwright.firefox.launch(headless=headless)
        context = await browser.new_context(
            locale="sv-SE",
            viewport={"width": 1440, "height": 1100},
        )

        try:
            page = await context.new_page()
            blocked_main_navigation = False

            async def guard_route(route: Route, request: Request):
                nonlocal blocked_main_navigation

                try:
                    # Re-resolve navigation targets on every navigation rather
                    # than trusting the short subresource DNS cache. This keeps
                    # redirect checks as close as possible to the actual request.
                    is_main_navigation = (
                        request.is_navigation_request()
                        and request.frame == page.main_frame
                    )

                    await network_guard.validate_url(
                        request.url,
                        use_cache=not is_main_navigation,
                    )
                except UnsafeNetworkTargetError:
                    if (
                        request.is_navigation_request()
                        and request.frame == page.main_frame
                    ):
                        blocked_main_navigation = True

                    _log("[security] blocked a non-public network request")
                    await route.abort("blockedbyclient")
                    return

                await route.continue_()

            # Guard every browser HTTP(S) request, not just page.goto(). This
            # covers redirects, iframes, XHR/fetch, scripts, images and other
            # subresources that could otherwise be used for SSRF into the LAN.
            await context.route(
                re.compile(r"^https?://", re.IGNORECASE),
                guard_route,
            )

            for job in jobs:
                _log(f"[{job.store}] {job.url}")
                blocked_main_navigation = False

                try:
                    # Preflight before the browser touches the target at all.
                    await network_guard.validate_url(
                        job.url,
                        use_cache=False,
                    )

                    await page.goto(
                        job.url,
                        wait_until="domcontentloaded",
                        timeout=60_000,
                    )

                    if blocked_main_navigation:
                        raise UnsafeNetworkTargetError(
                            "Unsafe redirect was blocked."
                        )

                    # Validate the committed URL as a second check after all
                    # server/browser redirects have completed.
                    await network_guard.validate_url(
                        page.url,
                        use_cache=False,
                    )

                    price = None
                    method = None

                    for attempt in range(4):
                        price, method = await extract_price(
                            page,
                            product_name=job.name,
                            product_url=job.url,
                        )

                        if price is not None:
                            break

                        if attempt < 3:
                            await page.wait_for_timeout(1000)

                    if price is None:
                        results.append({
                            "item_id": job.item_id,
                            "source_id": job.source_id,
                            "ok": False,
                            "price": None,
                            "method": None,
                            "final_url": page.url,
                            "error": "Could not extract a product price.",
                            "observed_at": _now_iso(),
                        })
                    else:
                        results.append({
                            "item_id": job.item_id,
                            "source_id": job.source_id,
                            "ok": True,
                            "price": price,
                            "method": method,
                            "final_url": page.url,
                            "error": None,
                            "observed_at": _now_iso(),
                        })
                except UnsafeNetworkTargetError:
                    results.append(_blocked_result(job))
                except Exception as error:
                    if blocked_main_navigation:
                        results.append(_blocked_result(job))
                    else:
                        results.append({
                            "item_id": job.item_id,
                            "source_id": job.source_id,
                            "ok": False,
                            "price": None,
                            "method": None,
                            "final_url": None,
                            "error": str(error),
                            "observed_at": _now_iso(),
                        })
        finally:
            await context.close()
            await browser.close()

    print(json.dumps({"results": results}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        asyncio.run(_run())
    except Exception as error:
        print(
            json.dumps({"error": str(error), "results": []}),
            file=sys.stdout,
        )
        _log(f"fatal: {error}")
        raise
