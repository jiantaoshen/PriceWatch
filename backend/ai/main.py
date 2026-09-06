import json
import os

from typing import Literal

import httpx

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from advisor import advisors
from prompt_builder import build_system_prompt


app = FastAPI()

OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://127.0.0.1:11434/api/chat",
)

MODEL_NAME = os.getenv(
    "OLLAMA_MODEL",
    "qwen3:4b",
)

MAX_RECENT_MESSAGES = 20


# ============================================================
# Models
# ============================================================

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class PricePoint(BaseModel):
    date: str
    price: float


class ProductContext(BaseModel):
    product_id: str
    name: str
    currency: str

    current_price: float | None = None
    target_price: float | None = None
    previous_price: float | None = None

    historical_low: float | None = None
    historical_high: float | None = None
    historical_average: float | None = None

    history: list[PricePoint] = Field(default_factory=list)


class ChatRequest(BaseModel):
    advisor_id: str
    products: list[ProductContext] = Field(default_factory=list)
    messages: list[Message] = Field(default_factory=list)


# ============================================================
# Health
# ============================================================

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "advisors": len(advisors),
    }


# ============================================================
# Advisors
# ============================================================

def get_public_advisor(advisor: dict) -> dict:
    return {
        "id": advisor["id"],
        "name": advisor["name"],
        "title": advisor["title"],
        "description": advisor["description"],
        "greeting": advisor["greeting"],
    }


@app.get("/advisors")
async def get_advisors():
    return [
        get_public_advisor(advisor)
        for advisor in advisors.values()
    ]


@app.get("/advisors/{advisor_id}")
async def get_advisor(advisor_id: str):
    advisor = advisors.get(advisor_id)

    if not advisor:
        raise HTTPException(
            status_code=404,
            detail="Advisor not found",
        )

    return get_public_advisor(advisor)


# ============================================================
# Temporary compatibility
#
# Remove these after ASP.NET and React have fully moved from
# "characters" to "advisors".
# ============================================================

@app.get("/characters", include_in_schema=False)
async def get_characters_legacy():
    return await get_advisors()


@app.get("/characters/{advisor_id}", include_in_schema=False)
async def get_character_legacy(advisor_id: str):
    return await get_advisor(advisor_id)


# ============================================================
# Conversation summary
# ============================================================

async def summarize_messages(messages: list[Message]) -> str:
    if not messages:
        return ""

    conversation_text = "\n".join(
        f"{message.role}: {message.content}"
        for message in messages
    )

    summary_prompt = f"""
Summarize the older part of this PriceWatch shopping conversation.

The summary is internal context for future messages.

Preserve only information that may matter later, including:

- Products the user discussed
- Products the user is considering buying
- Budget or price preferences
- How urgently the user needs an item
- Price thresholds mentioned by the user
- User preferences
- Important comparisons
- Decisions already made
- Reasons the user gave for buying or waiting
- Relevant previous advisor recommendations

Do not:

- Invent information
- Add prices that were not mentioned
- Add product facts that were not provided
- Preserve meaningless small talk
- Repeat the conversation line by line
- Make the summary unnecessarily long

Write a concise factual summary in English.

Conversation:

{conversation_text}
""".strip()

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You summarize shopping conversations for internal context. "
                    "Preserve only facts that appeared in the conversation. "
                    "Never invent information."
                ),
            },
            {
                "role": "user",
                "content": summary_prompt,
            },
        ],
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=None) as client:
        response = await client.post(
            OLLAMA_URL,
            json=payload,
        )

        response.raise_for_status()
        data = response.json()

    return (
        data
        .get("message", {})
        .get("content", "")
        .strip()
    )


# ============================================================
# Chat stream
# ============================================================

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    advisor = advisors.get(request.advisor_id)

    if not advisor:
        raise HTTPException(
            status_code=404,
            detail="Advisor not found",
        )

    products = [
        product.model_dump()
        for product in request.products
    ]

    system_prompt = build_system_prompt(
        advisor,
        products,
    )

    recent_messages = request.messages
    conversation_summary = ""

    if len(request.messages) > MAX_RECENT_MESSAGES:
        old_messages = request.messages[:-MAX_RECENT_MESSAGES]
        recent_messages = request.messages[-MAX_RECENT_MESSAGES:]

        conversation_summary = await summarize_messages(
            old_messages
        )

    async def generate():
        ollama_messages = [
            {
                "role": "system",
                "content": system_prompt,
            }
        ]

        if conversation_summary:
            ollama_messages.append(
                {
                    "role": "system",
                    "content": f"""
The following is an internal summary of the older conversation.

Treat it only as remembered conversation context.

Do not treat it as a source of current PriceWatch price data.

Current product prices must come from the PriceWatch Product Data section of the main system prompt.

Conversation Summary:

{conversation_summary}
""".strip(),
                }
            )

        ollama_messages.extend(
            {
                "role": message.role,
                "content": message.content,
            }
            for message in recent_messages
        )

        payload = {
            "model": MODEL_NAME,
            "messages": ollama_messages,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                OLLAMA_URL,
                json=payload,
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    content = (
                        data
                        .get("message", {})
                        .get("content", "")
                    )

                    if content:
                        yield content

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
    )
