-- ============================================================
-- VIEWS (Cross-schema)
-- ============================================================

-- ============================================================
-- View: User with profile and department
-- ============================================================
CREATE OR REPLACE VIEW core.v_users_full AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    u.status,
    u.failed_login_attempts,
    u.locked_until,
    u.created_at,
    u.updated_at,
    up.full_name,
    up.phone,
    up.position,
    up.avatar_url,
    up.employee_code,
    up.joined_date,
    d.id as department_id,
    d.name as department_name,
    d.code as department_code
FROM core.users u
LEFT JOIN core.user_profiles up ON u.id = up.user_id
LEFT JOIN core.departments d ON u.department_id = d.id
WHERE u.status != 'REVOKED';

-- ============================================================
-- View: Document metadata with category and department
-- ============================================================
CREATE OR REPLACE VIEW metadata.v_document_metadata_full AS
SELECT 
    dm.id,
    dm.document_id,
    dm.title,
    dm.description,
    dm.document_type,
    dm.access_level,
    dm.effective_date,
    dm.expiry_date,
    dm.status,
    dm.current_version,
    dm.created_at,
    dm.updated_at,
    dm.published_at,
    c.id as category_id,
    c.name as category_name,
    c.slug as category_slug,
    d.id as department_id,
    d.name as department_name,
    d.code as department_code,
    creator.username as created_by_username,
    updater.username as updated_by_username,
    ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
FROM metadata.document_metadata dm
LEFT JOIN metadata.categories c ON dm.category_id = c.id
LEFT JOIN core.departments d ON dm.department_id = d.id
LEFT JOIN core.users creator ON dm.created_by = creator.id
LEFT JOIN core.users updater ON dm.updated_by = updater.id
LEFT JOIN metadata.document_tags dt ON dm.id = dt.document_metadata_id
LEFT JOIN metadata.tags t ON dt.tag_id = t.id
WHERE dm.deleted_at IS NULL
GROUP BY dm.id, c.id, d.id, creator.username, updater.username;

-- ============================================================
-- View: Documents with processing status
-- ============================================================
CREATE OR REPLACE VIEW knowledge.v_documents_with_status AS
SELECT 
    d.id,
    d.original_filename,
    d.file_type,
    d.file_size_bytes,
    d.status,
    d.current_version,
    d.page_count,
    d.word_count,
    d.ocr_required,
    d.created_at,
    d.updated_at,
    d.uploaded_by,
    COALESCE(chunk_stats.chunk_count, 0) as chunk_count,
    COALESCE(chunk_stats.total_tokens, 0) as total_tokens,
    latest_job.job_type as current_job_type,
    latest_job.progress_percent as current_progress,
    latest_job.error_message as latest_error
FROM knowledge.documents d
LEFT JOIN (
    SELECT 
        document_id,
        COUNT(*) as chunk_count,
        SUM(token_count) as total_tokens
    FROM knowledge.chunks
    GROUP BY document_id
) chunk_stats ON d.id = chunk_stats.document_id
LEFT JOIN LATERAL (
    SELECT job_type, progress_percent, error_message
    FROM knowledge.processing_jobs
    WHERE document_id = d.id
    ORDER BY created_at DESC
    LIMIT 1
) latest_job ON TRUE
WHERE d.deleted_at IS NULL;

-- ============================================================
-- View: Conversation summary
-- ============================================================
CREATE OR REPLACE VIEW conversation.v_conversations_summary AS
SELECT 
    c.id,
    c.user_id,
    c.title,
    c.message_count,
    c.last_message_at,
    c.created_at,
    last_msg.content as last_message_preview,
    last_msg.role as last_message_role
FROM conversation.conversations c
LEFT JOIN LATERAL (
    SELECT content, role
    FROM conversation.messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
) last_msg ON TRUE
WHERE c.deleted_at IS NULL;

-- ============================================================
-- View: Feedback summary
-- ============================================================
CREATE OR REPLACE VIEW analytics.v_feedback_summary AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_feedbacks,
    COUNT(*) FILTER (WHERE type = 'LIKE') as likes,
    COUNT(*) FILTER (WHERE type = 'DISLIKE') as dislikes,
    ROUND(
        COUNT(*) FILTER (WHERE type = 'LIKE')::NUMERIC / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) as satisfaction_percentage,
    COUNT(*) FILTER (WHERE comment IS NOT NULL) as with_comments
FROM analytics.feedbacks
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ============================================================
-- View: Recent audit activity
-- ============================================================
CREATE OR REPLACE VIEW analytics.v_recent_audit_activity AS
SELECT 
    al.id,
    al.created_at,
    al.username,
    al.user_role,
    al.action,
    al.resource_type,
    al.resource_name,
    al.ip_address,
    al.service_name
FROM analytics.audit_logs al
ORDER BY al.created_at DESC
LIMIT 100;