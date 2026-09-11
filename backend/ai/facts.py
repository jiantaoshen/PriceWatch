"""
File: facts.py
Purpose:
    Implements the Python-owned objective fact layer for PriceWatch V10.3.
Main functions:
    - build_price_facts(): computes price relationships and recent trend.
    - build_user_facts(): normalizes budget/need/owned-product context.
    - build_dynamic_factors(): emits only factors that are actually available.
Inputs:
    Validated ProductContext and UserContext objects.
Outputs:
    Objective facts and Dynamic Named Facts sent to Qwen.
"""

from statistics import mean

from models import ProductContext, UserContext


FACTOR_LABELS_ZH = {
    "HIST_LOW": "历史低价位置",
    "HIST_AVG": "历史平均价位置",
    "TARGET": "目标价位置",
    "TREND": "近期价格趋势",
    "BUDGET": "预算情况",
    "OWNED": "已有类似商品",
    "NEED": "替换需求",
    "URGENCY": "购买紧迫度",
    "SENSITIVITY": "价格敏感度",
    "CONTEXT": "其他现实情况",
}

FACTOR_LABELS_EN = {
    "HIST_LOW": "Historical low position",
    "HIST_AVG": "Historical average position",
    "TARGET": "Target price position",
    "TREND": "Recent price trend",
    "BUDGET": "Budget",
    "OWNED": "Existing similar product",
    "NEED": "Replacement need",
    "URGENCY": "Purchase urgency",
    "SENSITIVITY": "Price sensitivity",
    "CONTEXT": "Other real-life context",
}

CANONICAL_FACTOR_ORDER = [
    "HIST_LOW",
    "HIST_AVG",
    "TARGET",
    "TREND",
    "BUDGET",
    "OWNED",
    "NEED",
    "URGENCY",
    "SENSITIVITY",
    "CONTEXT",
]


def relation(current: float, reference: float) -> str:
    if current < reference:
        return "below"
    if current > reference:
        return "above"
    return "equal"


def signed_difference(current: float, reference: float) -> float:
    return round(current - reference, 2)


def percent_difference(current: float, reference: float) -> float:
    if reference == 0:
        return 0.0
    return round(((current - reference) / reference) * 100, 2)


def calculate_recent_trend(history: list[dict], max_points: int = 6) -> dict:
    recent = history[-max_points:]
    if len(recent) < 2:
        return {
            "direction": "insufficient",
            "change": 0.0,
            "start_price": None,
            "end_price": None,
            "sample_size": len(recent),
        }

    start_price = float(recent[0]["price"])
    end_price = float(recent[-1]["price"])
    change = round(end_price - start_price, 2)

    if change < 0:
        direction = "downward"
    elif change > 0:
        direction = "upward"
    else:
        direction = "flat"

    return {
        "direction": direction,
        "change": change,
        "start_price": start_price,
        "end_price": end_price,
        "sample_size": len(recent),
    }


def _history_prices(product: ProductContext) -> list[float]:
    return [float(item.price) for item in product.history]


def _resolve_historical_low(product: ProductContext) -> float | None:
    if product.historical_low is not None:
        return float(product.historical_low)
    prices = _history_prices(product)
    if not prices:
        return None
    return min(prices + [float(product.current_price)])


def _resolve_historical_average(product: ProductContext) -> float | None:
    if product.historical_average is not None:
        return float(product.historical_average)
    prices = _history_prices(product)
    if not prices:
        return None
    # Avoid double-counting the current price when the newest accepted history point
    # already equals current_price.
    if abs(prices[-1] - float(product.current_price)) > 1e-9:
        prices = prices + [float(product.current_price)]
    return round(mean(prices), 2)


def build_price_facts(product: ProductContext) -> dict:
    current = float(product.current_price)
    facts: dict = {
        "current_price": current,
        "history_sample_size": len(product.history),
        "recent_trend": calculate_recent_trend(
            [item.model_dump() for item in product.history]
        ),
    }

    low = _resolve_historical_low(product)
    if low is not None:
        facts["current_vs_low"] = {
            "relation": relation(current, low),
            "difference": signed_difference(current, low),
            "percent": percent_difference(current, low),
            "reference": low,
        }

    average = _resolve_historical_average(product)
    if average is not None:
        facts["current_vs_average"] = {
            "relation": relation(current, average),
            "difference": signed_difference(current, average),
            "percent": percent_difference(current, average),
            "reference": average,
        }

    if product.target_price is not None:
        target = float(product.target_price)
        facts["current_vs_target"] = {
            "relation": relation(current, target),
            "difference": signed_difference(current, target),
            "percent": percent_difference(current, target),
            "reference": target,
        }

    return facts


def build_user_facts(product: ProductContext, user_context: UserContext) -> dict:
    current_price = float(product.current_price)

    if user_context.budget is None:
        budget_fact = {"known": False, "budget": None, "current_vs_budget": None}
    else:
        budget = float(user_context.budget)
        budget_fact = {
            "known": True,
            "budget": budget,
            "current_vs_budget": {
                "relation": relation(current_price, budget),
                "difference": signed_difference(current_price, budget),
                "percent": percent_difference(current_price, budget),
            },
        }

    owned = [item.model_dump() for item in user_context.owned_similar_products]
    good_similar: list[dict] = []
    broken_similar: list[dict] = []
    unknown_similar: list[dict] = []

    for item in owned:
        similarity = item.get("similarity", "unknown").lower()
        if similarity not in {"high", "very_high"}:
            continue

        condition = item.get("condition", "unknown").lower()
        if condition in {"good", "excellent", "working"}:
            good_similar.append(item)
        elif condition in {"broken", "unusable"}:
            broken_similar.append(item)
        else:
            unknown_similar.append(item)

    return {
        "budget": budget_fact,
        "urgency": user_context.urgency,
        "replacement_need": user_context.replacement_need,
        "price_sensitivity": user_context.price_sensitivity,
        "owned_similar_products": owned,
        "good_similar_products": good_similar,
        "broken_similar_products": broken_similar,
        "unknown_similar_products": unknown_similar,
        "notes": [note.strip() for note in user_context.notes if note.strip()],
    }


def build_dynamic_factors(
    product: ProductContext,
    price_facts: dict,
    user_facts: dict,
) -> dict:
    factors: dict = {}

    low = price_facts.get("current_vs_low")
    if low is not None:
        factors["HIST_LOW"] = {
            "state": f"{low['relation']}_observed_low",
            "gap_pct": low["percent"],
            "observed_low": low["reference"],
        }

    avg = price_facts.get("current_vs_average")
    if avg is not None:
        factors["HIST_AVG"] = {
            "state": f"{avg['relation']}_average",
            "gap_pct": avg["percent"],
            "average": avg["reference"],
        }

    target = price_facts.get("current_vs_target")
    if target is not None:
        factors["TARGET"] = {
            "state": f"{target['relation']}_target",
            "gap_pct": target["percent"],
            "target": target["reference"],
        }

    trend = price_facts["recent_trend"]
    if trend["direction"] != "insufficient":
        factors["TREND"] = {
            "state": trend["direction"],
            "from": trend["start_price"],
            "to": trend["end_price"],
            "change": trend["change"],
        }

    budget = user_facts["budget"]
    if budget["known"]:
        current_vs_budget = budget["current_vs_budget"]
        factors["BUDGET"] = {
            "state": f"{current_vs_budget['relation']}_budget",
            "budget": budget["budget"],
            "gap": current_vs_budget["difference"],
            "gap_pct": current_vs_budget["percent"],
        }

    good = user_facts["good_similar_products"]
    broken = user_facts["broken_similar_products"]
    unknown = user_facts["unknown_similar_products"]

    if good:
        factors["OWNED"] = {
            "state": "working_similar_product",
            "products": [item.get("name", "similar product") for item in good],
        }
    elif broken:
        factors["OWNED"] = {
            "state": "broken_similar_product",
            "products": [item.get("name", "similar product") for item in broken],
        }
    elif unknown:
        factors["OWNED"] = {
            "state": "similar_product_unknown_condition",
            "products": [item.get("name", "similar product") for item in unknown],
        }

    if user_facts["replacement_need"] != "unknown":
        factors["NEED"] = {"state": user_facts["replacement_need"]}

    if user_facts["urgency"] != "unknown":
        factors["URGENCY"] = {"state": user_facts["urgency"]}

    if user_facts["price_sensitivity"] != "unknown":
        factors["SENSITIVITY"] = {"state": user_facts["price_sensitivity"]}

    if user_facts["notes"]:
        factors["CONTEXT"] = {"notes": user_facts["notes"]}

    return {
        factor: factors[factor]
        for factor in CANONICAL_FACTOR_ORDER
        if factor in factors
    }
