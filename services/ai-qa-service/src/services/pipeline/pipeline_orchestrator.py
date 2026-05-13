from typing import Any, Optional
from uuid import UUID
import asyncio
import structlog
from pydantic import BaseModel

from .layer1_toxic_filter import ToxicFilterService, ToxicFilterResult
from .layer2_intent_classifier import IntentClassifierService, IntentResult
from .layer2_responder import Layer2Responder, Layer2Response
from .query_refiner import QueryRefiner, RefinedQuery

logger = structlog.get_logger(__name__)

class PipelineResult(BaseModel):
    status: str
    layer_stopped: int
    response: Optional[str] = None
    model_used: Optional[str] = None
    sources: Optional[list[Any]] = None
    refined_query: Optional[str] = None
    rate_limited_model: Optional[str] = None
    message: Optional[str] = None

class PipelineOrchestrator:
    """
    Coordinates the full 3-layer pipeline.
    This is the central service called from the /chat endpoint.
    """

    def __init__(
        self,
        toxic_filter: ToxicFilterService,
        intent_classifier: IntentClassifierService,
        layer2_responder: Layer2Responder,
        query_refiner: QueryRefiner,
        hybrid_search: Any, # HybridSearchService
        model_registry: Any, # ModelRegistry
        title_generator: Any, # TitleGenerator
        conversation_manager: Any, # ConversationManager
        knowledge_gap_detector: Any, # KnowledgeGapDetector
    ):
        self.toxic_filter = toxic_filter
        self.intent_classifier = intent_classifier
        self.layer2_responder = layer2_responder
        self.query_refiner = query_refiner
        self.hybrid_search = hybrid_search
        self.model_registry = model_registry
        self.title_generator = title_generator
        self.conversation_manager = conversation_manager
        self.knowledge_gap_detector = knowledge_gap_detector

    async def _save_layer2_exchange(self, request, layer2_response, user_context, layer1_result, intent_result):
        # Placeholder for Phase 8: Conversation Management
        pass

    async def _save_layer3_exchange(self, request, refined, gen_result, gap_result, user_context, layer1_result, intent_result):
        # Placeholder for Phase 8: Conversation Management
        pass

    async def _maybe_generate_title(self, conversation_id: UUID, user_query: str, assistant_response: str):
        # Placeholder for Phase 6: Title Generation
        pass

    async def process(
        self,
        request: Any, # ChatRequest
        user_context: Any, # UserContext
    ) -> PipelineResult:

        # ── LAYER 1: Toxic Filter ────────────────────────────────
        layer1_result = await self.toxic_filter.check(request.message)
        if layer1_result.is_toxic:
            return PipelineResult(
                status="BLOCKED",
                layer_stopped=1,
                response="Inappropriate content. Please rephrase your question.",
            )

        # ── LAYER 2: Intent Classification ──────────────────────
        # Fetch recent history (any layer) so the classifier understands context
        recent_msgs = await self.conversation_manager.get_recent_messages(
            conversation_id=request.conversation_id,
            limit=4  # Last 2 Q&A pairs — only for classifier context awareness
        ) if request.conversation_id else []
        
        intent_result = await self.intent_classifier.classify(
            query=request.message,
            recent_history=[msg.content for msg in recent_msgs] if recent_msgs else None
        )

        if intent_result.intent == "SIMPLE":
            layer2_response = await self.layer2_responder.respond(request.message)
            # Save to DB with layer=2
            await self._save_layer2_exchange(
                request, layer2_response, user_context, layer1_result, intent_result
            )
            return PipelineResult(
                status="OK",
                layer_stopped=2,
                response=layer2_response.content,
                model_used=layer2_response.model_used,
                sources=None,
            )

        # ── COMPLEX path: Query Refinement → Layer 3 ────────────

        # Fetch Layer 3 history only for refinement and context
        layer3_history = await self.conversation_manager.get_layer3_context(
            conversation_id=request.conversation_id,
            limit=10  # Last 5 Layer 3 Q&A pairs
        ) if request.conversation_id else []

        refined = await self.query_refiner.refine(
            original_query=request.message,
            layer3_history=layer3_history
        )

        # ── LAYER 3: RAG + Generation ────────────────────────────
        filters = {}
        if hasattr(request, "context") and request.context:
            filters = {
                "document_ids": getattr(request.context, "document_ids", None),
                "category_ids": getattr(request.context, "category_ids", None),
            }

        chunks = await self.hybrid_search.search(
            query=refined.refined,
            user_context=user_context,
            filters=filters,
            limit=10,
        )

        # Knowledge gap detection
        gap_result = await self.knowledge_gap_detector.evaluate(
            query=refined.refined,
            retrieved_chunks=chunks
        )

        # Generate — using user-selected model
        try:
            gen_result = await self.model_registry.generate(
                model_id=getattr(request, "model_id", "local/qwen3-8b"),
                query=refined.refined,
                original_query=request.message,
                retrieved_chunks=chunks,
                layer3_history=layer3_history,  # Layer 3 context ONLY
            )
        except Exception as e:
            # We catch generic exception for now, wait for Phase 3 RateLimitError
            if "Rate limit" in str(e) or "429" in str(e):
                await self.model_registry.mark_rate_limited(getattr(request, "model_id", "local/qwen3-8b"))
                return PipelineResult(
                    status="RATE_LIMITED",
                    layer_stopped=3,
                    rate_limited_model=getattr(request, "model_id", "local/qwen3-8b"),
                    message=f"Model '{getattr(request, 'model_id', 'local/qwen3-8b')}' is rate limited. Please select another model.",
                )
            raise e

        # Save Layer 3 exchange
        saved = await self._save_layer3_exchange(
            request, refined, gen_result, gap_result,
            user_context, layer1_result, intent_result
        )

        # Auto-generate title (background task — does not block response)
        if request.conversation_id:
            asyncio.create_task(
                self._maybe_generate_title(
                    conversation_id=request.conversation_id,
                    user_query=request.message,
                    assistant_response=gen_result.content,
                )
            )

        # Publish knowledge gap event if needed
        if gap_result.is_unanswered and saved:
            asyncio.create_task(
                self.knowledge_gap_detector.publish_unanswered(
                    result=gap_result,
                    user_id=getattr(user_context, "user_id", None),
                    message_id=getattr(saved, "message_id", None),
                    conversation_id=request.conversation_id,
                )
            )

        # Assume chunks_to_sources is a method on HybridSearchService or similar
        sources = [chunk.metadata for chunk in chunks] if chunks else []

        return PipelineResult(
            status="OK",
            layer_stopped=3,
            response=gen_result.content,
            model_used=gen_result.model_used,
            sources=sources,
            refined_query=refined.refined,
        )
