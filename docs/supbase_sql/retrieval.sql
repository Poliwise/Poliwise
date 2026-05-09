-- 1. Xem danh sách tất cả các bảng hiện có trong hệ thống (Để bạn biết có bao nhiêu bảng)
SELECT
    table_schema,
    table_name
FROM
    information_schema.tables
WHERE
    table_schema IN ('knowledge', 'core', 'metadata', 'analytics')
ORDER BY
    table_schema,
    table_name;

SELECT
    *
FROM
    knowledge.documents;

-- Thông tin gốc của tài liệu
SELECT
    *
FROM
    knowledge.document_versions;

-- Các phiên bản (chứa extracted_text & fingerprint)
SELECT
    *
FROM
    knowledge.processing_jobs;

-- Trạng thái các job nạp liệu
SELECT
    *
FROM
    knowledge.chunks;

-- Các đoạn văn bản sau khi cắt (nếu có)
SELECT
    *
FROM
    knowledge.embedding_cache;

-- Bộ nhớ đệm vector embedding
SELECT
    *
FROM
    knowledge.document_audit_logs;

-- Nhật ký thay đổi tài liệu
SELECT
    *
FROM
    core.users;

-- Tài liệu người dùng (admin, user...)
SELECT
    *
FROM
    core.user_profiles;

-- Thông tin chi tiết profile
SELECT
    *
FROM
    core.departments;

-- Danh sách phòng ban
SELECT
    *
FROM
    core.login_history;

-- Lịch sử đăng nhập
SELECT
    *
FROM
    core.refresh_tokens;

-- Token duy trì phiên
SELECT
    *
FROM
    core.access_token_blacklist;

-- Các token đã bị vô hiệu hóa
SELECT
    *
FROM
    metadata.document_metadata;

-- Metadata mở rộng của tài liệu
SELECT
    *
FROM
    metadata.categories;

-- Danh mục tài liệu
SELECT
    *
FROM
    metadata.tags;

-- Các nhãn (tags)
SELECT
    *
FROM
    metadata.document_tags;

-- Liên kết tài liệu - tag
SELECT
    *
FROM
    metadata.document_access_rules;

-- Quy tắc truy cập chi tiết
SELECT
    *
FROM
    analytics.feedbacks;

-- Phản hồi của người dùng về câu trả lời
SELECT
    *
FROM
    analytics.audit_logs;

-- Nhật ký hoạt động toàn hệ thống
SELECT
    *
FROM
    analytics.usage_stats;

-- Thống kê sử dụng tổng quát
SELECT
    *
FROM
    analytics.document_popularity;

-- Thống kê độ phổ biến của tài liệu
SELECT
    *
FROM
    analytics.popular_questions;

-- Các câu hỏi thường gặp
SELECT
    *
FROM
    analytics.daily_aggregates;

-- Thống kê gộp theo ngày
SELECT
    *
FROM
    analytics.hourly_aggregates;

-- Thống kê gộp theo giờ
SELECT
    *
FROM
    analytics.department_daily_stats;

-- Thống kê theo phòng ban
SELECT
    *
FROM
    analytics.report_exports;

-- Lịch sử xuất báo cáo
INSERT INTO
    metadata.categories (id, name, description, slug, created_at)
VALUES
    (
        gen_random_uuid(),
        'Human Resources',
        'Policies related to employment, benefits, and workplace conduct.',
        'human-resources',
        NOW()
    ),
    (
        gen_random_uuid(),
        'Information Security',
        'Guidelines for data protection, system access, and cybersecurity.',
        'information-security',
        NOW()
    ),
    (
        gen_random_uuid(),
        'Finance & Accounting',
        'Rules for expenses, procurement, auditing, and financial reporting.',
        'finance-accounting',
        NOW()
    ),
    (
        gen_random_uuid(),
        'Legal & Compliance',
        'Regulatory requirements, ethics, and legal standing of the organization.',
        'legal-compliance',
        NOW()
    ),
    (
        gen_random_uuid(),
        'Operations',
        'Standard operating procedures and facilities management guidelines.',
        'operations',
        NOW()
    ),
    (
        gen_random_uuid(),
        'Health & Safety',
        'Workplace safety standards, emergency procedures, and employee well-being.',
        'health-safety',
        NOW()
    ),
    (
        gen_random_uuid(),
        'IT & Infrastructure',
        'Hardware usage, software licensing, and network infrastructure policies.',
        'it-infrastructure',
        NOW()
    ),
    (
        gen_random_uuid(),
        'Customer Service',
        'Service level agreements and customer interaction standards.',
        'customer-service',
        NOW()
    );