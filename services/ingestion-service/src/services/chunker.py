import structlog
import uuid
from typing import Optional
from uuid import UUID
from src.models.extraction import Chunk, StructuredText
from src.config.settings import settings

logger = structlog.get_logger()


class ParentChildChunker:
    """Hierarchical chunking for structured documents."""

    def __init__(
        self,
        parent_size: Optional[int] = None,
        child_size: Optional[int] = None,
        child_overlap: Optional[int] = None,
    ):
        self.parent_size = parent_size or settings.chunking_parent_size
        self.child_size = child_size or settings.chunking_child_size
        self.child_overlap = child_overlap or settings.chunking_child_overlap
        self._tokenizer = None

    def _get_tokenizer(self):
        """Lazy load tiktoken tokenizer."""
        if self._tokenizer is None:
            import tiktoken
            self._tokenizer = tiktoken.get_encoding("cl100k_base")
        return self._tokenizer

    def chunk(self, structured_text: StructuredText, metadata: dict) -> list[Chunk]:
        """Chunk document based on its structure."""
        if structured_text.headings:
            return self._hierarchical_chunk(structured_text, metadata)
        else:
            return self._recursive_chunk(structured_text.normalized_text, metadata)

    def _hierarchical_chunk(self, structured_text: StructuredText, metadata: dict) -> list[Chunk]:
        """Create parent-child chunks based on document heading structure."""
        chunks = []
        enc = self._get_tokenizer()
        
        for section in structured_text.sections:
            section_text = section.get("text", "")
            section_title = section.get("title", "")
            section_level = section.get("level", 1)
            section_path = section.get("path", [])

            if not section_text:
                continue

            token_count = len(enc.encode(section_text))
            parent_id = uuid.uuid4()

            # Always create a parent chunk
            parent_chunk = Chunk(
                chunk_id=parent_id,
                document_id=metadata.get("document_id"),
                document_version_id=metadata.get("version_id"),
                document_version=metadata.get("document_version"),
                chunk_type="parent",
                content=section_text,
                section_title=section_title,
                section_level=section_level,
                section_path=section_path,
                chunk_index=len(chunks),
                token_count=token_count,
                allowed_roles=metadata.get("allowed_roles"),
                allowed_departments=metadata.get("allowed_departments"),
                allowed_users=metadata.get("allowed_users"),
                access_level=metadata.get("access_level", "PUBLIC"),
                metadata=metadata,
            )
            chunks.append(parent_chunk)

            # Create child chunks if section is large enough or always if we want consistent strategy
            # For now, create children if token_count > child_size or if we want better retrieval
            if token_count > self.child_size:
                child_chunks = self._create_child_chunks(
                    section_text, section_title, section_level, section_path,
                    parent_id, metadata, enc
                )
                chunks.extend(child_chunks)

        if not chunks:
            return self._recursive_chunk(structured_text.normalized_text, metadata)

        return chunks

    def _recursive_chunk(self, text: str, metadata: dict) -> list[Chunk]:
        """Create chunks using recursive splitting with overlap."""
        chunks = []
        enc = self._get_tokenizer()
        tokens = enc.encode(text)

        if not tokens:
            return chunks

        start = 0
        chunk_index = 0

        while start < len(tokens):
            end = min(start + self.parent_size, len(tokens))
            chunk_tokens = tokens[start:end]
            parent_id = uuid.uuid4()
            parent_text = enc.decode(chunk_tokens)

            parent_chunk = Chunk(
                chunk_id=parent_id,
                document_id=metadata.get("document_id"),
                document_version_id=metadata.get("version_id"),
                document_version=metadata.get("document_version"),
                chunk_type="parent",
                content=parent_text,
                chunk_index=chunk_index,
                token_count=len(chunk_tokens),
                allowed_roles=metadata.get("allowed_roles"),
                allowed_departments=metadata.get("allowed_departments"),
                allowed_users=metadata.get("allowed_users"),
                access_level=metadata.get("access_level", "PUBLIC"),
                metadata=metadata,
            )
            chunks.append(parent_chunk)
            
            # Create child chunks for this parent
            child_chunks = self._create_child_chunks(
                parent_text, None, 1, [],
                parent_id, metadata, enc
            )
            chunks.extend(child_chunks)
            
            chunk_index += 1

            # Ensure we always move forward, even if overlap is large
            new_start = end - self.child_overlap
            if new_start <= start:
                start = end
            else:
                start = new_start

            if start >= len(tokens):
                break

        return chunks

    def _create_child_chunks(
        self, text: str, section_title: Optional[str], section_level: int, section_path: list,
        parent_id: UUID, metadata: dict, enc
    ) -> list[Chunk]:
        """Create child chunks from parent text."""
        child_chunks = []
        tokens = enc.encode(text)

        start = 0
        child_idx = 0

        while start < len(tokens):
            end = min(start + self.child_size, len(tokens))
            chunk_tokens = tokens[start:end]

            child_chunks.append(
                Chunk(
                    document_id=metadata.get("document_id"),
                    document_version_id=metadata.get("version_id"),
                    document_version=metadata.get("document_version"),
                    chunk_type="child",
                    parent_chunk_id=parent_id,
                    content=enc.decode(chunk_tokens),
                    section_title=section_title,
                    section_level=section_level,
                    section_path=section_path,
                    chunk_index=child_idx, # Local index within parent
                    token_count=len(chunk_tokens),
                    allowed_roles=metadata.get("allowed_roles"),
                    allowed_departments=metadata.get("allowed_departments"),
                    allowed_users=metadata.get("allowed_users"),
                    access_level=metadata.get("access_level", "PUBLIC"),
                    metadata=metadata,
                )
            )

            # Ensure we always move forward
            new_start = end - self.child_overlap
            if new_start <= start:
                start = end
            else:
                start = new_start

            child_idx += 1

        return child_chunks
