from uuid import UUID
from typing import List, Optional
import asyncpg
import structlog

from ...db.session import get_connection, release_connection
from ...models.retrieval import RetrievalChunk, RetrievalFilters

logger = structlog.get_logger()


class ChunkRepository:
    async def vector_search(
        self,
        query_embedding: List[float],
        user_id: UUID,
        user_role: str,
        user_department_id: Optional[UUID],
        filters: Optional[RetrievalFilters] = None,
        limit: int = 10
    ) -> List[RetrievalChunk]:
        conn = await get_connection()
        try:
            user_roles = [user_role]
            user_departments = [str(user_department_id)] if user_department_id else []
            user_ids = [str(user_id)]

            doc_filter = ""
            if filters and filters.document_ids:
                doc_filter = f"AND c.document_id = ANY(${5})"
                params = [query_embedding, user_roles, user_departments, user_ids, [str(d) for d in filters.document_ids], limit]
            else:
                params = [query_embedding, user_roles, user_departments, user_ids, limit]

            query = f"""
                SELECT c.id, c.document_id, dm.title as document_name, c.content,
                       c.section_title,
                       (c.embedding_vector <=> $1::vector) as distance,
                       c.metadata
                FROM knowledge.chunks c
                LEFT JOIN metadata.document_metadata dm ON dm.document_id = c.document_id
                WHERE c.is_latest = true
                  AND c.deleted_at IS NULL
                  AND c.embedding_vector IS NOT NULL
                  AND (c.access_level = 'PUBLIC'
                       OR c.allowed_roles && $2::core.user_role[]
                       OR c.allowed_departments && $3::uuid[]
                       OR c.allowed_users && $4::uuid[])
                  {doc_filter}
                ORDER BY distance ASC
                LIMIT ${len(params)}
            """

            rows = await conn.fetch(query, *params)

            chunks = []
            for row in rows:
                distance = row['distance']
                similarity = 1.0 - distance if distance is not None else 0.0
                chunks.append(RetrievalChunk(
                    id=row['id'],
                    document_id=row['document_id'],
                    document_name=row.get('document_name'),
                    content=row['content'],
                    section_title=row.get('section_title'),
                    similarity_score=similarity,
                    metadata=row.get('metadata')
                ))

            return chunks
        finally:
            await release_connection(conn)

    async def bm25_search(
        self,
        query: str,
        user_id: UUID,
        user_role: str,
        user_department_id: Optional[UUID],
        filters: Optional[RetrievalFilters] = None,
        limit: int = 10
    ) -> List[RetrievalChunk]:
        conn = await get_connection()
        try:
            user_roles = [user_role]
            user_departments = [str(user_department_id)] if user_department_id else []
            user_ids = [str(user_id)]

            doc_filter = ""
            if filters and filters.document_ids:
                doc_filter = f"AND c.document_id = ANY(${6})"
                params = [query, user_roles, user_departments, user_ids, [str(d) for d in filters.document_ids], limit]
            else:
                params = [query, user_roles, user_departments, user_ids, limit]

            sql_query = f"""
                SELECT c.id, c.document_id, dm.title as document_name, c.content,
                       c.section_title,
                       ts_rank(c.content_tsv, plainto_tsquery('english', $1)) as rank,
                       c.metadata
                FROM knowledge.chunks c
                LEFT JOIN metadata.document_metadata dm ON dm.document_id = c.document_id
                WHERE c.content_tsv @@ plainto_tsquery('english', $1)
                  AND c.is_latest = true
                  AND c.deleted_at IS NULL
                  AND (c.access_level = 'PUBLIC'
                       OR c.allowed_roles && $2::core.user_role[]
                       OR c.allowed_departments && $3::uuid[]
                       OR c.allowed_users && $4::uuid[])
                  {doc_filter}
                ORDER BY rank DESC
                LIMIT ${len(params)}
            """

            rows = await conn.fetch(sql_query, *params)

            chunks = []
            for row in rows:
                rank = row.get('rank', 0)
                similarity = min(rank * 10, 1.0)
                chunks.append(RetrievalChunk(
                    id=row['id'],
                    document_id=row['document_id'],
                    document_name=row.get('document_name'),
                    content=row['content'],
                    section_title=row.get('section_title'),
                    similarity_score=similarity,
                    metadata=row.get('metadata')
                ))

            return chunks
        finally:
            await release_connection(conn)


chunk_repository = ChunkRepository()