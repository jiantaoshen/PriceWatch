"""
File: ai_clients.py
Purpose:
    Provides interchangeable local Ollama and private Google Cloud Run Qwen transports.
Main functions:
    - LocalOllamaClient.complete(): calls Ollama structured-output chat API.
    - CloudRunQwenClient.complete(): calls the deployed OpenAI-compatible llama.cpp endpoint.
    - create_ai_client(): selects provider from Settings.
Inputs:
    V10.3 system prompt and dynamic JSON schema.
Outputs:
    Raw parsed model response metadata for the validator/service layer.
"""

import asyncio
import json
import shutil
import subprocess
import time
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from settings import Settings


@dataclass
class AICompletion:
    content: str
    finish_reason: str | None
    latency_ms: int
    usage: dict[str, Any] | None
    model: str | None
    raw: dict[str, Any]


class AIClient(Protocol):
    provider_name: str

    async def complete(self, system_prompt: str, output_schema: dict) -> AICompletion:
        ...


class LocalOllamaClient:
    provider_name = "local"

    def __init__(self, settings: Settings):
        self.settings = settings

    async def complete(self, system_prompt: str, output_schema: dict) -> AICompletion:
        payload = {
            "model": self.settings.local_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Make the PriceWatch purchase judgment. /no_think"},
            ],
            "stream": False,
            "format": output_schema,
            "think": False,
            "keep_alive": self.settings.local_keep_alive,
            "options": {
                "temperature": self.settings.temperature,
                "num_predict": self.settings.max_tokens,
            },
        }

        started = time.perf_counter()
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(self.settings.local_url, json=payload)
            response.raise_for_status()
            raw = response.json()
        latency_ms = int((time.perf_counter() - started) * 1000)

        content = raw.get("message", {}).get("content", "")
        input_tokens = raw.get("prompt_eval_count")
        output_tokens = raw.get("eval_count")
        total_tokens = None
        if isinstance(input_tokens, int) and isinstance(output_tokens, int):
            total_tokens = input_tokens + output_tokens

        usage = {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "total_duration_ns": raw.get("total_duration"),
            "load_duration_ns": raw.get("load_duration"),
        }

        return AICompletion(
            content=content,
            finish_reason=raw.get("done_reason"),
            latency_ms=latency_ms,
            usage=usage,
            model=raw.get("model") or self.settings.local_model,
            raw=raw,
        )


class CloudRunTokenProvider:
    """Fetches and briefly caches a Google-signed Cloud Run identity token."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._cached_token: str | None = None
        self._cached_until = 0.0

    async def get_token(self) -> str | None:
        if self.settings.cloud_run_auth == "none":
            return None
        if self.settings.cloud_run_id_token:
            return self.settings.cloud_run_id_token
        if self._cached_token and time.monotonic() < self._cached_until:
            return self._cached_token

        token = await asyncio.to_thread(self._fetch_token_sync)
        self._cached_token = token
        # Google ID tokens are normally valid for about one hour. Cache for 45 minutes.
        self._cached_until = time.monotonic() + 45 * 60
        return token

    def _fetch_token_sync(self) -> str:
        auth_mode = self.settings.cloud_run_auth
        errors: list[str] = []

        if auth_mode in {"auto", "adc"}:
            try:
                import google.auth.transport.requests
                import google.oauth2.id_token

                request = google.auth.transport.requests.Request()
                return google.oauth2.id_token.fetch_id_token(
                    request,
                    self.settings.cloud_run_url.rstrip("/"),
                )
            except Exception as exc:  # noqa: BLE001 - fallback is intentional
                errors.append(f"ADC identity token failed: {exc}")
                if auth_mode == "adc":
                    raise RuntimeError(errors[-1]) from exc

        if auth_mode in {"auto", "gcloud"}:
            gcloud = shutil.which("gcloud.cmd") or shutil.which("gcloud")
            if not gcloud:
                errors.append("gcloud CLI was not found in PATH")
            else:
                try:
                    result = subprocess.run(
                        [gcloud, "auth", "print-identity-token"],
                        capture_output=True,
                        text=True,
                        check=True,
                    )
                    token = result.stdout.strip()
                    if token:
                        return token
                    errors.append("gcloud returned an empty identity token")
                except Exception as exc:  # noqa: BLE001
                    errors.append(f"gcloud identity token failed: {exc}")

        raise RuntimeError("Unable to acquire Cloud Run identity token. " + " | ".join(errors))


class CloudRunQwenClient:
    provider_name = "cloud_run"

    def __init__(self, settings: Settings):
        self.settings = settings
        self.token_provider = CloudRunTokenProvider(settings)

    async def complete(self, system_prompt: str, output_schema: dict) -> AICompletion:
        payload: dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Make the PriceWatch purchase judgment. /no_think"},
            ],
            "temperature": self.settings.temperature,
            "max_tokens": self.settings.max_tokens,
            "response_format": {
                "type": "json_object",
                "schema": output_schema,
            },
        }
        if self.settings.cloud_run_model:
            payload["model"] = self.settings.cloud_run_model

        token = await self.token_provider.get_token()
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        endpoint = f"{self.settings.cloud_run_url.rstrip('/')}/v1/chat/completions"
        started = time.perf_counter()
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()
            raw = response.json()
        latency_ms = int((time.perf_counter() - started) * 1000)

        choice = raw["choices"][0]
        content = choice["message"]["content"]
        usage_raw = raw.get("usage") or {}
        usage = {
            "input_tokens": usage_raw.get("prompt_tokens"),
            "output_tokens": usage_raw.get("completion_tokens"),
            "total_tokens": usage_raw.get("total_tokens"),
        }

        return AICompletion(
            content=content,
            finish_reason=choice.get("finish_reason"),
            latency_ms=latency_ms,
            usage=usage,
            model=raw.get("model") or self.settings.cloud_run_model or "Qwen3-8B Q4_K_M",
            raw=raw,
        )


def create_ai_client(settings: Settings) -> AIClient:
    if settings.provider == "local":
        return LocalOllamaClient(settings)
    if settings.provider == "cloud_run":
        return CloudRunQwenClient(settings)
    raise ValueError(f"Unsupported provider: {settings.provider}")


def parse_json_content(content: str) -> dict:
    """Parse model JSON without trying to repair or reinterpret its decision."""
    return json.loads(content)
