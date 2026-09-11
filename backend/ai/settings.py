"""
File: settings.py
Purpose:
    Centralizes provider selection and runtime settings for local Ollama and Google Cloud Run.
Main functions:
    - Settings: loads PRICEWATCH_AI_* environment variables.
Inputs:
    Environment variables / optional .env file.
Outputs:
    Validated runtime configuration shared by API and provider clients.
"""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PRICEWATCH_AI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    provider: Literal["local", "cloud_run"] = "local"

    request_timeout_seconds: float = 300.0
    temperature: float = 0.12
    max_tokens: int = 90
    max_attempts: int = 2
    debug: bool = False

    local_url: str = "http://127.0.0.1:11434/api/chat"
    local_model: str = "qwen3:8b"
    local_keep_alive: str = "10m"

    cloud_run_url: str = "https://pricewatch-ai-177025785357.europe-west4.run.app"
    cloud_run_model: str | None = None
    cloud_run_auth: Literal["auto", "adc", "gcloud", "none"] = "auto"
    cloud_run_id_token: str | None = Field(default=None, repr=False)

    api_host: str = "127.0.0.1"
    api_port: int = 8000
