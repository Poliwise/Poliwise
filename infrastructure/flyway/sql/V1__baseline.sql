-- ====================================================================
-- Source: 000_bootstrap.sql
-- ====================================================================
-- ============================================================
-- FILE: 000_bootstrap.sql
-- PURPOSE: Create all application schemas
-- ============================================================

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS metadata;
CREATE SCHEMA IF NOT EXISTS knowledge;
CREATE SCHEMA IF NOT EXISTS conversation;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Extensions are often needed by multiple schemas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- ====================================================================
-- Source: 001_core.sql
-- ====================================================================
-- ============================================================
-- FILE: 001_core.sql
-- SCHEMA: CORE
-- Contains: Users, Auth, Departments
-- ============================================================
-- Single source of truth for core database schema.
-- All columns defined upfront - no ALTER statements needed.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE core.user_role AS ENUM ('USER', 'MANAGER', 'ADMIN');
CREATE TYPE core.account_status AS ENUM ('ACTIVE', 'DEACTIVATED', 'REVOKED');
CREATE TYPE core.login_status AS ENUM ('SUCCESS', 'FAILED_CREDENTIALS', 'FAILED_DEACTIVATED', 'FAILED_REVOKED', 'FAILED_LOCKED');

-- ============================================================
-- TABLE: core.departments
-- ============================================================
CREATE TABLE core.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES core.departments(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: core.users
-- ============================================================
CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role core.user_role NOT NULL DEFAULT 'USER',
    status core.account_status NOT NULL DEFAULT 'ACTIVE',
    department_id UUID REFERENCES core.departments(id) ON DELETE SET NULL,

    -- Security fields
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    must_change_password BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_username_format CHECK (username ~* '^[a-z0-9_]{3,50}$'),
    CONSTRAINT chk_status_revoked CHECK (status != 'REVOKED' OR revoked_at IS NOT NULL),
    CONSTRAINT chk_status_deactivated CHECK (status != 'DEACTIVATED' OR deactivated_at IS NOT NULL)
);

-- ============================================================
-- TABLE: core.user_profiles
-- ============================================================
CREATE TABLE core.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    position VARCHAR(100),
    avatar_url VARCHAR(500),
    bio TEXT,
    date_of_birth DATE,
    employee_code VARCHAR(20) UNIQUE,
    joined_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: core.refresh_tokens
-- ============================================================
CREATE TABLE core.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info VARCHAR(500),
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revoked_reason VARCHAR(100),
    replaced_by UUID REFERENCES core.refresh_tokens(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_active_token_hash UNIQUE (token_hash)
);

-- ============================================================
-- TABLE: core.access_token_blacklist
-- ============================================================
CREATE TABLE core.access_token_blacklist (
    jti VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL,
    expired_at TIMESTAMPTZ NOT NULL,
    blacklisted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100)
);

-- ============================================================
-- TABLE: core.login_history
-- ============================================================
CREATE TABLE core.login_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES core.users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    device_type VARCHAR(50),
    location VARCHAR(200),
    status core.login_status NOT NULL,
    failure_reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES: Core schema
-- ============================================================
CREATE INDEX idx_core_departments_parent_id ON core.departments(parent_id);
CREATE INDEX idx_core_departments_code ON core.departments(code);

CREATE INDEX idx_core_users_email ON core.users(email);
CREATE INDEX idx_core_users_username ON core.users(username);
CREATE INDEX idx_core_users_status ON core.users(status);
CREATE INDEX idx_core_users_role ON core.users(role);
CREATE INDEX idx_core_users_department_id ON core.users(department_id);
CREATE INDEX idx_core_users_deleted_at ON core.users(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_core_user_profiles_full_name ON core.user_profiles(full_name);
CREATE INDEX idx_core_user_profiles_employee_code ON core.user_profiles(employee_code);
CREATE INDEX idx_core_user_profiles_user_id ON core.user_profiles(user_id);

CREATE INDEX idx_core_refresh_tokens_user_id ON core.refresh_tokens(user_id);
CREATE INDEX idx_core_refresh_tokens_token_hash ON core.refresh_tokens(token_hash) WHERE revoked = FALSE;

CREATE INDEX idx_core_access_token_blacklist_user_id ON core.access_token_blacklist(user_id);
CREATE INDEX idx_core_access_token_blacklist_expired_at ON core.access_token_blacklist(expired_at);

CREATE INDEX idx_core_login_history_user_id ON core.login_history(user_id);
CREATE INDEX idx_core_login_history_created_at ON core.login_history(created_at DESC);

-- ====================================================================
-- Source: 002_metadata.sql
-- ====================================================================
-- ============================================================
-- FILE: 002_metadata.sql
-- SCHEMA: METADATA
-- Contains: Document metadata, Categories, Tags, Access rules
-- ============================================================
-- Single source of truth for metadata schema.
-- All columns defined upfront - no ALTER statements needed.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE metadata.document_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED');
CREATE TYPE metadata.access_level AS ENUM ('PUBLIC', 'DEPARTMENT_ONLY', 'RESTRICTED');
CREATE TYPE metadata.rule_target_type AS ENUM ('ROLE', 'DEPARTMENT', 'USER');
CREATE TYPE metadata.rule_permission AS ENUM ('VIEW', 'DENY');

-- ============================================================
-- TABLE: metadata.categories
-- ============================================================
CREATE TABLE metadata.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES metadata.categories(id) ON DELETE SET NULL,
    icon VARCHAR(50),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: metadata.tags
-- ============================================================
CREATE TABLE metadata.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: metadata.document_metadata
-- ============================================================
CREATE TABLE metadata.document_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID UNIQUE NOT NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(50) NOT NULL,

    category_id UUID REFERENCES metadata.categories(id) ON DELETE SET NULL,
    department_id UUID REFERENCES core.departments(id) ON DELETE SET NULL,

    access_level metadata.access_level NOT NULL DEFAULT 'PUBLIC',

    effective_date DATE,
    expiry_date DATE,

    status metadata.document_status NOT NULL DEFAULT 'DRAFT',
    current_version INT DEFAULT 1,

    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    published_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_date_range CHECK (expiry_date IS NULL OR effective_date IS NULL OR expiry_date >= effective_date)
);

-- ============================================================
-- TABLE: metadata.document_tags
-- ============================================================
CREATE TABLE metadata.document_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_metadata_id UUID NOT NULL REFERENCES metadata.document_metadata(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES metadata.tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_document_tag UNIQUE (document_metadata_id, tag_id)
);

-- ============================================================
-- TABLE: metadata.document_access_rules
-- ============================================================
CREATE TABLE metadata.document_access_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_metadata_id UUID NOT NULL REFERENCES metadata.document_metadata(id) ON DELETE CASCADE,

    target_type metadata.rule_target_type NOT NULL,
    target_role core.user_role,
    target_department_id UUID REFERENCES core.departments(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES core.users(id) ON DELETE CASCADE,

    permission metadata.rule_permission NOT NULL,

    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    trace_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',

    CONSTRAINT chk_target_consistency CHECK (
        (target_type = 'ROLE' AND target_role IS NOT NULL AND target_department_id IS NULL AND target_user_id IS NULL) OR
        (target_type = 'DEPARTMENT' AND target_role IS NULL AND target_department_id IS NOT NULL AND target_user_id IS NULL) OR
        (target_type = 'USER' AND target_role IS NULL AND target_department_id IS NULL AND target_user_id IS NOT NULL)
    )
);

-- ============================================================
-- INDEXES: Metadata schema
-- ============================================================
CREATE INDEX idx_metadata_categories_parent_id ON metadata.categories(parent_id);
CREATE INDEX idx_metadata_categories_slug ON metadata.categories(slug);
CREATE INDEX idx_metadata_categories_deleted_at ON metadata.categories(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_metadata_tags_name ON metadata.tags(name);
CREATE INDEX idx_metadata_tags_slug ON metadata.tags(slug);
CREATE INDEX idx_metadata_tags_deleted_at ON metadata.tags(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_metadata_document_metadata_document_id ON metadata.document_metadata(document_id);
CREATE INDEX idx_metadata_document_metadata_status ON metadata.document_metadata(status);
CREATE INDEX idx_metadata_document_metadata_category_id ON metadata.document_metadata(category_id);
CREATE INDEX idx_metadata_document_metadata_department_id ON metadata.document_metadata(department_id);
CREATE INDEX idx_metadata_document_metadata_deleted_at ON metadata.document_metadata(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_metadata_document_tags_metadata_id ON metadata.document_tags(document_metadata_id);
CREATE INDEX idx_metadata_document_tags_tag_id ON metadata.document_tags(tag_id);

CREATE INDEX idx_metadata_doc_access_rules_metadata_id ON metadata.document_access_rules(document_metadata_id);
CREATE INDEX idx_metadata_doc_access_rules_trace_id ON metadata.document_access_rules(trace_id);

-- ====================================================================
-- Source: 003_knowledge.sql
-- ====================================================================
-- ============================================================
-- FILE: 003_knowledge.sql
-- SCHEMA: KNOWLEDGE
-- Contains: Documents, Chunks, Processing jobs
-- ============================================================
-- Single source of truth for knowledge schema.
-- All columns defined upfront - no ALTER statements needed.
-- Uses VECTOR(1024) for BGE-M3 embedding model.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE knowledge.file_type AS ENUM ('PDF', 'DOCX', 'XLSX', 'DOC', 'XLS', 'TXT', 'PNG', 'JPG', 'JPEG', 'MD', 'UNKNOWN');

CREATE TYPE knowledge.processing_status AS ENUM (
    'STAGING', 'UPLOADED', 'PARSING', 'PARSED', 'CHUNKING', 'CHUNKED',
    'EMBEDDING', 'EMBEDDED', 'INDEXING', 'INDEXED', 'READY', 'FAILED'
);

CREATE TYPE knowledge.processing_step AS ENUM ('UPLOAD', 'PARSE', 'CHUNK', 'EMBED', 'INDEX');

CREATE TYPE knowledge.chunking_strategy AS ENUM ('RECURSIVE', 'SEMANTIC', 'FIXED_SIZE', 'SENTENCE');

CREATE TYPE knowledge.embedding_model AS ENUM ('TEXT_EMBEDDING_3_SMALL', 'TEXT_EMBEDDING_3_LARGE', 'MULTILINGUAL_E5_LARGE', 'BGE_M3');

CREATE TYPE knowledge.chunk_type AS ENUM ('parent', 'child');

CREATE TYPE knowledge.content_quality AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'REDIRECT');

-- ============================================================
-- TABLE: knowledge.documents
-- ============================================================
CREATE TABLE knowledge.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    original_filename VARCHAR(500) NOT NULL,
    file_type knowledge.file_type NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(255) NOT NULL,

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
    embedding_model knowledge.embedding_model DEFAULT 'BGE_M3',

    uploaded_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    trace_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',

    CONSTRAINT chk_file_size CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
    CONSTRAINT chk_version CHECK (current_version >= 1)
);

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

    -- Redundancy detection fields (V2 additions baked in)
    file_checksum VARCHAR(64),
    content_hash VARCHAR(64),
    similarity_to_previous FLOAT,
    fingerprint_embedding VECTOR(1024),

    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_document_version UNIQUE (document_id, version_number),
    CONSTRAINT chk_version_number CHECK (version_number >= 1)
);

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
    embedding_vector VECTOR(1024),

    -- Denormalized metadata for filtering
    department_id UUID,
    document_type VARCHAR(50),
    effective_date DATE,
    expiry_date DATE,

    -- GitLab Handbook hierarchical section metadata (V2 additions baked in)
    section_title VARCHAR(500),
    section_level INT,
    section_path TEXT[],
    parent_chunk_id UUID REFERENCES knowledge.chunks(id) ON DELETE SET NULL,
    bucket_name VARCHAR(100),

    -- Access control (pre-flattened for fast vector search)
    allowed_roles core.user_role[],
    allowed_departments UUID[],
    allowed_users UUID[],
    access_level VARCHAR(20) DEFAULT 'PUBLIC',

    is_latest BOOLEAN DEFAULT TRUE,

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_chunk_index CHECK (chunk_index >= 0),
    CONSTRAINT chk_content_length CHECK (content_length > 0)
);

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

-- ============================================================
-- TABLE: knowledge.document_audit_logs
-- ============================================================
CREATE TABLE knowledge.document_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID,
    action VARCHAR(100) NOT NULL,
    actor_id UUID,
    actor_username VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_audit_logs_document_id ON knowledge.document_audit_logs(document_id);
CREATE INDEX idx_document_audit_logs_actor_id ON knowledge.document_audit_logs(actor_id);
CREATE INDEX idx_document_audit_logs_action ON knowledge.document_audit_logs(action);
CREATE INDEX idx_document_audit_logs_created_at ON knowledge.document_audit_logs(created_at DESC);

COMMENT ON TABLE knowledge.document_audit_logs IS 'Audit trail for document operations including OnlyOffice editing and conflict resolution';

-- ============================================================
-- TABLE: knowledge.embedding_cache
-- ============================================================
CREATE TABLE knowledge.embedding_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    text_hash VARCHAR(64) NOT NULL,
    text_length INT NOT NULL,

    embedding_model knowledge.embedding_model NOT NULL,
    embedding_dimension INT NOT NULL,
    embedding_vector VECTOR(1024) NOT NULL,

    usage_count INT DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_embedding_cache UNIQUE (text_hash, embedding_model)
);

-- ============================================================
-- INDEXES: Knowledge schema (basic non-AI indexes only)
-- ============================================================
CREATE INDEX idx_knowledge_documents_status ON knowledge.documents(status);
CREATE INDEX idx_knowledge_documents_file_type ON knowledge.documents(file_type);
CREATE INDEX idx_knowledge_documents_uploaded_by ON knowledge.documents(uploaded_by);
CREATE INDEX idx_knowledge_documents_deleted_at ON knowledge.documents(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_documents_trace_id ON knowledge.documents(trace_id);
CREATE INDEX idx_knowledge_documents_domain ON knowledge.documents(domain);
CREATE INDEX idx_knowledge_documents_content_quality ON knowledge.documents(content_quality);
CREATE INDEX idx_knowledge_documents_expires_at ON knowledge.documents(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX idx_knowledge_document_versions_document_id ON knowledge.document_versions(document_id);
CREATE INDEX idx_knowledge_document_versions_is_current ON knowledge.document_versions(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_versions_file_checksum ON knowledge.document_versions(file_checksum) WHERE file_checksum IS NOT NULL;
CREATE INDEX idx_versions_content_hash ON knowledge.document_versions(content_hash) WHERE content_hash IS NOT NULL;

CREATE INDEX idx_knowledge_chunks_document_id ON knowledge.chunks(document_id);
CREATE INDEX idx_knowledge_chunks_document_version_id ON knowledge.chunks(document_version_id);
CREATE INDEX idx_knowledge_chunks_vector_indexed ON knowledge.chunks(vector_indexed) WHERE vector_indexed = TRUE;
CREATE INDEX idx_knowledge_chunks_vector_id ON knowledge.chunks(vector_id) WHERE vector_id IS NOT NULL;
CREATE INDEX idx_knowledge_chunks_department_id ON knowledge.chunks(department_id);
CREATE INDEX idx_knowledge_chunks_is_latest ON knowledge.chunks(is_latest) WHERE is_latest = TRUE;
CREATE INDEX idx_knowledge_chunks_deleted_at ON knowledge.chunks(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_knowledge_chunks_chunk_type ON knowledge.chunks(chunk_type);
CREATE INDEX idx_knowledge_chunks_section_level ON knowledge.chunks(section_level);

CREATE INDEX idx_knowledge_processing_jobs_document_id ON knowledge.processing_jobs(document_id);
CREATE INDEX idx_knowledge_processing_jobs_status ON knowledge.processing_jobs(status);
CREATE INDEX idx_knowledge_processing_jobs_deleted_at ON knowledge.processing_jobs(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_knowledge_embedding_cache_hash ON knowledge.embedding_cache(text_hash);
CREATE INDEX idx_knowledge_embedding_cache_last_used ON knowledge.embedding_cache(last_used_at DESC);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE knowledge.documents IS 'Master document storage with MinIO reference';
COMMENT ON TABLE knowledge.document_versions IS 'Immutable version history with redundancy detection';
COMMENT ON TABLE knowledge.chunks IS 'Text chunks with VECTOR(1024) embeddings for RAG';
COMMENT ON TABLE knowledge.processing_jobs IS 'ETL pipeline job tracking';
COMMENT ON TABLE knowledge.embedding_cache IS 'Cache for embedding vectors to reduce API costs';



-- ====================================================================
-- Source: 004_conversation.sql
-- ====================================================================
-- ============================================================
-- FILE: 004_conversation.sql
-- SCHEMA: CONVERSATION
-- Contains: Conversations, Messages, Unanswered questions
-- ============================================================
-- Single source of truth for conversation schema.
-- All columns defined upfront - no ALTER statements needed.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE conversation.message_role AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE conversation.confidence_level AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');
CREATE TYPE conversation.priority_level AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- ============================================================
-- TABLE: conversation.conversations
-- ============================================================
CREATE TABLE conversation.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,

    title VARCHAR(255),

    message_count INT DEFAULT 0,
    last_message_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: conversation.messages
-- ============================================================
CREATE TABLE conversation.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversation.conversations(id) ON DELETE CASCADE,

    role conversation.message_role NOT NULL,
    content TEXT NOT NULL,

    sources JSONB DEFAULT '[]',

    model_used VARCHAR(50),
    tokens_prompt INT,
    tokens_completion INT,
    tokens_total INT,
    latency_ms INT,

    confidence conversation.confidence_level,
    has_sources BOOLEAN DEFAULT FALSE,

    is_streaming BOOLEAN DEFAULT FALSE,
    streaming_completed BOOLEAN DEFAULT TRUE,

    trace_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT chk_tokens CHECK (tokens_total IS NULL OR tokens_total >= 0)
);

-- ============================================================
-- TABLE: conversation.unanswered_questions
-- ============================================================
CREATE TABLE conversation.unanswered_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    message_id UUID REFERENCES conversation.messages(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversation.conversations(id) ON DELETE SET NULL,

    question TEXT NOT NULL,
    question_normalized TEXT,

    attempted_context JSONB DEFAULT '{}',
    search_query TEXT,
    top_similarity_score DECIMAL(5,4),

    user_department_id UUID,
    user_role VARCHAR(20),

    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    related_document_id UUID,

    category VARCHAR(100),
    priority conversation.priority_level DEFAULT 'NORMAL',

    trace_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES: Conversation schema
-- ============================================================
CREATE INDEX idx_conversation_conversations_user_id ON conversation.conversations(user_id);
CREATE INDEX idx_conversation_conversations_created_at ON conversation.conversations(created_at DESC);
CREATE INDEX idx_conversation_conversations_deleted_at ON conversation.conversations(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_conversation_messages_conversation_id ON conversation.messages(conversation_id);
CREATE INDEX idx_conversation_messages_role ON conversation.messages(role);
CREATE INDEX idx_conversation_messages_created_at ON conversation.messages(created_at DESC);
CREATE INDEX idx_conversation_messages_deleted_at ON conversation.messages(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversation_messages_trace_id ON conversation.messages(trace_id);

CREATE INDEX idx_conversation_unanswered_questions_user_id ON conversation.unanswered_questions(user_id);
CREATE INDEX idx_conversation_unanswered_questions_resolved ON conversation.unanswered_questions(resolved);
CREATE INDEX idx_conversation_unanswered_questions_priority ON conversation.unanswered_questions(priority);
CREATE INDEX idx_conversation_unanswered_questions_deleted_at ON conversation.unanswered_questions(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversation_unanswered_questions_trace_id ON conversation.unanswered_questions(trace_id);

-- ====================================================================
-- Source: 005_analytics.sql
-- ====================================================================
-- ============================================================
-- FILE: 005_analytics.sql
-- SCHEMA: ANALYTICS
-- Contains: Feedbacks, Usage stats, Audit logs, Aggregates
-- ============================================================
-- Single source of truth for analytics schema.
-- All columns defined upfront - no ALTER statements needed.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE analytics.feedback_type AS ENUM ('LIKE', 'DISLIKE');

CREATE TYPE analytics.audit_action AS ENUM (
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESH', 'PASSWORD_CHANGE',
    'USER_CREATE', 'USER_UPDATE', 'USER_DEACTIVATE', 'USER_ACTIVATE', 'USER_REVOKE', 'USER_DELETE',
    'USER_PROFILE_UPDATE', 'USER_SETTINGS_UPDATE',
    'ROLE_CHANGE', 'STATUS_CHANGE',
    'DOCUMENT_UPLOAD', 'DOCUMENT_UPDATE', 'DOCUMENT_DELETE', 'DOCUMENT_PUBLISH', 'DOCUMENT_ARCHIVE', 'DOCUMENT_VERSION_CREATE',
    'QUESTION_ASK', 'CONVERSATION_CREATE', 'CONVERSATION_DELETE',
    'FEEDBACK_SUBMIT',
    'SETTINGS_UPDATE', 'BULK_IMPORT', 'REPORT_EXPORT',
    'CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_DELETE',
    'TAG_CREATE', 'TAG_UPDATE', 'TAG_DELETE',
    'DEPARTMENT_CREATE', 'DEPARTMENT_UPDATE', 'DEPARTMENT_DELETE'
);

CREATE TYPE analytics.resource_type AS ENUM (
    'USER', 'DOCUMENT', 'CONVERSATION', 'MESSAGE', 'FEEDBACK',
    'DEPARTMENT', 'CATEGORY', 'TAG', 'SETTINGS'
);

CREATE TYPE analytics.export_format AS ENUM ('CSV', 'PDF', 'XLSX', 'JSON');

CREATE TYPE analytics.report_type AS ENUM (
    'USAGE_SUMMARY', 'QUESTION_ANALYTICS', 'FEEDBACK_ANALYSIS',
    'USER_ENGAGEMENT', 'DOCUMENT_POPULARITY', 'UNANSWERED_QUESTIONS', 'DEPARTMENT_BREAKDOWN'
);

CREATE TYPE analytics.report_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- ============================================================
-- TABLE: analytics.feedbacks
-- ============================================================
CREATE TABLE analytics.feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL,
    message_id UUID NOT NULL,
    conversation_id UUID NOT NULL,

    type analytics.feedback_type NOT NULL,
    comment TEXT,

    question_text TEXT,
    answer_text TEXT,
    sources_used JSONB DEFAULT '[]',

    user_department_id UUID,
    user_role VARCHAR(20),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    CONSTRAINT uq_user_message_feedback UNIQUE (user_id, message_id)
);

-- ============================================================
-- TABLE: analytics.usage_stats
-- ============================================================
CREATE TABLE analytics.usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID,
    user_role VARCHAR(20),
    user_department_id UUID,

    service_name VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,

    response_time_ms INT NOT NULL,
    status_code INT NOT NULL,

    request_size_bytes INT,
    response_size_bytes INT,

    is_error BOOLEAN DEFAULT FALSE,
    error_code VARCHAR(50),
    error_message TEXT,

    tokens_used INT,
    model_used VARCHAR(50),
    chunks_retrieved INT,
    confidence VARCHAR(20),

    trace_id VARCHAR(100),

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: analytics.audit_logs
-- ============================================================
CREATE TABLE analytics.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID,
    username VARCHAR(50),
    user_role VARCHAR(20),

    action analytics.audit_action NOT NULL,

    resource_type analytics.resource_type NOT NULL,
    resource_id UUID,
    resource_name VARCHAR(255),

    old_value JSONB,
    new_value JSONB,
    changed_fields TEXT[],

    ip_address INET,
    user_agent TEXT,
    trace_id VARCHAR(100),

    service_name VARCHAR(50),

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: analytics.daily_aggregates
-- ============================================================
CREATE TABLE analytics.daily_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,

    total_questions INT DEFAULT 0,
    total_conversations INT DEFAULT 0,
    unique_users_asked INT DEFAULT 0,

    total_likes INT DEFAULT 0,
    total_dislikes INT DEFAULT 0,
    feedback_ratio DECIMAL(5,4),

    avg_response_time_ms INT,
    p50_response_time_ms INT,
    p95_response_time_ms INT,
    p99_response_time_ms INT,

    total_requests INT DEFAULT 0,
    total_errors INT DEFAULT 0,
    error_rate DECIMAL(5,4),

    total_tokens_used BIGINT DEFAULT 0,
    avg_tokens_per_question INT,
    avg_chunks_retrieved DECIMAL(5,2),

    documents_uploaded INT DEFAULT 0,
    documents_published INT DEFAULT 0,

    unique_active_users INT DEFAULT 0,
    new_users INT DEFAULT 0,

    unanswered_questions INT DEFAULT 0,
    resolved_questions INT DEFAULT 0,

    computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: analytics.hourly_aggregates
-- ============================================================
CREATE TABLE analytics.hourly_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    datetime TIMESTAMPTZ NOT NULL,
    hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),

    total_questions INT DEFAULT 0,
    total_requests INT DEFAULT 0,
    total_errors INT DEFAULT 0,
    unique_users INT DEFAULT 0,

    avg_response_time_ms INT,

    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0,

    computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_hourly_datetime UNIQUE (datetime)
);

-- ============================================================
-- TABLE: analytics.department_daily_stats
-- ============================================================
CREATE TABLE analytics.department_daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    department_id UUID NOT NULL,

    total_questions INT DEFAULT 0,
    unique_users INT DEFAULT 0,

    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0,

    top_categories JSONB DEFAULT '[]',

    computed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_department_daily UNIQUE (date, department_id)
);

-- ============================================================
-- TABLE: analytics.popular_questions
-- ============================================================
CREATE TABLE analytics.popular_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    question_normalized TEXT NOT NULL,
    question_sample TEXT NOT NULL,

    ask_count INT DEFAULT 1,
    unique_users_count INT DEFAULT 1,

    first_asked_at TIMESTAMPTZ NOT NULL,
    last_asked_at TIMESTAMPTZ NOT NULL,

    total_likes INT DEFAULT 0,
    total_dislikes INT DEFAULT 0,

    common_source_documents JSONB DEFAULT '[]',

    detected_category VARCHAR(100),
    detected_department_id UUID,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: analytics.document_popularity
-- ============================================================
CREATE TABLE analytics.document_popularity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL UNIQUE,

    total_citations INT DEFAULT 0,
    unique_questions_cited INT DEFAULT 0,

    citations_with_likes INT DEFAULT 0,
    citations_with_dislikes INT DEFAULT 0,

    first_cited_at TIMESTAMPTZ,
    last_cited_at TIMESTAMPTZ,

    citations_last_7_days INT DEFAULT 0,
    citations_last_30_days INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE: analytics.report_exports
-- ============================================================
CREATE TABLE analytics.report_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    report_type analytics.report_type NOT NULL,
    title VARCHAR(255) NOT NULL,

    date_from DATE,
    date_to DATE,
    department_id UUID,
    filters JSONB DEFAULT '{}',

    format analytics.export_format NOT NULL,
    file_key VARCHAR(500),
    file_size_bytes INT,

    status analytics.report_status DEFAULT 'PENDING',
    error_message TEXT,

    requested_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    downloaded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES: Analytics schema
-- ============================================================
CREATE INDEX idx_analytics_feedbacks_user_id ON analytics.feedbacks(user_id);
CREATE INDEX idx_analytics_feedbacks_message_id ON analytics.feedbacks(message_id);
CREATE INDEX idx_analytics_feedbacks_type ON analytics.feedbacks(type);
CREATE INDEX idx_analytics_feedbacks_created_at ON analytics.feedbacks(created_at DESC);
CREATE INDEX idx_analytics_feedbacks_deleted_at ON analytics.feedbacks(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_analytics_usage_stats_user_id ON analytics.usage_stats(user_id);
CREATE INDEX idx_analytics_usage_stats_service ON analytics.usage_stats(service_name);
CREATE INDEX idx_analytics_usage_stats_created_at ON analytics.usage_stats(created_at DESC);
CREATE INDEX idx_analytics_usage_stats_is_error ON analytics.usage_stats(is_error) WHERE is_error = TRUE;
CREATE INDEX idx_analytics_usage_stats_trace_id ON analytics.usage_stats(trace_id);

CREATE INDEX idx_analytics_audit_logs_user_id ON analytics.audit_logs(user_id);
CREATE INDEX idx_analytics_audit_logs_action ON analytics.audit_logs(action);
CREATE INDEX idx_analytics_audit_logs_resource ON analytics.audit_logs(resource_type, resource_id);
CREATE INDEX idx_analytics_audit_logs_created_at ON analytics.audit_logs(created_at DESC);
CREATE INDEX idx_analytics_audit_logs_trace_id ON analytics.audit_logs(trace_id);

CREATE INDEX idx_analytics_daily_aggregates_date ON analytics.daily_aggregates(date DESC);
CREATE INDEX idx_analytics_hourly_aggregates_datetime ON analytics.hourly_aggregates(datetime DESC);
CREATE INDEX idx_analytics_department_daily_stats_date ON analytics.department_daily_stats(date DESC);
CREATE INDEX idx_analytics_department_daily_stats_department ON analytics.department_daily_stats(department_id);

CREATE INDEX idx_analytics_popular_questions_ask_count ON analytics.popular_questions(ask_count DESC);
CREATE INDEX idx_analytics_popular_questions_last_asked ON analytics.popular_questions(last_asked_at DESC);

CREATE INDEX idx_analytics_document_popularity_document_id ON analytics.document_popularity(document_id);
CREATE INDEX idx_analytics_document_popularity_total_citations ON analytics.document_popularity(total_citations DESC);

CREATE INDEX idx_analytics_report_exports_requested_by ON analytics.report_exports(requested_by);
CREATE INDEX idx_analytics_report_exports_status ON analytics.report_exports(status);

-- ====================================================================
-- Source: 006_functions_triggers.sql
-- ====================================================================
-- ============================================================
-- FILE: 006_functions_triggers.sql
-- CROSS-SCHEMA: Triggers and Functions
-- ============================================================
-- Contains: Auto-updated_at triggers, conversation stats,
-- tag usage tracking, and document access functions.
-- ============================================================

-- ============================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS: updated_at for Core schema
-- ============================================================
CREATE TRIGGER trg_core_users_updated_at
    BEFORE UPDATE ON core.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_core_user_profiles_updated_at
    BEFORE UPDATE ON core.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_core_departments_updated_at
    BEFORE UPDATE ON core.departments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRIGGERS: updated_at for Metadata schema
-- ============================================================
CREATE TRIGGER trg_metadata_categories_updated_at
    BEFORE UPDATE ON metadata.categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_metadata_document_metadata_updated_at
    BEFORE UPDATE ON metadata.document_metadata
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRIGGERS: updated_at for Knowledge schema
-- ============================================================
CREATE TRIGGER trg_knowledge_documents_updated_at
    BEFORE UPDATE ON knowledge.documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_knowledge_chunks_updated_at
    BEFORE UPDATE ON knowledge.chunks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_knowledge_processing_jobs_updated_at
    BEFORE UPDATE ON knowledge.processing_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRIGGERS: updated_at for Conversation schema
-- ============================================================
CREATE TRIGGER trg_conversation_conversations_updated_at
    BEFORE UPDATE ON conversation.conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_conversation_unanswered_questions_updated_at
    BEFORE UPDATE ON conversation.unanswered_questions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRIGGERS: updated_at for Analytics schema
-- ============================================================
CREATE TRIGGER trg_analytics_feedbacks_updated_at
    BEFORE UPDATE ON analytics.feedbacks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_analytics_daily_aggregates_updated_at
    BEFORE UPDATE ON analytics.daily_aggregates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_analytics_popular_questions_updated_at
    BEFORE UPDATE ON analytics.popular_questions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_analytics_document_popularity_updated_at
    BEFORE UPDATE ON analytics.document_popularity
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FUNCTION: Tag usage count trigger
-- ============================================================
CREATE OR REPLACE FUNCTION metadata.update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE metadata.tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE metadata.tags SET usage_count = GREATEST(0, usage_count - 1) WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_metadata_document_tags_usage_count
    AFTER INSERT OR DELETE ON metadata.document_tags
    FOR EACH ROW EXECUTE FUNCTION metadata.update_tag_usage_count();

-- ============================================================
-- FUNCTION: Conversation stats trigger
-- ============================================================
CREATE OR REPLACE FUNCTION conversation.update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversation.conversations
        SET message_count = message_count + 1,
            last_message_at = NEW.created_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE conversation.conversations
        SET message_count = message_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.conversation_id;

        UPDATE conversation.conversations c
        SET last_message_at = (
            SELECT MAX(created_at) FROM conversation.messages WHERE conversation_id = c.id
        )
        WHERE c.id = OLD.conversation_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversation_messages_stats
    AFTER INSERT OR DELETE ON conversation.messages
    FOR EACH ROW EXECUTE FUNCTION conversation.update_conversation_stats();

-- ============================================================
-- FUNCTION: Auto-generate conversation title
-- ============================================================
CREATE OR REPLACE FUNCTION conversation.generate_conversation_title()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'USER' THEN
        UPDATE conversation.conversations
        SET title = LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END
        WHERE id = NEW.conversation_id AND title IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conversation_messages_generate_title
    AFTER INSERT ON conversation.messages
    FOR EACH ROW EXECUTE FUNCTION conversation.generate_conversation_title();

-- ============================================================
-- FUNCTION: Check document access
-- ============================================================
CREATE OR REPLACE FUNCTION metadata.check_document_access(
    p_document_id UUID,
    p_user_id UUID,
    p_user_role core.user_role,
    p_user_department_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_access_level metadata.access_level;
    v_document_department_id UUID;
    v_has_explicit_deny BOOLEAN;
    v_has_explicit_allow BOOLEAN;
BEGIN
    SELECT access_level, department_id
    INTO v_access_level, v_document_department_id
    FROM metadata.document_metadata
    WHERE document_id = p_document_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF p_user_role = 'ADMIN' THEN
        RETURN TRUE;
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM metadata.document_access_rules
        WHERE document_metadata_id = (SELECT id FROM metadata.document_metadata WHERE document_id = p_document_id)
          AND permission = 'DENY'
          AND (
              (target_type = 'USER' AND target_user_id = p_user_id) OR
              (target_type = 'ROLE' AND target_role = p_user_role) OR
              (target_type = 'DEPARTMENT' AND target_department_id = p_user_department_id)
          )
    ) INTO v_has_explicit_deny;

    IF v_has_explicit_deny THEN
        RETURN FALSE;
    END IF;

    IF v_access_level = 'PUBLIC' THEN
        RETURN TRUE;
    ELSIF v_access_level = 'DEPARTMENT_ONLY' THEN
        RETURN v_document_department_id = p_user_department_id;
    ELSIF v_access_level = 'RESTRICTED' THEN
        SELECT EXISTS(
            SELECT 1 FROM metadata.document_access_rules
            WHERE document_metadata_id = (SELECT id FROM metadata.document_metadata WHERE document_id = p_document_id)
              AND permission = 'VIEW'
              AND (
                  (target_type = 'USER' AND target_user_id = p_user_id) OR
                  (target_type = 'ROLE' AND target_role = p_user_role) OR
                  (target_type = 'DEPARTMENT' AND target_department_id = p_user_department_id)
              )
        ) INTO v_has_explicit_allow;

        RETURN v_has_explicit_allow;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Ensure only one current version per document
-- ============================================================
CREATE OR REPLACE FUNCTION knowledge.enforce_single_current_version()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE knowledge.document_versions
        SET is_current = FALSE
        WHERE document_id = NEW.document_id
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND is_current = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_current_version
    BEFORE INSERT OR UPDATE ON knowledge.document_versions
    FOR EACH ROW EXECUTE FUNCTION knowledge.enforce_single_current_version();

-- ====================================================================
-- Source: 007_seed_data.sql
-- ====================================================================
-- ============================================================
-- FILE: 007_seed_data.sql
-- SCHEMA: ALL
-- Contains: Default seed data for initial deployment
-- ============================================================
-- Seed data for categories, tags, and default admin user.
-- Safe to re-run (uses ON CONFLICT DO NOTHING).
-- Note: UUIDs generated with uuid_generate_v4() for security
-- ============================================================

-- ============================================================
-- SEED: Categories
-- ============================================================
INSERT INTO metadata.categories (id, name, slug, description, display_order, is_active) VALUES
    (uuid_generate_v4(), 'ChÃ­nh sÃ¡ch nhÃ¢n sá»±', 'chinh-sach-nhan-su', 'CÃ¡c chÃ­nh sÃ¡ch liÃªn quan Ä‘áº¿n nhÃ¢n sá»± vÃ  tuyá»ƒn dá»¥ng', 1, TRUE),
    (uuid_generate_v4(), 'Quy cháº¿ tÃ i chÃ­nh', 'quy-che-tai-chinh', 'Quy cháº¿ vá» tÃ i chÃ­nh vÃ  ngÃ¢n sÃ¡ch', 2, TRUE),
    (uuid_generate_v4(), 'Quy Ä‘á»‹nh vÄƒn hÃ³a', 'quy-dinh-van-hoa', 'Quy Ä‘á»‹nh vá» vÄƒn hÃ³a doanh nghiá»‡p', 3, TRUE),
    (uuid_generate_v4(), 'An toÃ n lao Ä‘á»™ng', 'an-toan-lao-dong', 'Quy Ä‘á»‹nh vá» an toÃ n vÃ  vá»‡ sinh lao Ä‘á»™ng', 4, TRUE),
    (uuid_generate_v4(), 'Quy trÃ¬nh nghiá»‡p vá»¥', 'quy-trinh-nghiep-vu', 'CÃ¡c quy trÃ¬nh nghiá»‡p vá»¥ ná»™i bá»™', 5, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: Tags
-- ============================================================
INSERT INTO metadata.tags (id, name, slug, color) VALUES
    (uuid_generate_v4(), 'Quan trá»ng', 'quan-trong', '#ef4444'),
    (uuid_generate_v4(), 'Má»›i', 'moi', '#22c55e'),
    (uuid_generate_v4(), 'Cáº­p nháº­t', 'cap-nhat', '#3b82f6'),
    (uuid_generate_v4(), 'Cáº§n xem xÃ©t', 'can-xem-xet', '#f59e0b'),
    (uuid_generate_v4(), 'Ná»™i bá»™', 'noin-bo', '#8b5cf6')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: Default Admin User
-- ============================================================
-- NOTE: Admin user is created by AdminInitializer.java with random password
-- This fallback ensures there's always an admin available
INSERT INTO core.users (id, username, email, password_hash, role, status, department_id, must_change_password)
VALUES (
    uuid_generate_v4(),
    'admin',
    'admin@poliwise.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5.KK0Ke',
    'ADMIN',
    'ACTIVE',
    NULL,
    TRUE
)
ON CONFLICT (username) DO NOTHING;

-- Create admin profile
INSERT INTO core.user_profiles (id, user_id, full_name)
VALUES (
    uuid_generate_v4(),
    (SELECT id FROM core.users WHERE username = 'admin' LIMIT 1),
    'System Administrator'
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- SEED: Default Department
-- ============================================================
INSERT INTO core.departments (id, name, code, description, is_active)
VALUES (
    uuid_generate_v4(),
    'Quáº£n trá»‹ há»‡ thá»‘ng',
    'ADMIN',
    'PhÃ²ng ban quáº£n trá»‹ há»‡ thá»‘ng',
    TRUE
)
ON CONFLICT (code) DO NOTHING;

-- ====================================================================
-- Source: 008_ai_indexes.sql
-- ====================================================================
-- ============================================================
-- FILE: 008_ai_indexes.sql
-- ALL SCHEMAS
-- Contains: pgvector HNSW indexes, GIN text search, BM25 setup
-- ============================================================
-- MUST run AFTER all tables are created.
-- All indexes defined in one place for clarity.
-- Uses VECTOR(1024) for BGE-M3 embedding model.
-- ============================================================

-- ============================================================
-- KNOWLEDGE SCHEMA: Vector and Text Search Indexes
-- ============================================================

-- HNSW vector similarity search (cosine distance)
-- For embedding_vector VECTOR(1024) with BGE-M3 model
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
    ON knowledge.chunks
    USING hnsw (embedding_vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- BM25 Full-text search via TSVECTOR generated column
-- Uses 'simple' dictionary (lowercase + split) for Vietnamese content compatibility
ALTER TABLE knowledge.chunks
    ADD COLUMN IF NOT EXISTS content_tsv TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_chunks_content_tsv
    ON knowledge.chunks USING GIN (content_tsv);

-- Section path for GitLab Handbook hierarchical filtering
CREATE INDEX IF NOT EXISTS idx_chunks_section_path
    ON knowledge.chunks USING GIN (section_path);

-- ============================================================
-- KNOWLEDGE SCHEMA: ACL Filtering Indexes (GIN for arrays)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chunks_allowed_roles
    ON knowledge.chunks USING GIN (allowed_roles);

CREATE INDEX IF NOT EXISTS idx_chunks_allowed_departments
    ON knowledge.chunks USING GIN (allowed_departments);

CREATE INDEX IF NOT EXISTS idx_chunks_allowed_users
    ON knowledge.chunks USING GIN (allowed_users);

-- ============================================================
-- KNOWLEDGE SCHEMA: Composite Indexes for Common Queries
-- ============================================================

-- Most common query pattern: latest child chunks for vector search
CREATE INDEX IF NOT EXISTS idx_chunks_search_filters
    ON knowledge.chunks (is_latest, chunk_type, document_id)
    WHERE is_latest = TRUE AND chunk_type = 'child';

-- Unique constraint for idempotent chunk insertion
CREATE UNIQUE INDEX IF NOT EXISTS uniq_chunk_per_version
    ON knowledge.chunks (document_version_id, chunk_index, chunk_type);

-- ============================================================
-- KNOWLEDGE SCHEMA: GIN indexes for JSONB metadata
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_chunks_metadata_gin
    ON knowledge.chunks USING GIN (metadata);

-- ============================================================
-- KNOWLEDGE SCHEMA: Document metadata join optimization
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_document_metadata_document
    ON metadata.document_metadata (document_id) WHERE deleted_at IS NULL;

-- ============================================================
-- CONVERSATION SCHEMA: Full-text search on messages
-- ============================================================

ALTER TABLE conversation.messages
    ADD COLUMN IF NOT EXISTS content_tsv TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

CREATE INDEX IF NOT EXISTS idx_messages_content_tsv
    ON conversation.messages USING GIN (content_tsv);

-- ============================================================
-- METADATA SCHEMA: Text search indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tags_name_search
    ON metadata.tags USING gin(to_tsvector('simple', name));

CREATE INDEX IF NOT EXISTS idx_metadata_title_search
    ON metadata.document_metadata USING gin(to_tsvector('simple', title));

CREATE INDEX IF NOT EXISTS idx_categories_name_search
    ON metadata.categories USING gin(to_tsvector('simple', name));

-- ============================================================
-- PERFORMANCE NOTES
-- ============================================================
-- HNSW index build time: ~5-10 min for 1M chunks (during maintenance)
-- GIN indexes: <1 min typically
-- Vector search p99 latency target: <50ms with HNSW (m=16, ef=64)
--
-- Index maintenance:
-- - HNSW: No periodic VACUUM needed, just ANALYZE
-- - GIN: Regular VACUUM ANALYZE recommended
-- - BM25 TSVECTOR: Auto-updated on INSERT/UPDATE, no extra maintenance
-- ============================================================

-- ====================================================================
-- Source: migrations/001_bm25_simple_dictionary.sql
-- ====================================================================
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


-- ====================================================================
-- Source: migrations/002_fk_constraints_and_improvements.sql
-- ====================================================================
-- Migration: FK constraints, normalization, and index improvements
-- Date: 2026-05-21
-- Issues: H4, H5, H6, M6, M8, L1, L2, L3, L8, L9

-- ============================================================
-- H4: FK constraint on conversation.conversations.user_id
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_conversations_user_id'
    ) THEN
        ALTER TABLE conversation.conversations
            ADD CONSTRAINT fk_conversations_user_id
            FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================
-- H5: FK constraint on metadata.document_metadata.document_id
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_document_metadata_document_id'
    ) THEN
        ALTER TABLE metadata.document_metadata
            ADD CONSTRAINT fk_document_metadata_document_id
            FOREIGN KEY (document_id) REFERENCES knowledge.documents(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================
-- H6: FK constraints on analytics.feedbacks
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_feedbacks_message_id'
    ) THEN
        ALTER TABLE analytics.feedbacks
            ADD CONSTRAINT fk_feedbacks_message_id
            FOREIGN KEY (message_id) REFERENCES conversation.messages(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_feedbacks_conversation_id'
    ) THEN
        ALTER TABLE analytics.feedbacks
            ADD CONSTRAINT fk_feedbacks_conversation_id
            FOREIGN KEY (conversation_id) REFERENCES conversation.conversations(id) ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_feedbacks_user_id'
    ) THEN
        ALTER TABLE analytics.feedbacks
            ADD CONSTRAINT fk_feedbacks_user_id
            FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- M6: Normalize question_normalized on insert
-- Add trigger to auto-normalize unanswered questions
-- ============================================================
CREATE OR REPLACE FUNCTION conversation.normalize_unanswered_question()
RETURNS TRIGGER AS $$
BEGIN
    NEW.question_normalized := lower(trim(
        regexp_replace(
            regexp_replace(NEW.question, '[^a-zA-Z0-9Ã Ã¡áº£Ã£áº¡Äƒáº±áº¯áº³áºµáº·Ã¢áº§áº¥áº©áº«áº­Ã¨Ã©áº»áº½áº¹Ãªá»áº¿á»ƒá»…á»‡Ã¬Ã­á»‰Ä©á»‹Ã²Ã³á»Ãµá»Ã´á»“á»‘á»•á»—á»™Æ¡á»á»›á»Ÿá»¡á»£Ã¹Ãºá»§Å©á»¥Æ°á»«á»©á»­á»¯á»±á»³Ã½á»·á»¹á»µÄ‘Ã€Ãáº¢Ãƒáº Ä‚áº°áº®áº²áº´áº¶Ã‚áº¦áº¤áº¨áºªáº¬ÃˆÃ‰áººáº¼áº¸ÃŠá»€áº¾á»‚á»„á»†ÃŒÃá»ˆÄ¨á»ŠÃ’Ã“á»ŽÃ•á»ŒÃ”á»’á»á»”á»–á»˜Æ á»œá»šá»žá» á»¢Ã™Ãšá»¦Å¨á»¤Æ¯á»ªá»¨á»¬á»®á»°á»²Ãá»¶á»¸á»´Ä\s]', ' ', 'g'),
            '\s+', ' ', 'g'
        )
    ));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_unanswered_question ON conversation.unanswered_questions;
CREATE TRIGGER trg_normalize_unanswered_question
    BEFORE INSERT OR UPDATE OF question ON conversation.unanswered_questions
    FOR EACH ROW
    EXECUTE FUNCTION conversation.normalize_unanswered_question();

-- Update existing records
UPDATE conversation.unanswered_questions
SET question_normalized = lower(trim(
    regexp_replace(
        regexp_replace(question, '[^a-zA-Z0-9Ã Ã¡áº£Ã£áº¡Äƒáº±áº¯áº³áºµáº·Ã¢áº§áº¥áº©áº«áº­Ã¨Ã©áº»áº½áº¹Ãªá»áº¿á»ƒá»…á»‡Ã¬Ã­á»‰Ä©á»‹Ã²Ã³á»Ãµá»Ã´á»“á»‘á»•á»—á»™Æ¡á»á»›á»Ÿá»¡á»£Ã¹Ãºá»§Å©á»¥Æ°á»«á»©á»­á»¯á»±á»³Ã½á»·á»¹á»µÄ‘Ã€Ãáº¢Ãƒáº Ä‚áº°áº®áº²áº´áº¶Ã‚áº¦áº¤áº¨áºªáº¬ÃˆÃ‰áººáº¼áº¸ÃŠá»€áº¾á»‚á»„á»†ÃŒÃá»ˆÄ¨á»ŠÃ’Ã“á»ŽÃ•á»ŒÃ”á»’á»á»”á»–á»˜Æ á»œá»šá»žá» á»¢Ã™Ãšá»¦Å¨á»¤Æ¯á»ªá»¨á»¬á»®á»°á»²Ãá»¶á»¸á»´Ä\s]', ' ', 'g'),
        '\s+', ' ', 'g'
    )
))
WHERE question_normalized IS NULL OR question_normalized = question;

-- ============================================================
-- M8: Set vector_indexed = TRUE for chunks that have embeddings
-- ============================================================
UPDATE knowledge.chunks
SET vector_indexed = TRUE
WHERE embedding_vector IS NOT NULL
  AND vector_indexed = FALSE;

-- ============================================================
-- L2: Change language default from 'vi' to NULL
-- ============================================================
ALTER TABLE knowledge.documents
    ALTER COLUMN language DROP DEFAULT;

-- ============================================================
-- L3: Change chunk_type default from 'child' to 'parent'
-- Parent chunks are the primary unit, children are derived
-- ============================================================
ALTER TABLE knowledge.chunks
    ALTER COLUMN chunk_type SET DEFAULT 'parent';

-- ============================================================
-- L9: Add index on metadata.document_access_rules for access checks
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_access_rules_targets
    ON metadata.document_access_rules(target_type, target_role, target_department_id, target_user_id)
    WHERE deleted_at IS NULL;

-- ============================================================
-- L1: Update tag usage count on document soft-delete
-- ============================================================
CREATE OR REPLACE FUNCTION metadata.update_tag_usage_on_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- Document was soft-deleted, decrement tag usage counts
        UPDATE metadata.tags
        SET usage_count = usage_count - 1
        WHERE id IN (
            SELECT tag_id FROM metadata.document_tags WHERE document_id = OLD.id
        );
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        -- Document was restored, increment tag usage counts
        UPDATE metadata.tags
        SET usage_count = usage_count + 1
        WHERE id IN (
            SELECT tag_id FROM metadata.document_tags WHERE document_id = OLD.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_tag_usage_on_soft_delete ON metadata.document_metadata;
CREATE TRIGGER trg_update_tag_usage_on_soft_delete
    AFTER UPDATE OF deleted_at ON metadata.document_metadata
    FOR EACH ROW
    EXECUTE FUNCTION metadata.update_tag_usage_on_soft_delete();

-- ============================================================
-- L8: Drop redundant bucket_name column from chunks table
-- Bucket is tracked at documents level, no need to duplicate
-- ============================================================
ALTER TABLE knowledge.chunks DROP COLUMN IF EXISTS bucket_name;


