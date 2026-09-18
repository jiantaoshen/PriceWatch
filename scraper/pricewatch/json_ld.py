import json
from .price_parser import parse_price


def _normalize_url(url):
    if not url:
        return None
    return str(url).strip().rstrip("/").lower()


def _normalize_text(value):
    if value is None:
        return None
    return str(value).strip().lower()


def _find_products(data):
    results = []

    if isinstance(data, list):
        for item in data:
            results.extend(_find_products(item))
    elif isinstance(data, dict):
        item_type = data.get("@type")

        if item_type == "Product" or (
            isinstance(item_type, list) and "Product" in item_type
        ):
            results.append(data)

        if "@graph" in data:
            results.extend(_find_products(data["@graph"]))

    return results


def _product_urls(product):
    urls = []

    if product.get("url"):
        urls.append(_normalize_url(product["url"]))

    offers = product.get("offers")
    offer_list = offers if isinstance(offers, list) else [offers]

    for offer in offer_list:
        if isinstance(offer, dict) and offer.get("url"):
            urls.append(_normalize_url(offer["url"]))

    return [url for url in urls if url]


def _offer_price(offer):
    if not isinstance(offer, dict):
        return None

    price = parse_price(offer.get("price"))
    if price is not None:
        return price

    specification = offer.get("priceSpecification")
    if isinstance(specification, dict):
        return parse_price(specification.get("price"))

    return None


async def extract_json_ld_price(page, product_name: str, product_url: str):
    products = []

    for script in await page.locator('script[type="application/ld+json"]').all():
        try:
            text = await script.text_content()
            if not text or not text.strip():
                continue
            products.extend(_find_products(json.loads(text)))
        except Exception:
            continue

    if not products:
        return None

    selected = None
    normalized_url = _normalize_url(product_url)

    if normalized_url:
        selected = next(
            (
                product
                for product in products
                if normalized_url in _product_urls(product)
            ),
            None,
        )

    if selected is None and normalized_url:
        for product in products:
            identifiers = [
                _normalize_text(product.get(field))
                for field in ("productID", "sku", "mpn")
            ]
            if any(identifier and identifier in normalized_url for identifier in identifiers):
                selected = product
                break

    if selected is None:
        target_name = _normalize_text(product_name)
        if target_name:
            for product in products:
                name = _normalize_text(product.get("name"))
                if name and (
                    name == target_name
                    or target_name in name
                    or name in target_name
                ):
                    selected = product
                    break

    if selected is None and len(products) == 1:
        selected = products[0]

    if selected is None:
        return None

    offers = selected.get("offers")
    offer_list = offers if isinstance(offers, list) else [offers]

    for offer in offer_list:
        price = _offer_price(offer)
        if price is not None:
            return price

    return None
