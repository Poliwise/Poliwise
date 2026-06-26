-- ============================================================
-- Migration: 003_onlyoffice_document_locks.sql
-- Date: 2026-06-22
-- Description: Add document edit locks and version deletions for OnlyOffice
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge.document_locks (
    document_id      UUID PRIMARY KEY REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    locked_by        UUID NOT NULL,
    locked_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at       TIMESTAMPTZ NOT NULL,
    lock_token       UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    version_at_lock  INT NOT NULL,
    locked_by_username VARCHAR(255)
);

COMMENT ON TABLE knowledge.document_locks IS 'Edit locks for OnlyOffice document editor — prevents concurrent edits and detects version conflicts';
COMMENT ON COLUMN knowledge.document_locks.lock_token IS 'UUID token returned to the editor; must be passed back on save callback to verify ownership';
COMMENT ON COLUMN knowledge.document_locks.version_at_lock IS 'The document version that was locked — used to detect if newer versions were uploaded by others';

CREATE INDEX IF NOT EXISTS idx_locks_expires ON knowledge.document_locks(expires_at);

CREATE TABLE IF NOT EXISTS knowledge.document_version_deletions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id      UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    version_number   INT NOT NULL,
    deleted_by       UUID NOT NULL,
    deleted_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    file_key         VARCHAR(500),
    file_size_bytes  BIGINT,
    changelog        TEXT,
    extracted_text   TEXT,
    CONSTRAINT uq_version_deletion UNIQUE (document_id, version_number)
);

COMMENT ON TABLE knowledge.document_version_deletions IS 'Soft-delete archive for document versions — allows recovery of accidentally deleted versions';
