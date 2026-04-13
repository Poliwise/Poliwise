import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, BigInteger
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from src.db.session import Base


class Document(Base):
    """SQLAlchemy model for knowledge.documents table."""
    __tablename__ = "documents"
    __table_args__ = {"schema": "knowledge"}

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_filename = Column(String(500), nullable=False)
    status = Column(String(50), default='PENDING')
    current_version = Column(Integer, default=1)
    language = Column(String(10), default='en')
    chunking_strategy = Column(String(50), default='parent_child')
    chunk_size = Column(Integer, nullable=True)
    chunk_overlap = Column(Integer, nullable=True)
    embedding_model = Column(String(100), nullable=True)
    uploaded_by = Column(PG_UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
