"""
File: validator.py
Purpose:
    Validates V10.3 model output without becoming a second recommendation engine.
Main functions:
    - validate_decision(): schema-validates decision/confidence/drivers and driver availability.
Inputs:
    Parsed model JSON and currently available Dynamic Named Facts.
Outputs:
    Validated AdvisorDecision or a validation exception for retry/error handling.
"""

from pydantic import ValidationError

from models import AdvisorDecision


class DecisionValidationError(ValueError):
    pass


def validate_decision(raw: dict, available_factors: list[str]) -> AdvisorDecision:
    try:
        decision = AdvisorDecision.model_validate(raw)
    except ValidationError as exc:
        raise DecisionValidationError(str(exc)) from exc

    if len(decision.drivers) != len(set(decision.drivers)):
        raise DecisionValidationError("drivers contains duplicates")

    available = set(available_factors)
    unknown = [factor for factor in decision.drivers if factor not in available]
    if unknown:
        raise DecisionValidationError(f"Unknown/unavailable drivers: {unknown}")

    return decision
