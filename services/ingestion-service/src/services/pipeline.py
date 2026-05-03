"""Ingestion pipeline - coordinates all processing steps."""

import hashlib
import structlog
from uuid import UUID

from src.services.minio_service import minio_service
from src.services.extractors.orchestrator import orchestrator
from src.services.standardizer import DocumentPolicyStandardizer
from src.services.chunker import ParentChildChunker
from src.services.embedding_service import embedding_service
from src.services.processing_job_service import processing_job_service
from src.db.repositories.chunk_repo import chunk_repo
from src.db.repositories.version_repo import VersionRepository
from src.models.extraction import Chunk

logger = structlog.get_logger()


class DuplicateResult:
    """Result of duplicate detection."""
    def __init__(self, is_duplicate: bool, existing_version_id: str = None, method: str = None, similarity: float = None):
        self.is_duplicate = is_duplicate
        self.existing_version_id = existing_version_id
        self.method = method
        self.similarity = similarity


class IngestionPipeline:
    """Coordinates the full document ingestion pipeline."""

    def __init__(self):
        self.standardizer = DocumentPolicyStandardizer()
        self.chunker = ParentChildChunker()

    async def check_duplicates(self, file_bytes: bytes) -> DuplicateResult:
        """Layer 1: Check for exact duplicate via file_checksum."""
        file_checksum = hashlib.sha256(file_bytes).hexdigest()

        from src.db.session import async_session
        async with async_session() as session:
            repo = VersionRepository(session)
            existing = await repo.find_by_file_checksum(file_checksum)
            if existing:
                logger.info("duplicate_found_exact", checksum=file_checksum[:16], version_id=str(existing.id))
                return DuplicateResult(
                    is_duplicate=True,
                    existing_version_id=str(existing.id),
                    method="file_checksum"
                )

        logger.info("no_duplicate_found")
        return DuplicateResult(is_duplicate=False)

    async def process(
        self,
        document_id: UUID,
        version_id: UUID,
        job_id: UUID,
        bucket_name: str,
        file_key: str,
        metadata: dict,
    ) -> dict:
        """Run the full ingestion pipeline."""
        logger.info(
            "pipeline_started",
            document_id=document_id,
            version_id=version_id,
            job_id=job_id,
            file_key=file_key,
        )

        try:
            await processing_job_service.update_progress(job_id, 5, "Downloading file from MinIO")

            file_bytes = await minio_service.download_file(bucket_name, file_key)
            file_size = len(file_bytes)

            duplicate_result = await self.check_duplicates(file_bytes)
            if duplicate_result.is_duplicate:
                logger.info(
                    "skipping_duplicate",
                    document_id=document_id,
                    existing_version=duplicate_result.existing_version_id,
                    method=duplicate_result.method,
                )
                await processing_job_service.complete_job(job_id, True, {
                    "duplicate_of": duplicate_result.existing_version_id,
                    "method": duplicate_result.method,
                    "skipped": True,
                })
                return {
                    "status": "skipped",
                    "reason": "duplicate",
                    "existing_version": duplicate_result.existing_version_id,
                    "method": duplicate_result.method,
                }

            file_checksum = hashlib.sha256(file_bytes).hexdigest()
            logger.info("file_downloaded", file_size=file_size, checksum=file_checksum[:16])

            await processing_job_service.update_progress(job_id, 15, "Extracting text content")

            extracted = await orchestrator.extract(file_bytes, file_key, document_id, version_id)
            logger.info(
                "extraction_completed",
                text_length=len(extracted.text),
                chunks=len(extracted.chunks),
                pages=extracted.page_count,
            )

            text_for_hash = extracted.text.encode("utf-8")
            content_hash = hashlib.sha256(text_for_hash).hexdigest()

            # Layer 2: Content Hash Deduplication
            from src.db.session import async_session as async_session_factory
            async with async_session_factory() as session:
                repo = VersionRepository(session)
                existing_versions = await repo.find_by_content_hash(content_hash, exclude_version_id=version_id)
                if existing_versions:
                    existing_ver = existing_versions[0]
                    logger.info(
                        "duplicate_found_content", 
                        content_hash=content_hash[:16], 
                        existing_version_id=str(existing_ver.id)
                    )
                    await processing_job_service.complete_job(job_id, True, {
                        "duplicate_of": str(existing_ver.id),
                        "method": "content_hash",
                        "skipped": True,
                    })
                    return {
                        "status": "skipped",
                        "reason": "content_duplicate",
                        "existing_version": str(existing_ver.id),
                        "method": "content_hash",
                    }

            await processing_job_service.update_progress(job_id, 30, "Standardizing text")

            structured = self.standardizer.normalize(extracted.text)

            await processing_job_service.update_progress(job_id, 45, "Chunking document")

            ingestion_metadata = {
                "document_id": document_id,
                "version_id": version_id,
                "job_id": job_id,
                "allowed_roles": metadata.get("allowed_roles", ["USER"]),
                "allowed_departments": metadata.get("allowed_departments", []),
                "allowed_users": metadata.get("allowed_users", []),
                "access_level": metadata.get("access_level", "PUBLIC"),
            }

            chunks = self.chunker.chunk(structured, ingestion_metadata)
            logger.info("chunking_completed", chunk_count=len(chunks))

            await processing_job_service.update_progress(job_id, 60, "Generating embeddings (with cache)")

            if chunks:
                texts = [c.content for c in chunks]

                # Layer 3: Chunk-level embedding cache
                # Only cache-miss texts are sent to TEI; hits are reused from DB.
                from src.db.session import async_session
                async with async_session() as embed_session:
                    embeddings = await embedding_service.embed_batch_cached(
                        texts, embed_session
                    )
                    await embed_session.commit()

                for chunk, embedding in zip(chunks, embeddings):
                    chunk.embedding_vector = embedding
                    chunk.embedding_model = "bge-m3"
                    chunk.embedding_dimension = len(embedding)

            logger.info("embeddings_completed", embedding_count=len(chunks))

            await processing_job_service.update_progress(job_id, 75, "Saving chunks to database")

            for chunk in chunks:
                chunk.document_id = document_id
                chunk.document_version_id = version_id

            await chunk_repo.bulk_insert(chunks)

            from src.db.session import async_session as async_session_ver
            async with async_session_ver() as ver_session:
                ver_repo = VersionRepository(ver_session)
                await ver_repo.update_version(
                    version_id,
                    extracted_text=extracted.text,
                    file_checksum=file_checksum,
                    content_hash=content_hash,
                )

            logger.info("chunks_saved", chunk_count=len(chunks))

            await processing_job_service.complete_job(job_id, True, {
                "chunk_count": len(chunks),
                "page_count": extracted.page_count,
                "language": extracted.language,
                "file_checksum": file_checksum,
                "content_hash": content_hash,
            })

            logger.info(
                "pipeline_completed",
                document_id=document_id,
                version_id=version_id,
                job_id=job_id,
                chunks=len(chunks),
            )

            return {
                "status": "completed",
                "chunk_count": len(chunks),
                "page_count": extracted.page_count,
                "language": extracted.language,
                "file_checksum": file_checksum,
                "content_hash": content_hash,
            }

        except Exception as e:
            logger.error(
                "pipeline_failed",
                document_id=document_id,
                version_id=version_id,
                job_id=job_id,
                error=str(e),
            )

            await processing_job_service.complete_job(job_id, False, error_message=str(e))

            raise


pipeline = IngestionPipeline()