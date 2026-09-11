"""
File: pricewatch/run.py
Purpose:
    Builds scraper run metadata. Archived products are excluded before this module
    is called, so total_products represents ACTIVE products only.

Main types/functions:
    - RunMetadata: persisted health/result metadata for one scraper execution.
    - build_run_metadata(...): derive success/degraded/failed and duration.

Inputs:
    Run timestamps plus active-product success/failed/suspicious counts.

Outputs:
    RunMetadata written by webscraping.py to data/runs/*.json.
    A run with zero active products is a clean success, not a scraper failure.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class RunMetadata(BaseModel):
    run_id: str

    started_at: datetime
    finished_at: datetime

    duration_seconds: float

    status: Literal[
        "success",
        "degraded",
        "failed",
    ]

    total_products: int
    successful: int
    failed: int
    suspicious: int


def build_run_metadata(
    *,
    run_id: str,
    started_at: datetime,
    finished_at: datetime,
    total_products: int,
    successful: int,
    failed: int,
    suspicious: int,
) -> RunMetadata:

    duration_seconds = (
        finished_at - started_at
    ).total_seconds()

    # Nothing is configured for active tracking. This is healthy, not failed.
    if total_products == 0:
        status = "success"

    # Active products existed, but none succeeded.
    elif successful == 0:
        status = "failed"

    # Everything succeeded cleanly.
    elif failed == 0 and suspicious == 0:
        status = "success"

    # At least one active product had a problem.
    else:
        status = "degraded"

    return RunMetadata(
        run_id=run_id,
        started_at=started_at,
        finished_at=finished_at,
        duration_seconds=round(
            duration_seconds,
            2,
        ),
        status=status,
        total_products=total_products,
        successful=successful,
        failed=failed,
        suspicious=suspicious,
    )
