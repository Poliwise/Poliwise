from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_session
from src.services.pipeline import pipeline
from src.db.repositories.job_repo import JobRepository
from src.api.dependencies import get_api_key

router = APIRouter()
logger = structlog.get_logger()


class IngestRequest(BaseModel):
    """Request payload for manual ingestion."""
    document_id: UUID
    document_version_id: UUID
    document_version: int
    file_key: str
    bucket_name: str
    job_id: UUID
    metadata: Optional[dict] = None


class IngestResponse(BaseModel):
    """Response for ingestion request."""
    job_id: UUID
    status: str
    message: str


class JobStatusResponse(BaseModel):
    """Response for job status query."""
    job_id: UUID
    status: str
    progress_percent: Optional[int] = None
    error_message: Optional[str] = None


@router.post("/ingest", response_model=IngestResponse, dependencies=[Depends(get_api_key)])
async def ingest_document(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
):
    """
    Manually trigger ingestion for a document.
    Runs in the background task to not block the request.
    """
    logger.info("manual_ingest_requested", job_id=str(request.job_id))
    
    # Start the pipeline in background
    background_tasks.add_task(
        pipeline.process,
        document_id=request.document_id,
        version_id=request.document_version_id,
        document_version=request.document_version,
        job_id=request.job_id,
        bucket_name=request.bucket_name,
        file_key=request.file_key,
        metadata=request.metadata or {}
    )

    return IngestResponse(
        job_id=request.job_id,
        status="processing",
        message="Ingestion job started in background",
    )


@router.get("/ingest/{job_id}/status", response_model=JobStatusResponse, dependencies=[Depends(get_api_key)])
async def get_ingestion_status(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get current status and progress of an ingestion job.
    """
    repo = JobRepository(session)
    job = await repo.get_by_id(job_id)
    
    if not job:
        raise HTTPException(status_status=404, detail="Job not found")
        
    return JobStatusResponse(
        job_id=job.id,
        status=job.status,
        progress_percent=job.progress_percent,
        error_message=job.error_message
    )
