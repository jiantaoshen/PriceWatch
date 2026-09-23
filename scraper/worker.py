import asyncio
import json
import sys
from dataclasses import dataclass

from playwright.async_api import async_playwright

from pricewatch.extractors import extract_price


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


async def _run():
    headless, jobs = _load_request()
    results = []

    if not jobs:
        print(json.dumps({"results": []}))
        return

    async with async_playwright() as playwright:
        browser = await playwright.firefox.launch(headless=headless)
        context = await browser.new_context(
            locale="sv-SE",
            viewport={"width": 1440, "height": 1100},
        )

        try:
            page = await context.new_page()

            for job in jobs:
                _log(f"[{job.store}] {job.url}")

                try:
                    await page.goto(
                        job.url,
                        wait_until="domcontentloaded",
                        timeout=60_000,
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
                        })
                except Exception as error:
                    results.append({
                        "item_id": job.item_id,
                        "source_id": job.source_id,
                        "ok": False,
                        "price": None,
                        "method": None,
                        "final_url": None,
                        "error": str(error),
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
