import json
from pydantic import BaseModel
from groq import AsyncGroq
import structlog
from typing import Any

logger = structlog.get_logger(__name__)

REFINEMENT_PROMPT = """You are an expert at improving questions for document retrieval.
The domain is "Poliwise", a policy management platform, and the documents are from the "GitLab Handbook".

Given the original question and conversation history (containing only document-lookup Q&A pairs), do the following:
1. De-contextualize: Rewrite the question so it is self-contained and understandable without conversation context.
2. Expand: Add related keywords to improve search recall (especially GitLab-specific terms if implied).
3. Clarify: Resolve any ambiguity in the question.

Conversation history (Layer 3 only):
{layer3_history}

Original question: {original_query}

Return JSON:
{{
  "refined_query": "the improved question",
  "search_keywords": ["keyword1", "keyword2"],
  "filters_hint": {{"date_range": null, "category": null}}
}}"""

class RefinedQuery(BaseModel):
    original: str
    refined: str
    keywords: list[str] = []
    filters_hint: dict[str, Any] = {}
    latency_ms: int = 0

class QueryRefiner:
    def __init__(self, groq_api_key: str, model: str = "llama-3.1-8b-instant"):
        self.client = AsyncGroq(api_key=groq_api_key)
        self.model = model

    def _format_layer3_history(self, layer3_history: list[Any]) -> str:
        if not layer3_history:
            return "None"
        formatted_messages = []
        for msg in layer3_history:
            role = getattr(msg, "role", "unknown")
            content = getattr(msg, "content", "")
            formatted_messages.append(f"{role.upper()}: {content}")
        return "\n".join(formatted_messages)

    async def refine(
        self,
        original_query: str,
        layer3_history: list[Any],  # Will type properly when integrated
    ) -> RefinedQuery:
        import time
        start_time = time.time()
        
        history_text = self._format_layer3_history(layer3_history)
        prompt = REFINEMENT_PROMPT.format(
            layer3_history=history_text,
            original_query=original_query
        )

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=256,
                temperature=0.0,
                response_format={"type": "json_object"},
            )
            latency_ms = int((time.time() - start_time) * 1000)

            data = json.loads(response.choices[0].message.content)
            return RefinedQuery(
                original=original_query,
                refined=data.get("refined_query", original_query),
                keywords=data.get("search_keywords", []),
                filters_hint=data.get("filters_hint", {}),
                latency_ms=latency_ms
            )
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"Query Refinement failed: {e}. Falling back to original query.")
            return RefinedQuery(
                original=original_query,
                refined=original_query,
                latency_ms=latency_ms
            )
