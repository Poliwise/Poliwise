from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.repositories.job_repo import JobRepository


class ProcessingJobService:
    """Service for managing processing job status updates."""

    def __init__(self, job_repo: JobRepository):
        self.job_repo = job_repo

    async def mark_processing(self, job_id: UUID) -> None:
        """Mark job as processing started."""
        await self.job_repo.update_status(job_id, "PROCESSING", progress_percent=0)

    async def mark_progress(self, job_id: UUID, percent: int) -> None:
        """Update job progress percentage."""
        await self.job_repo.update_status(job_id, "PROCESSING", progress_percent=percent)

    async def mark_completed(self, job_id: UUID, metrics: dict) -> None:
        """Mark job as completed with output metrics."""
        import json
        await self.job_repo.mark_completed(job_id, output_metrics=json.dumps(metrics))

    async def mark_failed(self, job_id: UUID, error_message: str, error_details: str | None = None) -> None:
        """Mark job as failed with error information."""
        await self.job_repo.mark_failed(job_id, error_message, error_details)
