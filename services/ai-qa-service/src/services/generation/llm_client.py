from openai import AsyncOpenAI
from typing import Optional, Dict, Any, AsyncGenerator
import time
import structlog
from pydantic import BaseModel

from ...config.settings import settings

logger = structlog.get_logger()


class ModelProfile(BaseModel):
    id: str
    name: str
    provider: str
    model_name: str
    base_url: str
    api_key: Optional[str]
    is_default: bool = False


class ModelRegistry:
    def __init__(self):
        # Default profile (Your Local Model)
        self.default_profile = ModelProfile(
            id="default",
            name=f"Local LLM ({settings.local_model_name})",
            provider="local",
            model_name=settings.local_model_name,
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key or "local-no-key",
            is_default=True
        )

        # Groq Cloud profile (Hardcoded model name)
        self.groq_profile = ModelProfile(
            id="groq",
            name="Llama 3.3 70B (Groq Cloud)",
            provider="groq",
            model_name=settings.groq_model_name,  # Hardcoded in settings
            base_url="https://api.groq.com/openai/v1",
            api_key=settings.llm_api_key,
            is_default=False
        )

        # MiniMax M2.5 profile (via OpenRouter)
        self.minimax_profile = ModelProfile(
            id="minimax",
            name="MiniMax M2.5 (OpenRouter)",
            provider="openrouter",
            model_name="minimax/minimax-01",
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.llm_api_key,  # Reusing LLM_API_KEY for now
            is_default=False
        )

        self.profiles: Dict[str, ModelProfile] = {
            "default": self.default_profile,
            "groq": self.groq_profile,
            "minimax": self.minimax_profile
        }

    def get_profile(self, model_id: str = "default") -> ModelProfile:
        return self.profiles.get(model_id, self.default_profile)

    def list_models(self):
        return [p for p in self.profiles.values()]


model_registry = ModelRegistry()


class LLMClient:
    def __init__(self):
        self.registry = model_registry

    async def generate(
        self,
        messages: list[Dict[str, str]],
        model_id: str = "default",
        temperature: float = 0.3,
        max_tokens: int = 1024
    ) -> tuple[str, int, int, int, int]:
        profile = self.registry.get_profile(model_id)

        if not profile.api_key:
            raise ValueError(f"API key not configured for model {model_id}")

        client = AsyncOpenAI(
            api_key=profile.api_key,
            base_url=profile.base_url
        )

        start_time = time.time()

        response = await client.chat.completions.create(
            model=profile.model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        latency_ms = int((time.time() - start_time) * 1000)
        content = response.choices[0].message.content
        usage = response.usage

        return (
            content,
            usage.prompt_tokens if usage else 0,
            usage.completion_tokens if usage else 0,
            usage.total_tokens if usage else 0,
            latency_ms
        )

    async def generate_streaming(
        self,
        messages: list[Dict[str, str]],
        model_id: str = "default",
        temperature: float = 0.3,
        max_tokens: int = 1024
    ) -> AsyncGenerator[str, None]:
        profile = self.registry.get_profile(model_id)

        if not profile.api_key:
            raise ValueError(f"API key not configured for model {model_id}")

        client = AsyncOpenAI(
            api_key=profile.api_key,
            base_url=profile.base_url
        )

        async for chunk in client.chat.completions.create(
            model=profile.model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True
        ):
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


llm_client = LLMClient()