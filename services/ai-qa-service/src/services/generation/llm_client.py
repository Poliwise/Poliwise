"""LLM client - unified interface for chat routes to interact with model registry."""

import time
import structlog
from typing import List, Optional, AsyncGenerator

from ...config.settings import settings
from .model_registry import model_registry, ModelProfile, RateLimitError

logger = structlog.get_logger()


class LLMClient:
    """High-level LLM client used by chat routes."""

    def __init__(self):
        self.registry = model_registry

    async def generate(
        self,
        messages: List[dict],
        model_id: str = "default",
    ) -> tuple[str, int, int, int, int]:
        """Generate a completion.

        Returns:
            (content, prompt_tokens, completion_tokens, total_tokens, latency_ms)
        """
        if model_id == "default":
            model_id = settings.default_model_id

        profile = self.registry.get(model_id)
        if not profile:
            profile = self.registry.get(settings.default_model_id)

        if profile.status.value == "rate_limited":
            raise RateLimitError(f"Model {model_id} is rate limited")

        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=profile.api_key or "not-needed",
            base_url=profile.base_url,
        )

        start_time = time.time()
        try:
            response = await client.chat.completions.create(
                model=profile.model_name,
                messages=messages,
                temperature=0.3,
                max_tokens=1024,
            )
            latency_ms = int((time.time() - start_time) * 1000)
            usage = response.usage

            return (
                response.choices[0].message.content,
                usage.prompt_tokens if usage else 0,
                usage.completion_tokens if usage else 0,
                usage.total_tokens if usage else 0,
                latency_ms,
            )
        except Exception as e:
            logger.error("llm_generation_failed", error=str(e), model=profile.model_name)
            raise

    async def generate_streaming(
        self,
        messages: List[dict],
        model_id: str = "default",
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> AsyncGenerator[str, None]:
        """Stream a completion."""
        if model_id == "default":
            model_id = settings.default_model_id

        profile = self.registry.get(model_id)
        if not profile:
            profile = self.registry.get(settings.default_model_id)

        if profile.status.value == "rate_limited":
            raise RateLimitError(f"Model {model_id} is rate limited")

        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=profile.api_key or "not-needed",
            base_url=profile.base_url,
        )

        try:
            stream = await client.chat.completions.create(
                model=profile.model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            logger.error("llm_streaming_failed", error=str(e), model=profile.model_name)
            raise


llm_client = LLMClient()
