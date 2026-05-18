import re
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
from ...services.retrieval.hybrid_search import hybrid_search_service
from ...services.retrieval.reranker import reranker_service
from ...services.generation.llm_client import llm_client
from ...services.generation.prompt_builder import prompt_builder
from ...services.knowledge_gap import knowledge_gap_detector
from ...services.pipeline.layer1_toxic_filter import ToxicFilterService
from ...services.pipeline.layer2_intent_classifier import IntentClassifierService
from ...services.pipeline.layer2_responder import Layer2Responder
from ...services.pipeline.query_refiner import QueryRefiner
from ...db.repositories.message_repo import message_repository
from ...models.retrieval import RetrievalFilters, RetrievalChunk
from ...config.settings import settings

toxic_filter = ToxicFilterService(
    groq_api_key=settings.groq_api_key,
    model=settings.layer1_model,
    fail_open=settings.layer1_fail_open
)

intent_classifier = IntentClassifierService(
    groq_api_key=settings.groq_api_key,
    model=settings.layer2_model,
    max_tokens=settings.layer2_max_tokens_classify
)

layer2_responder = Layer2Responder(
    groq_api_key=settings.groq_api_key,
    model=settings.layer2_model,
    max_tokens=settings.layer2_max_tokens_respond
)

query_refiner = QueryRefiner(
    groq_api_key=settings.groq_api_key,
    model="llama-3.3-70b-versatile"
)

router = APIRouter(prefix="/chat", tags=["Chat"])


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
    sources = []
    seen_names = set()
    for chunk in chunks[:10]:
        doc_name = chunk.document_name or "Unknown"
        if doc_name in seen_names:
            continue
        seen_names.add(doc_name)
        excerpt = chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content
        sources.append(SourceDocument(
            document_id=chunk.document_id,
            document_name=doc_name,
            relevance_score=chunk.similarity_score,
            excerpt=excerpt
        ))
        if len(sources) >= 5:
            break
    return sources


def strip_thinking_tags(content: str) -> str:
    return re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()


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

    # ── LAYER 1: Toxic Filter ────────────────────────────────
    layer1_result = await toxic_filter.check(request.message)
    if layer1_result.is_toxic:
        assistant_msg = await conversation_service.add_message(
            request.conversation_id,
            role="ASSISTANT",
            content="Inappropriate content. Please rephrase your question.",
            has_sources=False
        )
        return ChatResponse(
            answer="Inappropriate content. Please rephrase your question.",
            conversationId=conv.id,
            message=MessageResponse(
                id=assistant_msg.id,
                conversation_id=assistant_msg.conversation_id,
                role=assistant_msg.role.value,
                content=assistant_msg.content,
                created_at=assistant_msg.created_at,
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

    # ── LAYER 2: Intent Classification ──────────────────────
    recent_msgs = await message_repository.get_by_conversation(
        request.conversation_id, user.user_id, limit=4
    )
    recent_history = [msg.content for msg in recent_msgs] if recent_msgs else None

    intent_result = await intent_classifier.classify(
        query=request.message,
        recent_history=recent_history
    )

    if intent_result.intent == "SIMPLE":
        layer2_response = await layer2_responder.respond(request.message)
        assistant_msg = await conversation_service.add_message(
            request.conversation_id,
            role="ASSISTANT",
            content=layer2_response.content,
            model_used=layer2_response.model_used,
            latency_ms=layer2_response.latency_ms,
            has_sources=False
        )
        return ChatResponse(
            answer=assistant_msg.content,
            conversationId=conv.id,
            message=MessageResponse(
                id=assistant_msg.id,
                conversation_id=assistant_msg.conversation_id,
                role=assistant_msg.role.value,
                content=assistant_msg.content,
                model_used=assistant_msg.model_used,
                latency_ms=assistant_msg.latency_ms,
                created_at=assistant_msg.created_at,
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

    # ── COMPLEX path: RAG + Generation ──────────────────────
    messages = await message_repository.get_by_conversation(request.conversation_id, user.user_id, limit=20)
    history = [{"role": "user" if m.role.value == "USER" else "assistant", "content": m.content} for m in messages]

    filters = None
    if request.context and (request.context.document_ids or request.context.category_ids):
        filters = RetrievalFilters(
            document_ids=request.context.document_ids,
            category_ids=request.context.category_ids
        )

    chunks = await hybrid_search_service.search(
        query=request.message,
        user_id=str(user.user_id),
        user_role=user.role,
        user_department_id=str(user.department_id) if user.department_id else None,
        filters=filters,
        limit=settings.retrieval_limit
    )

    if settings.use_reranker and settings.reranker_url:
        chunks = await reranker_service.rerank(request.message, chunks, settings.rerank_limit)

    gap_result = await knowledge_gap_detector.evaluate(request.message, chunks)

    messages_for_llm = prompt_builder.build(
        query=request.message,
        context_chunks=chunks,
        history=history
    )

    content, prompt_tokens, completion_tokens, total_tokens, latency = await llm_client.generate(
        messages=messages_for_llm,
        model_id=request.model_id
    )

    content = strip_thinking_tags(content)

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

    # ── LAYER 1: Toxic Filter ────────────────────────────────
    layer1_result = await toxic_filter.check(request.message)
    if layer1_result.is_toxic:
        async def generate_blocked():
            yield f"data: {json.dumps({'conversationId': str(request.conversation_id)})}\n\n"
            yield f"data: {json.dumps({'content': 'Inappropriate content. Please rephrase your question.'})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(generate_blocked(), media_type="text/event-stream")

    # ── LAYER 2: Intent Classification ──────────────────────
    recent_msgs = await message_repository.get_by_conversation(
        request.conversation_id, user.user_id, limit=4
    )
    recent_history = [msg.content for msg in recent_msgs] if recent_msgs else None

    intent_result = await intent_classifier.classify(
        query=request.message,
        recent_history=recent_history
    )

    if intent_result.intent == "SIMPLE":
        layer2_response = await layer2_responder.respond(request.message)
        await conversation_service.add_message(
            request.conversation_id,
            role="ASSISTANT",
            content=layer2_response.content,
            model_used=layer2_response.model_used,
            latency_ms=layer2_response.latency_ms,
            has_sources=False
        )
        async def generate_simple():
            yield f"data: {json.dumps({'conversationId': str(request.conversation_id)})}\n\n"
            yield f"data: {json.dumps({'content': layer2_response.content})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(generate_simple(), media_type="text/event-stream")

    # ── COMPLEX path: RAG + Generation ──────────────────────
    messages = await message_repository.get_by_conversation(request.conversation_id, user.user_id, limit=20)
    history = [{"role": "user" if m.role.value == "USER" else "assistant", "content": m.content} for m in messages]

    # Query refinement: translate non-English queries + expand keywords
    refined = await query_refiner.refine(
        original_query=request.message,
        layer3_history=[]
    )
    search_query = refined.refined

    filters = None
    if request.context and (request.context.document_ids or request.context.category_ids):
        filters = RetrievalFilters(
            document_ids=request.context.document_ids,
            category_ids=request.context.category_ids
        )

    chunks = await hybrid_search_service.search(
        query=search_query,
        user_id=str(user.user_id),
        user_role=user.role,
        user_department_id=str(user.department_id) if user.department_id else None,
        filters=filters,
        limit=5
    )

    if refined.keywords:
        from ...db.repositories.chunk_repo import chunk_repository
        try:
            common_words = {"the", "and", "for", "with", "are", "was", "were", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "on", "at", "by", "up", "about", "into", "through", "during", "before", "after", "above", "below", "between", "out", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just", "because", "as", "until", "while", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "it", "its", "my", "your", "his", "her", "our", "their", "company", "employee", "workplace", "culture", "management", "information", "personal", "policy", "website"}
            individual_words = set()
            for kw in refined.keywords[:3]:
                for word in kw.lower().split():
                    if len(word) > 2 and word not in common_words:
                        individual_words.add(word)
            specific_words = sorted(individual_words)[:3]
            for word in specific_words:
                keyword_results = await chunk_repository.bm25_search(
                    query=word,
                    user_id=str(user.user_id),
                    user_role=user.role,
                    user_department_id=str(user.department_id) if user.department_id else None,
                    filters=filters,
                    limit=3
                )
                seen_ids = {str(c.id) for c in chunks}
                for kc in keyword_results:
                    if str(kc.id) not in seen_ids and len(chunks) < settings.retrieval_limit:
                        chunks.insert(0, kc)
                        seen_ids.add(str(kc.id))
                logger.info("keyword_bm25_word",
                    word=word,
                    found=len([c for c in keyword_results if str(c.id) not in {str(x.id) for x in chunks}]),
                    top_docs=[{"doc": c.document_name, "score": c.similarity_score, "excerpt": c.content[:80]} for c in keyword_results[:2]]
                )
        except Exception as e:
            logger.error("keyword_bm25_failed", error=str(e))

    if settings.use_reranker and settings.reranker_url:
        chunks = await reranker_service.rerank(search_query, chunks, settings.rerank_limit)

    gap_result = await knowledge_gap_detector.evaluate(search_query, chunks)

    has_sources = len(chunks) > 0
    sources_data = await build_sources(chunks) if has_sources else None

    logger.info("retrieval_results",
        original_query=request.message,
        refined_query=search_query,
        model_id=request.model_id,
        chunk_count=len(chunks),
        chunks=[{"doc": c.document_name, "score": c.similarity_score, "excerpt": c.content[:150]} for c in chunks[:5]]
    )

    messages_for_llm = prompt_builder.build(
        query=request.message,
        context_chunks=chunks,
        history=history
    )

    async def generate():
        full_content = ""
        start_time = time.time()

        # Send conversationId as first event so frontend can track it
        yield f"data: {json.dumps({'conversationId': str(request.conversation_id)})}\n\n"

        # Send sources metadata before streaming content
        if sources_data:
            yield f"data: {json.dumps({'sources': [s.model_dump(mode='json') for s in sources_data]})}\n\n"

        try:
            in_thinking = False
            buffer = ""

            async for chunk_content in llm_client.generate_streaming(
                messages=messages_for_llm,
                model_id=request.model_id,
                temperature=0.3,
                max_tokens=1024
            ):
                buffer += chunk_content
                if not in_thinking:
                    if "<think" in buffer:
                        in_thinking = True
                        buffer = ""
                        continue
                    yield f"data: {json.dumps({'content': chunk_content})}\n\n"
                    full_content += chunk_content
                else:
                    if "</think>" in buffer:
                        in_thinking = False
                        buffer = ""
                    else:
                        buffer = ""

            full_content = strip_thinking_tags(full_content)

            latency_ms = int((time.time() - start_time) * 1000)

            logger.info("generation_complete",
                model_id=request.model_id,
                content_preview=full_content[:300],
                latency_ms=latency_ms,
                chunk_count=len(chunks),
                top_score=chunks[0].similarity_score if chunks else 0
            )

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