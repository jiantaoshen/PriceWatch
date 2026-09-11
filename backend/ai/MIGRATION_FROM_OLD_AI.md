# Migration from the old PriceWatch AI code

## Old behavior

The uploaded legacy code used:

- `qwen3:4b`
- free-form chat history
- conversation summarization
- raw price/history data in the prompt
- streamed natural-language AI analysis
- AI-generated factual explanations

Primary endpoint:

```text
POST /chat/stream
```

## New V10.3 behavior

The new code uses:

- `qwen3:8b` locally by default
- the existing Google Cloud Run Qwen3-8B service in cloud mode
- Python objective Fact Layer
- Dynamic Named Facts only
- AI output restricted to:
  - `decision`
  - `confidence`
  - `drivers`
- Python validation
- Python factual rendering
- no factor weights
- no directional impact labels
- no Python BUY/WAIT scoring

Primary endpoint:

```text
POST /recommend
```

## Conversation handling

The old message-history summarizer is intentionally removed from the production recommendation path.

V10.3 works best when the PriceWatch backend sends explicit structured user context:

```json
{
  "budget": 4500,
  "urgency": "high",
  "replacement_need": "high",
  "price_sensitivity": "medium",
  "owned_similar_products": [],
  "notes": ["User has a long flight tomorrow."]
}
```

Free text that matters to the purchase can be passed as `notes`. It becomes the `CONTEXT` Dynamic Named Fact.

## Existing UI metadata compatibility

These aliases are kept temporarily:

```text
GET /characters
GET /characters/{advisor_id}
```

They return the same metadata as `/advisors`.

The old `/chat/stream` endpoint is not retained because its free-form AI text contract conflicts with V10.3's factual safety boundary.
