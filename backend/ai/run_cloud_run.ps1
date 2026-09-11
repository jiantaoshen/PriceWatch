# File: run_cloud_run.ps1
# Purpose: Start the PriceWatch AI gateway using the private Google Cloud Run Qwen3-8B service.
$env:PRICEWATCH_AI_PROVIDER = "cloud_run"
if (-not $env:PRICEWATCH_AI_CLOUD_RUN_URL) {
    $env:PRICEWATCH_AI_CLOUD_RUN_URL = "https://pricewatch-ai-177025785357.europe-west4.run.app"
}
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
