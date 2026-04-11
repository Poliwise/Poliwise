-- ============================================================
-- SCHEMA: KNOWLEDGE
-- Contains: Documents, Chunks, Processing jobs
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- ENUM TYPES (in knowledge schema)
-- ============================================================
CREATE TYPE knowledge.processing_status AS ENUM (
    'UPLOADED', 'PARSING', 'PARSED', 'CHUNKING', 'CHUNKED',
    'EMBEDDING', 'EMBEDDED', 'INDEXING', 'INDEXED', 'READY', 'FAILED'
);

CREATE TYPE knowledge.processing_step AS ENUM ('UPLOAD', 'PARSE', 'CHUNK', 'EMBED', 'INDEX');

CREATE TYPE knowledge.file_type AS ENUM ('PDF', 'DOCX', 'XLSX', 'DOC', 'XLS', 'TXT', 'PNG', 'JPG', 'JPEG');

CREATE TYPE knowledge.chunking_strategy AS ENUM ('RECURSIVE', 'SEMANTIC', 'FIXED_SIZE', 'SENTENCE');

CREATE TYPE knowledge.embedding_model AS ENUM ('TEXT_EMBEDDING_3_SMALL', 'TEXT_EMBEDDING_3_LARGE', 'MULTILINGUAL_E5_LARGE');

CREATE TYPE knowledge.chunk_type AS ENUM ('parent', 'child');

CREATE TYPE knowledge.content_quality AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'REDIRECT');

-- ============================================================
-- TABLE: knowledge.documents
-- ============================================================
CREATE TABLE knowledge.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    original_filename VARCHAR(255) NOT NULL,
    file_type knowledge.file_type NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    
    file_key VARCHAR(500) NOT NULL,
    bucket_name VARCHAR(100) NOT NULL DEFAULT 'poliwise-documents',
    
    status knowledge.processing_status NOT NULL DEFAULT 'UPLOADED',
    current_version INT NOT NULL DEFAULT 1,
    
    extracted_text TEXT,
    page_count INT,
    word_count INT,
    language VARCHAR(10) DEFAULT 'vi',

    domain VARCHAR(50),
    content_quality knowledge.content_quality,

    ocr_required BOOLEAN DEFAULT FALSE,
    ocr_confidence DECIMAL(5,4),
    
    chunking_strategy knowledge.chunking_strategy DEFAULT 'RECURSIVE',
    chunk_size INT DEFAULT 1000,
    chunk_overlap INT DEFAULT 200,
    embedding_model knowledge.embedding_model DEFAULT 'TEXT_EMBEDDING_3_SMALL',
    
    uploaded_by UUID NOT NULL, -- References core.users
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    trace_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',

    CONSTRAINT chk_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
    CONSTRAINT chk_version CHECK (current_version >= 1)
);

CREATE INDEX idx_knowledge_documents_status ON knowledge.documents(status);
CREATE INDEX idx_knowledge_documents_file_type ON knowledge.documents(file_type);
CREATE INDEX idx_knowledge_documents_uploaded_by ON knowledge.documents(uploaded_by);
CREATE INDEX idx_knowledge_documents_deleted_at ON knowledge.documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_documents_trace_id ON knowledge.documents(trace_id);
CREATE INDEX idx_knowledge_documents_domain ON knowledge.documents(domain);
CREATE INDEX idx_knowledge_documents_content_quality ON knowledge.documents(content_quality);

-- ============================================================
-- TABLE: knowledge.document_versions
-- ============================================================
CREATE TABLE knowledge.document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    
    file_key VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    changelog TEXT,
    extracted_text TEXT,
    is_current BOOLEAN DEFAULT FALSE,

    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_document_version UNIQUE (document_id, version_number),
    CONSTRAINT chk_version_number CHECK (version_number >= 1)
);

CREATE INDEX idx_knowledge_document_versions_document_id ON knowledge.document_versions(document_id);
CREATE INDEX idx_knowledge_document_versions_is_current ON knowledge.document_versions(is_current) WHERE is_current = TRUE;

-- Ensure only one current version per document
CREATE UNIQUE INDEX idx_one_current_version_per_doc
ON knowledge.document_versions(document_id)
WHERE is_current = true;

-- ============================================================
-- TABLE: knowledge.chunks
-- ============================================================
CREATE TABLE knowledge.chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    document_version_id UUID REFERENCES knowledge.document_versions(id) ON DELETE CASCADE,
    document_version INT NOT NULL,

    chunk_index INT NOT NULL,
    chunk_type knowledge.chunk_type DEFAULT 'child',

    content TEXT NOT NULL,
    content_length INT NOT NULL,
    token_count INT,

    page_number INT,
    start_char_index INT,
    end_char_index INT,

    embedding_model knowledge.embedding_model,
    embedding_dimension INT,
    vector_indexed BOOLEAN DEFAULT FALSE,
    vector_id VARCHAR(100),
    embedding_vector vector(1024),

    -- Denormalized metadata for filtering
    department_id UUID,
    document_type VARCHAR(50),
    effective_date DATE,
    expiry_date DATE,

    -- GitLab Handbook hierarchical section metadata
    section_title VARCHAR(500),
    section_level INT,
    section_path TEXT[],

    -- Access control (pre-flattened for fast vector search)
    allowed_roles core.user_role[],
    allowed_departments UUID[],
    allowed_users UUID[],
    access_level VARCHAR(20) DEFAULT 'PUBLIC',

    is_latest BOOLEAN DEFAULT TRUE,
    parent_chunk_id UUID REFERENCES knowledge.chunks(id) ON DELETE SET NULL,

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_chunk_index CHECK (chunk_index >= 0),
    CONSTRAINT chk_content_length CHECK (content_length > 0)
);

CREATE INDEX idx_knowledge_chunks_document_id ON knowledge.chunks(document_id);
CREATE INDEX idx_knowledge_chunks_document_version_id ON knowledge.chunks(document_version_id);
CREATE INDEX idx_knowledge_chunks_vector_indexed ON knowledge.chunks(vector_indexed) WHERE vector_indexed = TRUE;
CREATE INDEX idx_knowledge_chunks_vector_id ON knowledge.chunks(vector_id) WHERE vector_id IS NOT NULL;
CREATE INDEX idx_knowledge_chunks_department_id ON knowledge.chunks(department_id);
CREATE INDEX idx_knowledge_chunks_content_search ON knowledge.chunks USING gin(to_tsvector('english', content));
CREATE INDEX idx_knowledge_chunks_is_latest ON knowledge.chunks(is_latest) WHERE is_latest = TRUE;
CREATE INDEX idx_knowledge_chunks_deleted_at ON knowledge.chunks(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_chunks_section_title ON knowledge.chunks(section_title);
CREATE INDEX idx_knowledge_chunks_section_level ON knowledge.chunks(section_level);
CREATE INDEX idx_knowledge_chunks_section_path ON knowledge.chunks USING gin(section_path);
CREATE INDEX idx_knowledge_chunks_chunk_type ON knowledge.chunks(chunk_type);

-- ACL filtering (GIN indexes for pre-flattened access control)
CREATE INDEX idx_knowledge_chunks_allowed_roles ON knowledge.chunks USING GIN (allowed_roles);
CREATE INDEX idx_knowledge_chunks_allowed_departments ON knowledge.chunks USING GIN (allowed_departments);
CREATE INDEX idx_knowledge_chunks_allowed_users ON knowledge.chunks USING GIN (allowed_users);

-- HNSW vector similarity search index
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
    ON knowledge.chunks
    USING hnsw (embedding_vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Composite index for common query pattern: latest child chunks
CREATE INDEX idx_knowledge_chunks_search_filters
    ON knowledge.chunks (is_latest, chunk_type, document_id)
    WHERE is_latest = TRUE AND chunk_type = 'child';

-- Unique constraint for idempotent chunk insertion
CREATE UNIQUE INDEX uniq_chunk_per_version
    ON knowledge.chunks (document_version_id, chunk_index, chunk_type);

-- Full-text search (BM25) - generated column
ALTER TABLE knowledge.chunks
    ADD COLUMN IF NOT EXISTS content_tsv TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_knowledge_chunks_content_tsv
    ON knowledge.chunks USING GIN (content_tsv);

-- ============================================================
-- TABLE: knowledge.processing_jobs
-- ============================================================
CREATE TABLE knowledge.processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    
    job_type knowledge.processing_step NOT NULL,
    status knowledge.processing_status NOT NULL DEFAULT 'UPLOADED',
    
    progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    success BOOLEAN,
    error_message TEXT,
    error_details JSONB,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    
    output_metrics JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_processing_jobs_document_id ON knowledge.processing_jobs(document_id);
CREATE INDEX idx_knowledge_processing_jobs_status ON knowledge.processing_jobs(status);
CREATE INDEX idx_knowledge_processing_jobs_deleted_at ON knowledge.processing_jobs(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- TABLE: knowledge.embedding_cache
-- ============================================================
CREATE TABLE knowledge.embedding_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    text_hash VARCHAR(64) NOT NULL,
    text_length INT NOT NULL,

    embedding_model knowledge.embedding_model NOT NULL,
    embedding_dimension INT NOT NULL,
    embedding_vector vector(1024) NOT NULL,

    usage_count INT DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_embedding_cache UNIQUE (text_hash, embedding_model)
);

CREATE INDEX idx_knowledge_embedding_cache_hash ON knowledge.embedding_cache(text_hash);
CREATE INDEX idx_knowledge_embedding_cache_last_used ON knowledge.embedding_cache(last_used_at DESC);