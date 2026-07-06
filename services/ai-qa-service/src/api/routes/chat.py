import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, List
from datetime import datetime
import json
import time
import structlog

logger = structlog.get_logger()

from ..dependencies import get_user_context, UserContext
from ..dependencies.rate_limit import rate_limit
from ...services.conversation.manager import conversation_service
from ...services.retrieval.hybrid_search import hybrid_search_service
from ...services.retrieval.reranker import reranker_service
from ...services.generation.llm_client import llm_client
from ...services.generation.prompt_builder import prompt_builder
from ...services.knowledge_gap import knowledge_gap_detector
from ...services.pipeline.layer1_toxic_filter import ToxicFilterService
from ...services.pipeline.layer2_intent_classifier import IntentClassifierService
from ...services.pipeline.layer2_responder import Layer2Responder
from ...services.pipeline.query_refiner import QueryRefiner
from ...services.pipeline.pipeline_orchestrator import PipelineOrchestrator
from ...db.repositories.message_repo import message_repository
from ...models.retrieval import RetrievalFilters, RetrievalChunk
from ...config.settings import settings

toxic_filter = ToxicFilterService(
    groq_api_key=settings.groq_api_key,
    jailbreak_model=settings.layer1_model,
    toxic_model=settings.toxic_model,
    fail_open=settings.layer1_fail_open
)

intent_classifier = IntentClassifierService(
    groq_api_key=settings.groq_api_key,
    model=settings.layer2_model,
    max_tokens=settings.layer2_max_tokens_classify,
    fallback_intent=settings.layer2_fallback_intent
)

layer2_responder = Layer2Responder(
    groq_api_key=settings.groq_api_key,
    model=settings.layer2_model_respond,
    max_tokens=settings.layer2_max_tokens_respond
)

query_refiner = QueryRefiner(
    groq_api_key=settings.groq_api_key,
    model=settings.query_refiner_model,
    max_tokens=settings.query_refiner_max_tokens
)

orchestrator = PipelineOrchestrator(
    toxic_filter=toxic_filter,
    intent_classifier=intent_classifier,
    layer2_responder=layer2_responder,
    query_refiner=query_refiner,
    hybrid_search=hybrid_search_service,
    llm_client=llm_client,
    prompt_builder=prompt_builder,
    conversation_service=conversation_service,
    message_repository=message_repository,
    knowledge_gap_detector=knowledge_gap_detector,
    reranker_service=reranker_service,
    settings=settings,
)

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


class ChatContext(BaseModel):
    document_ids: Optional[List[UUID]] = None
    category_ids: Optional[List[UUID]] = None


class ChatRequest(BaseModel):
    message: str = Field(..., alias="question")
    conversation_id: Optional[UUID] = Field(None, alias="conversationId")
    model_id: str = Field("default", alias="modelId")
    context: Optional[ChatContext] = None

    model_config = {
        "populate_by_name": True
    }


class ChunkRef(BaseModel):
    chunk_id: UUID
    section_title: Optional[str] = None
    excerpt: str
    full_content: str
    similarity_score: float
    start_char_index: Optional[int] = None
    end_char_index: Optional[int] = None


class SourceDocument(BaseModel):
    document_id: UUID
    document_name: str
    relevance_score: float
    chunks: List[ChunkRef]


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    sources: Optional[list] = None
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
    """Group retrieval chunks by document and build a hierarchical sources list."""
    from collections import OrderedDict
    doc_map: OrderedDict[UUID, dict] = OrderedDict()

    for chunk in chunks[:10]:
        doc_id = chunk.document_id
        doc_name = chunk.document_name or "Unknown"
        excerpt = chunk.content[:800] + "..." if len(chunk.content) > 800 else chunk.content

        chunk_ref = ChunkRef(
            chunk_id=chunk.id,
            section_title=chunk.section_title,
            excerpt=excerpt,
            full_content=chunk.content,
            similarity_score=chunk.similarity_score,
            start_char_index=chunk.start_char_index,
            end_char_index=chunk.end_char_index,
        )

        if doc_id not in doc_map:
            doc_map[doc_id] = {
                "document_id": doc_id,
                "document_name": doc_name,
                "relevance_score": chunk.similarity_score,
                "chunks": [chunk_ref],
            }
        else:
            doc_map[doc_id]["chunks"].append(chunk_ref)
            if chunk.similarity_score > doc_map[doc_id]["relevance_score"]:
                doc_map[doc_id]["relevance_score"] = chunk.similarity_score

    sources = [SourceDocument(**data) for data in list(doc_map.values())[:5]]
    return sources


def strip_thinking_tags(content: str) -> str:
    return re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()


def _build_chat_response(result, request, conv, assistant_msg, sources_data):
    """Format PipelineResult into ChatResponse."""
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
            created_at=assistant_msg.created_at,
        ),
        conversation=ConversationResponse(
            id=conv.id,
            user_id=conv.user_id,
            title=conv.title,
            message_count=conv.message_count,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
        ),
        sources=sources_data,
    )


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
        has_sources=False,
    )

    result = await orchestrator.process(request, user)

    if result.status == "BLOCKED":
        # Mark the last USER message as toxic
        await message_repository.mark_last_user_message_toxic(
            request.conversation_id, user.user_id
        )
        assistant_msg = await conversation_service.add_message(
            request.conversation_id,
            role="ASSISTANT",
            content=result.response,
            has_sources=False,
        )
        return _build_chat_response(result, request, conv, assistant_msg, None)

    if result.layer_stopped == 2:
        conv = await conversation_service.get_conversation(request.conversation_id, user.user_id)
        assistant_msg = await conversation_service.add_message(
            request.conversation_id,
            role="ASSISTANT",
            content=result.response,
            model_used=result.model_used,
            latency_ms=result.latency_ms,
            has_sources=False,
        )
        return _build_chat_response(result, request, conv, assistant_msg, None)

    # Layer 3: RAG response
    conv = await conversation_service.get_conversation(request.conversation_id, user.user_id)
    assistant_msg = await message_repository.get_by_id(
        conv.id, user.user_id
    ) if conv else None

    # Re-fetch to get the latest message
    messages = await message_repository.get_by_conversation(
        request.conversation_id, user.user_id, limit=1
    )
    assistant_msg = messages[-1] if messages else None

    return _build_chat_response(result, request, conv, assistant_msg, result.sources)


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
        has_sources=False,
    )

    return StreamingResponse(
        orchestrator.process_stream(request, user),
        media_type="text/event-stream",
    )
