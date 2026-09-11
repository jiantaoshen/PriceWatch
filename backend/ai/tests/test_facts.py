"""
File: tests/test_facts.py
Purpose: Regression tests for the Python fact layer and dynamic factor availability.
Inputs: Deterministic product/user fixtures.
Outputs: unittest pass/fail results.
"""

import unittest

from facts import build_dynamic_factors, build_price_facts, build_user_facts
from models import ProductContext, UserContext


class FactTests(unittest.TestCase):
    def setUp(self):
        self.product = ProductContext.model_validate({
            "product_id": "p1",
            "name": "Test",
            "currency": "SEK",
            "current_price": 90,
            "target_price": 95,
            "historical_low": 80,
            "historical_average": 100,
            "history": [
                {"date": "1", "price": 110},
                {"date": "2", "price": 100},
                {"date": "3", "price": 90},
            ],
        })

    def test_price_relations(self):
        facts = build_price_facts(self.product)
        self.assertEqual(facts["current_vs_low"]["relation"], "above")
        self.assertEqual(facts["current_vs_average"]["relation"], "below")
        self.assertEqual(facts["current_vs_target"]["relation"], "below")
        self.assertEqual(facts["recent_trend"]["direction"], "downward")

    def test_dynamic_factors_only_available(self):
        user = UserContext()
        pf = build_price_facts(self.product)
        uf = build_user_facts(self.product, user)
        factors = build_dynamic_factors(self.product, pf, uf)
        self.assertEqual(list(factors), ["HIST_LOW", "HIST_AVG", "TARGET", "TREND"])

    def test_budget_and_owned_factors(self):
        user = UserContext.model_validate({
            "budget": 85,
            "urgency": "low",
            "replacement_need": "low",
            "price_sensitivity": "high",
            "owned_similar_products": [
                {"name": "Old", "condition": "good", "similarity": "high"}
            ],
            "notes": ["Optional purchase"],
        })
        pf = build_price_facts(self.product)
        uf = build_user_facts(self.product, user)
        factors = build_dynamic_factors(self.product, pf, uf)
        for code in ["BUDGET", "OWNED", "NEED", "URGENCY", "SENSITIVITY", "CONTEXT"]:
            self.assertIn(code, factors)

    def test_history_can_supply_low_and_average(self):
        product = ProductContext.model_validate({
            "product_id": "p2",
            "name": "History Only",
            "currency": "SEK",
            "current_price": 90,
            "history": [
                {"date": "1", "price": 120},
                {"date": "2", "price": 100},
                {"date": "3", "price": 90}
            ]
        })
        facts = build_price_facts(product)
        self.assertEqual(facts["current_vs_low"]["relation"], "equal")
        self.assertAlmostEqual(facts["current_vs_average"]["reference"], 103.33, places=2)


if __name__ == "__main__":
    unittest.main()
