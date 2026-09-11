"""
File: main.py
Purpose:
    Exposes the production PriceWatch V10.3 AI HTTP API.
Main functions:
    - GET /health: runtime/provider information.
    - GET /advisors: public advisor metadata.
    - POST /recommend: one structured purchase judgment.
Inputs:
    Accepted product price data plus optional user decision context.
Outputs:
    Validated BUY/WAIT/NEUTRAL response with Python-rendered factual explanations.
"""

from fastapi import FastAPI, HTTPException

from advisor import ADVISORS, get_public_advisor
from ai_clients import create_ai_client
from models import RecommendationRequest, RecommendationResponse
from service import AIRecommendationError, InsufficientFactsError, RecommendationService
from settings import Settings


settings = Settings()
client = create_ai_client(settings)
service = RecommendationService(settings, client)

app = FastAPI(
    title="PriceWatch AI Advisor",
    version="10.3",
    description=(
        "Frozen V10.3 Dynamic Named Facts architecture. Python owns objective facts; "
        "Qwen owns BUY/WAIT/NEUTRAL, confidence and top driver selection."
    ),
)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": "V10.3",
        "provider": settings.provider,
        "local_model": settings.local_model if settings.provider == "local" else None,
        "cloud_run_url": settings.cloud_run_url if settings.provider == "cloud_run" else None,
        "advisors": len(ADVISORS),
    }


@app.get("/advisors")
async def get_advisors() -> list[dict]:
    return [get_public_advisor(advisor) for advisor in ADVISORS.values()]


@app.get("/advisors/{advisor_id}")
async def get_advisor(advisor_id: str) -> dict:
    advisor = ADVISORS.get(advisor_id)
    if advisor is None:
        raise HTTPException(status_code=404, detail="Advisor not found")
    return get_public_advisor(advisor)


@app.post("/recommend", response_model=RecommendationResponse)
async def recommend(request: RecommendationRequest) -> RecommendationResponse:
    try:
        return await service.recommend(request)
    except KeyError:
        raise HTTPException(status_code=404, detail="Advisor not found")
    except InsufficientFactsError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except AIRecommendationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        # Network/auth/provider errors are surfaced as a gateway failure rather than
        # silently changing the recommendation in Python.
        raise HTTPException(status_code=502, detail=f"AI provider request failed: {exc}") from exc


# Temporary metadata compatibility for older frontend code.
@app.get("/characters", include_in_schema=False)
async def get_characters_legacy() -> list[dict]:
    return await get_advisors()


@app.get("/characters/{advisor_id}", include_in_schema=False)
async def get_character_legacy(advisor_id: str) -> dict:
    return await get_advisor(advisor_id)
