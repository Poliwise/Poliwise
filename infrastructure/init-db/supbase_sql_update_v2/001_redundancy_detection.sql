-- ============================================================
-- POLIWISE MIGRATION V2: Redundancy Detection + Chunk Indexes
-- ============================================================
-- Phase 2 additions: file_checksum, content_hash, similarity fields
-- Required indexes for vector search and ACL filtering
-- ============================================================

BEGIN;

-- ============================================================
-- 1. document_versions: Add redundancy detection fields
-- ============================================================

ALTER TABLE knowledge.document_versions
ADD COLUMN IF NOT EXISTS file_checksum VARCHAR(64),
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS similarity_to_previous FLOAT;

COMMENT ON COLUMN knowledge.document_versions.file_checksum IS 'SHA256 of raw file bytes for exact duplicate detection';
COMMENT ON COLUMN knowledge.document_versions.content_hash IS 'SHA256 of extracted text for content deduplication';
COMMENT ON COLUMN knowledge.document_versions.similarity_to_previous IS 'Cosine similarity score vs previous version (0.0-1.0)';

-- ============================================================
-- 2. Indexes for redundancy detection
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_versions_file_checksum
ON knowledge.document_versions(file_checksum)
WHERE file_checksum IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_versions_content_hash
ON knowledge.document_versions(content_hash)
WHERE content_hash IS NOT NULL;

-- ============================================================
-- 3. chunks: Add missing structural fields for GitLab Handbook
-- ============================================================

ALTER TABLE knowledge.chunks
ADD COLUMN IF NOT EXISTS section_title VARCHAR(500),
ADD COLUMN IF NOT EXISTS section_level INT,
ADD COLUMN IF NOT EXISTS section_path VARCHAR(1000),
ADD COLUMN IF NOT EXISTS parent_chunk_id UUID REFERENCES knowledge.chunks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bucket_name VARCHAR(100);

COMMENT ON COLUMN knowledge.chunks.section_title IS 'Heading text for section this chunk belongs to';
COMMENT ON COLUMN knowledge.chunks.section_level IS 'Heading level (1=#, 2=##, 3=###, etc.)';
COMMENT ON COLUMN knowledge.chunks.section_path IS 'Hierarchical path like handbook/legal/policy';
COMMENT ON COLUMN knowledge.chunks.parent_chunk_id IS 'Parent chunk ID for parent-child chunking';
COMMENT ON COLUMN knowledge.chunks.bucket_name IS 'MinIO bucket for source file reference';

-- ============================================================
-- 4. Unique constraint for chunks (prevents duplicates)
-- ============================================================

-- Check if constraint exists first, add if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uniq_chunk_per_version'
    ) THEN
        ALTER TABLE knowledge.chunks
        ADD CONSTRAINT uniq_chunk_per_version
        UNIQUE (document_version_id, chunk_index, chunk_type);
    END IF;
END $$;

-- ============================================================
-- 5. HNSW vector index for embedding similarity search
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
ON knowledge.chunks
USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================
-- 6. GIN indexes for ACL filtering
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chunks_allowed_roles
ON knowledge.chunks USING GIN (allowed_roles);

CREATE INDEX IF NOT EXISTS idx_chunks_allowed_departments
ON knowledge.chunks USING GIN (allowed_departments);

CREATE INDEX IF NOT EXISTS idx_chunks_allowed_users
ON knowledge.chunks USING GIN (allowed_users);

-- ============================================================
-- 7. Full-text search (BM25) via TSVECTOR
-- ============================================================

ALTER TABLE knowledge.chunks
ADD COLUMN IF NOT EXISTS content_tsv TSVECTOR
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_chunks_content_tsv
ON knowledge.chunks USING GIN (content_tsv);

-- ============================================================
-- 8. Partial indexes for common query patterns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chunks_latest_children
ON knowledge.chunks (document_id, chunk_index)
WHERE is_latest = true AND chunk_type = 'child';

CREATE INDEX IF NOT EXISTS idx_chunks_document_version
ON knowledge.chunks (document_version_id);

CREATE INDEX IF NOT EXISTS idx_chunks_document_latest
ON knowledge.chunks (document_id)
WHERE is_latest = true;

-- ============================================================
-- 9. Indexes for chunks structural fields
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chunks_section_path
ON knowledge.chunks (section_path)
WHERE section_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chunks_search_filters
ON knowledge.chunks (is_latest, chunk_type)
WHERE is_latest = true AND chunk_type = 'child';

COMMIT;

-- ============================================================
-- Verification queries (run separately)
-- ============================================================

-- Check new columns exist
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'knowledge' AND table_name = 'document_versions'
-- AND column_name IN ('file_checksum', 'content_hash', 'similarity_to_previous');

-- Check indexes created
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname = 'knowledge' AND tablename = 'chunks';

-- Check HNSW index
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE schemaname = 'knowledge' AND indexname = 'idx_chunks_embedding_hnsw';