import httpx
from src.config.settings import settings


class EmbeddingService:
    """Service for generating embeddings via LitServe."""

    def __init__(self):
        self.embedding_url = settings.litserve_embedding_url
        self.reranker_url = settings.litserve_reranker_url

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a batch of texts.
        Returns list of embedding vectors.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.embedding_url}/predict",
                json={"inputs": texts},
                timeout=120.0,
            )
            response.raise_for_status()
            return response.json()["outputs"]

    async def rerank(self, query: str, documents: list[str]) -> list[dict]:
        """
        Rerank documents based on query relevance.
        Returns list of {index, score} dicts.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.reranker_url}/predict",
                json={"query": query, "documents": documents},
                timeout=60.0,
            )
            response.raise_for_status()
            return response.json()["outputs"]


# Global service instance
embedding_service = EmbeddingService()
