"""
File: tests/test_run.py
Purpose:
    Verifies scraper run-status metadata, including the archive-specific case
    where zero active products is a clean successful no-op rather than a failure.

Main functions/tests:
    - test_successful_run(): all active products succeeded.
    - test_degraded_run(): mixed success/failure/suspicious result.
    - test_failed_run(): active products ran but none succeeded.
    - test_zero_active_products_is_success(): all products archived / nothing to run.

Inputs:
    Synthetic run counts and timestamps passed to build_run_metadata().

Outputs:
    Assertions over RunMetadata status and duration fields.
"""

from datetime import datetime, timedelta

from backend.python.pricewatch.run import (
    build_run_metadata,
)


def test_successful_run():

    started = datetime(
        2026,
        8,
        24,
        8,
        0,
        0,
    )

    finished = (
        started
        + timedelta(seconds=30)
    )

    result = build_run_metadata(
        run_id="test-run",
        started_at=started,
        finished_at=finished,
        total_products=10,
        successful=10,
        failed=0,
        suspicious=0,
    )

    assert result.status == "success"
    assert result.duration_seconds == 30

def test_degraded_run():

    started = datetime(
        2026,
        8,
        24,
        8,
        0,
        0,
    )

    finished = (
        started
        + timedelta(seconds=30)
    )

    result = build_run_metadata(
        run_id="test-run",
        started_at=started,
        finished_at=finished,
        total_products=10,
        successful=8,
        failed=1,
        suspicious=1,
    )

    assert result.status == "degraded"

def test_failed_run():

    started = datetime(
        2026,
        8,
        24,
        8,
        0,
        0,
    )

    finished = (
        started
        + timedelta(seconds=30)
    )

    result = build_run_metadata(
        run_id="test-run",
        started_at=started,
        finished_at=finished,
        total_products=10,
        successful=0,
        failed=10,
        suspicious=0,
    )

    assert result.status == "failed"

def test_zero_active_products_is_success():

    started = datetime(2026, 9, 11, 8, 0, 0)
    finished = started + timedelta(seconds=1)

    result = build_run_metadata(
        run_id="archive-only-run",
        started_at=started,
        finished_at=finished,
        total_products=0,
        successful=0,
        failed=0,
        suspicious=0,
    )

    assert result.status == "success"
