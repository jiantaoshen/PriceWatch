import re


def parse_price(value) -> float | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text:
        return None

    text = re.sub(r"[^\d.,\s]", "", text)
    text = text.replace(" ", "")

    if not text:
        return None

    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        decimal_part = text.split(",")[-1]
        text = text.replace(",", "." if len(decimal_part) == 2 else "")
    elif "." in text:
        decimal_part = text.split(".")[-1]
        if len(decimal_part) == 3:
            text = text.replace(".", "")

    try:
        return float(text)
    except ValueError:
        return None
