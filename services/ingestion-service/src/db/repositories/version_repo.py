from typing import Optional
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.document_version import DocumentVersion


class VersionRepository:
    """Repository for document version database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, version_id: UUID) -> Optional[DocumentVersion]:
        """Get document version by ID."""
        result = await self.session.execute(
            select(DocumentVersion).where(
                DocumentVersion.id == version_id,
                DocumentVersion.deleted_at == None
            )
        )
        return result.scalar_one_or_none()

    async def mark_not_current(self, document_id: UUID) -> None:
        """Mark all versions for a document as not current."""
        await self.session.execute(
            update(DocumentVersion)
            .where(DocumentVersion.document_id == document_id, DocumentVersion.is_current == True)
            .values(is_current=False)
        )

    async def update_extracted_text(self, version_id: UUID, extracted_text: str) -> None:
        """Update version with extracted text."""
        await self.session.execute(
            update(DocumentVersion)
            .where(DocumentVersion.id == version_id)
            .values(extracted_text=extracted_text)
        )
