"""
File: quick_test.py
Purpose:
    Sends one realistic V10.3 test request to the local PriceWatch AI gateway.
Main functions:
    - main(): posts sample_request.json and prints the structured recommendation.
Inputs:
    --url and --advisor command-line arguments.
Outputs:
    JSON response including decision, drivers, latency and token usage.
"""

import argparse
import json
from pathlib import Path

import httpx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--advisor", choices=["cautious", "balanced", "hunter"], default="balanced")
    args = parser.parse_args()

    request_path = Path(__file__).with_name("sample_request.json")
    payload = json.loads(request_path.read_text(encoding="utf-8"))
    payload["advisor_id"] = args.advisor

    response = httpx.post(
        f"{args.url.rstrip('/')}/recommend",
        json=payload,
        timeout=300,
    )
    response.raise_for_status()
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
