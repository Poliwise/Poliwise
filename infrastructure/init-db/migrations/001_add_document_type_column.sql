-- Migration: Add document_type column to document_versions
-- Fixes: ingestion-service schema mismatch error
-- Error: column document_versions.document_type does not exist
-- Run this on existing databases to add the missing column

ALTER TABLE knowledge.document_versions
ADD COLUMN IF NOT EXISTS document_type VARCHAR(50);

COMMENT ON COLUMN knowledge.document_versions.document_type IS 'Document type (pdf, docx, etc.) for ingestion-service compatibility';
