# Database Schema Documentation

## Tổng Quan

Hệ thống sử dụng **5 schema** trong database Supabase (`postgres`):

| Schema        | Owner Service   | Mục đích                                                  |
|---------------|-----------------|-----------------------------------------------------------|
| **core**      | auth-service    | Users, auth data, departments, profiles, refresh tokens, access token blacklist |
| **knowledge** | knowledge-service | Tài liệu, phiên bản, chunks, processing jobs, embedding cache |
| **metadata**  | metadata-service | Metadata tài liệu: danh mục, tag, quyền truy cập       |
| **analytics** | feedback-service | Feedback, usage stats, audit logs, aggregates            |
| **conversation** | feedback-service | Unanswered questions (từ feedback-service entity)      |

> **Lưu ý:** Không tạo schema `auth` riêng vì Supabase connection pooler không cho phép. Enum và bảng auth-related đặt trong schema `core`.

---

## Auth-related Types (trong schema core)

> Không tạo schema `auth` riêng vì Supabase connection pooler không cho phép. Các enum và bảng auth-related nằm trong schema `core`.

### Enum Types

```sql
CREATE TYPE core.user_role AS ENUM ('USER', 'MANAGER', 'ADMIN');
CREATE TYPE core.account_status AS ENUM ('ACTIVE', 'DEACTIVATED', 'REVOKED');
CREATE TYPE core.login_status AS ENUM (
    'SUCCESS', 'FAILED_CREDENTIALS', 'FAILED_DEACTIVATED', 'FAILED_REVOKED', 'FAILED_LOCKED'
);
```

### core.access_token_blacklist

**Blacklist các JTI của access token đã bị thu hồi (logout, đổi mật khẩu, revoke)**

| Cột             | Kiểu       | Mô tả                                     |
|-----------------|------------|-------------------------------------------|
| `jti`           | VARCHAR    | JWT ID — Primary Key                      |
| `user_id`       | UUID       | User sở hữu token                         |
| `expired_at`    | TIMESTAMPTZ| Thời điểm token hết hạn                  |
| `blacklisted_at` | TIMESTAMPTZ| Thời điểm bị blacklist (default NOW())    |
| `reason`        | VARCHAR    | Lý do: LOGOUT, PASSWORD_CHANGE, ...       |

---

## Schema: Core (auth-service + user-service)

### Enum Types

```sql
CREATE TYPE core.user_role AS ENUM ('USER', 'MANAGER', 'ADMIN');
CREATE TYPE core.account_status AS ENUM ('ACTIVE', 'DEACTIVATED', 'REVOKED');
```

### core.users

**Tài khoản người dùng — bảng duy nhất cho toàn bộ hệ thống**

| Cột                     | Kiểu             | Mô tả                                      |
|-------------------------|------------------|--------------------------------------------|
| `id`                    | UUID             | Primary Key                                |
| `username`              | VARCHAR(50)      | Unique, đăng nhập                          |
| `email`                 | VARCHAR(255)     | Unique                                     |
| `password_hash`         | VARCHAR(255)     | BCrypt hash (không plaintext)              |
| `role`                  | core.user_role   | USER / MANAGER / ADMIN                      |
| `status`                | core.account_status | ACTIVE / DEACTIVATED / REVOKED           |
| `department_id`         | UUID             | FK tới core.departments                     |
| `failed_login_attempts` | INT              | Số lần login thất bại liên tiếp            |
| `locked_until`          | TIMESTAMPTZ      | Thời gian hết khóa (sau brute-force)      |
| `password_changed_at`   | TIMESTAMPTZ      | Lần đổi mật khẩu gần nhất                  |
| `must_change_password`  | BOOLEAN          | Bắt buộc đổi mật khẩu ở lần đăng nhập tiếp |
| `created_by`            | UUID             | Ai tạo tài khoản                            |
| `created_at`            | TIMESTAMPTZ      | Ngày tạo                                   |
| `updated_at`            | TIMESTAMPTZ      | Ngày cập nhật (auto-update trigger)       |
| `deactivated_at`        | TIMESTAMPTZ      | Ngày khóa tài khoản (status=DEACTIVATED)  |
| `revoked_at`            | TIMESTAMPTZ      | Ngày thu hồi (status=REVOKED)             |

### core.departments

| Cột           | Kiểu        | Mô tả                        |
|---------------|-------------|------------------------------|
| `id`          | UUID        | Primary Key                  |
| `name`        | VARCHAR     | Tên phòng ban                |
| `code`        | VARCHAR     | Mã phòng ban (unique)        |
| `description` | TEXT        | Mô tả                        |
| `parent_id`   | UUID        | FK tới chính bảng (phân cấp) |
| `is_active`   | BOOLEAN     | Có hoạt động hay không       |
| `created_at`  | TIMESTAMPTZ | Ngày tạo                     |
| `updated_at`  | TIMESTAMPTZ | Ngày cập nhật                |

### core.user_profiles

**Hồ sơ chi tiết người dùng**

| Cột             | Kiểu       | Mô tả                   |
|-----------------|------------|-------------------------|
| `id`            | UUID       | Primary Key             |
| `user_id`       | UUID       | FK tới core.users (1:1) |
| `full_name`     | VARCHAR    | Họ và tên               |
| `phone`         | VARCHAR    | Số điện thoại           |
| `position`      | VARCHAR    | Chức vụ                 |
| `avatar_url`    | VARCHAR    | URL ảnh đại diện        |
| `bio`           | TEXT       | Mô tả cá nhân           |
| `date_of_birth` | DATE       | Ngày sinh               |
| `employee_code` | VARCHAR    | Mã nhân viên (unique)    |
| `joined_date`   | DATE       | Ngày vào công ty        |
| `created_at`    | TIMESTAMPTZ| Ngày tạo                |
| `updated_at`    | TIMESTAMPTZ| Ngày cập nhật           |

### core.refresh_tokens

| Cột              | Kiểu        | Mô tả                      |
|------------------|-------------|---------------------------|
| `id`             | UUID        | Primary Key               |
| `user_id`        | UUID        | FK tới core.users          |
| `token_hash`     | VARCHAR     | BCrypt hash của token      |
| `device_info`    | VARCHAR     | Thiết bị đăng nhập        |
| `ip_address`     | INET        | IP client                  |
| `user_agent`     | TEXT        | Browser/app info           |
| `expires_at`     | TIMESTAMPTZ | Hết hạn                    |
| `revoked`        | BOOLEAN     | Đã thu hồi hay chưa       |
| `revoked_at`     | TIMESTAMPTZ | Thời gian thu hồi         |
| `revoked_reason` | VARCHAR     | Lý do thu hồi             |
| `replaced_by`    | UUID        | Token mới thay thế        |
| `created_at`     | TIMESTAMPTZ | Ngày tạo                  |

### core.login_history

| Cột              | Kiểu          | Mô tả                  |
|------------------|---------------|-----------------------|
| `id`             | UUID          | Primary Key           |
| `user_id`        | UUID          | FK tới core.users     |
| `username`       | VARCHAR       | Tên đăng nhập         |
| `ip_address`     | INET          | IP client             |
| `user_agent`     | TEXT          | Browser info          |
| `device_type`    | VARCHAR       | Loại thiết bị         |
| `location`       | VARCHAR       | Vị trí địa lý         |
| `status`         | auth.login_status | SUCCESS / FAILED_* |
| `failure_reason` | VARCHAR       | Lý do thất bại        |
| `created_at`     | TIMESTAMPTZ   | Thời gian đăng nhập   |

---

## Schema: Knowledge (knowledge-service)

### Enum Types

```sql
CREATE TYPE knowledge.processing_status AS ENUM (
    'UPLOADED','PARSING','PARSED','CHUNKING','CHUNKED',
    'EMBEDDING','EMBEDDED','INDEXING','INDEXED','READY','FAILED'
);
CREATE TYPE knowledge.processing_step AS ENUM ('UPLOAD','PARSE','CHUNK','EMBED','INDEX');
CREATE TYPE knowledge.file_type AS ENUM ('PDF','DOCX','XLSX','DOC','XLS','TXT','PNG','JPG','JPEG');
CREATE TYPE knowledge.chunking_strategy AS ENUM ('RECURSIVE','SEMANTIC','FIXED_SIZE','SENTENCE');
CREATE TYPE knowledge.embedding_model AS ENUM (
    'TEXT_EMBEDDING_3_SMALL','TEXT_EMBEDDING_3_LARGE','MULTILINGUAL_E5_LARGE'
);
```

### knowledge.documents

**Thông tin file tài liệu gốc**

| Cột                 | Kiểu                      | Mô tả                      |
|---------------------|---------------------------|----------------------------|
| `id`                | UUID                      | Primary Key                |
| `original_filename` | VARCHAR                   | Tên file gốc               |
| `file_type`         | knowledge.file_type        | PDF, DOCX, ...             |
| `file_size_bytes`   | BIGINT                    | Kích thước file            |
| `mime_type`         | VARCHAR                   | MIME type                  |
| `file_key`          | VARCHAR                   | Key lưu trữ (S3/storage)  |
| `bucket_name`       | VARCHAR                   | Bucket lưu trữ             |
| `status`            | knowledge.processing_status | Trạng thái xử lý        |
| `current_version`   | INT                       | Phiên bản hiện tại         |
| `extracted_text`    | TEXT                      | Text đã trích xuất         |
| `page_count`        | INT                       | Số trang                   |
| `word_count`        | INT                       | Số từ                      |
| `language`          | VARCHAR                   | Ngôn ngữ (default 'vi')    |
| `ocr_required`      | BOOLEAN                  | Cần OCR hay không           |
| `ocr_confidence`    | DECIMAL(5,4)             | Độ chính xác OCR           |
| `chunking_strategy` | knowledge.chunking_strategy | Chiến lược chia chunk   |
| `chunk_size`        | INT                       | Kích thước chunk (char)    |
| `chunk_overlap`     | INT                       | Overlap giữa các chunk     |
| `embedding_model`   | knowledge.embedding_model | Model embedding sử dụng    |
| `uploaded_by`       | UUID                      | FK tới core.users          |
| `created_at`        | TIMESTAMPTZ               | Ngày tạo                   |
| `updated_at`        | TIMESTAMPTZ               | Ngày cập nhật              |
| `deleted_at`        | TIMESTAMPTZ               | Soft delete                |

### knowledge.document_versions

| Cột               | Kiểu        | Mô tả                                   |
|-------------------|-------------|----------------------------------------|
| `id`              | UUID        | Primary Key                            |
| `document_id`     | UUID        | FK tới knowledge.documents              |
| `version_number`  | INT         | Số phiên bản                           |
| `file_key`        | VARCHAR     | Key lưu trữ phiên bản này              |
| `file_size_bytes` | BIGINT      | Kích thước file                        |
| `changelog`       | TEXT        | Nhật ký thay đổi                       |
| `extracted_text`  | TEXT        | Text đã trích xuất                     |
| `is_current`      | BOOLEAN     | Là phiên bản hiện hành hay không       |
| `created_by`      | UUID        | FK tới core.users                      |
| `created_at`      | TIMESTAMPTZ | Ngày tạo                               |

### knowledge.chunks

**Các đoạn text được chia để embedding (RAG)**

| Cột                    | Kiểu            | Mô tả                                |
|------------------------|-----------------|--------------------------------------|
| `id`                   | UUID            | Primary Key                          |
| `document_id`          | UUID            | FK tới knowledge.documents            |
| `document_version_id`  | UUID            | FK tới knowledge.document_versions   |
| `is_latest`            | BOOLEAN         | Chunk mới nhất cho vị trí đó         |
| `chunk_type`           | VARCHAR         | 'parent' / 'child'                   |
| `parent_chunk_id`      | UUID            | FK tới chunk cha (parent chunk)      |
| `section_title`        | VARCHAR         | Tiêu đề section                      |
| `section_level`        | INT             | Cấp độ heading (1, 2, 3...)          |
| `section_path`         | JSONB           | Đường dẫn cấu trúc, vd `["Chương 1"]` |
| `content`              | TEXT            | Nội dung chunk (bắt buộc)            |
| `summary`              | TEXT            | Tóm tắt (dùng cho parent chunk)      |
| `chunk_index`          | INT             | Thứ tự chunk trong tài liệu          |
| `page_number`          | INT             | Số trang                             |
| `start_char_index`     | INT             | Vị trí ký tự bắt đầu                 |
| `end_char_index`       | INT             | Vị trí ký tự kết thúc               |
| `token_count`          | INT             | Số token ước tính                    |
| `embedding_model`      | VARCHAR         | Model embedding đã dùng              |
| `embedding_dimension`  | INT             | Số chiều embedding                   |
| `embedding`            | TEXT            | Embedding dạng text (debug/audit)    |
| `allowed_roles`        | TEXT[]          | Danh sách role được phép truy cập    |
| `allowed_departments`  | UUID[]          | Danh sách department được phép       |
| `access_level`         | VARCHAR         | PUBLIC / INTERNAL / CONFIDENTIAL     |
| `metadata`             | JSONB           | Metadata linh hoạt bổ sung           |
| `created_at`           | TIMESTAMPTZ     | Ngày tạo                             |

### knowledge.processing_jobs

| Cột                | Kiểu                      | Mô tả                   |
|--------------------|---------------------------|-------------------------|
| `id`               | UUID                      | Primary Key             |
| `document_id`      | UUID                      | FK tới knowledge.documents |
| `job_type`         | knowledge.processing_step  | UPLOAD / PARSE / CHUNK / EMBED / INDEX |
| `status`           | knowledge.processing_status | Trạng thái xử lý      |
| `progress_percent`  | INT                       | % tiến độ (0-100)       |
| `started_at`       | TIMESTAMPTZ                | Thời gian bắt đầu       |
| `completed_at`     | TIMESTAMPTZ                | Thời gian hoàn thành     |
| `success`          | BOOLEAN                   | Thành công hay không     |
| `error_message`    | TEXT                      | Thông báo lỗi           |
| `error_details`    | JSONB                     | Chi tiết lỗi            |
| `retry_count`      | INT                       | Số lần thử lại          |
| `max_retries`      | INT                       | Số lần thử tối đa       |
| `output_metrics`   | JSONB                     | Metrics đầu ra          |
| `created_at`       | TIMESTAMPTZ                | Ngày tạo                |
| `updated_at`       | TIMESTAMPTZ                | Ngày cập nhật           |

### knowledge.embedding_cache

| Cột                   | Kiểu              | Mô tả                  |
|-----------------------|-------------------|-----------------------|
| `id`                  | UUID              | Primary Key           |
| `text_hash`           | VARCHAR           | Hash của text gốc      |
| `text_length`         | INT              | Độ dài text           |
| `embedding_model`     | knowledge.embedding_model | Model embedding |
| `embedding_dimension` | INT              | Số chiều embedding     |
| `usage_count`         | INT              | Số lần sử dụng cache   |
| `last_used_at`        | TIMESTAMPTZ      | Lần sử dụng gần nhất   |
| `created_at`          | TIMESTAMPTZ      | Ngày tạo               |

---

## Schema: Metadata (metadata-service)

### Enum Types

```sql
CREATE TYPE metadata.access_level AS ENUM ('PUBLIC', 'DEPARTMENT_ONLY', 'RESTRICTED');
CREATE TYPE metadata.document_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'EXPIRED');
CREATE TYPE metadata.user_role AS ENUM ('USER', 'MANAGER', 'ADMIN');  -- cùng giá trị core.user_role
```

### metadata.categories

| Cột             | Kiểu        | Mô tả                     |
|-----------------|-------------|--------------------------|
| `id`            | UUID        | Primary Key              |
| `name`          | VARCHAR     | Tên danh mục             |
| `slug`          | VARCHAR     | URL slug (unique)         |
| `description`   | TEXT        | Mô tả                    |
| `parent_id`     | UUID        | Danh mục cha (phân cấp)   |
| `icon`          | VARCHAR     | Icon                     |
| `display_order` | INT         | Thứ tự hiển thị          |
| `is_active`     | BOOLEAN     | Có hoạt động hay không    |
| `created_at`    | TIMESTAMPTZ | Ngày tạo                 |
| `updated_at`    | TIMESTAMPTZ | Ngày cập nhật            |

### metadata.tags

| Cột           | Kiểu        | Mô tả                  |
|---------------|-------------|------------------------|
| `id`          | UUID        | Primary Key            |
| `name`        | VARCHAR     | Tên tag (unique)        |
| `slug`        | VARCHAR     | URL slug (unique)       |
| `color`       | VARCHAR     | Màu sắc (hex, default #6B7280) |
| `usage_count` | INT         | Số lần sử dụng (auto-update trigger) |
| `created_at`  | TIMESTAMPTZ | Ngày tạo                |

### metadata.document_metadata

**Metadata chính của tài liệu**

| Cột               | Kiểu                    | Mô tả                     |
|-------------------|-------------------------|--------------------------|
| `id`              | UUID                    | Primary Key              |
| `document_id`     | UUID                    | FK tới knowledge.documents |
| `title`           | VARCHAR                 | Tiêu đề tài liệu         |
| `description`     | TEXT                    | Mô tả                    |
| `document_type`   | VARCHAR                 | Loại tài liệu            |
| `category_id`     | UUID                    | FK tới metadata.categories |
| `department_id`   | UUID                    | FK tới core.departments   |
| `access_level`    | metadata.access_level   | PUBLIC / DEPARTMENT_ONLY / RESTRICTED |
| `effective_date`  | DATE                    | Ngày hiệu lực            |
| `expiry_date`     | DATE                    | Ngày hết hạn             |
| `status`          | metadata.document_status | DRAFT / PUBLISHED / ARCHIVED / EXPIRED |
| `current_version` | INT                     | Phiên bản hiện tại        |
| `created_by`      | UUID                    | FK tới core.users         |
| `updated_by`      | UUID                    | FK tới core.users         |
| `published_by`    | UUID                    | FK tới core.users         |
| `published_at`    | TIMESTAMPTZ             | Thời gian xuất bản        |
| `created_at`      | TIMESTAMPTZ             | Ngày tạo                  |
| `updated_at`      | TIMESTAMPTZ             | Ngày cập nhật             |
| `deleted_at`      | TIMESTAMPTZ             | Soft delete               |

### metadata.document_tags

| Cột                    | Kiểu        | Mô tả                   |
|------------------------|-------------|-------------------------|
| `id`                   | UUID        | Primary Key             |
| `document_metadata_id`  | UUID        | FK tới document_metadata |
| `tag_id`               | UUID        | FK tới metadata.tags     |
| `created_at`           | TIMESTAMPTZ | Ngày tạo                 |

### metadata.document_access_rules

**Quy tắc phân quyền truy cập tài liệu**

| Cột                    | Kiểu              | Mô tả                              |
|------------------------|-------------------|-----------------------------------|
| `id`                   | UUID              | Primary Key                       |
| `document_metadata_id` | UUID              | FK tới document_metadata           |
| `target_type`          | VARCHAR           | ROLE / DEPARTMENT / USER          |
| `target_role`          | metadata.user_role | Vai trò được cấp                  |
| `target_department_id`  | UUID              | FK tới core.departments           |
| `target_user_id`       | UUID              | FK tới core.users                 |
| `permission`           | VARCHAR           | VIEW / DENY                        |
| `created_by`           | UUID              | FK tới core.users                 |
| `created_at`           | TIMESTAMPTZ       | Ngày tạo                          |

---

## Schema: Analytics (feedback-service)

### Enum Types

```sql
CREATE TYPE analytics.feedback_type AS ENUM ('LIKE', 'DISLIKE');
CREATE TYPE analytics.audit_action AS ENUM (
    'LOGIN_SUCCESS','LOGIN_FAILED','LOGOUT','TOKEN_REFRESH','PASSWORD_CHANGE',
    'USER_CREATE','USER_UPDATE','USER_DEACTIVATE','USER_ACTIVATE','USER_REVOKE','USER_DELETE',
    'DOCUMENT_UPLOAD','DOCUMENT_UPDATE','DOCUMENT_DELETE','DOCUMENT_PUBLISH',
    'DOCUMENT_ARCHIVE','DOCUMENT_VERSION_CREATE',
    'QUESTION_ASK','CONVERSATION_CREATE','CONVERSATION_DELETE',
    'FEEDBACK_SUBMIT','SETTINGS_UPDATE','BULK_IMPORT','REPORT_EXPORT'
);
CREATE TYPE analytics.resource_type AS ENUM (
    'USER','DOCUMENT','CONVERSATION','MESSAGE','FEEDBACK',
    'DEPARTMENT','CATEGORY','TAG','SETTINGS'
);
CREATE TYPE analytics.export_format AS ENUM ('CSV', 'PDF', 'XLSX', 'JSON');
CREATE TYPE analytics.report_type AS ENUM (
    'USAGE_SUMMARY','QUESTION_ANALYTICS','FEEDBACK_ANALYSIS',
    'USER_ENGAGEMENT','DOCUMENT_POPULARITY','UNANSWERED_QUESTIONS','DEPARTMENT_BREAKDOWN'
);
```

### analytics.feedbacks

| Cột               | Kiểu                 | Mô tả                        |
|-------------------|----------------------|------------------------------|
| `id`              | UUID                 | Primary Key                  |
| `user_id`         | UUID                 | FK tới core.users            |
| `message_id`       | UUID                 | FK tới conversation.messages |
| `conversation_id`  | UUID                 | FK tới conversation.conversations |
| `type`            | analytics.feedback_type | LIKE / DISLIKE            |
| `comment`         | TEXT                 | Bình luận                   |
| `question_text`   | TEXT                 | Câu hỏi gốc                  |
| `answer_text`     | TEXT                 | Câu trả lời                 |
| `sources_used`    | JSONB                | Tài liệu tham khảo          |
| `user_department_id` | UUID               | Department của user          |
| `user_role`       | VARCHAR              | Role của user lúc feedback   |
| `created_at`      | TIMESTAMPTZ          | Ngày tạo                    |
| `updated_at`      | TIMESTAMPTZ          | Ngày cập nhật               |

### analytics.usage_stats

| Cột                   | Kiểu       | Mô tả                    |
|-----------------------|------------|-------------------------|
| `id`                  | UUID       | Primary Key             |
| `user_id`             | UUID       | FK tới core.users       |
| `user_role`           | VARCHAR    | Role tại thời điểm log  |
| `user_department_id`   | UUID       | Department tại thời điểm log |
| `service_name`        | VARCHAR    | Tên dịch vụ             |
| `endpoint`            | VARCHAR    | Endpoint API             |
| `method`              | VARCHAR    | HTTP method              |
| `response_time_ms`    | INT        | Thời gian phản hồi (ms) |
| `status_code`         | INT        | HTTP status code        |
| `request_size_bytes`  | INT        | Kích thước request       |
| `response_size_bytes` | INT        | Kích thước response      |
| `is_error`            | BOOLEAN    | Là lỗi hay không        |
| `error_code`          | VARCHAR    | Mã lỗi                  |
| `error_message`       | TEXT       | Thông báo lỗi           |
| `tokens_used`          | INT        | Tokens tiêu thụ          |
| `model_used`          | VARCHAR    | Model AI sử dụng         |
| `chunks_retrieved`    | INT        | Số chunk trả về          |
| `confidence`          | VARCHAR    | Mức độ tin cậy          |
| `trace_id`           | VARCHAR    | Trace ID distributed     |
| `ip_address`          | INET       | IP client                |
| `user_agent`          | TEXT       | Browser info             |
| `created_at`          | TIMESTAMPTZ| Ngày tạo                 |

### analytics.audit_logs

| Cột             | Kiểu                   | Mô tả                   |
|-----------------|------------------------|-------------------------|
| `id`            | UUID                   | Primary Key             |
| `user_id`       | UUID                   | FK tới core.users       |
| `username`      | VARCHAR                | Username tại thời điểm log |
| `user_role`     | VARCHAR                | Role tại thời điểm log  |
| `action`        | analytics.audit_action | Hành động               |
| `resource_type` | analytics.resource_type| Loại tài nguyên         |
| `resource_id`   | UUID                   | ID tài nguyên           |
| `resource_name` | VARCHAR                | Tên tài nguyên          |
| `old_value`     | JSONB                  | Giá trị cũ             |
| `new_value`     | JSONB                  | Giá trị mới            |
| `changed_fields`| TEXT[]                 | Danh sách trường thay đổi |
| `ip_address`    | INET                   | IP client               |
| `user_agent`     | TEXT                   | Browser info            |
| `trace_id`      | VARCHAR                | Trace ID                |
| `service_name`  | VARCHAR                | Tên service log         |
| `metadata`      | JSONB                  | Metadata bổ sung        |
| `created_at`    | TIMESTAMPTZ            | Ngày tạo                |

### analytics.daily_aggregates

| Cột                     | Kiểu          | Mô tả                          |
|-------------------------|---------------|--------------------------------|
| `id`                    | UUID          | Primary Key                    |
| `date`                  | DATE          | Ngày (unique)                  |
| `total_questions`       | INT           | Tổng câu hỏi                  |
| `total_conversations`   | INT           | Tổng phiên chat               |
| `unique_users_asked`    | INT           | Số user đã hỏi                 |
| `total_likes`           | INT           | Tổng like                     |
| `total_dislikes`        | INT           | Tổng dislike                  |
| `feedback_ratio`        | DECIMAL(5,4)  | Tỷ lệ like / total            |
| `avg_response_time_ms`  | INT           | Thời gian phản hồi TB (ms)   |
| `p50_response_time_ms`  | INT           | Percentile 50                  |
| `p95_response_time_ms`  | INT           | Percentile 95                  |
| `p99_response_time_ms`  | INT           | Percentile 99                  |
| `total_requests`        | INT           | Tổng requests                 |
| `total_errors`          | INT           | Tổng lỗi                      |
| `error_rate`            | DECIMAL(5,4)  | Tỷ lệ lỗi                     |
| `total_tokens_used`     | BIGINT        | Tổng tokens                   |
| `avg_tokens_per_question` | INT          | TB tokens/câu hỏi             |
| `avg_chunks_retrieved`  | DECIMAL(5,2)  | TB chunks trả về              |
| `documents_uploaded`    | INT           | Tài liệu upload ngày          |
| `documents_published`   | INT           | Tài liệu publish ngày         |
| `unique_active_users`   | INT           | User hoạt động                |
| `new_users`            | INT           | User mới                      |
| `unanswered_questions`  | INT           | Câu hỏi chưa trả lời được     |
| `resolved_questions`   | INT           | Câu hỏi đã giải quyết         |
| `computed_at`          | TIMESTAMPTZ   | Thời điểm tính toán          |
| `created_at`           | TIMESTAMPTZ   | Ngày tạo                       |
| `updated_at`           | TIMESTAMPTZ   | Ngày cập nhật                  |

### analytics.hourly_aggregates

| Cột               | Kiểu        | Mô tả            |
|-------------------|-------------|------------------|
| `id`              | UUID        | Primary Key      |
| `datetime`        | TIMESTAMPTZ | Thời gian        |
| `hour`            | INT         | Giờ (0-23)       |
| `total_questions` | INT         | Tổng câu hỏi     |
| `total_requests`  | INT         | Tổng requests    |
| `total_errors`    | INT         | Tổng lỗi         |
| `unique_users`    | INT         | Số user          |
| `avg_response_time_ms` | INT     | TB response time |
| `likes`           | INT         | Tổng like        |
| `dislikes`        | INT         | Tổng dislike     |
| `computed_at`     | TIMESTAMPTZ | Thời điểm tính   |

### analytics.department_daily_stats

| Cột               | Kiểu       | Mô tả             |
|-------------------|------------|------------------|
| `id`              | UUID       | Primary Key       |
| `date`            | DATE       | Ngày              |
| `department_id`   | UUID       | FK tới core.departments |
| `total_questions` | INT        | Tổng câu hỏi     |
| `unique_users`    | INT        | Số user           |
| `likes`           | INT        | Tổng like        |
| `dislikes`        | INT        | Tổng dislike     |
| `top_categories`  | JSONB      | Top categories    |
| `computed_at`     | TIMESTAMPTZ| Thời điểm tính   |

### analytics.popular_questions

| Cột                      | Kiểu          | Mô tả                   |
|--------------------------|---------------|-------------------------|
| `id`                     | UUID          | Primary Key             |
| `question_normalized`    | TEXT          | Câu hỏi (chuẩn hóa)     |
| `question_sample`        | TEXT          | Mẫu câu hỏi            |
| `ask_count`              | INT           | Số lần hỏi              |
| `unique_users_count`     | INT           | Số user hỏi             |
| `first_asked_at`         | TIMESTAMPTZ   | Lần hỏi đầu tiên        |
| `last_asked_at`          | TIMESTAMPTZ   | Lần hỏi gần nhất        |
| `total_likes`            | INT           | Tổng like              |
| `total_dislikes`         | INT           | Tổng dislike           |
| `common_source_documents`| JSONB         | Tài liệu thường dùng   |
| `detected_category`      | VARCHAR       | Category phát hiện     |
| `detected_department_id` | UUID          | Department phát hiện   |
| `created_at`             | TIMESTAMPTZ   | Ngày tạo               |
| `updated_at`             | TIMESTAMPTZ   | Ngày cập nhật           |

### analytics.document_popularity

| Cột                      | Kiểu       | Mô tả                  |
|--------------------------|------------|------------------------|
| `id`                     | UUID       | Primary Key            |
| `document_id`           | UUID       | FK tới knowledge.documents |
| `total_citations`       | INT        | Tổng trích dẫn         |
| `unique_questions_cited` | INT        | Số câu hỏi tham khảo   |
| `citations_with_likes`   | INT        | Trích dẫn có like      |
| `citations_with_dislikes`| INT       | Trích dẫn có dislike   |
| `first_cited_at`         | TIMESTAMPTZ| Lần trích dẫn đầu      |
| `last_cited_at`          | TIMESTAMPTZ| Lần trích dẫn gần nhất |
| `citations_last_7_days`  | INT        | Số trích dẫn 7 ngày    |
| `citations_last_30_days` | INT        | Số trích dẫn 30 ngày   |
| `created_at`             | TIMESTAMPTZ| Ngày tạo              |
| `updated_at`             | TIMESTAMPTZ| Ngày cập nhật          |

### analytics.report_exports

| Cột            | Kiểu                    | Mô tả                    |
|----------------|-------------------------|-------------------------|
| `id`           | UUID                    | Primary Key             |
| `report_type`  | analytics.report_type   | Loại báo cáo            |
| `title`        | VARCHAR                 | Tiêu đề                 |
| `date_from`    | DATE                    | Ngày bắt đầu            |
| `date_to`      | DATE                    | Ngày kết thúc           |
| `department_id`| UUID                    | Department lọc           |
| `filters`      | JSONB                   | Bộ lọc bổ sung          |
| `format`       | analytics.export_format | CSV / PDF / XLSX / JSON |
| `file_key`     | VARCHAR                 | Key file trong storage  |
| `file_size_bytes` | INT                  | Kích thước file         |
| `status`       | VARCHAR                 | PENDING/PROCESSING/COMPLETED/FAILED |
| `error_message`| TEXT                    | Thông báo lỗi           |
| `requested_by` | UUID                    | FK tới core.users       |
| `created_at`   | TIMESTAMPTZ             | Ngày tạo                |
| `completed_at` | TIMESTAMPTZ             | Ngày hoàn thành         |
| `downloaded_at`| TIMESTAMPTZ             | Ngày tải về             |
| `expires_at`   | TIMESTAMPTZ             | Ngày hết hạn tải        |

---

## Schema: Conversation (feedback-service — unanswered questions)

### conversation.unanswered_questions

**Câu hỏi mà AI không trả lời được (entity từ feedback-service)**

| Cột                    | Kiểu          | Mô tả                            |
|------------------------|---------------|----------------------------------|
| `id`                   | UUID          | Primary Key                      |
| `user_id`              | UUID          | FK tới core.users                |
| `message_id`           | UUID          | FK tới conversation.messages     |
| `conversation_id`      | UUID          | FK tới conversation.conversations |
| `question`             | TEXT          | Câu hỏi gốc                      |
| `question_normalized`  | TEXT          | Câu hỏi đã chuẩn hóa             |
| `attempted_context`    | JSONB         | Context đã thử tìm kiếm          |
| `search_query`         | TEXT          | Query tìm kiếm đã dùng           |
| `top_similarity_score`| DECIMAL(5,4)  | Điểm tương đồng cao nhất (0-1)  |
| `user_department_id`   | UUID          | Department của user              |
| `user_role`            | VARCHAR       | Role của user                   |
| `resolved`             | BOOLEAN       | Đã giải quyết hay chưa           |
| `resolved_by`          | UUID          | Người giải quyết                |
| `resolved_at`          | TIMESTAMPTZ   | Thời gian giải quyết            |
| `resolution_notes`      | TEXT          | Ghi chú giải quyết              |
| `related_document_id`   | UUID          | Tài liệu liên quan               |
| `category`             | VARCHAR       | Category phát hiện               |
| `priority`             | VARCHAR       | LOW / NORMAL / HIGH / CRITICAL   |
| `created_at`           | TIMESTAMPTZ   | Ngày tạo                         |
| `updated_at`           | TIMESTAMPTZ   | Ngày cập nhật                    |

---

## Trigger Auto-Update

| Trigger                                  | Bảng                        | Hành động                          |
|------------------------------------------|-----------------------------|-------------------------------------|
| `trg_core_users_updated_at`              | core.users                  | Auto update `updated_at`            |
| `trg_core_user_profiles_updated_at`      | core.user_profiles          | Auto update `updated_at`            |
| `trg_core_departments_updated_at`        | core.departments            | Auto update `updated_at`            |
| `trg_metadata_categories_updated_at`     | metadata.categories          | Auto update `updated_at`            |
| `trg_metadata_document_metadata_updated_at` | metadata.document_metadata | Auto update `updated_at`          |
| `trg_metadata_document_tags_usage_count` | metadata.document_tags      | Auto tăng/giảm `usage_count` tag   |
| `trg_knowledge_documents_updated_at`     | knowledge.documents          | Auto update `updated_at`            |
| `trg_knowledge_chunks_updated_at`        | knowledge.chunks             | Auto update `updated_at`            |
| `trg_knowledge_processing_jobs_updated_at` | knowledge.processing_jobs  | Auto update `updated_at`            |
| `trg_analytics_feedbacks_updated_at`      | analytics.feedbacks          | Auto update `updated_at`            |
| `trg_analytics_daily_aggregates_updated_at` | analytics.daily_aggregates | Auto update `updated_at`           |
| `trg_analytics_popular_questions_updated_at` | analytics.popular_questions | Auto update `updated_at`         |
| `trg_analytics_document_popularity_updated_at` | analytics.document_popularity | Auto update `updated_at`         |
| `trg_conversation_unanswered_questions_updated_at` | conversation.unanswered_questions | Auto update `updated_at`   |

---

## Database Functions

| Hàm                                | Schema       | Chức năng                              |
|------------------------------------|--------------|----------------------------------------|
| `public.update_updated_at_column()` | public       | Auto update trường `updated_at`        |
| `metadata.update_tag_usage_count()`| metadata     | Tăng/giảm usage_count khi thêm/xóa tag |
| `conversation.update_conversation_stats()` | conversation | Update message_count, last_message_at |
| `conversation.generate_conversation_title()` | conversation | Auto tạo title từ message đầu tiên |
| `metadata.check_document_access()`  | metadata     | Kiểm tra quyền truy cập tài liệu      |

---

## Views

| View                                    | Schema      | Chức năng                            |
|-----------------------------------------|-------------|---------------------------------------|
| `core.v_users_full`                     | core        | Join user + profile + department      |
| `metadata.v_document_metadata_full`      | metadata    | Metadata đầy đủ với category & tags  |
| `knowledge.v_documents_with_status`      | knowledge   | Document + thống kê chunks           |
| `conversation.v_conversations_summary`   | conversation| Tóm tắt conversations                |
| `analytics.v_feedback_summary`           | analytics   | Thống kê feedback theo ngày          |
| `analytics.v_recent_audit_activity`     | analytics   | Audit log gần đây (limit 100)         |
| `analytics.v_popular_questions_trending`| analytics   | Câu hỏi phổ biến với trending level  |
| `analytics.v_usage_stats_daily`         | analytics   | Usage stats tổng hợp theo ngày       |
| `analytics.v_unanswered_questions_summary` | analytics | Tóm tắt câu hỏi chưa trả lời được   |
| `analytics.v_document_popularity_trending` | analytics | Document popularity với trend status  |

---

## Ghi chú thiết kế

- **Soft Delete:** Bảng có trường `deleted_at` sử dụng soft delete
- **Timestamps:** Tất cả bảng có `created_at` và `updated_at` (ngoại trừ joining tables)
- **Foreign Keys:** Sử dụng UUID cho tất cả PK/FK
- **JSONB:** Sử dụng cho dữ liệu linh hoạt (metadata, sources, ...)
- **Bảng `users` duy nhất:** Cả `auth-service` và `user-service` đều dùng chung bảng `core.users`. Logic tạo/sửa user nên thực hiện qua `auth-service`.
- **Không có schema `auth`:** Enum và bảng auth-related đặt trong schema `core` vì Supabase connection pooler không cho phép tạo schema mới.
- **Enum `core.user_role` vs `metadata.user_role`:** Cùng giá trị `USER/MANAGER/ADMIN`, dùng chung khi cần reference cross-schema.
- **pgvector (tương lai):** Có thể bật `CREATE EXTENSION vector` trong Supabase nếu cần lưu trữ embedding vector trực tiếp trong PostgreSQL thay vì dùng external vector DB.
