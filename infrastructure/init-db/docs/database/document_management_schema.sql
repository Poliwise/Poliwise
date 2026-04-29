-- ============================================================
-- Document Management System - Full Schema
-- Schema: poliwise_knowledge (Document storage & versions)
-- Schema: poliwise_metadata (Categories, Tags, Access Rules)
-- ============================================================

-- ============================================================
-- SCHEMA 1: knowledge (Document Storage & Versions)
-- ============================================================

-- Documents table - core document records
CREATE TABLE IF NOT EXISTS knowledge.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'UNKNOWN',
    file_size_bytes BIGINT,
    mime_type VARCHAR(255),
    file_key VARCHAR(1000) NOT NULL,
    bucket_name VARCHAR(255) NOT NULL DEFAULT 'poliwise-documents',
    status VARCHAR(50) NOT NULL DEFAULT 'STAGING',
    current_version INTEGER DEFAULT 1,
    extracted_text TEXT,
    page_count INTEGER,
    word_count INTEGER,
    language VARCHAR(10) DEFAULT 'vi',
    ocr_required BOOLEAN DEFAULT FALSE,
    ocr_confidence DECIMAL(5,4),
    chunking_strategy VARCHAR(50) DEFAULT 'SENTENCE',
    chunk_size INTEGER DEFAULT 512,
    chunk_overlap INTEGER DEFAULT 50,
    embedding_model VARCHAR(50) DEFAULT 'MULTILINGUAL_E5',
    uploaded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Document versions table - version history for each document
CREATE TABLE IF NOT EXISTS knowledge.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_key VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT,
    changelog TEXT,
    extracted_text TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, version_number)
);

-- Processing jobs table - ETL pipeline tracking
CREATE TABLE IF NOT EXISTS knowledge.processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL DEFAULT 'PARSE',
    status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',
    progress_percent INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    success BOOLEAN,
    error_message TEXT,
    error_details TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Text chunks table - vector embeddings storage
CREATE TABLE IF NOT EXISTS knowledge.chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64),
    embedding_vector vector(384),  -- For multilingual-e5-small
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Embedding cache table - cache for repeated embeddings
CREATE TABLE IF NOT EXISTS knowledge.embedding_cache (
    content_hash VARCHAR(64) PRIMARY KEY,
    content TEXT NOT NULL,
    embedding_vector vector(384),
    model VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table - full audit trail for documents
CREATE TABLE IF NOT EXISTS knowledge.document_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES knowledge.documents(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    actor_id UUID,
    actor_username VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SCHEMA 2: metadata (Categories, Tags, Access Rules)
-- ============================================================

-- Categories table - hierarchical document categories
CREATE TABLE IF NOT EXISTS metadata.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES metadata.categories(id) ON DELETE SET NULL,
    icon VARCHAR(100),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table - document tagging
CREATE TABLE IF NOT EXISTS metadata.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#6366f1',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document metadata table - document information and lifecycle
CREATE TABLE IF NOT EXISTS metadata.document_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    document_type VARCHAR(50),  -- POLICY, GENERAL, etc.
    category_id UUID REFERENCES metadata.categories(id) ON DELETE SET NULL,
    department_id UUID,
    access_level VARCHAR(50) DEFAULT 'PUBLIC',
    effective_date DATE,
    expiry_date DATE,
    status VARCHAR(50) DEFAULT 'DRAFT',
    current_version INTEGER DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    published_by UUID,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(document_id)
);

-- Document tags junction table - many-to-many
CREATE TABLE IF NOT EXISTS metadata.document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_metadata_id UUID NOT NULL REFERENCES metadata.document_metadata(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES metadata.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_metadata_id, tag_id)
);

-- Document access rules table - ACL for documents
CREATE TABLE IF NOT EXISTS metadata.document_access_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_metadata_id UUID NOT NULL REFERENCES metadata.document_metadata(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL,  -- ROLE, DEPARTMENT, USER
    target_role VARCHAR(50),  -- USER, MANAGER, ADMIN
    target_department_id UUID,
    target_user_id UUID,
    permission VARCHAR(50) NOT NULL DEFAULT 'VIEW',  -- VIEW, DENY
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Metadata audit logs table - audit trail for metadata changes
CREATE TABLE IF NOT EXISTS metadata.metadata_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_metadata_id UUID,
    action VARCHAR(50) NOT NULL,
    actor_id UUID,
    actor_username VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_status ON knowledge.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON knowledge.documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON knowledge.documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON knowledge.documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON knowledge.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON knowledge.documents(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_status_deleted ON knowledge.documents(status, deleted_at) WHERE deleted_at IS NULL;

-- document_versions indexes
CREATE INDEX IF NOT EXISTS idx_versions_document_id ON knowledge.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_versions_document_version ON knowledge.document_versions(document_id, version_number DESC);

-- processing_jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_document_id ON knowledge.processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON knowledge.processing_jobs(status);

-- chunks indexes
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON knowledge.chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw ON knowledge.chunks USING hnsw (embedding_vector vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chunks_content_search ON knowledge.chunks USING gin(to_tsvector('simple', content));

-- document_audit_logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_document_id ON knowledge.document_audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON knowledge.document_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON knowledge.document_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON knowledge.document_audit_logs(created_at DESC);

-- categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON metadata.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON metadata.categories(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_categories_slug ON metadata.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON metadata.categories(display_order, name);

-- tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_slug ON metadata.tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON metadata.tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_name_search ON metadata.tags USING gin(to_tsvector('simple', name));

-- document_metadata indexes
CREATE INDEX IF NOT EXISTS idx_metadata_document_id ON metadata.document_metadata(document_id);
CREATE INDEX IF NOT EXISTS idx_metadata_status ON metadata.document_metadata(status);
CREATE INDEX IF NOT EXISTS idx_metadata_category_id ON metadata.document_metadata(category_id);
CREATE INDEX IF NOT EXISTS idx_metadata_deleted_at ON metadata.document_metadata(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_metadata_title_search ON metadata.document_metadata USING gin(to_tsvector('simple', title));

-- document_tags indexes
CREATE INDEX IF NOT EXISTS idx_doc_tags_metadata_id ON metadata.document_tags(document_metadata_id);
CREATE INDEX IF NOT EXISTS idx_doc_tags_tag_id ON metadata.document_tags(tag_id);

-- document_access_rules indexes
CREATE INDEX IF NOT EXISTS idx_access_rules_metadata_id ON metadata.document_access_rules(document_metadata_id);
CREATE INDEX IF NOT EXISTS idx_access_rules_target ON metadata.document_access_rules(target_type, target_role, target_department_id, target_user_id);

-- metadata_audit_logs indexes
CREATE INDEX IF NOT EXISTS idx_metadata_audit_metadata_id ON metadata.metadata_audit_logs(document_metadata_id);
CREATE INDEX IF NOT EXISTS idx_metadata_audit_created_at ON metadata.metadata_audit_logs(created_at DESC);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION knowledge.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_documents_updated_at ON knowledge.documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON knowledge.documents
    FOR EACH ROW
    EXECUTE FUNCTION knowledge.update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON metadata.categories;
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON metadata.categories
    FOR EACH ROW
    EXECUTE FUNCTION knowledge.update_updated_at_column();

DROP TRIGGER IF EXISTS update_metadata_updated_at ON metadata.document_metadata;
CREATE TRIGGER update_metadata_updated_at
    BEFORE UPDATE ON metadata.document_metadata
    FOR EACH ROW
    EXECUTE FUNCTION knowledge.update_updated_at_column();

-- Function to auto-decrement tag usage count when document tag removed
CREATE OR REPLACE FUNCTION metadata.decrement_tag_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE metadata.tags SET usage_count = GREATEST(0, usage_count - 1)
    WHERE id = OLD.tag_id;
    RETURN OLD;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS decrement_tag_usage_on_delete ON metadata.document_tags;
CREATE TRIGGER decrement_tag_usage_on_delete
    AFTER DELETE ON metadata.document_tags
    FOR EACH ROW
    EXECUTE FUNCTION metadata.decrement_tag_usage();

-- ============================================================
-- ENUMS (PostgreSQL custom types)
-- ============================================================

-- File types enum
DO $$ BEGIN
    CREATE TYPE knowledge.file_type AS ENUM ('PDF', 'DOCX', 'DOC', 'XLSX', 'XLS', 'TXT', 'PNG', 'JPG', 'JPEG', 'UNKNOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Processing status enum
DO $$ BEGIN
    CREATE TYPE knowledge.processing_status AS ENUM (
        'STAGING',      -- File uploaded, waiting for metadata confirmation
        'UPLOADED',     -- Metadata confirmed, queued for processing
        'PARSING',      -- Parsing document content
        'PARSED',       -- Content parsed successfully
        'CHUNKING',     -- Splitting content into chunks
        'CHUNKED',      -- Content chunked successfully
        'EMBEDDING',    -- Generating vector embeddings
        'EMBEDDED',     -- Embeddings generated
        'INDEXING',     -- Indexing chunks in vector DB
        'INDEXED',      -- Chunks indexed
        'READY',        -- Fully processed and ready
        'FAILED',       -- Processing failed
        'CANCELLED'     -- Upload cancelled
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Processing step enum
DO $$ BEGIN
    CREATE TYPE knowledge.processing_step AS ENUM ('PARSE', 'CHUNK', 'EMBED', 'INDEX');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Chunking strategy enum
DO $$ BEGIN
    CREATE TYPE knowledge.chunking_strategy AS ENUM ('SENTENCE', 'PARAGRAPH', 'PAGE', 'FIXED_SIZE', 'RECURSIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Embedding model enum
DO $$ BEGIN
    CREATE TYPE knowledge.embedding_model AS ENUM ('MULTILINGUAL_E5', 'SENTENCE_BERT', 'OPENAI_ADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Document status enum (metadata)
DO $$ BEGIN
    CREATE TYPE metadata.document_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Access level enum (metadata)
DO $$ BEGIN
    CREATE TYPE metadata.access_level AS ENUM ('PUBLIC', 'DEPARTMENT_ONLY', 'RESTRICTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User role enum (core)
DO $$ BEGIN
    CREATE TYPE core.user_role AS ENUM ('USER', 'MANAGER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE knowledge.documents IS 'Core document storage with MinIO reference';
COMMENT ON TABLE knowledge.document_versions IS 'Version history for each document';
COMMENT ON TABLE knowledge.processing_jobs IS 'ETL pipeline job tracking';
COMMENT ON TABLE knowledge.chunks IS 'Text chunks with vector embeddings for RAG';
COMMENT ON TABLE knowledge.document_audit_logs IS 'Full audit trail for document operations';

COMMENT ON TABLE metadata.categories IS 'Hierarchical document categories';
COMMENT ON TABLE metadata.tags IS 'Document tags with usage tracking';
COMMENT ON TABLE metadata.document_metadata IS 'Document metadata and lifecycle management';
COMMENT ON TABLE metadata.document_tags IS 'Many-to-many junction for document tags';
COMMENT ON TABLE metadata.document_access_rules IS 'ACL rules for document access control';
COMMENT ON TABLE metadata.metadata_audit_logs IS 'Audit trail for metadata changes';

-- ============================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================

-- Insert sample categories
INSERT INTO metadata.categories (id, name, slug, description, display_order, is_active) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Chính sách nhân sự', 'chinh-sach-nhan-su', 'Các chính sách liên quan đến nhân sự và tuyển dụng', 1, TRUE),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Quy chế tài chính', 'quy-che-tai-chinh', 'Quy chế về tài chính và ngân sách', 2, TRUE),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Quy định văn hóa', 'quy-dinh-van-hoa', 'Quy định về văn hóa doanh nghiệp', 3, TRUE),
    ('d4e5f6a7-b8c9-0123-defa-234567890123', 'An toàn lao động', 'an-toan-lao-dong', 'Quy định về an toàn và vệ sinh lao động', 4, TRUE),
    ('e5f6a7b8-c9d0-1234-efab-345678901234', 'Quy trình nghiệp vụ', 'quy-trinh-nghiep-vu', 'Các quy trình nghiệp vụ nội bộ', 5, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample tags
INSERT INTO metadata.tags (id, name, slug, color) VALUES
    ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'Quan trọng', 'quan-trong', '#ef4444'),
    ('a7b8c9d0-e1f2-3456-abcd-567890123456', 'Mới', 'moi', '#22c55e'),
    ('b8c9d0e1-f2a3-4567-bcde-678901234567', 'Cập nhật', 'cap-nhat', '#3b82f6'),
    ('c9d0e1f2-a3b4-5678-cdef-789012345678', 'Cần xem xét', 'can-xem-xet', '#f59e0b'),
    ('d0e1f2a3-b4c5-6789-defa-890123456789', 'Nội bộ', 'noi-bo', '#8b5cf6')
ON CONFLICT (slug) DO NOTHING;
