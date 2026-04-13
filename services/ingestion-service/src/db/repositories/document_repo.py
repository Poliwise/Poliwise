from typing import Optional
from uuid import UUID
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.document import Document


class DocumentRepository:
    """Repository for document database operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, document_id: UUID) -> Optional[Document]:
        """Get document by ID."""
        result = await self.session.execute(
            select(Document).where(Document.id == document_id, Document.deleted_at == None)
        )
        return result.scalar_one_or_none()

    async def update_extracted_text(
        self, document_id: UUID, extracted_text: str, page_count: int, word_count: int
    ) -> None:
        """Update document with extracted text and metadata."""
        await self.session.execute(
            update(Document)
            .where(Document.id == document_id)
            .values(
                extracted_text=extracted_text,
                page_count=page_count,
                word_count=word_count,
            )
        )
