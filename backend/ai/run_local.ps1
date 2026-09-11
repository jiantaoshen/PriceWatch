# File: run_local.ps1
# Purpose: Start the PriceWatch AI gateway using local Ollama/Qwen3-8B.
$env:PRICEWATCH_AI_PROVIDER = "local"
if (-not $env:PRICEWATCH_AI_LOCAL_MODEL) { $env:PRICEWATCH_AI_LOCAL_MODEL = "qwen3:8b" }
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
