-- ============================================================
-- SEED DATA (ENGLISH VERSION)
-- ============================================================

-- Insert default departments
INSERT INTO core.departments (id, name, code, description) VALUES
    (uuid_generate_v4(), 'Board of Directors', 'BOD', 'Organization leadership and executives'),
    (uuid_generate_v4(), 'Human Resources', 'HR', 'Human Resources and Employee Relations'),
    (uuid_generate_v4(), 'Engineering & Tech', 'TECH', 'Technology, Engineering & IT Infrastructure'),
    (uuid_generate_v4(), 'Sales & Business', 'SALES', 'Sales and Business Development'),
    (uuid_generate_v4(), 'Finance & Accounting', 'FIN', 'Financial planning and accounting services'),
    (uuid_generate_v4(), 'Marketing', 'MKT', 'Marketing and Communications');

-- Insert default categories
INSERT INTO metadata.categories (id, name, slug, description, display_order) VALUES
    (uuid_generate_v4(), 'Company Policies', 'company-policies', 'Internal rules and regulations of the organization', 1),
    (uuid_generate_v4(), 'Standard Procedures', 'standard-procedures', 'Business and operational workflows', 2),
    (uuid_generate_v4(), 'User Guides', 'user-guides', 'Instructional and training materials', 3),
    (uuid_generate_v4(), 'Templates', 'templates', 'Necessary forms and document templates', 4),
    (uuid_generate_v4(), 'Announcements', 'announcements', 'Internal news and organizational updates', 5);

-- Insert default tags
INSERT INTO metadata.tags (name, slug, color) VALUES
    ('Important', 'important', '#EF4444'),
    ('Recently Updated', 'recently-updated', '#10B981'),
    ('Mandatory Reading', 'mandatory-reading', '#F59E0B'),
    ('FAQ', 'faq', '#6366F1'),
    ('Leave & Time-off', 'leave-time-off', '#8B5CF6'),
    ('Compensation', 'compensation', '#EC4899'),
    ('Insurance', 'insurance', '#14B8A6'),
    ('Workplace Safety', 'safety', '#F97316');

-- Create default admin user (password: Admin@123456)
-- Password hash for 'Admin@123456'
INSERT INTO core.users (id, username, email, password_hash, role, status) VALUES
    (uuid_generate_v4(), 'admin', 'admin@poliwise.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.K5K5K5K5K5K5K5', 'ADMIN', 'ACTIVE');

-- Create admin profile
INSERT INTO core.user_profiles (user_id, full_name, position, employee_code, joined_date)
SELECT id, 'System Administrator', 'Senior Administrator', 'ADMIN001', CURRENT_DATE
FROM core.users WHERE username = 'admin';