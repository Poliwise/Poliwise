import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Integer, BigInteger, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from src.db.session import Base


class DocumentVersion(Base):
    """SQLAlchemy model for knowledge.document_versions table, an immutable record of document history."""
    __tablename__ = "document_versions"
    __table_args__ = {"schema": "knowledge"}

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(PG_UUID(as_uuid=True), nullable=False)
    version_number = Column(Integer, nullable=False)
    file_key = Column(String(500), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    changelog = Column(Text, nullable=True)
    extracted_text = Column(Text, nullable=True)
    is_current = Column(Boolean, default=False, nullable=False)
    created_by = Column(PG_UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Redundancy detection fields (Phase 2)
    file_checksum = Column(String(64), nullable=True)
    content_hash = Column(String(64), nullable=True)
    similarity_to_previous = Column(Float, nullable=True)
