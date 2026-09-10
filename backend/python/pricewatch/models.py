"""
File: pricewatch/models.py
Purpose:
    Defines the JSON models emitted by the scraper for latest/history data.
    Suspicious and failed results can now remain visible in latest.json so the
    frontend can ask the user to review or manually supply a price.

Main models:
    - ScrapeError: structured scraper/review error.
    - Offer: one store offer, including normalized comparison price when available.
    - ScrapeResult: one product's latest scraper result and review metadata.

Inputs:
    Values assembled by webscraping.py and by user-confirmation API updates.

Outputs:
    Pydantic-validated objects serialized into data/latest.json and accepted
    history snapshots.
"""

from typing import Literal

from pydantic import BaseModel, Field


class ScrapeError(BaseModel):
    type: str
    message: str


class Offer(BaseModel):
    store: str
    url: str
    price: float

    price_source: Literal[
        "scrape",
        "manual",
    ] = "scrape"

    unit_quantity: float | None = None
    unit_price: float | None = None
    comparison_price: float | None = None
    note: str | None = None


class ScrapeResult(BaseModel):
    product_id: str
    name: str

    # Lowest total / normalized comparison-total winner.
    url: str
    store: str | None = None
    target_price: float
    current_price: float | None = None
    previous_price: float | None = None
    below_target: bool | None = None
    difference: float | None = None

    # Lowest unit-price winner. It may be a different source.
    unit: str | None = None
    unit_url: str | None = None
    unit_store: str | None = None
    target_unit_price: float | None = None
    current_unit_price: float | None = None
    previous_unit_price: float | None = None
    unit_below_target: bool | None = None
    unit_difference: float | None = None

    status: Literal[
        "success",
        "failed",
        "suspicious",
    ]

    currency: str = "SEK"
    offers: list[Offer] = Field(default_factory=list)
    error: ScrapeError | None = None

    # Optional audit information added when the API accepts a suspicious result.
    reviewed_by_user: bool = False
    review_method: Literal["confirmed", "manual"] | None = None
    reviewed_at: str | None = None
