from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_session

router = APIRouter()


class IngestRequest(BaseModel):
    """Request payload for manual ingestion."""
    document_id: UUID
    document_version_id: UUID
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


@router.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    request: IngestRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Manually trigger ingestion for a document.
    This endpoint can be used for testing or manual ingestion.
    """
    # TODO: Implement actual ingestion logic
    # 1. Validate request
    # 2. Download file from MinIO
    # 3. Extract text
    # 4. Process chunks
    # 5. Embed and save to DB

    return IngestResponse(
        job_id=request.job_id,
        status="queued",
        message="Ingestion job queued successfully",
    )


@router.get("/ingest/{job_id}/status", response_model=JobStatusResponse)
async def get_ingestion_status(
    job_id: UUID,
    session: AsyncSession = Depends(get_session),
):
    """
    Get status of an ingestion job.
    """
    # TODO: Query job status from database
    # For now, return a placeholder
    return JobStatusResponse(
        job_id=job_id,
        status="pending",
        progress_percent=None,
        error_message=None,
    )
