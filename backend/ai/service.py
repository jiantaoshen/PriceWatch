"""
File: service.py
Purpose:
    Orchestrates the complete V10.3 flow shared by local and Cloud Run providers.
Main functions:
    - RecommendationService.recommend(): facts -> prompt -> model -> validation -> renderer.
Inputs:
    RecommendationRequest plus a configured AI client.
Outputs:
    RecommendationResponse with validated AI judgment and Python-rendered factual explanations.
"""

import json

from advisor import ADVISORS
from ai_clients import AIClient, parse_json_content
from facts import build_dynamic_factors, build_price_facts, build_user_facts
from models import RecommendationMeta, RecommendationRequest, RecommendationResponse, UsageInfo
from prompt_builder import build_output_schema, build_system_prompt
from renderer import build_explanations, render_answer
from settings import Settings
from validator import DecisionValidationError, validate_decision


class InsufficientFactsError(ValueError):
    pass


class AIRecommendationError(RuntimeError):
    pass


class RecommendationService:
    def __init__(self, settings: Settings, client: AIClient):
        self.settings = settings
        self.client = client

    async def recommend(self, request: RecommendationRequest) -> RecommendationResponse:
        advisor = ADVISORS.get(request.advisor_id)
        if advisor is None:
            raise KeyError(request.advisor_id)

        price_facts = build_price_facts(request.product)
        user_facts = build_user_facts(request.product, request.user_context)
        factors = build_dynamic_factors(request.product, price_facts, user_facts)

        if not factors:
            raise InsufficientFactsError(
                "No V10.3 decision factors are available. Add accepted history, a target price, or user context."
            )

        available_factors = list(factors.keys())
        schema = build_output_schema(available_factors)
        prompt = build_system_prompt(
            advisor=advisor,
            product_name=request.product.name,
            current_price=float(request.product.current_price),
            currency=request.product.currency,
            factors=factors,
        )

        last_error: Exception | None = None
        total_latency_ms = 0
        completion = None
        decision = None
        attempts_used = 0

        for attempt in range(1, self.settings.max_attempts + 1):
            attempts_used = attempt
            try:
                completion = await self.client.complete(prompt, schema)
                total_latency_ms += completion.latency_ms
                parsed = parse_json_content(completion.content)
                decision = validate_decision(parsed, available_factors)
                break
            except (json.JSONDecodeError, DecisionValidationError, KeyError, ValueError) as exc:
                last_error = exc
                if attempt >= self.settings.max_attempts:
                    raise AIRecommendationError(
                        f"AI output was invalid after {attempt} attempt(s): {exc}"
                    ) from exc

        if completion is None or decision is None:
            raise AIRecommendationError(f"AI recommendation failed: {last_error}")

        explanations = build_explanations(
            decision=decision,
            product=request.product,
            price_facts=price_facts,
            user_facts=user_facts,
            language=request.language,
        )
        rendered_text = render_answer(
            advisor_id=request.advisor_id,
            decision=decision,
            explanations=explanations,
            language=request.language,
        )

        usage = UsageInfo.model_validate(completion.usage) if completion.usage else None

        return RecommendationResponse(
            advisor_id=request.advisor_id,
            advisor_name=advisor["name"],
            decision=decision.decision,
            confidence=decision.confidence,
            drivers=decision.drivers,
            explanations=explanations,
            rendered_text=rendered_text,
            meta=RecommendationMeta(
                provider=self.client.provider_name,
                model=completion.model,
                attempts=attempts_used,
                latency_ms=total_latency_ms,
                finish_reason=completion.finish_reason,
                usage=usage,
            ),
        )
