"""
File: tests/test_service.py
Purpose: Ensures both providers can share one V10.3 orchestration path via a fake client.
Inputs: Synthetic request and fake structured model completion.
Outputs: unittest pass/fail results for judgment validation and factual rendering.
"""

import json
import unittest

from ai_clients import AICompletion
from models import RecommendationRequest
from service import RecommendationService
from settings import Settings


class FakeClient:
    provider_name = "fake"

    async def complete(self, system_prompt: str, output_schema: dict) -> AICompletion:
        return AICompletion(
            content=json.dumps({
                "decision": "BUY",
                "confidence": "medium",
                "drivers": ["NEED", "URGENCY"],
            }),
            finish_reason="stop",
            latency_ms=12,
            usage={"input_tokens": 100, "output_tokens": 20, "total_tokens": 120},
            model="fake-qwen",
            raw={},
        )


class ServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_recommendation_pipeline(self):
        request = RecommendationRequest.model_validate({
            "advisor_id": "balanced",
            "language": "zh",
            "product": {
                "product_id": "p1",
                "name": "Headphones",
                "currency": "SEK",
                "current_price": 3990,
                "target_price": 3690,
                "historical_low": 3490,
                "historical_average": 4290,
                "history": [
                    {"date": "1", "price": 4190},
                    {"date": "2", "price": 3990}
                ]
            },
            "user_context": {
                "urgency": "high",
                "replacement_need": "high"
            }
        })
        service = RecommendationService(Settings(), FakeClient())
        response = await service.recommend(request)
        self.assertEqual(response.decision, "BUY")
        self.assertEqual(response.drivers, ["NEED", "URGENCY"])
        self.assertIn("替换需求很高", response.rendered_text)
        self.assertEqual(response.meta.usage.total_tokens, 120)


if __name__ == "__main__":
    unittest.main()
