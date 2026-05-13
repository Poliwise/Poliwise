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

        import json
        values = []
        for c in chunks:
            # Convert embedding_vector to string representation for pgvector in raw SQL
            emb_vector = c.embedding_vector
            if isinstance(emb_vector, list):
                emb_vector = str(emb_vector)
            elif isinstance(emb_vector, str) and not emb_vector.startswith('['):
                # If it's a string but doesn't look like a PG vector, try to fix it
                try:
                    import ast
                    parsed = ast.literal_eval(emb_vector)
                    if isinstance(parsed, list):
                        emb_vector = str(parsed)
                except:
                    pass

            # Convert metadata to JSON string as asyncpg + text() doesn't auto-encode dicts
            meta = c.metadata
            if isinstance(meta, dict):
                meta = json.dumps(meta)

            # Ensure UUIDs are actual UUID objects for the driver
            def to_uuid(v):
                if v is None: return None
                if isinstance(v, UUID): return v
                try: return UUID(str(v))
                except: return None

            def to_uuid_list(l):
                if not l: return []
                return [to_uuid(x) for x in l if x]

            values.append({
                "document_id": to_uuid(c.document_id),
                "document_version_id": to_uuid(c.document_version_id),
                "document_version": int(c.document_version) if c.document_version is not None else 0,
                "chunk_type": str(c.chunk_type),
                "parent_chunk_id": to_uuid(c.parent_chunk_id),
                "content": str(c.content),
                "content_length": len(c.content) if c.content else 0,
                "section_title": c.section_title,
                "section_level": c.section_level,
                "section_path": c.section_path if c.section_path is not None else [],
                "chunk_index": int(c.chunk_index),
                "start_char_index": c.start_char_index,
                "end_char_index": c.end_char_index,
                "token_count": c.token_count,
                "embedding_vector": emb_vector,
                "embedding_model": c.embedding_model,
                "embedding_dimension": c.embedding_dimension,
                "allowed_roles": c.allowed_roles if c.allowed_roles is not None else [],
                "allowed_departments": to_uuid_list(c.allowed_departments),
                "allowed_users": to_uuid_list(c.allowed_users),
                "access_level": str(c.access_level),
                "is_latest": True,
                "metadata": meta,
            })

        # Use raw SQL for bulk insert with ON CONFLICT
        await self.session.execute(text("""
            INSERT INTO knowledge.chunks (
                document_id, document_version_id, document_version, chunk_type, parent_chunk_id,
                content, content_length, section_title, section_level, section_path,
                chunk_index, start_char_index, end_char_index, token_count,
                embedding_vector, embedding_model, embedding_dimension,
                allowed_roles, allowed_departments, allowed_users, access_level,
                is_latest, metadata
            ) VALUES (
                :document_id, :document_version_id, :document_version, :chunk_type, :parent_chunk_id,
                :content, :content_length, :section_title, :section_level, :section_path,
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
