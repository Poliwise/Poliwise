from uuid import UUID
from typing import List, Optional
from datetime import datetime
import asyncpg
import json
import structlog

from ...db.session import get_connection, release_connection
from ...models.message import MessageResponse, MessageRole, ConfidenceLevel

logger = structlog.get_logger()


class MessageRepository:
    async def create(
        self,
        conversation_id: UUID,
        role: str,
        content: str,
        sources: Optional[list] = None,
        model_used: Optional[str] = None,
        tokens_prompt: Optional[int] = None,
        tokens_completion: Optional[int] = None,
        tokens_total: Optional[int] = None,
        latency_ms: Optional[int] = None,
        confidence: Optional[str] = None,
        has_sources: bool = False
    ) -> MessageResponse:
        conn = await get_connection()
        try:
            row = await conn.fetchrow(
                """INSERT INTO conversation.messages
                   (conversation_id, role, content, sources, model_used, tokens_prompt,
                    tokens_completion, tokens_total, latency_ms, confidence, has_sources, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                   RETURNING id, conversation_id, role, content, sources, model_used,
                             tokens_prompt, tokens_completion, tokens_total, latency_ms,
                             confidence, has_sources, is_streaming, streaming_completed, created_at""",
                conversation_id,
                role,
                content,
                json.dumps(sources, default=str) if sources else None,
                model_used,
                tokens_prompt,
                tokens_completion,
                tokens_total,
                latency_ms,
                confidence,
                has_sources,
                datetime.utcnow()
            )
            row_dict = dict(row)
            if row_dict.get('sources') and isinstance(row_dict['sources'], str):
                row_dict['sources'] = json.loads(row_dict['sources'])
            return MessageResponse(**row_dict)
        finally:
            await release_connection(conn)

    async def get_by_conversation(
        self,
        conversation_id: UUID,
        user_id: UUID,
        limit: int = 50
    ) -> List[MessageResponse]:
        conn = await get_connection()
        try:
            rows = await conn.fetch(
                """SELECT m.id, m.conversation_id, m.role, m.content, m.sources, m.model_used,
                          m.tokens_prompt, m.tokens_completion, m.tokens_total, m.latency_ms,
                          m.confidence, m.has_sources, m.is_streaming, m.streaming_completed, m.created_at
                   FROM conversation.messages m
                   JOIN conversation.conversations c ON m.conversation_id = c.id
                   WHERE m.conversation_id = $1 AND c.user_id = $2 AND m.deleted_at IS NULL
                   ORDER BY m.created_at ASC
                   LIMIT $3""",
                conversation_id, user_id, limit
            )
            results = []
            for row in rows:
                row_dict = dict(row)
                if row_dict.get('sources') and isinstance(row_dict['sources'], str):
                    row_dict['sources'] = json.loads(row_dict['sources'])
                results.append(MessageResponse(**row_dict))
            return results
        finally:
            await release_connection(conn)

    async def get_by_id(self, message_id: UUID, user_id: UUID) -> Optional[MessageResponse]:
        conn = await get_connection()
        try:
            row = await conn.fetchrow(
                """SELECT m.id, m.conversation_id, m.role, m.content, m.sources, m.model_used,
                          m.tokens_prompt, m.tokens_completion, m.tokens_total, m.latency_ms,
                          m.confidence, m.has_sources, m.is_streaming, m.streaming_completed, m.created_at
                   FROM conversation.messages m
                   JOIN conversation.conversations c ON m.conversation_id = c.id
                   WHERE m.id = $1 AND c.user_id = $2 AND m.deleted_at IS NULL""",
                message_id, user_id
            )
            if not row:
                return None
            row_dict = dict(row)
            if row_dict.get('sources') and isinstance(row_dict['sources'], str):
                row_dict['sources'] = json.loads(row_dict['sources'])
            return MessageResponse(**row_dict)
        finally:
            await release_connection(conn)

    async def delete_by_conversation(self, conversation_id: UUID, user_id: UUID) -> bool:
        conn = await get_connection()
        try:
            result = await conn.execute(
                """UPDATE conversation.messages
                   SET deleted_at = $3
                   WHERE conversation_id = $1
                   AND EXISTS (SELECT 1 FROM conversation.conversations WHERE id = $1 AND user_id = $2)
                   AND deleted_at IS NULL""",
                conversation_id, user_id, datetime.utcnow()
            )
            return True
        finally:
            await release_connection(conn)


message_repository = MessageRepository()