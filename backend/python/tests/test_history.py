"""
File: tests/test_history.py
Purpose:
    Verifies accepted price lookup, including current-period baselines created by
    repeated runs or user confirmation, and legacy name-only history fallback.

Main tests:
    Previous accepted price, current-period baseline, missing data, ID mismatch,
    and old history records without product_id.

Inputs:
    Temporary JSON history files.

Outputs:
    Pytest assertions for get_previous_price().
"""

import json

from backend.python.pricewatch.history import (
    get_previous_price,
)


def write_json(
    file_path,
    data,
):

    file_path.write_text(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def test_previous_price_found(
    tmp_path,
):

    history_dir = (
        tmp_path
        / "history"
    )

    history_dir.mkdir()

    # ---------------------------------------------------------
    # index.json
    # ---------------------------------------------------------

    write_json(
        history_dir
        / "index.json",
        {
            "periods": [
                "2026-08-17",
            ]
        },
    )

    # ---------------------------------------------------------
    # Previous week's data
    # ---------------------------------------------------------

    write_json(
        history_dir
        / "2026-08-17.json",
        {
            "data": [
                {
                    "product_id": (
                        "sony-xm6"
                    ),
                    "current_price": 3490,
                }
            ]
        },
    )

    price = get_previous_price(
        history_dir=history_dir,
        current_period="2026-08-24",
        product_id="sony-xm6",
    )

    assert price == 3490.0


def test_current_period_is_used_as_latest_accepted_baseline(
    tmp_path,
):

    history_dir = (
        tmp_path
        / "history"
    )

    history_dir.mkdir()

    # ---------------------------------------------------------
    # Current period + previous period
    # ---------------------------------------------------------

    write_json(
        history_dir
        / "index.json",
        {
            "periods": [
                "2026-08-24",
                "2026-08-17",
            ]
        },
    )

    # Current period
    write_json(
        history_dir
        / "2026-08-24.json",
        {
            "data": [
                {
                    "product_id": (
                        "sony-xm6"
                    ),
                    "current_price": 2999,
                }
            ]
        },
    )

    # Previous period
    write_json(
        history_dir
        / "2026-08-17.json",
        {
            "data": [
                {
                    "product_id": (
                        "sony-xm6"
                    ),
                    "current_price": 3490,
                }
            ]
        },
    )

    price = get_previous_price(
        history_dir=history_dir,
        current_period="2026-08-24",
        product_id="sony-xm6",
    )

    # Current-period history is the last accepted snapshot from an earlier run.
    # It must be the validation baseline so a user-confirmed price remains trusted
    # during another scraper run in the same week.
    assert price == 2999.0


def test_missing_history_returns_none(
    tmp_path,
):

    history_dir = (
        tmp_path
        / "history"
    )

    history_dir.mkdir()

    price = get_previous_price(
        history_dir=history_dir,
        current_period="2026-08-24",
        product_id="sony-xm6",
    )

    assert price is None


def test_product_not_found_returns_none(
    tmp_path,
):

    history_dir = (
        tmp_path
        / "history"
    )

    history_dir.mkdir()

    write_json(
        history_dir
        / "index.json",
        {
            "periods": [
                "2026-08-17",
            ]
        },
    )

    write_json(
        history_dir
        / "2026-08-17.json",
        {
            "data": [
                {
                    "product_id": (
                        "different-product"
                    ),
                    "current_price": 999,
                }
            ]
        },
    )

    price = get_previous_price(
        history_dir=history_dir,
        current_period="2026-08-24",
        product_id="sony-xm6",
    )

    assert price is None


def test_old_history_without_product_id_uses_name(
    tmp_path,
):

    history_dir = (
        tmp_path
        / "history"
    )

    history_dir.mkdir()

    write_json(
        history_dir
        / "index.json",
        {
            "periods": [
                "2026-08-17",
            ]
        },
    )

    # Simulate an old history file from before
    # product_id was introduced.
    write_json(
        history_dir
        / "2026-08-17.json",
        {
            "data": [
                {
                    "name": "Sony WH-1000XM6",
                    "current_price": 3490,
                }
            ]
        },
    )

    price = get_previous_price(
        history_dir=history_dir,
        current_period="2026-08-24",
        product_id=(
            "Sony WH-1000XM6"
        ),
    )

    assert price == 3490.0