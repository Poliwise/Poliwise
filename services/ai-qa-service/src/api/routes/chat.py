from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, List
from datetime import datetime
import json
import asyncio
import time
import structlog

logger = structlog.get_logger()

from ..dependencies import get_user_context, UserContext
from ..dependencies.rate_limit import rate_limit
from ...services.conversation.manager import conversation_service
from ...services.input_processing.gateway import input_gateway_service
from ...services.retrieval.hybrid_search import hybrid_search_service
from ...services.retrieval.reranker import reranker_service
from ...services.generation.llm_client import llm_client
from ...services.generation.prompt_builder import prompt_builder
from ...services.knowledge_gap import knowledge_gap_detector
from ...db.repositories.message_repo import message_repository
from ...models.retrieval import RetrievalFilters, RetrievalChunk
from ...config.settings import settings

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatContext(BaseModel):
    document_ids: Optional[List[UUID]] = None
    category_ids: Optional[List[UUID]] = None


class ChatRequest(BaseModel):
    message: str = Field(..., alias="question")
    conversation_id: Optional[UUID] = Field(None, alias="conversationId")
    model_id: str = "default"
    context: Optional[ChatContext] = None

    model_config = {
        "populate_by_name": True
    }


class SourceDocument(BaseModel):
    document_id: UUID
    document_name: str
    relevance_score: float
    excerpt: str


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    sources: Optional[dict] = None
    model_used: Optional[str] = None
    tokens_prompt: Optional[int] = None
    tokens_completion: Optional[int] = None
    tokens_total: Optional[int] = None
    latency_ms: Optional[int] = None
    confidence: Optional[str] = None
    has_sources: bool = False
    is_streaming: bool = False
    streaming_completed: bool = True
    created_at: datetime


class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message_count: int
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ChatResponse(BaseModel):
    answer: str
    conversationId: UUID
    message: MessageResponse
    conversation: ConversationResponse
    sources: Optional[List[SourceDocument]] = None


async def build_sources(chunks: List[RetrievalChunk]) -> List[SourceDocument]:
    sources = []
    for chunk in chunks[:5]:
        excerpt = chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
        sources.append(SourceDocument(
            document_id=chunk.document_id,
            document_name=chunk.document_name or "Unknown",
            relevance_score=chunk.similarity_score,
            excerpt=excerpt
        ))
    return sources


@router.post("", response_model=ChatResponse, dependencies=[Depends(rate_limit)])
async def chat(request: ChatRequest, user: UserContext = Depends(get_user_context)):
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if request.conversation_id:
        conv = await conversation_service.get_conversation(request.conversation_id, user.user_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = await conversation_service.create_conversation(user.user_id)
        request.conversation_id = conv.id

    await conversation_service.add_message(
        request.conversation_id,
        role="USER",
        content=request.message,
        has_sources=False
    )

    history = []
    messages = await message_repository.get_by_conversation(request.conversation_id, user.user_id, limit=20)
    history = [{"role": "user" if m.role.value == "USER" else "assistant", "content": m.content} for m in messages]

    gateway_result = await input_gateway_service.process_input(
        request.message,
        [{"role": h["role"], "content": h["content"]} for h in history] if history else None
    )

    if gateway_result.action == "reject":
        raise HTTPException(status_code=400, detail="Query rejected by safety filter")

    if gateway_result.action == "respond_directly":
        answer_msg = await conversation_service.add_message(
            request.conversation_id,
            role="ASSISTANT",
            content=gateway_result.explanation or "Hello! How can I help you today?",
            has_sources=False
        )
        return ChatResponse(
            answer=answer_msg.content,
            conversationId=answer_msg.conversation_id,
            message=MessageResponse(
                id=answer_msg.id,
                conversation_id=answer_msg.conversation_id,
                role=answer_msg.role.value,
                content=answer_msg.content,
                created_at=answer_msg.created_at,
                has_sources=False
            ),
            conversation=ConversationResponse(
                id=conv.id,
                user_id=conv.user_id,
                title=conv.title,
                message_count=conv.message_count,
                created_at=conv.created_at,
                updated_at=conv.updated_at
            )
        )

    refined_query = gateway_result.refined_query or request.message

    filters = None
    if request.context and (request.context.document_ids or request.context.category_ids):
        filters = RetrievalFilters(
            document_ids=request.context.document_ids,
            category_ids=request.context.category_ids
        )

    chunks = await hybrid_search_service.search(
        query=refined_query,
        user_id=str(user.user_id),
        user_role=user.role,
        user_department_id=str(user.department_id) if user.department_id else None,
        filters=filters,
        limit=settings.retrieval_limit
    )

    if settings.use_reranker and settings.reranker_url:
        chunks = await reranker_service.rerank(refined_query, chunks, settings.rerank_limit)

    gap_result = await knowledge_gap_detector.evaluate(refined_query, chunks)

    messages_for_llm = prompt_builder.build(
        query=refined_query,
        context_chunks=chunks,
        history=history
    )

    content, prompt_tokens, completion_tokens, total_tokens, latency = await llm_client.generate(
        messages=messages_for_llm,
        model_id=request.model_id
    )

    has_sources = len(chunks) > 0
    sources_data = await build_sources(chunks) if has_sources else None

    assistant_msg = await conversation_service.add_message(
        request.conversation_id,
        role="ASSISTANT",
        content=content,
        sources=[s.model_dump() for s in sources_data] if sources_data else [],
        model_used=request.model_id,
        tokens_prompt=prompt_tokens,
        tokens_completion=completion_tokens,
        tokens_total=total_tokens,
        latency_ms=latency,
        has_sources=has_sources,
        confidence="HIGH" if gap_result.top_similarity >= 0.7 else ("MEDIUM" if gap_result.top_similarity >= 0.4 else "LOW")
    )

    if gap_result.is_unanswered:
        await knowledge_gap_detector.publish_unanswered(
            gap_result,
            user.user_id,
            request.conversation_id,
            request.message,
            message_id=assistant_msg.id,
            user_department_id=user.department_id,
            user_role=user.role
        )

    # Re-fetch conversation to get updated message_count
    conv = await conversation_service.get_conversation(request.conversation_id, user.user_id)

    return ChatResponse(
        answer=assistant_msg.content,
        conversationId=conv.id,
        message=MessageResponse(
            id=assistant_msg.id,
            conversation_id=assistant_msg.conversation_id,
            role=assistant_msg.role.value,
            content=assistant_msg.content,
            sources=assistant_msg.sources,
            model_used=assistant_msg.model_used,
            tokens_prompt=assistant_msg.tokens_prompt,
            tokens_completion=assistant_msg.tokens_completion,
            tokens_total=assistant_msg.tokens_total,
            latency_ms=assistant_msg.latency_ms,
            confidence=assistant_msg.confidence.value if assistant_msg.confidence else None,
            has_sources=assistant_msg.has_sources,
            created_at=assistant_msg.created_at
        ),
        conversation=ConversationResponse(
            id=conv.id,
            user_id=conv.user_id,
            title=conv.title,
            message_count=conv.message_count,
            created_at=conv.created_at,
            updated_at=conv.updated_at
        ),
        sources=sources_data
    )


@router.post("/stream", dependencies=[Depends(rate_limit)])
async def chat_stream(request: ChatRequest, user: UserContext = Depends(get_user_context)):
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if request.conversation_id:
        conv = await conversation_service.get_conversation(request.conversation_id, user.user_id)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = await conversation_service.create_conversation(user.user_id)
        request.conversation_id = conv.id

    await conversation_service.add_message(
        request.conversation_id,
        role="USER",
        content=request.message,
        has_sources=False
    )

    history = []
    messages = await message_repository.get_by_conversation(request.conversation_id, user.user_id, limit=20)
    history = [{"role": "user" if m.role.value == "USER" else "assistant", "content": m.content} for m in messages]

    gateway_result = await input_gateway_service.process_input(
        request.message,
        [{"role": h["role"], "content": h["content"]} for h in history] if history else None
    )

    if gateway_result.action == "reject":
        raise HTTPException(status_code=400, detail="Query rejected by safety filter")

    if gateway_result.action == "respond_directly":
        direct_content = gateway_result.explanation or "Hello! How can I help you today?"
        await conversation_service.add_message(
            request.conversation_id,
            role="ASSISTANT",
            content=direct_content,
            has_sources=False
        )

        async def generate_direct():
            yield f"data: {json.dumps({'conversationId': str(request.conversation_id)})}\n\n"
            yield f"data: {json.dumps({'content': direct_content})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate_direct(), media_type="text/event-stream")

    refined_query = gateway_result.refined_query or request.message

    filters = None
    if request.context and (request.context.document_ids or request.context.category_ids):
        filters = RetrievalFilters(
            document_ids=request.context.document_ids,
            category_ids=request.context.category_ids
        )

    chunks = await hybrid_search_service.search(
        query=refined_query,
        user_id=str(user.user_id),
        user_role=user.role,
        user_department_id=str(user.department_id) if user.department_id else None,
        filters=filters,
        limit=settings.retrieval_limit
    )

    if settings.use_reranker and settings.reranker_url:
        chunks = await reranker_service.rerank(refined_query, chunks, settings.rerank_limit)

    gap_result = await knowledge_gap_detector.evaluate(refined_query, chunks)

    has_sources = len(chunks) > 0
    sources_data = await build_sources(chunks) if has_sources else None

    messages_for_llm = prompt_builder.build(
        query=refined_query,
        context_chunks=chunks,
        history=history
    )

    profile = llm_client.registry.get_profile(request.model_id)

    async def generate():
        full_content = ""
        start_time = time.time()

        # Send conversationId as first event so frontend can track it
        yield f"data: {json.dumps({'conversationId': str(request.conversation_id)})}\n\n"

        # Send sources metadata before streaming content
        if sources_data:
            yield f"data: {json.dumps({'sources': [s.model_dump(mode='json') for s in sources_data]})}\n\n"

        try:
            # Use the unified streaming generator from llm_client
            async for chunk_content in llm_client.generate_streaming(
                messages=messages_for_llm,
                model_id=request.model_id,
                temperature=0.3,
                max_tokens=1024
            ):
                full_content += chunk_content
                yield f"data: {json.dumps({'content': chunk_content})}\n\n"

            latency_ms = int((time.time() - start_time) * 1000)

            # Persist the assistant message after streaming completes
            confidence = "HIGH" if gap_result.top_similarity >= 0.7 else ("MEDIUM" if gap_result.top_similarity >= 0.4 else "LOW")
            assistant_msg = await conversation_service.add_message(
                request.conversation_id,
                role="ASSISTANT",
                content=full_content,
                sources=[s.model_dump() for s in sources_data] if sources_data else [],
                model_used=request.model_id,
                latency_ms=latency_ms,
                has_sources=has_sources,
                confidence=confidence
            )

            # Publish unanswered question event if needed
            if gap_result.is_unanswered:
                await knowledge_gap_detector.publish_unanswered(
                    gap_result,
                    user.user_id,
                    request.conversation_id,
                    request.message,
                    message_id=assistant_msg.id,
                    user_department_id=user.department_id,
                    user_role=user.role
                )

            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error("streaming_generation_failed", error=str(e))
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")