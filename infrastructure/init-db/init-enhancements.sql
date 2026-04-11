-- =====================================================
-- AI INGESTION ENHANCEMENTS — Post-initial schema
-- =====================================================
-- Run this AFTER infrastructure/init-db/init.sql
-- Adds indexes and columns needed for ingestion-service & ai-qa-service
-- This script is IDEMPOTENT — safe to run multiple times.
-- =====================================================

-- Enable required extensions (safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- =====================================================
-- KNOWLEDGE SCHEMA — AI Search Infrastructure
-- =====================================================

-- 1. BM25: Full-text search vector (English) — GENERATED column
ALTER TABLE knowledge.chunks
ADD COLUMN IF NOT EXISTS content_tsv TSVECTOR
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- 2. HNSW index for vector similarity search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
ON knowledge.chunks
USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. GIN indexes for ACL array filtering (read-optimized permissions)
CREATE INDEX IF NOT EXISTS idx_chunks_allowed_roles
ON knowledge.chunks USING GIN (allowed_roles);

CREATE INDEX IF NOT EXISTS idx_chunks_allowed_departments
ON knowledge.chunks USING GIN (allowed_departments);

CREATE INDEX IF NOT EXISTS idx_chunks_allowed_users
ON knowledge.chunks USING GIN (allowed_users);

-- 4. GIN index for JSONB section_path (hierarchical path queries)
CREATE INDEX IF NOT EXISTS idx_chunks_section_path
ON knowledge.chunks USING GIN (section_path);

-- 5. Composite index for the most common query pattern:
--    latest child chunks for vector search
CREATE INDEX IF NOT EXISTS idx_chunks_search_filters
ON knowledge.chunks (is_latest, chunk_type, document_id)
WHERE is_latest = true AND chunk_type = 'child';

-- 6. GIN index for BM25 full-text search (hybrid retrieval)
CREATE INDEX IF NOT EXISTS idx_chunks_content_tsv
ON knowledge.chunks USING GIN (content_tsv);

-- 7. Unique constraint for idempotent chunk insertion
CREATE UNIQUE INDEX IF NOT EXISTS uniq_chunk_per_version
ON knowledge.chunks (document_version_id, chunk_index, chunk_type);

-- =====================================================
-- METADATA SCHEMA — Performance Indexes
-- =====================================================

-- Fast lookup of access rules for a document (used during ingestion to flatten ACL)
CREATE INDEX IF NOT EXISTS idx_document_access_rules_document
ON metadata.document_access_rules (document_metadata_id);

-- Efficient queries for published/effective documents
CREATE INDEX IF NOT EXISTS idx_document_metadata_status
ON metadata.document_metadata (status, effective_date, expiry_date)
WHERE deleted_at IS NULL;

-- Category hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_categories_parent
ON metadata.categories (parent_id);

-- Document metadata join (soft-delete aware)
CREATE INDEX IF NOT EXISTS idx_document_metadata_document
ON metadata.document_metadata (document_id) WHERE deleted_at IS NULL;

-- =====================================================
-- CONVERSATION SCHEMA — AI Chat History (for ai-qa-service)
-- =====================================================

-- Get latest conversations per user (for sidebar)
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
ON conversation.conversations (user_id, updated_at DESC);

-- Fetch messages for a conversation in chronological order
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON conversation.messages (conversation_id, created_at ASC);

-- Soft-delete aware index for messages
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
ON conversation.messages (deleted_at) WHERE deleted_at IS NULL;

-- Full-text search on message content (search in chat history)
ALTER TABLE conversation.messages
ADD COLUMN IF NOT EXISTS content_tsv TSVECTOR
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_messages_content_tsv
ON conversation.messages USING GIN (content_tsv);

-- =====================================================
-- ANALYTICS SCHEMA — Usage Tracking
-- =====================================================

-- Feedback queries by user
CREATE INDEX IF NOT EXISTS idx_feedback_user
ON analytics.feedbacks (user_id, created_at DESC);

-- Unanswered questions queue (admin review)
CREATE INDEX IF NOT EXISTS idx_unanswered_priority
ON analytics.unanswered_questions (priority, created_at DESC)
WHERE resolved = false;

-- Usage stats aggregation by service/endpoint/date
CREATE INDEX IF NOT EXISTS idx_usage_stats_service_date
ON analytics.usage_stats (service_name, created_at, endpoint);

-- Daily aggregates for reporting
CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date
ON analytics.daily_aggregates (date DESC);

-- Department stats
CREATE INDEX IF NOT EXISTS idx_department_daily_stats
ON analytics.department_daily_stats (date DESC, department_id);

-- =====================================================
-- GRANTS (if using role-based access control)
-- =====================================================
-- Uncomment if you use separate DB roles for each service:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA knowledge TO poliwise_ingestion;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA metadata TO poliwise_ingestion;
-- GRANT SELECT ON ALL TABLES IN SCHEMA knowledge TO poliwise_ai_qa;
