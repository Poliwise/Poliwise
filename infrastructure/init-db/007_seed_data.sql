-- ============================================================
-- FILE: 007_seed_data.sql
-- SCHEMA: ALL
-- Contains: Default seed data for initial deployment
-- ============================================================
-- Seed data for categories, tags, and default admin user.
-- Safe to re-run (uses ON CONFLICT DO NOTHING).
-- ============================================================

-- ============================================================
-- SEED: Categories
-- ============================================================
INSERT INTO metadata.categories (id, name, slug, description, display_order, is_active) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Chính sách nhân sự', 'chinh-sach-nhan-su', 'Các chính sách liên quan đến nhân sự và tuyển dụng', 1, TRUE),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Quy chế tài chính', 'quy-che-tai-chinh', 'Quy chế về tài chính và ngân sách', 2, TRUE),
    ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Quy định văn hóa', 'quy-dinh-van-hoa', 'Quy định về văn hóa doanh nghiệp', 3, TRUE),
    ('d4e5f6a7-b8c9-0123-defa-234567890123', 'An toàn lao động', 'an-toan-lao-dong', 'Quy định về an toàn và vệ sinh lao động', 4, TRUE),
    ('e5f6a7b8-c9d0-1234-efab-345678901234', 'Quy trình nghiệp vụ', 'quy-trinh-nghiep-vu', 'Các quy trình nghiệp vụ nội bộ', 5, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: Tags
-- ============================================================
INSERT INTO metadata.tags (id, name, slug, color) VALUES
    ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'Quan trọng', 'quan-trong', '#ef4444'),
    ('a7b8c9d0-e1f2-3456-abcd-567890123456', 'Mới', 'moi', '#22c55e'),
    ('b8c9d0e1-f2a3-4567-bcde-678901234567', 'Cập nhật', 'cap-nhat', '#3b82f6'),
    ('c9d0e1f2-a3b4-5678-cdef-789012345678', 'Cần xem xét', 'can-xem-xet', '#f59e0b'),
    ('d0e1f2a3-b4c5-6789-defa-890123456789', 'Nội bộ', 'noi-bo', '#8b5cf6')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED: Default Admin User
-- ============================================================
-- Password: Admin@123456 (bcrypt hash)
INSERT INTO core.users (id, username, email, password_hash, role, status, department_id, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@poliwise.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqJ5.KK0Ke',
    'ADMIN',
    'ACTIVE',
    NULL,
    NULL
)
ON CONFLICT (username) DO NOTHING;

-- Create admin profile
INSERT INTO core.user_profiles (id, user_id, full_name)
VALUES (
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'System Administrator'
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- SEED: Default Department
-- ============================================================
INSERT INTO core.departments (id, name, code, description, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Quản trị hệ thống',
    'ADMIN',
    'Phòng ban quản trị hệ thống',
    TRUE
)
ON CONFLICT (code) DO NOTHING;