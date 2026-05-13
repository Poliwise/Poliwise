import structlog
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

            if token_count <= self.parent_size:
                chunks.append(
                    Chunk(
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
                    )
                )
            else:
                parent_chunk = Chunk(
                    document_id=metadata.get("document_id"),
                    document_version_id=metadata.get("version_id"),
                    document_version=metadata.get("document_version"),
                    chunk_type="parent",
                    content=section_text[: self.parent_size * 4],
                    section_title=section_title,
                    section_level=section_level,
                    section_path=section_path,
                    chunk_index=len(chunks),
                    token_count=self.parent_size,
                    allowed_roles=metadata.get("allowed_roles"),
                    allowed_departments=metadata.get("allowed_departments"),
                    allowed_users=metadata.get("allowed_users"),
                    access_level=metadata.get("access_level", "PUBLIC"),
                )
                chunks.append(parent_chunk)

                child_chunks = self._create_child_chunks(
                    section_text, section_title, section_level, section_path,
                    parent_chunk.chunk_index, metadata, enc
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

            chunk = Chunk(
                document_id=metadata.get("document_id"),
                document_version_id=metadata.get("version_id"),
                document_version=metadata.get("document_version"),
                chunk_type="parent",
                content=enc.decode(chunk_tokens),
                chunk_index=chunk_index,
                token_count=len(chunk_tokens),
                allowed_roles=metadata.get("allowed_roles"),
                allowed_departments=metadata.get("allowed_departments"),
                allowed_users=metadata.get("allowed_users"),
                access_level=metadata.get("access_level", "PUBLIC"),
            )
            chunks.append(chunk)
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
        self, text: str, section_title: str, section_level: int, section_path: list,
        parent_index: int, metadata: dict, enc
    ) -> list[Chunk]:
        """Create child chunks from parent text."""
        child_chunks = []
        tokens = enc.encode(text)

        start = 0
        parent_idx = parent_index

        while start < len(tokens):
            end = min(start + self.child_size, len(tokens))
            chunk_tokens = tokens[start:end]

            child_chunks.append(
                Chunk(
                    document_id=metadata.get("document_id"),
                    document_version_id=metadata.get("version_id"),
                    document_version=metadata.get("document_version"),
                    chunk_type="child",
                    content=enc.decode(chunk_tokens),
                    section_title=section_title,
                    section_level=section_level,
                    section_path=section_path,
                    chunk_index=parent_idx,
                    token_count=len(chunk_tokens),
                    allowed_roles=metadata.get("allowed_roles"),
                    allowed_departments=metadata.get("allowed_departments"),
                    allowed_users=metadata.get("allowed_users"),
                    access_level=metadata.get("access_level", "PUBLIC"),
                )
            )

            # Ensure we always move forward
            new_start = end - self.child_overlap
            if new_start <= start:
                start = end
            else:
                start = new_start

            parent_idx += 1

        return child_chunks
