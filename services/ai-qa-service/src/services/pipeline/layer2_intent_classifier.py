from pydantic import BaseModel
from groq import AsyncGroq
import structlog

logger = structlog.get_logger(__name__)

INTENT_CLASSIFICATION_PROMPT = """You are an intent classifier. Analyze the following question and assign it to exactly one of two categories:

[SIMPLE]: Questions that do not require searching specialized documents. Includes:
  - Greetings and small talk (hello, how are you, thank you...)
  - Simple calculations (2+2, basic percentage math...)
  - Common general knowledge questions unrelated to internal documents
  - Requests to explain basic concepts that need no specialized context
  - Questions any ordinary person could answer immediately

[COMPLEX]: Questions that require looking up documents, policies, regulations, or internal data. Includes:
  - Questions about specific policies, procedures, or regulations
  - Questions about internal documentation
  - Questions requiring analysis, comparison, or synthesis
  - Any question that needs a document source to answer accurately

Question: {query}

Recent conversation history (if any):
{recent_history}

Return exactly one label: [SIMPLE] or [COMPLEX]"""

class IntentResult(BaseModel):
    intent: str
    raw_label: str
    latency_ms: int = 0

class IntentClassifierService:
    def __init__(self, groq_api_key: str, model: str = "llama-3.1-8b-instant", max_tokens: int = 10):
        self.client = AsyncGroq(api_key=groq_api_key)
        self.model = model
        self.max_tokens = max_tokens

    def _format_history(self, recent_history: list[str] | None) -> str:
        if not recent_history:
            return "None"
        return "\n".join(recent_history)

    async def classify(
        self,
        query: str,
        recent_history: list[str] | None = None  # Context-awareness only, not Layer 3 history
    ) -> IntentResult:
        import time
        start_time = time.time()
        
        history_text = self._format_history(recent_history)

        prompt = INTENT_CLASSIFICATION_PROMPT.format(
            query=query,
            recent_history=history_text
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=self.max_tokens,
                temperature=0.0,  # Deterministic
            )
            latency_ms = int((time.time() - start_time) * 1000)

            label_text = response.choices[0].message.content.strip().upper()
            intent = "COMPLEX" if "COMPLEX" in label_text else "SIMPLE"

            return IntentResult(intent=intent, raw_label=label_text, latency_ms=latency_ms)
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Layer 2 intent classifier failed: {e}. Defaulting to COMPLEX.")
            return IntentResult(intent="COMPLEX", raw_label="ERROR", latency_ms=latency_ms)
