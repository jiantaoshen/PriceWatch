"""
File: prompt_builder.py
Purpose:
    Builds the frozen compact V10.3 prompt and its dynamic JSON output schema.
Main functions:
    - build_output_schema(): restricts drivers to currently available Dynamic Named Facts.
    - build_system_prompt(): creates the compact advisor judgment prompt.
Inputs:
    Frozen advisor config, product identity/current price, and Python-owned facts.
Outputs:
    JSON schema and system prompt sent to either local Ollama or Cloud Run Qwen.
"""

import json


def build_output_schema(available_factors: list[str]) -> dict:
    if not available_factors:
        raise ValueError("At least one decision factor is required.")

    return {
        "type": "object",
        "properties": {
            "decision": {
                "type": "string",
                "enum": ["BUY", "WAIT", "NEUTRAL"],
            },
            "confidence": {
                "type": "string",
                "enum": ["low", "medium", "high"],
            },
            "drivers": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": available_factors,
                },
                "minItems": 1,
                "maxItems": min(3, len(available_factors)),
            },
        },
        "required": ["decision", "confidence", "drivers"],
        "additionalProperties": False,
    }


def build_system_prompt(advisor: dict, product_name: str, current_price: float, currency: str, factors: dict) -> str:
    available = list(factors.keys())
    compact_context = {
        "product": product_name,
        "current": current_price,
        "currency": currency,
        "facts": factors,
    }
    guidance = "\n".join(f"- {item}" for item in advisor["guidance"])

    return f"""
You are {advisor["name"]}, PriceWatch's {advisor["title"]}.

Personality:
{advisor["personality"]}

Guidance:
{guidance}

Choose BUY, WAIT, or NEUTRAL.

Also select 1 to 3 driver names: the supplied facts that mattered most to your final judgment.

Rules:
- PriceWatch supplied facts are authoritative.
- Never recalculate, reverse, or contradict a supplied factual state.
- drivers are FACT NAMES only. Do not label them BUY/WAIT and do not explain them.
- Use only supplied driver names. Never invent missing facts or circumstances.
- Your personality should materially affect which supplied facts matter most.
- Practical need may outweigh an imperfect price.
- A strong price does not automatically justify an unnecessary purchase.
- Target price is a user preference, not a future-price prediction.
- If important considerations genuinely conflict and neither side clearly dominates, choose NEUTRAL.
- Confidence:
  high = little meaningful conflict
  medium = meaningful counterpressure but a clear lean
  low = highly ambiguous or limited evidence
- Output JSON only.

Allowed drivers:
{json.dumps(available, ensure_ascii=False, separators=(",", ":"))}

CONTEXT:
{json.dumps(compact_context, ensure_ascii=False, separators=(",", ":"))}
""".strip()
