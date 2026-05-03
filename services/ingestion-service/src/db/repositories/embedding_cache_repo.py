import hashlib
from datetime import datetime
from typing import Optional
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.embedding_cache import EmbeddingCache


class EmbeddingCacheRepository:
    """Repository for knowledge.embedding_cache operations.

    Provides batch lookup and batch upsert to minimise round-trips
    when processing documents with many chunks.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def hash_text(text: str) -> str:
        """Compute a deterministic SHA-256 hash for a chunk's content."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    async def lookup_batch(
        self,
        text_hashes: list[str],
        embedding_model: str,
    ) -> dict[str, list[float]]:
        """Look up cached embeddings for a list of text hashes.

        Returns a dict mapping text_hash → embedding_vector for every
        cache hit.  Cache misses are simply absent from the dict.
        """
        if not text_hashes:
            return {}

        result = await self.session.execute(
            select(
                EmbeddingCache.text_hash,
                EmbeddingCache.embedding_vector,
            ).where(
                EmbeddingCache.text_hash.in_(text_hashes),
                EmbeddingCache.embedding_model == embedding_model,
            )
        )

        cache_hits: dict[str, list[float]] = {}
        for row in result.all():
            cache_hits[row.text_hash] = list(row.embedding_vector)

        # Bump usage_count + last_used_at for the hits
        if cache_hits:
            await self.session.execute(
                update(EmbeddingCache)
                .where(
                    EmbeddingCache.text_hash.in_(list(cache_hits.keys())),
                    EmbeddingCache.embedding_model == embedding_model,
                )
                .values(
                    usage_count=EmbeddingCache.usage_count + 1,
                    last_used_at=datetime.utcnow(),
                )
            )

        return cache_hits

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------
    async def save_batch(
        self,
        entries: list[dict],
    ) -> None:
        """Persist new embeddings into the cache.

        Each entry must contain:
          - text_hash: str
          - text_length: int
          - embedding_model: str
          - embedding_dimension: int
          - embedding_vector: list[float]

        Uses ON CONFLICT … DO UPDATE so repeated calls are safe.
        """
        if not entries:
            return

        await self.session.execute(
            text("""
                INSERT INTO knowledge.embedding_cache (
                    text_hash, text_length,
                    embedding_model, embedding_dimension,
                    embedding_vector,
                    usage_count, last_used_at
                ) VALUES (
                    :text_hash, :text_length,
                    :embedding_model, :embedding_dimension,
                    :embedding_vector,
                    1, NOW()
                )
                ON CONFLICT (text_hash, embedding_model) DO UPDATE SET
                    usage_count   = knowledge.embedding_cache.usage_count + 1,
                    last_used_at  = NOW()
            """),
            entries,
        )
