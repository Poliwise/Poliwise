from typing import List, Optional
from pydantic import BaseModel
import json
import asyncio
import structlog

import google.generativeai as genai

from ...config.settings import settings

logger = structlog.get_logger()


class GatewayResult(BaseModel):
    action: str
    refined_query: str
    explanation: Optional[str] = None
    suggested_filters: Optional[dict] = None


class Message(BaseModel):
    role: str
    content: str


class InputGatewayService:
    def __init__(self):
        if settings.gateway_api_key and settings.gateway_enabled:
            genai.configure(api_key=settings.gateway_api_key)
            self.client = genai.GenerativeModel(settings.gateway_model)
            self.enabled = True
            logger.info("input_gateway_enabled", model=settings.gateway_model)
        else:
            self.enabled = False
            logger.warning("input_gateway_disabled", reason="no_api_key_or_disabled")

    async def process_input(
        self,
        user_input: str,
        history: List[dict] = None
    ) -> GatewayResult:
        if not self.enabled:
            return GatewayResult(
                action="forward",
                refined_query=user_input,
                explanation="Gateway disabled"
            )

        try:
            prompt = self._build_gateway_prompt(user_input, history)
            response = await self._generate_response_async(prompt)
            result = json.loads(response)

            logger.info("gateway_processed", action=result.get("action"), original=user_input[:50])

            return GatewayResult(
                action=result.get("action", "forward"),
                refined_query=result.get("refined_query", user_input),
                explanation=result.get("explanation"),
                suggested_filters=result.get("filters")
            )
        except Exception as e:
            logger.error("gateway_processing_failed", error=str(e))
            return GatewayResult(
                action="forward",
                refined_query=user_input,
                explanation=f"Gateway error: {str(e)}"
            )

    def _build_gateway_prompt(self, user_input: str, history: List[dict] = None) -> str:
        history_text = ""
        if history:
            recent = history[-5:] if len(history) > 5 else history
            history_text = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')[:100]}" for m in recent])
            history_text = f"\n\nRecent conversation:\n{history_text}\n"

        prompt = f"""You are an AI input gateway for Poliwise, a policy management platform.
Your job is to analyze user queries and decide how to handle them.

{history_text}
User's current question: {user_input}

Analyze the query and respond with ONLY a JSON object:
{{
  "action": "forward" | "reject" | "respond_directly",
  "refined_query": "improved search query (if needed)",
  "explanation": "brief reason for the decision",
  "filters": {{"key": "value"}} (optional metadata filters)
}}

Rules:
1. "forward" - Query needs RAG search to answer from knowledge base
2. "reject" - Query is toxic, harmful, or nonsense (e.g., spam, inappropriate content)
3. "respond_directly" - Query is general chitchat that doesn't need document search (e.g., greetings, thanks)

For "forward" action: Rewrite the query to be more effective for semantic search. Include any implicit context from conversation history.

Return ONLY the JSON, no other text."""

        return prompt

    async def _generate_response_async(self, prompt: str) -> str:
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(None, self.client.generate_content, prompt)
        return response.text


input_gateway_service = InputGatewayService()