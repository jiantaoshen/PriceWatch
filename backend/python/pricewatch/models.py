"""
File: pricewatch/models.py
Purpose:
    Defines the current JSON models used by PriceWatch. Latest scraper output and
    accepted historical price data deliberately use separate schemas so history
    remains a compact time series instead of duplicating the full scraper result.

Main models:
    - ScrapeError: structured scraper/review error shown for failed/suspicious runs.
    - Offer: one store offer from the latest scraper run.
    - ScrapeResult: full latest-state record for one product.
    - PriceHistoryEntry: compact accepted historical price observation.
    - PriceHistoryFile: one history period containing compact accepted observations.

Inputs:
    Values assembled by webscraping.py and user-confirmation API updates.

Outputs:
    ScrapeResult -> data/latest.json.
    PriceHistoryFile -> data/history/YYYY-MM-DD.json.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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

    # Audit information added when the API accepts a suspicious result.
    reviewed_by_user: bool = False
    review_method: Literal["confirmed", "manual"] | None = None
    reviewed_at: str | None = None


class PriceHistoryEntry(BaseModel):
    """
    One accepted price observation for a product.

    History intentionally stores only values required to reconstruct price
    trends/statistics. Product name, target, URL, offers and status belong to
    products.json or latest.json and are not duplicated here.
    """

    model_config = ConfigDict(extra="forbid")

    product_id: str
    current_price: float
    current_unit_price: float | None = None


class PriceHistoryFile(BaseModel):
    """Compact accepted-price snapshot for one PriceWatch history period."""

    model_config = ConfigDict(extra="forbid")

    period: str
    generated_at: str
    data: list[PriceHistoryEntry] = Field(default_factory=list)
