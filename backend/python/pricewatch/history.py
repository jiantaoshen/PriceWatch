"""
File: pricewatch/history.py
Purpose:
    Reads compact accepted price history. Historical records are matched only by
    stable product_id and contain only current_price/current_unit_price values.
    The current period remains eligible so a user-confirmed suspicious price can
    become the validation baseline for another run in the same period.

Main functions:
    - get_previous_value(...): return newest accepted numeric history field.
    - get_previous_price(...): return newest accepted total/comparison price.
    - get_previous_unit_price(...): return newest accepted unit price.

Inputs:
    data/history/*.json using the compact PriceHistoryFile schema, an ISO period,
    stable product ID, and the requested history field.

Outputs:
    float | None containing the newest accepted historical value.
"""

import json
from pathlib import Path

from pricewatch.models import PriceHistoryFile


# =============================================================
# Internal
# =============================================================


def _read_history(path: Path) -> PriceHistoryFile | None:
    try:
        with path.open("r", encoding="utf-8") as file:
            return PriceHistoryFile.model_validate(json.load(file))
    except Exception:
        return None


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

    The current-period file contains the last accepted observation from an
    earlier run in that period. webscraping.py writes the new observation only
    after the current run finishes, so this does not compare a run with itself.
    """
    if field not in {"current_price", "current_unit_price"}:
        raise ValueError(f"Unsupported history field: {field}")

    if not history_dir.exists():
        return None

    history_files: list[tuple[str, Path]] = []

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
        snapshot = _read_history(path)

        if snapshot is None:
            continue

        for product in snapshot.data:
            if product.product_id != product_id:
                continue

            value = getattr(product, field)
            if value is not None:
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
