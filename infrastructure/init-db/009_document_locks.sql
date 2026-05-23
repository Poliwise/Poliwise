-- ============================================================
-- FILE: 009_document_locks.sql
-- SCHEMA: KNOWLEDGE
-- Contains: Document edit locks for OnlyOffice integration
-- ============================================================
-- One lock per document. A lock records who is editing, which
-- version was locked, and when the lock expires (auto-release).
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge.document_locks (
    document_id      UUID PRIMARY KEY REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    locked_by        UUID NOT NULL,
    locked_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at       TIMESTAMPTZ NOT NULL,
    lock_token       UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    version_at_lock  INT NOT NULL,

    -- Who owns the lock (for display in UI)
    locked_by_username VARCHAR(255)
);

COMMENT ON TABLE knowledge.document_locks IS 'Edit locks for OnlyOffice document editor — prevents concurrent edits and detects version conflicts';
COMMENT ON COLUMN knowledge.document_locks.lock_token IS 'UUID token returned to the editor; must be passed back on save callback to verify ownership';
COMMENT ON COLUMN knowledge.document_locks.version_at_lock IS 'The document version that was locked — used to detect if newer versions were uploaded by others';

-- Auto-expire stale locks
CREATE INDEX idx_locks_expires ON knowledge.document_locks(expires_at);

-- ============================================================
-- TABLE: knowledge.document_version_deletions
-- Track which version was deleted (for audit / rollback safety)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge.document_version_deletions (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id      UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    version_number   INT NOT NULL,
    deleted_by       UUID NOT NULL,
    deleted_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Snapshot of the deleted version for recovery
    file_key         VARCHAR(500),
    file_size_bytes  BIGINT,
    changelog        TEXT,
    extracted_text   TEXT,

    CONSTRAINT uq_version_deletion UNIQUE (document_id, version_number)
);

COMMENT ON TABLE knowledge.document_version_deletions IS 'Soft-delete archive for document versions — allows recovery of accidentally deleted versions';
