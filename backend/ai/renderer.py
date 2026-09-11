"""
File: renderer.py
Purpose:
    Produces factual user-facing explanations from validated driver names.
Main functions:
    - build_explanations(): maps AI-selected driver names to Python-owned factual text.
    - render_answer(): creates a concise Chinese or English recommendation string.
Inputs:
    Advisor decision plus objective price/user facts.
Outputs:
    Driver explanations and final display text; no new AI-generated factual claims.
"""

from advisor import ADVISORS
from facts import FACTOR_LABELS_EN, FACTOR_LABELS_ZH
from models import AdvisorDecision, DriverExplanation, ProductContext


def format_money(value: float, currency: str) -> str:
    value = float(value)
    if value.is_integer():
        return f"{int(value)} {currency}"
    return f"{value:.2f} {currency}"


def _factor_fact_text_zh(factor: str, product: ProductContext, price_facts: dict, user_facts: dict) -> str:
    currency = product.currency
    current = float(product.current_price)

    if factor == "HIST_LOW":
        data = price_facts["current_vs_low"]
        if data["relation"] == "equal":
            return "当前价正好等于已记录历史低点"
        word = "高于" if data["relation"] == "above" else "低于"
        return f"当前价比已记录历史低点{word} {abs(data['percent']):.2f}%"

    if factor == "HIST_AVG":
        data = price_facts["current_vs_average"]
        if data["relation"] == "equal":
            return "当前价与历史平均价相同"
        word = "高于" if data["relation"] == "above" else "低于"
        return f"当前价比历史平均价{word} {abs(data['percent']):.2f}%"

    if factor == "TARGET":
        data = price_facts["current_vs_target"]
        if data["relation"] == "equal":
            return "当前价已经达到目标价"
        word = "高于" if data["relation"] == "above" else "低于"
        return f"当前价比目标价{word} {abs(data['percent']):.2f}%"

    if factor == "TREND":
        trend = price_facts["recent_trend"]
        if trend["direction"] == "downward":
            return f"近期已记录价格从 {format_money(trend['start_price'], currency)} 下降到 {format_money(trend['end_price'], currency)}"
        if trend["direction"] == "upward":
            return f"近期已记录价格从 {format_money(trend['start_price'], currency)} 上涨到 {format_money(trend['end_price'], currency)}"
        return "近期已记录价格整体持平"

    if factor == "BUDGET":
        budget = user_facts["budget"]
        data = budget["current_vs_budget"]
        if data["relation"] == "above":
            return f"当前价 {format_money(current, currency)} 比预算 {format_money(budget['budget'], currency)} 高 {format_money(abs(data['difference']), currency)}"
        if data["relation"] == "below":
            return f"当前价 {format_money(current, currency)} 在预算 {format_money(budget['budget'], currency)} 以内"
        return "当前价正好等于预算"

    if factor == "OWNED":
        if user_facts["good_similar_products"]:
            names = [item.get("name", "类似商品") for item in user_facts["good_similar_products"]]
            return "已有状态良好的类似商品：" + "、".join(names)
        if user_facts["broken_similar_products"]:
            names = [item.get("name", "类似商品") for item in user_facts["broken_similar_products"]]
            return "已有类似商品但无法正常使用：" + "、".join(names)
        return "已有类似商品，但状态不明确"

    if factor == "NEED":
        return {"high": "替换需求很高", "medium": "有一定替换需求", "low": "替换需求较低"}.get(user_facts["replacement_need"], "替换需求已提供")

    if factor == "URGENCY":
        return {"high": "购买紧急程度很高", "medium": "购买有一定紧迫性", "low": "目前并不急着购买"}.get(user_facts["urgency"], "购买紧迫度已提供")

    if factor == "SENSITIVITY":
        return {"high": "对价格比较敏感", "medium": "价格敏感度中等", "low": "对价格敏感度较低"}.get(user_facts["price_sensitivity"], "价格敏感度已提供")

    if factor == "CONTEXT":
        return "；".join(user_facts["notes"])

    return factor


def _factor_fact_text_en(factor: str, product: ProductContext, price_facts: dict, user_facts: dict) -> str:
    currency = product.currency
    current = float(product.current_price)

    if factor in {"HIST_LOW", "HIST_AVG", "TARGET"}:
        key = {"HIST_LOW": "current_vs_low", "HIST_AVG": "current_vs_average", "TARGET": "current_vs_target"}[factor]
        noun = {"HIST_LOW": "recorded historical low", "HIST_AVG": "historical average", "TARGET": "target price"}[factor]
        data = price_facts[key]
        if data["relation"] == "equal":
            return f"The current price equals the {noun}."
        relation_word = "above" if data["relation"] == "above" else "below"
        return f"The current price is {abs(data['percent']):.2f}% {relation_word} the {noun}."

    if factor == "TREND":
        trend = price_facts["recent_trend"]
        if trend["direction"] == "downward":
            return f"Recent recorded prices fell from {format_money(trend['start_price'], currency)} to {format_money(trend['end_price'], currency)}."
        if trend["direction"] == "upward":
            return f"Recent recorded prices rose from {format_money(trend['start_price'], currency)} to {format_money(trend['end_price'], currency)}."
        return "Recent recorded prices are broadly flat."

    if factor == "BUDGET":
        budget = user_facts["budget"]
        data = budget["current_vs_budget"]
        if data["relation"] == "above":
            return f"The current price is {format_money(abs(data['difference']), currency)} above the {format_money(budget['budget'], currency)} budget."
        if data["relation"] == "below":
            return f"The current price is within the {format_money(budget['budget'], currency)} budget."
        return "The current price exactly matches the budget."

    if factor == "OWNED":
        if user_facts["good_similar_products"]:
            names = [item.get("name", "similar product") for item in user_facts["good_similar_products"]]
            return "A working similar product is already owned: " + ", ".join(names)
        if user_facts["broken_similar_products"]:
            names = [item.get("name", "similar product") for item in user_facts["broken_similar_products"]]
            return "A similar product is owned but unusable: " + ", ".join(names)
        return "A similar product is owned, but its condition is unclear."

    if factor == "NEED":
        return {"high": "Replacement need is high.", "medium": "There is some replacement need.", "low": "Replacement need is low."}.get(user_facts["replacement_need"], "Replacement need was provided.")

    if factor == "URGENCY":
        return {"high": "Purchase urgency is high.", "medium": "There is some urgency.", "low": "The purchase is not urgent."}.get(user_facts["urgency"], "Urgency was provided.")

    if factor == "SENSITIVITY":
        return {"high": "The user is highly price-sensitive.", "medium": "Price sensitivity is medium.", "low": "Price sensitivity is low."}.get(user_facts["price_sensitivity"], "Price sensitivity was provided.")

    if factor == "CONTEXT":
        return "; ".join(user_facts["notes"])

    return factor


def build_explanations(
    decision: AdvisorDecision,
    product: ProductContext,
    price_facts: dict,
    user_facts: dict,
    language: str,
) -> list[DriverExplanation]:
    labels = FACTOR_LABELS_ZH if language == "zh" else FACTOR_LABELS_EN
    formatter = _factor_fact_text_zh if language == "zh" else _factor_fact_text_en
    return [
        DriverExplanation(code=factor, label=labels[factor], text=formatter(factor, product, price_facts, user_facts))
        for factor in decision.drivers
    ]


def render_answer(advisor_id: str, decision: AdvisorDecision, explanations: list[DriverExplanation], language: str) -> str:
    advisor = ADVISORS[advisor_id]

    if language == "zh":
        decision_label = {
            "BUY": "BUY｜可以买",
            "WAIT": "WAIT｜继续等",
            "NEUTRAL": "NEUTRAL｜暂时保持中立",
        }[decision.decision]
        lines = [
            decision_label,
            "",
            advisor["tone"][decision.decision],
            "",
            f"Confidence: {decision.confidence}",
            "",
            "AI 最看重的事实：",
        ]
        lines.extend(f"- {item.label}：{item.text}" for item in explanations)
        return "\n".join(lines)

    decision_label = {
        "BUY": "BUY",
        "WAIT": "WAIT",
        "NEUTRAL": "NEUTRAL",
    }[decision.decision]
    lines = [
        decision_label,
        "",
        advisor["tone_en"][decision.decision],
        "",
        f"Confidence: {decision.confidence}",
        "",
        "Most important facts:",
    ]
    lines.extend(f"- {item.label}: {item.text}" for item in explanations)
    return "\n".join(lines)
