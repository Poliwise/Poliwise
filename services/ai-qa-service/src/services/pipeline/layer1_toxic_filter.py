from pydantic import BaseModel
import structlog
from groq import AsyncGroq

logger = structlog.get_logger(__name__)

class ToxicFilterResult(BaseModel):
    is_toxic: bool
    label: str
    latency_ms: int = 0
    error: str | None = None

class ToxicFilterService:
    """
    Uses llama-prompt-guard-2-86m — an 86M-param model specialized for prompt safety.
    Very lightweight, low latency, minimal Groq RPD usage.
    Output label: BENIGN or JAILBREAK / INJECTION (toxic).
    """

    TOXIC_LABELS = {"JAILBREAK", "INJECTION"}

    def __init__(self, groq_api_key: str, model: str = "meta-llama/llama-prompt-guard-2-86m", fail_open: bool = True):
        self.client = AsyncGroq(api_key=groq_api_key)
        self.model = model
        self.fail_open = fail_open

    async def check(self, user_input: str) -> ToxicFilterResult:
        import time
        start_time = time.time()
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": user_input}],
                max_tokens=10,  # Only need a short label
            )
            latency_ms = int((time.time() - start_time) * 1000)
            label = response.choices[0].message.content.strip().upper()
            is_toxic = any(toxic in label for toxic in self.TOXIC_LABELS)

            return ToxicFilterResult(
                is_toxic=is_toxic,
                label=label,
                latency_ms=latency_ms,
            )
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.warning(f"Layer 1 toxic filter failed: {e}. Failing open is set to {self.fail_open}.")
            # If Layer 1 fails -> fail open (allow through) if configured
            is_toxic = False if self.fail_open else True
            return ToxicFilterResult(is_toxic=is_toxic, label="ERROR", error=str(e), latency_ms=latency_ms)
