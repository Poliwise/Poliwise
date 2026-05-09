import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from src.services.pipeline import IngestionPipeline
from src.services.deduplicator import DeduplicationResult
from src.services.extractors.base import ExtractedDocument

@pytest.fixture
def pipeline():
    return IngestionPipeline()

@pytest.fixture
def mock_session():
    """Tạo mock session hỗ trợ async context manager."""
    session = AsyncMock()
    session.__aenter__.return_value = session
    return session

@pytest.mark.asyncio
async def test_pipeline_layer1_duplicate(pipeline):
    """Test Layer 1: Chặn ngay khi trùng File Checksum."""
    job_id = uuid4()
    
    with patch("src.services.minio_service.minio_service.download_file", new_callable=AsyncMock) as mock_download, \
         patch("src.services.deduplicator.deduplicator.check_file_duplicate", new_callable=AsyncMock) as mock_check_file, \
         patch("src.services.processing_job_service.processing_job_service.complete_job", new_callable=AsyncMock) as mock_complete, \
         patch("src.services.processing_job_service.processing_job_service.update_progress", new_callable=AsyncMock):
        
        mock_download.return_value = b"identical_file_content"
        mock_check_file.return_value = DeduplicationResult(
            is_duplicate=True, 
            existing_version_id=uuid4(), 
            method="file_checksum"
        )
        
        result = await pipeline.process(
            document_id=uuid4(),
            version_id=uuid4(),
            job_id=job_id,
            bucket_name="test-bucket",
            file_key="test.pdf",
            metadata={}
        )
        
        assert result["status"] == "skipped"
        assert result["method"] == "file_checksum"
        mock_check_file.assert_called_once()
        mock_complete.assert_called_once()

@pytest.mark.asyncio
async def test_pipeline_layer2_duplicate(pipeline):
    """Test Layer 2: Chặn khi trùng nội dung chữ."""
    job_id = uuid4()
    
    with patch("src.services.minio_service.minio_service.download_file", new_callable=AsyncMock) as mock_download, \
         patch("src.services.deduplicator.deduplicator.check_file_duplicate", new_callable=AsyncMock) as mock_check_file, \
         patch("src.services.extractors.orchestrator.orchestrator.extract", new_callable=AsyncMock) as mock_extract, \
         patch("src.services.deduplicator.deduplicator.check_content_duplicate", new_callable=AsyncMock) as mock_check_content, \
         patch("src.services.processing_job_service.processing_job_service.complete_job", new_callable=AsyncMock) as mock_complete, \
         patch("src.services.processing_job_service.processing_job_service.update_progress", new_callable=AsyncMock):
        
        mock_download.return_value = b"different_bytes"
        mock_check_file.return_value = DeduplicationResult(is_duplicate=False)
        
        mock_extract.return_value = ExtractedDocument(text="Same Content", chunks=[], page_count=1)
        mock_check_content.return_value = DeduplicationResult(is_duplicate=True, existing_version_id=uuid4(), method="content_hash")
        
        result = await pipeline.process(
            document_id=uuid4(),
            version_id=uuid4(),
            job_id=job_id,
            bucket_name="test-bucket",
            file_key="test.docx",
            metadata={}
        )
        
        assert result["status"] == "skipped"
        assert result["method"] == "content_hash"

@pytest.mark.asyncio
async def test_pipeline_full_success(pipeline, mock_session):
    """Test luồng thành công hoàn toàn."""
    job_id = uuid4()
    
    # Mocking session factory
    mock_factory = MagicMock()
    mock_factory.return_value = mock_session

    with patch("src.services.minio_service.minio_service.download_file", new_callable=AsyncMock) as mock_download, \
         patch("src.services.deduplicator.deduplicator.check_file_duplicate", new_callable=AsyncMock) as mock_check_file, \
         patch("src.services.deduplicator.deduplicator.check_content_duplicate", new_callable=AsyncMock) as mock_check_content, \
         patch("src.services.deduplicator.deduplicator.check_semantic_duplicate", new_callable=AsyncMock) as mock_check_semantic, \
         patch("src.services.extractors.orchestrator.orchestrator.extract", new_callable=AsyncMock) as mock_extract, \
         patch("src.services.embedding_service.embedding_service.embed_batch_cached", new_callable=AsyncMock) as mock_embed, \
         patch("src.db.repositories.chunk_repo.ChunkRepository.bulk_insert", new_callable=AsyncMock) as mock_chunk_save, \
         patch("src.db.repositories.version_repo.VersionRepository.update_version", new_callable=AsyncMock) as mock_ver_save, \
         patch("src.services.processing_job_service.processing_job_service.update_progress", new_callable=AsyncMock), \
         patch("src.services.processing_job_service.processing_job_service.complete_job", new_callable=AsyncMock), \
         patch("src.db.session.async_session", mock_factory):
        
        mock_download.return_value = b"new_file"
        mock_check_file.return_value = DeduplicationResult(is_duplicate=False)
        mock_check_content.return_value = DeduplicationResult(is_duplicate=False)
        mock_check_semantic.return_value = DeduplicationResult(is_duplicate=False, vector=[0.1]*1024)
        
        mock_extract.return_value = ExtractedDocument(text="New Content", chunks=[], page_count=5, language="vi")
        mock_embed.return_value = [[0.2]*1024]
        
        result = await pipeline.process(
            document_id=uuid4(),
            version_id=uuid4(),
            job_id=job_id,
            bucket_name="test-bucket",
            file_key="new.pdf",
            metadata={}
        )
        
        assert result["status"] == "completed"
        mock_chunk_save.assert_called_once()
        mock_ver_save.assert_called_once()
