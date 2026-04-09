-- ============================================================
-- FILE: 001_pure_additions.sql
-- MỤC ĐÍCH: Chỉ bổ sung những gì THỰC SỰ còn thiếu
--           so với entity code và không có trong docs/supbase_sql/
-- NOTE: Các bảng/enum đã có đầy đủ trong SQL gốc rồi.
--       File này chỉ thêm 2 thứ duy nhất:
--         1. Bảng core.access_token_blacklist (hoàn toàn chưa có)
--         2. Cột knowledge.chunks.is_latest (thiếu trong SQL gốc)
-- ============================================================

-- ============================================================
-- 1. TABLE: core.access_token_blacklist
-- Entity: com.poliwise.auth.entity.AccessTokenBlacklist (auth-service)
-- Mục đích: Lưu JTI của access token đã bị thu hồi
--            (logout, đổi mật khẩu, revoke, thay đổi chính sách)
-- ============================================================
CREATE TABLE IF NOT EXISTS core.access_token_blacklist (
    jti VARCHAR(100) PRIMARY KEY,
    user_id UUID NOT NULL,
    expired_at TIMESTAMPTZ NOT NULL,
    blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_core_access_token_blacklist_user_id
    ON core.access_token_blacklist(user_id);

CREATE INDEX IF NOT EXISTS idx_core_access_token_blacklist_expired_at
    ON core.access_token_blacklist(expired_at);

COMMENT ON TABLE core.access_token_blacklist IS
    'Blacklist JTI của access token đã bị thu hồi (logout, PASSWORD_CHANGE, USER_REVOKED...)';

-- ============================================================
-- 2. THÊM CỘT: knowledge.chunks.is_latest
-- Entity: com.poliwise.knowledge.entity.Chunk (knowledge-service)
-- Mục đích: Đánh dấu chunk nào là phiên bản mới nhất cho mỗi vị trí trong tài liệu
-- ============================================================
ALTER TABLE knowledge.chunks
    ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_is_latest
    ON knowledge.chunks(is_latest) WHERE is_latest = TRUE;
