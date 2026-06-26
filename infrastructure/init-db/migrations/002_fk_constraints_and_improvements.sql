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
            regexp_replace(NEW.question, '[^a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ\s]', ' ', 'g'),
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
        regexp_replace(question, '[^a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ\s]', ' ', 'g'),
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
CREATE INDEX idx_access_rules_targets
    ON metadata.document_access_rules(target_type, target_role, target_department_id, target_user_id);

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
