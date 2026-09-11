"""
File: direct_test.py
Purpose:
    Tests the V10.3 pipeline directly against local Ollama or Google Cloud Run without starting FastAPI.
Main functions:
    - run_one(): loads sample_request.json and executes the shared RecommendationService.
Inputs:
    --provider local|cloud_run and optional --advisor/--all-advisors.
Outputs:
    Structured recommendation JSON with latency and usage for quick provider comparison.
"""

import argparse
import asyncio
import json
from pathlib import Path

from advisor import ADVISOR_ORDER
from ai_clients import create_ai_client
from models import RecommendationRequest
from service import RecommendationService
from settings import Settings


async def run_one(provider: str, advisor_id: str) -> None:
    payload = json.loads(Path(__file__).with_name("sample_request.json").read_text(encoding="utf-8"))
    payload["advisor_id"] = advisor_id

    settings = Settings(provider=provider)
    client = create_ai_client(settings)
    service = RecommendationService(settings, client)
    request = RecommendationRequest.model_validate(payload)
    response = await service.recommend(request)

    print(f"\n=== {provider} / {advisor_id} ===")
    print(json.dumps(response.model_dump(), ensure_ascii=False, indent=2))


async def async_main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=["local", "cloud_run"], required=True)
    parser.add_argument("--advisor", choices=ADVISOR_ORDER, default="balanced")
    parser.add_argument("--all-advisors", action="store_true")
    args = parser.parse_args()

    advisors = ADVISOR_ORDER if args.all_advisors else [args.advisor]
    for advisor_id in advisors:
        await run_one(args.provider, advisor_id)


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
