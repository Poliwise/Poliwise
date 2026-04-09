-- ============================================================
-- SCHEMA: KNOWLEDGE
-- Contains: Documents, Chunks, Processing jobs
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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
    
    CONSTRAINT chk_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
    CONSTRAINT chk_version CHECK (current_version >= 1)
);

CREATE INDEX idx_knowledge_documents_status ON knowledge.documents(status);
CREATE INDEX idx_knowledge_documents_file_type ON knowledge.documents(file_type);
CREATE INDEX idx_knowledge_documents_uploaded_by ON knowledge.documents(uploaded_by);
CREATE INDEX idx_knowledge_documents_deleted_at ON knowledge.documents(deleted_at) WHERE deleted_at IS NULL;

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
    
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_document_version UNIQUE (document_id, version_number),
    CONSTRAINT chk_version_number CHECK (version_number >= 1)
);

CREATE INDEX idx_knowledge_document_versions_document_id ON knowledge.document_versions(document_id);

-- ============================================================
-- TABLE: knowledge.chunks
-- ============================================================
CREATE TABLE knowledge.chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge.documents(id) ON DELETE CASCADE,
    document_version INT NOT NULL,
    
    chunk_index INT NOT NULL,
    
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
    
    -- Denormalized metadata for filtering
    department_id UUID,
    document_type VARCHAR(50),
    effective_date DATE,
    expiry_date DATE,
    
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_chunk_index CHECK (chunk_index >= 0),
    CONSTRAINT chk_content_length CHECK (content_length > 0)
);

CREATE INDEX idx_knowledge_chunks_document_id ON knowledge.chunks(document_id);
CREATE INDEX idx_knowledge_chunks_vector_indexed ON knowledge.chunks(vector_indexed) WHERE vector_indexed = TRUE;
CREATE INDEX idx_knowledge_chunks_vector_id ON knowledge.chunks(vector_id) WHERE vector_id IS NOT NULL;
CREATE INDEX idx_knowledge_chunks_department_id ON knowledge.chunks(department_id);
CREATE INDEX idx_knowledge_chunks_content_search ON knowledge.chunks USING gin(to_tsvector('english', content));

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
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_processing_jobs_document_id ON knowledge.processing_jobs(document_id);
CREATE INDEX idx_knowledge_processing_jobs_status ON knowledge.processing_jobs(status);

-- ============================================================
-- TABLE: knowledge.embedding_cache
-- ============================================================
CREATE TABLE knowledge.embedding_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    text_hash VARCHAR(64) NOT NULL,
    text_length INT NOT NULL,
    
    embedding_model knowledge.embedding_model NOT NULL,
    embedding_dimension INT NOT NULL,
    
    usage_count INT DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_embedding_cache UNIQUE (text_hash, embedding_model)
);

CREATE INDEX idx_knowledge_embedding_cache_hash ON knowledge.embedding_cache(text_hash);