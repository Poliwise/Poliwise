from typing import AsyncGenerator
import json

from .llm_client import llm_client, model_registry
from .prompt_builder import prompt_builder
from ...models.retrieval import RetrievalChunk


async def generate_stream(
    query: str,
    context_chunks: list[RetrievalChunk],
    history: list[dict],
    model_id: str = "default"
) -> AsyncGenerator[str, None]:
    messages = prompt_builder.build(
        query=query,
        context_chunks=context_chunks,
        history=history
    )

    async for content in llm_client.generate_streaming(
        messages=messages,
        model_id=model_id
    ):
        yield f"data: {json.dumps({'content': content})}\n\n"

    yield "data: [DONE]\n\n"