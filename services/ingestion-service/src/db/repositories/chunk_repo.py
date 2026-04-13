from typing import Optional
from uuid import UUID
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.chunk import Chunk


class ChunkRepository:
    """Repository for chunk database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def bulk_insert(self, chunks: list[Chunk]) -> None:
        """Bulk insert chunks with idempotency (ON CONFLICT DO NOTHING)."""
        if not chunks:
            return

        values = []
        for c in chunks:
            values.append({
                "id": c.id if hasattr(c, 'id') else None,
                "document_id": c.document_id,
                "document_version_id": c.document_version_id,
                "chunk_type": c.chunk_type,
                "parent_chunk_id": c.parent_chunk_id,
                "content": c.content,
                "section_title": c.section_title,
                "section_level": c.section_level,
                "section_path": c.section_path,
                "chunk_index": c.chunk_index,
                "start_char_index": c.start_char_index,
                "end_char_index": c.end_char_index,
                "token_count": c.token_count,
                "embedding_vector": c.embedding_vector,
                "embedding_model": c.embedding_model,
                "embedding_dimension": c.embedding_dimension,
                "allowed_roles": c.allowed_roles,
                "allowed_departments": c.allowed_departments,
                "allowed_users": c.allowed_users,
                "access_level": c.access_level,
                "is_latest": True,
                "metadata": c.metadata,
            })

        # Use raw SQL for bulk insert with ON CONFLICT
        await self.session.execute(text("""
            INSERT INTO knowledge.chunks (
                document_id, document_version_id, chunk_type, parent_chunk_id,
                content, section_title, section_level, section_path,
                chunk_index, start_char_index, end_char_index, token_count,
                embedding_vector, embedding_model, embedding_dimension,
                allowed_roles, allowed_departments, allowed_users, access_level,
                is_latest, metadata
            ) VALUES (
                :document_id, :document_version_id, :chunk_type, :parent_chunk_id,
                :content, :section_title, :section_level, :section_path,
                :chunk_index, :start_char_index, :end_char_index, :token_count,
                :embedding_vector, :embedding_model, :embedding_dimension,
                :allowed_roles, :allowed_departments, :allowed_users, :access_level,
                :is_latest, :metadata
            )
            ON CONFLICT (document_version_id, chunk_index, chunk_type) DO NOTHING
        """), values)

    async def mark_not_latest(self, document_id: UUID) -> None:
        """Mark all chunks for a document as not latest."""
        await self.session.execute(
            update(Chunk)
            .where(Chunk.document_id == document_id, Chunk.is_latest == True)
            .values(is_latest=False)
        )
