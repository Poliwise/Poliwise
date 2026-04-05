-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert default departments
INSERT INTO core.departments (id, name, code, description) VALUES
    (uuid_generate_v4(), 'Ban Giám đốc', 'BGD', 'Ban lãnh đạo công ty'),
    (uuid_generate_v4(), 'Phòng Nhân sự', 'HR', 'Human Resources Department'),
    (uuid_generate_v4(), 'Phòng Kỹ thuật', 'TECH', 'Technology & Engineering'),
    (uuid_generate_v4(), 'Phòng Kinh doanh', 'SALES', 'Sales & Business Development'),
    (uuid_generate_v4(), 'Phòng Tài chính', 'FIN', 'Finance & Accounting'),
    (uuid_generate_v4(), 'Phòng Marketing', 'MKT', 'Marketing & Communications');

-- Insert default categories
INSERT INTO metadata.categories (id, name, slug, description, display_order) VALUES
    (uuid_generate_v4(), 'Chính sách công ty', 'chinh-sach', 'Các chính sách nội bộ của công ty', 1),
    (uuid_generate_v4(), 'Quy trình làm việc', 'quy-trinh', 'Các quy trình nghiệp vụ', 2),
    (uuid_generate_v4(), 'Hướng dẫn sử dụng', 'huong-dan', 'Tài liệu hướng dẫn', 3),
    (uuid_generate_v4(), 'Biểu mẫu', 'bieu-mau', 'Các biểu mẫu cần thiết', 4),
    (uuid_generate_v4(), 'Thông báo', 'thong-bao', 'Thông báo nội bộ', 5);

-- Insert default tags
INSERT INTO metadata.tags (name, slug, color) VALUES
    ('Quan trọng', 'quan-trong', '#EF4444'),
    ('Mới cập nhật', 'moi-cap-nhat', '#10B981'),
    ('Bắt buộc đọc', 'bat-buoc-doc', '#F59E0B'),
    ('FAQ', 'faq', '#6366F1'),
    ('Nghỉ phép', 'nghi-phep', '#8B5CF6'),
    ('Lương thưởng', 'luong-thuong', '#EC4899'),
    ('Bảo hiểm', 'bao-hiem', '#14B8A6'),
    ('An toàn lao động', 'an-toan', '#F97316');

-- Create default admin user (password: Admin@123)
INSERT INTO core.users (id, username, email, password_hash, role, status) VALUES
    (uuid_generate_v4(), 'admin', 'admin@poliwise.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.K5K5K5K5K5K5K5', 'ADMIN', 'ACTIVE');

-- Create admin profile
INSERT INTO core.user_profiles (user_id, full_name, position, employee_code, joined_date)
SELECT id, 'System Administrator', 'Administrator', 'ADMIN001', CURRENT_DATE
FROM core.users WHERE username = 'admin';