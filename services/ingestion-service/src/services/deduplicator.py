import hashlib
import structlog
from typing import Optional, NamedTuple
from uuid import UUID

from src.db.session import async_session
from src.db.repositories.version_repo import VersionRepository
from src.services.embedding_service import embedding_service

logger = structlog.get_logger()


class DeduplicationResult(NamedTuple):
    """Result of redundancy detection."""
    is_duplicate: bool
    existing_version_id: Optional[UUID] = None
    method: Optional[str] = None  # "file_checksum", "content_hash", "semantic"
    similarity: Optional[float] = None
    vector: Optional[list[float]] = None


class Deduplicator:
    """Service for hybrid three-layer redundancy detection."""

    async def check_file_duplicate(self, file_bytes: bytes) -> DeduplicationResult:
        """
        Layer 1: Exact duplicate detection via file checksum (SHA256).
        Checks if the exact same file (byte-for-byte) has been uploaded before.
        """
        file_checksum = hashlib.sha256(file_bytes).hexdigest()
        
        async with async_session() as session:
            repo = VersionRepository(session)
            existing = await repo.find_by_file_checksum(file_checksum)
            
            if existing:
                logger.info("deduplication_hit_layer1", method="file_checksum", version_id=str(existing.id))
                return DeduplicationResult(
                    is_duplicate=True,
                    existing_version_id=existing.id,
                    method="file_checksum"
                )
        
        return DeduplicationResult(is_duplicate=False)

    async def check_content_duplicate(self, extracted_text: str, exclude_version_id: UUID = None) -> DeduplicationResult:
        """
        Layer 2: Exact content detection via extracted text hash.
        Handles cases where the same text is inside different file formats (e.g. PDF vs Docx).
        """
        if not extracted_text:
            return DeduplicationResult(is_duplicate=False)
            
        content_hash = hashlib.sha256(extracted_text.encode("utf-8")).hexdigest()
        
        async with async_session() as session:
            repo = VersionRepository(session)
            existing_versions = await repo.find_by_content_hash(content_hash, exclude_version_id=exclude_version_id)
            
            if existing_versions:
                existing = existing_versions[0]
                logger.info("deduplication_hit_layer2", method="content_hash", version_id=str(existing.id))
                return DeduplicationResult(
                    is_duplicate=True,
                    existing_version_id=existing.id,
                    method="content_hash"
                )
                
        return DeduplicationResult(is_duplicate=False)

    async def check_semantic_duplicate(
        self, 
        text: str, 
        threshold: float = 0.95
    ) -> DeduplicationResult:
        """
        Layer 3: Near-duplicate detection via Semantic Fingerprint.
        Returns the embedding used for the check as part of the result.
        """
        if not text:
            return DeduplicationResult(is_duplicate=False)
            
        # Extract the first 4000 characters as the semantic signature/fingerprint
        fingerprint_text = text[:4000]
        
        # Only 1 embedding call needed for the whole document fingerprint
        embeddings = await embedding_service.embed_batch([fingerprint_text])
        
        if not embeddings:
            return DeduplicationResult(is_duplicate=False)
            
        doc_embedding = embeddings[0]
        
        async with async_session() as session:
            repo = VersionRepository(session)
            near_duplicates = await repo.find_near_duplicates(doc_embedding, threshold=threshold)
            
            if near_duplicates:
                existing, similarity = near_duplicates[0]
                logger.info(
                    "deduplication_hit_layer3", 
                    method="semantic", 
                    version_id=str(existing.id), 
                    similarity=similarity
                )
                return DeduplicationResult(
                    is_duplicate=True,
                    existing_version_id=existing.id,
                    method="semantic",
                    similarity=similarity,
                    vector=doc_embedding
                )
                
        return DeduplicationResult(is_duplicate=False, vector=doc_embedding)


# Global instance
deduplicator = Deduplicator()
