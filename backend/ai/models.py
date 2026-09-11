"""
File: models.py
Purpose:
    Defines the public request/response contracts for the V10.3 PriceWatch AI gateway.
Main functions:
    Pydantic validation for product, user context, model decision and API responses.
Inputs:
    Accepted PriceWatch product price data and optional user decision context.
Outputs:
    Strongly validated Python objects used by the fact layer and API.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Decision = Literal["BUY", "WAIT", "NEUTRAL"]
Confidence = Literal["low", "medium", "high"]
ContextLevel = Literal["low", "medium", "high", "unknown"]
Language = Literal["zh", "en"]


class PricePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    price: float = Field(gt=0)


class SimilarProduct(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    condition: str = "unknown"
    similarity: str = "unknown"


class ProductContext(BaseModel):
    """
    current_price MUST be an accepted PriceWatch price.
    Never pass a suspicious/unconfirmed candidate price here.
    """

    model_config = ConfigDict(extra="forbid")

    product_id: str
    name: str
    currency: str
    current_price: float = Field(gt=0)
    price_status: Literal["success", "accepted_history"] = "success"

    target_price: float | None = Field(default=None, gt=0)
    historical_low: float | None = Field(default=None, gt=0)
    historical_average: float | None = Field(default=None, gt=0)
    history: list[PricePoint] = Field(default_factory=list)

    # Current PriceWatch product fields accepted for transport compatibility.
    # They are intentionally NOT V10.3 decision factors until separately benchmarked.
    current_unit_price: float | None = Field(default=None, gt=0)
    target_unit_price: float | None = Field(default=None, gt=0)
    last_purchase_price: float | None = Field(default=None, gt=0)
    last_purchase_date: str | None = None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        value = value.strip().upper()
        if not value:
            raise ValueError("currency cannot be empty")
        return value


class UserContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    budget: float | None = Field(default=None, gt=0)
    urgency: ContextLevel = "unknown"
    replacement_need: ContextLevel = "unknown"
    price_sensitivity: ContextLevel = "unknown"
    owned_similar_products: list[SimilarProduct] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    advisor_id: str
    product: ProductContext
    user_context: UserContext = Field(default_factory=UserContext)
    language: Language = "zh"


class AdvisorDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: Decision
    confidence: Confidence
    drivers: list[str] = Field(min_length=1, max_length=3)


class DriverExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    label: str
    text: str


class UsageInfo(BaseModel):
    model_config = ConfigDict(extra="allow")

    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None


class RecommendationMeta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: str
    model: str | None = None
    attempts: int
    latency_ms: int
    finish_reason: str | None = None
    usage: UsageInfo | None = None


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    advisor_id: str
    advisor_name: str
    decision: Decision
    confidence: Confidence
    drivers: list[str]
    explanations: list[DriverExplanation]
    rendered_text: str
    meta: RecommendationMeta
