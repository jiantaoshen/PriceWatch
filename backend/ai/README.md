# PriceWatch AI Advisor V10.3 — Local + Google Cloud Run

This folder replaces the old chat-style AI implementation with the latest **validated** PriceWatch Advisor architecture:

```text
Accepted PriceWatch data
        ↓
Python Fact Layer
        ↓
Dynamic Named Facts
        ↓
Qwen3-8B
        ↓
decision + confidence + top 1–3 drivers
        ↓
Python Validator
        ↓
Python Factual Renderer
```

## Important boundaries

- Python computes objective facts.
- Qwen decides `BUY / WAIT / NEUTRAL`, confidence, and the 1–3 most important available driver names.
- Python never replaces or overrides Qwen's final decision with a score/rule engine.
- AI never writes the factual price explanation; Python renders the selected facts.
- `current_price` must be an **accepted** PriceWatch price. `price_status` only accepts `success` or `accepted_history`; do **not** pass a Suspicious/Failed candidate price.
- Independent PriceWatch **Subscriptions are not analyzed here**.
- `last_purchase_price/date` and unit-price fields are accepted in the transport model but intentionally **not V10.3 decision factors yet**. Adding them to judgment requires a new benchmark.

## Two providers, one judgment pipeline

The same API and V10.3 logic can use either:

1. `local` — local Ollama + `qwen3:8b`
2. `cloud_run` — the existing private Google Cloud Run Qwen3-8B / llama.cpp endpoint

Only the transport changes. Facts, prompt, schema, validator and renderer are shared.

---

## Install

From this `ai` folder:

```powershell
uv sync
```

## Local Ollama

Install/pull the model first:

```powershell
ollama pull qwen3:8b
```

Start:

```powershell
.\run_local.ps1
```

Or copy `.env.local.example` to `.env` and run:

```powershell
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

## Google Cloud Run

The service URL is already set to the Qwen service used by the V10.3 benchmarks:

```text
https://pricewatch-ai-177025785357.europe-west4.run.app
```

For local Windows development, make sure `gcloud auth login` is already configured and your account can invoke the private Cloud Run service. The client first tries Google Application Default Credentials/service identity and then falls back to:

```powershell
gcloud auth print-identity-token
```

Start:

```powershell
.\run_cloud_run.ps1
```

When this gateway itself runs on Google Cloud, `google-auth` can obtain an audience-bound ID token from the attached service identity/metadata environment. Grant that identity `roles/run.invoker` on the Qwen service.

## Test

### Direct provider test (fastest)

No FastAPI gateway is required for this test:

```powershell
uv run python direct_test.py --provider local --advisor balanced
uv run python direct_test.py --provider cloud_run --advisor balanced
uv run python direct_test.py --provider cloud_run --all-advisors
```

This is the easiest way to verify that exactly the same V10.3 pipeline works against both providers.

### HTTP gateway test

With the gateway running:

```powershell
uv run python quick_test.py --advisor balanced
uv run python quick_test.py --advisor cautious
uv run python quick_test.py --advisor hunter
```

OpenAPI UI:

```text
http://127.0.0.1:8000/docs
```

Primary endpoint:

```text
POST /recommend
```

Example response:

```json
{
  "advisor_id": "balanced",
  "advisor_name": "Balanced",
  "decision": "BUY",
  "confidence": "medium",
  "drivers": ["NEED", "URGENCY", "BUDGET"],
  "explanations": [
    {
      "code": "NEED",
      "label": "替换需求",
      "text": "替换需求很高"
    }
  ],
  "rendered_text": "BUY｜可以买\n...",
  "meta": {
    "provider": "cloud_run",
    "model": "Qwen3-8B Q4_K_M",
    "attempts": 1,
    "latency_ms": 7100,
    "finish_reason": "stop",
    "usage": {
      "input_tokens": 640,
      "output_tokens": 35,
      "total_tokens": 675
    }
  }
}
```

## Why `/chat/stream` is gone

The old implementation treated the model as a free-form shopping chatbot and streamed natural-language analysis. V10.3 deliberately no longer does that. Output is short structured JSON, so streaming adds complexity without value and would allow the model to restate factual prices incorrectly.

The public advisor metadata endpoints remain, including temporary `/characters` aliases, but product judgment should move to `/recommend`.
