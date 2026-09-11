"""
File: tests/test_validator.py
Purpose: Regression tests for the V10.3 output validator.
Inputs: Synthetic AI JSON.
Outputs: unittest pass/fail results.
"""

import unittest

from validator import DecisionValidationError, validate_decision


class ValidatorTests(unittest.TestCase):
    def test_valid(self):
        result = validate_decision(
            {"decision": "WAIT", "confidence": "medium", "drivers": ["TARGET", "TREND"]},
            ["TARGET", "TREND"],
        )
        self.assertEqual(result.decision, "WAIT")

    def test_unknown_driver_rejected(self):
        with self.assertRaises(DecisionValidationError):
            validate_decision(
                {"decision": "WAIT", "confidence": "medium", "drivers": ["MADE_UP"]},
                ["TARGET"],
            )

    def test_duplicate_driver_rejected(self):
        with self.assertRaises(DecisionValidationError):
            validate_decision(
                {"decision": "BUY", "confidence": "high", "drivers": ["TARGET", "TARGET"]},
                ["TARGET"],
            )


if __name__ == "__main__":
    unittest.main()
