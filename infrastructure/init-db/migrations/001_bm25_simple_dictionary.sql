-- Migration: Change BM25 text search from 'english' to 'simple' for Vietnamese support
-- Date: 2026-05-21
-- Issue: M7 - English stemmer produces poor results for Vietnamese content

-- Drop existing generated columns (will be recreated with 'simple' dictionary)
ALTER TABLE knowledge.chunks DROP COLUMN IF EXISTS content_tsv;
ALTER TABLE conversation.messages DROP COLUMN IF EXISTS content_tsv;

-- Recreate with 'simple' dictionary (lowercase + split, no stemming)
ALTER TABLE knowledge.chunks
    ADD COLUMN content_tsv TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

ALTER TABLE conversation.messages
    ADD COLUMN content_tsv TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

-- Recreate GIN indexes (dropped automatically when column dropped, but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_chunks_content_tsv
    ON knowledge.chunks USING GIN (content_tsv);

CREATE INDEX IF NOT EXISTS idx_messages_content_tsv
    ON conversation.messages USING GIN (content_tsv);
