from .json_ld import extract_json_ld_price
from .price_parser import parse_price


async def extract_price(page, product_name: str, product_url: str):
    price = await extract_json_ld_price(
        page,
        product_name=product_name,
        product_url=product_url,
    )

    if price is not None:
        return price, "json-ld"

    selectors = [
        'meta[itemprop="price"]',
        'meta[property="product:price:amount"]',
        'meta[property="og:price:amount"]',
    ]

    for selector in selectors:
        locator = page.locator(selector).first
        try:
            if await locator.count() == 0:
                continue
            value = await locator.get_attribute("content")
            parsed = parse_price(value)
            if parsed is not None:
                return parsed, "meta"
        except Exception:
            continue

    return None, None
