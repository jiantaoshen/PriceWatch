"""
File: pricewatch/history.py
Purpose:
    Reads previously accepted price snapshots from data/history. The current
    period is intentionally eligible so a user-confirmed suspicious price can
    become the validation baseline for the next scraper run in the same week.

Main functions:
    - get_previous_value(...): returns the newest accepted numeric field for one product.
    - get_previous_price(...): returns the newest accepted total/comparison price.
    - get_previous_unit_price(...): returns the newest accepted unit price.

Inputs:
    History directory, current ISO period, product ID, and field name.

Outputs:
    float | None. Suspicious/failed latest results are never written to history,
    so values returned here are accepted/successful price points only.
"""

import json
from pathlib import Path


# =============================================================
# Internal
# =============================================================


def _read_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return None


def _matches_product(product: dict, product_id: str) -> bool:
    """Match current IDs and old history entries that only stored name."""
    stored_id = product.get("product_id")

    if stored_id is not None:
        return stored_id == product_id

    return product.get("name") == product_id


# =============================================================
# Previous accepted value
# =============================================================


def get_previous_value(
    history_dir: Path,
    current_period: str,
    product_id: str,
    field: str,
) -> float | None:
    """
    Return the newest accepted value up to and including current_period.

    The current period file represents the last accepted snapshot from an
    earlier run in that period. webscraping.py writes the new period snapshot
    only after the current run has finished, so using it here does not compare
    a product against itself.
    """
    if not history_dir.exists():
        return None

    history_files = []

    for path in history_dir.glob("*.json"):
        if path.name == "index.json":
            continue

        period = path.stem

        # Never use future history. Current-period history is allowed because
        # it contains the last accepted result from a previous run.
        if period > current_period:
            continue

        history_files.append((period, path))

    history_files.sort(key=lambda item: item[0], reverse=True)

    for _, path in history_files:
        data = _read_json(path)

        if not isinstance(data, dict):
            continue

        products = data.get("data")

        if not isinstance(products, list):
            continue

        for product in products:
            if not isinstance(product, dict):
                continue

            if not _matches_product(product, product_id):
                continue

            value = product.get(field)

            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return float(value)

    return None


# =============================================================
# Total price
# =============================================================


def get_previous_price(
    history_dir: Path,
    current_period: str,
    product_id: str,
) -> float | None:
    return get_previous_value(
        history_dir=history_dir,
        current_period=current_period,
        product_id=product_id,
        field="current_price",
    )


# =============================================================
# Unit price
# =============================================================


def get_previous_unit_price(
    history_dir: Path,
    current_period: str,
    product_id: str,
) -> float | None:
    return get_previous_value(
        history_dir=history_dir,
        current_period=current_period,
        product_id=product_id,
        field="current_unit_price",
    )
