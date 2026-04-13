-- ============================================================
-- FILE: 002_staging_upload.sql
-- MỤC ĐÍCH: Bổ sung hai-phase upload support
--           1. Thêm STAGING vào processing_status enum
--           2. Thêm cột expires_at cho documents table
-- ============================================================

-- ============================================================
-- 1. ENUM: Thêm STAGING vào knowledge.processing_status
-- ============================================================
-- PostgreSQL không cho ALTER TYPE ... ADD VALUE IF NOT EXISTS với vị trí cụ thể,
-- nên ta thêm STAGING vào cuối enum (sau FAILED)
ALTER TYPE knowledge.processing_status
    ADD VALUE IF NOT EXISTS 'STAGING';

-- ============================================================
-- 2. CỘT: knowledge.documents.expires_at
-- ============================================================
ALTER TABLE knowledge.documents
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_expires_at
    ON knowledge.documents(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN knowledge.documents.expires_at IS
    'Thời gian hết hạn cho staging documents. NULL cho documents đã confirmed.';

-- ============================================================
-- 3. CASCADING DELETE: Đảm bảo xóa document sẽ xóa luôn versions
-- ============================================================
-- Nếu constraint mặc định tồn tại (thường là documents_versions_document_id_fkey), 
-- ta drop và recreate với ON DELETE CASCADE để đảm bảo đồng bộ.
DO $$
BEGIN
    -- Drop old foreign key if exists (without cascade)
    IF EXISTS (
        SELECT 1 FROM information_schema.key_column_usage 
        WHERE constraint_name = 'document_versions_document_id_fkey' 
        AND table_schema = 'knowledge'
    ) THEN
        ALTER TABLE knowledge.document_versions DROP CONSTRAINT document_versions_document_id_fkey;
    END IF;

    -- Add it back with ON DELETE CASCADE
    ALTER TABLE knowledge.document_versions
        ADD CONSTRAINT document_versions_document_id_fkey 
        FOREIGN KEY (document_id) REFERENCES knowledge.documents(id) ON DELETE CASCADE;
END $$;
