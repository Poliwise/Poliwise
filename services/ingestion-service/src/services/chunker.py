import tiktoken
from typing import Optional
from uuid import UUID, uuid4
from src.models.extraction import Chunk, StructuredText
from src.config.settings import settings


class ParentChildChunker:
    """Hierarchical chunking for structured documents, recursive for unstructured."""

    def __init__(
        self,
        parent_size: Optional[int] = None,
        child_size: Optional[int] = None,
        child_overlap: Optional[int] = None,
    ):
        self.parent_size = parent_size or settings.chunking_parent_size
        self.child_size = child_size or settings.chunking_child_size
        self.child_overlap = child_overlap or settings.chunking_child_overlap
        self.enc = tiktoken.get_encoding("cl100k_base")

    def chunk(self, structured_text: StructuredText, metadata: dict) -> list[Chunk]:
        """Chunk document based on its structure."""
        if structured_text.headings:
            return self._hierarchical_chunk(structured_text, metadata)
        else:
            return self._recursive_chunk(structured_text.normalized_text, metadata)

    def _hierarchical_chunk(self, structured_text: StructuredText, metadata: dict) -> list[Chunk]:
        """Create chunks based on document heading structure."""
        # TODO: Implement hierarchical chunking with heading awareness
        chunks = []
        return chunks

    def _recursive_chunk(self, text: str, metadata: dict) -> list[Chunk]:
        """Create chunks using recursive character splitting."""
        # TODO: Implement recursive chunking with overlap
        chunks = []
        return chunks
