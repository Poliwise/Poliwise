# 📊 Database Schema Documentation

## 📋 Tổng Quan

Hệ thống sử dụng **5 schema chính** để quản lý các chức năng khác nhau:

| Schema           | Mục đích                                         |
| ---------------- | ------------------------------------------------ |
| **core**         | Quản lý người dùng, phòng ban, xác thực          |
| **metadata**     | Metadata tài liệu: danh mục, tag, quyền truy cập |
| **knowledge**    | Lưu trữ tài liệu, chunk, embedding cho AI search |
| **conversation** | Lịch sử chat và tương tác với AI                 |
| **analytics**    | Thống kê, feedback, audit log                    |

---

## 🔐 Schema: Core (Quản lý người dùng & xác thực)

### 📌 core.departments

**Danh sách phòng ban trong công ty**

| Cột           | Kiểu      | Mô tả                      |
| ------------- | --------- | -------------------------- |
| `id`          | UUID      | ID phòng ban (Primary Key) |
| `name`        | VARCHAR   | Tên phòng ban              |
| `code`        | VARCHAR   | Mã phòng ban               |
| `description` | TEXT      | Mô tả phòng ban            |
| `parent_id`   | UUID      | Phòng ban cha (phân cấp)   |
| `is_active`   | BOOLEAN   | Có hoạt động hay không     |
| `created_at`  | TIMESTAMP | Ngày tạo                   |
| `updated_at`  | TIMESTAMP | Ngày cập nhật              |

### 📌 core.users

**Tài khoản người dùng**

| Cột                     | Kiểu      | Mô tả                                      |
| ----------------------- | --------- | ------------------------------------------ |
| `id`                    | UUID      | ID user (Primary Key)                      |
| `username`              | VARCHAR   | Tên đăng nhập                              |
| `email`                 | VARCHAR   | Địa chỉ email                              |
| `password_hash`         | VARCHAR   | Mật khẩu đã mã hóa                         |
| `role`                  | ENUM      | Vai trò: USER / MANAGER / ADMIN            |
| `status`                | ENUM      | Trạng thái: ACTIVE / DEACTIVATED / REVOKED |
| `department_id`         | UUID      | FK tới phòng ban                           |
| `failed_login_attempts` | INT       | Số lần login thất bại                      |
| `locked_until`          | TIMESTAMP | Thời gian hết khóa                         |
| `password_changed_at`   | TIMESTAMP | Lần đổi mật khẩu gần nhất                  |
| `must_change_password`  | BOOLEAN   | Bắt buộc đổi mật khẩu                      |
| `created_by`            | UUID      | Ai tạo tài khoản                           |
| `created_at`            | TIMESTAMP | Ngày tạo                                   |
| `updated_at`            | TIMESTAMP | Ngày cập nhật                              |
| `deactivated_at`        | TIMESTAMP | Ngày khóa tài khoản                        |
| `revoked_at`            | TIMESTAMP | Ngày thu hồi                               |

### 📌 core.user_profiles

**Hồ sơ chi tiết của người dùng**

| Cột             | Kiểu      | Mô tả                  |
| --------------- | --------- | ---------------------- |
| `id`            | UUID      | ID hồ sơ (Primary Key) |
| `user_id`       | UUID      | FK tới bảng users      |
| `full_name`     | VARCHAR   | Họ và tên              |
| `phone`         | VARCHAR   | Số điện thoại          |
| `position`      | VARCHAR   | Chức vụ                |
| `avatar_url`    | VARCHAR   | URL ảnh đại diện       |
| `bio`           | TEXT      | Mô tả cá nhân          |
| `date_of_birth` | DATE      | Ngày sinh              |
| `employee_code` | VARCHAR   | Mã nhân viên           |
| `joined_date`   | DATE      | Ngày vào công ty       |
| `created_at`    | TIMESTAMP | Ngày tạo               |
| `updated_at`    | TIMESTAMP | Ngày cập nhật          |

### 📌 core.refresh_tokens

**Token làm mới (JWT Refresh Token)**

| Cột              | Kiểu      | Mô tả                  |
| ---------------- | --------- | ---------------------- |
| `id`             | UUID      | ID token (Primary Key) |
| `user_id`        | UUID      | FK tới user            |
| `token_hash`     | VARCHAR   | Hash của token         |
| `device_info`    | VARCHAR   | Thông tin thiết bị     |
| `ip_address`     | INET      | Địa chỉ IP             |
| `user_agent`     | TEXT      | Thông tin trình duyệt  |
| `expires_at`     | TIMESTAMP | Hết hạn                |
| `revoked`        | BOOLEAN   | Bị thu hồi hay không   |
| `revoked_at`     | TIMESTAMP | Thời gian thu hồi      |
| `revoked_reason` | VARCHAR   | Lý do thu hồi          |
| `replaced_by`    | UUID      | Token mới thay thế     |
| `created_at`     | TIMESTAMP | Ngày tạo               |

### 📌 core.login_history

**Lịch sử đăng nhập**

| Cột              | Kiểu      | Mô tả                    |
| ---------------- | --------- | ------------------------ |
| `id`             | UUID      | ID lịch sử (Primary Key) |
| `user_id`        | UUID      | FK tới user              |
| `username`       | VARCHAR   | Tên đăng nhập            |
| `ip_address`     | INET      | Địa chỉ IP               |
| `user_agent`     | TEXT      | Thông tin trình duyệt    |
| `device_type`    | VARCHAR   | Loại thiết bị            |
| `location`       | VARCHAR   | Vị trí địa lý            |
| `status`         | ENUM      | SUCCESS / FAILED         |
| `failure_reason` | TEXT      | Lý do thất bại (nếu có)  |
| `created_at`     | TIMESTAMP | Thời gian đăng nhập      |

---

## 📚 Schema: Metadata (Metadata tài liệu)

### 📌 metadata.categories

**Danh mục tài liệu**

| Cột             | Kiểu      | Mô tả                     |
| --------------- | --------- | ------------------------- |
| `id`            | UUID      | ID danh mục (Primary Key) |
| `name`          | VARCHAR   | Tên danh mục              |
| `slug`          | VARCHAR   | URL slug                  |
| `description`   | TEXT      | Mô tả                     |
| `parent_id`     | UUID      | Danh mục cha (phân cấp)   |
| `icon`          | VARCHAR   | Icon                      |
| `display_order` | INT       | Thứ tự hiển thị           |
| `is_active`     | BOOLEAN   | Có hoạt động hay không    |
| `created_at`    | TIMESTAMP | Ngày tạo                  |
| `updated_at`    | TIMESTAMP | Ngày cập nhật             |

### 📌 metadata.tags

**Tag tài liệu**

| Cột           | Kiểu      | Mô tả                |
| ------------- | --------- | -------------------- |
| `id`          | UUID      | ID tag (Primary Key) |
| `name`        | VARCHAR   | Tên tag              |
| `slug`        | VARCHAR   | URL slug             |
| `color`       | VARCHAR   | Màu sắc              |
| `usage_count` | INT       | Số lần sử dụng       |
| `created_at`  | TIMESTAMP | Ngày tạo             |

### 📌 metadata.document_metadata

**Metadata chính của tài liệu**

| Cột               | Kiểu      | Mô tả                     |
| ----------------- | --------- | ------------------------- |
| `id`              | UUID      | ID metadata (Primary Key) |
| `document_id`     | UUID      | FK tới bảng documents     |
| `title`           | VARCHAR   | Tiêu đề tài liệu          |
| `description`     | TEXT      | Mô tả                     |
| `document_type`   | VARCHAR   | Loại tài liệu             |
| `category_id`     | UUID      | FK tới danh mục           |
| `department_id`   | UUID      | FK tới phòng ban          |
| `access_level`    | ENUM      | PUBLIC / DEPARTMENT_ONLY  |
| `effective_date`  | DATE      | Ngày hiệu lực             |
| `expiry_date`     | DATE      | Ngày hết hạn              |
| `status`          | ENUM      | DRAFT / PUBLISHED         |
| `current_version` | INT       | Phiên bản hiện tại        |
| `created_by`      | UUID      | Người tạo                 |
| `updated_by`      | UUID      | Người cập nhật            |
| `published_by`    | UUID      | Người xuất bản            |
| `published_at`    | TIMESTAMP | Thời gian xuất bản        |
| `created_at`      | TIMESTAMP | Ngày tạo                  |
| `updated_at`      | TIMESTAMP | Ngày cập nhật             |
| `deleted_at`      | TIMESTAMP | Soft delete (xóa mềm)     |

### 📌 metadata.document_tags

**Quan hệ giữa tài liệu và tag (Many-to-Many)**

| Cột                    | Kiểu      | Mô tả                    |
| ---------------------- | --------- | ------------------------ |
| `id`                   | UUID      | ID (Primary Key)         |
| `document_metadata_id` | UUID      | FK tới document_metadata |
| `tag_id`               | UUID      | FK tới tags              |
| `created_at`           | TIMESTAMP | Ngày tạo                 |

### 📌 metadata.document_access_rules

**Quy tắc phân quyền truy cập tài liệu**

| Cột                    | Kiểu      | Mô tả                    |
| ---------------------- | --------- | ------------------------ |
| `id`                   | UUID      | ID quy tắc (Primary Key) |
| `document_metadata_id` | UUID      | FK tới document_metadata |
| `target_type`          | ENUM      | ROLE / USER / DEPARTMENT |
| `target_role`          | ENUM      | Vai trò được cấp         |
| `target_department_id` | UUID      | ID phòng ban             |
| `target_user_id`       | UUID      | ID người dùng            |
| `permission`           | ENUM      | VIEW / DENY              |
| `created_by`           | UUID      | Người tạo quy tắc        |
| `created_at`           | TIMESTAMP | Ngày tạo                 |

---

## 💡 Schema: Knowledge (Tài liệu & Embedding)

### 📌 knowledge.documents

**Thông tin file tài liệu gốc**

| Cột                 | Kiểu      | Mô tả                     |
| ------------------- | --------- | ------------------------- |
| `id`                | UUID      | ID tài liệu (Primary Key) |
| `original_filename` | VARCHAR   | Tên file gốc              |
| `file_type`         | ENUM      | Loại file                 |
| `file_size_bytes`   | BIGINT    | Kích thước file (bytes)   |
| `mime_type`         | VARCHAR   | MIME type                 |
| `file_key`          | VARCHAR   | Key lưu trữ               |
| `bucket_name`       | VARCHAR   | Bucket lưu trữ            |
| `status`            | ENUM      | Trạng thái xử lý          |
| `current_version`   | INT       | Phiên bản hiện tại        |
| `extracted_text`    | TEXT      | Text đã trích xuất        |
| `page_count`        | INT       | Số trang                  |
| `word_count`        | INT       | Số từ                     |
| `language`          | VARCHAR   | Ngôn ngữ                  |
| `ocr_required`      | BOOLEAN   | Cần OCR hay không         |
| `chunking_strategy` | ENUM      | Chiến lược chia chunk     |
| `chunk_size`        | INT       | Kích thước chunk          |
| `chunk_overlap`     | INT       | Overlap giữa chunks       |
| `embedding_model`   | ENUM      | Model embedding sử dụng   |
| `uploaded_by`       | UUID      | Người upload              |
| `created_at`        | TIMESTAMP | Ngày tạo                  |
| `updated_at`        | TIMESTAMP | Ngày cập nhật             |

### 📌 knowledge.document_versions

**Phiên bản của tài liệu**

| Cột               | Kiểu      | Mô tả                      |
| ----------------- | --------- | -------------------------- |
| `id`              | UUID      | ID phiên bản (Primary Key) |
| `document_id`     | UUID      | FK tới documents           |
| `version_number`  | INT       | Số phiên bản               |
| `file_key`        | VARCHAR   | Key lưu trữ                |
| `file_size_bytes` | BIGINT    | Kích thước file            |
| `changelog`       | TEXT      | Nhật ký thay đổi           |
| `extracted_text`  | TEXT      | Text đã trích xuất         |
| `created_by`      | UUID      | Người tạo phiên bản        |
| `created_at`      | TIMESTAMP | Ngày tạo                   |

### 📌 knowledge.chunks

**Các đoạn text được chia để embedding**

| Cột                   | Kiểu      | Mô tả                     |
| --------------------- | --------- | ------------------------- |
| `id`                  | UUID      | ID chunk (Primary Key)    |
| `document_id`         | UUID      | FK tới documents          |
| `document_version`    | INT       | Phiên bản tài liệu        |
| `chunk_index`         | INT       | Chỉ số chunk              |
| `content`             | TEXT      | Nội dung chunk            |
| `content_length`      | INT       | Độ dài nội dung           |
| `token_count`         | INT       | Số token                  |
| `page_number`         | INT       | Số trang                  |
| `start_char_index`    | INT       | Vị trí ký tự bắt đầu      |
| `end_char_index`      | INT       | Vị trí ký tự kết thúc     |
| `embedding_model`     | ENUM      | Model embedding           |
| `embedding_dimension` | INT       | Số chiều embedding        |
| `vector_indexed`      | BOOLEAN   | Đã index vector hay không |
| `vector_id`           | VARCHAR   | ID vector                 |
| `department_id`       | UUID      | Phòng ban (sao chép)      |
| `document_type`       | VARCHAR   | Loại tài liệu (sao chép)  |
| `metadata`            | JSONB     | Metadata bổ sung          |
| `created_at`          | TIMESTAMP | Ngày tạo                  |

### 📌 knowledge.processing_jobs

**Job xử lý pipeline tài liệu**

| Cột                | Kiểu      | Mô tả                |
| ------------------ | --------- | -------------------- |
| `id`               | UUID      | ID job (Primary Key) |
| `document_id`      | UUID      | FK tới documents     |
| `job_type`         | ENUM      | Loại job             |
| `status`           | ENUM      | Trạng thái xử lý     |
| `progress_percent` | INT       | % tiến độ            |
| `started_at`       | TIMESTAMP | Thời gian bắt đầu    |
| `completed_at`     | TIMESTAMP | Thời gian hoàn thành |
| `success`          | BOOLEAN   | Thành công hay không |
| `error_message`    | TEXT      | Thông báo lỗi        |
| `retry_count`      | INT       | Số lần thử lại       |
| `max_retries`      | INT       | Số lần thử tối đa    |
| `output_metrics`   | JSONB     | Metrics đầu ra       |
| `created_at`       | TIMESTAMP | Ngày tạo             |

### 📌 knowledge.embedding_cache

**Cache embedding để giảm chi phí API**

| Cột                   | Kiểu      | Mô tả                  |
| --------------------- | --------- | ---------------------- |
| `id`                  | UUID      | ID cache (Primary Key) |
| `text_hash`           | VARCHAR   | Hash của text          |
| `text_length`         | INT       | Độ dài text            |
| `embedding_model`     | ENUM      | Model embedding        |
| `embedding_dimension` | INT       | Số chiều embedding     |
| `usage_count`         | INT       | Số lần sử dụng         |
| `last_used_at`        | TIMESTAMP | Lần sử dụng gần nhất   |
| `created_at`          | TIMESTAMP | Ngày tạo               |

---

## 💬 Schema: Conversation (Chat với AI)

### 📌 conversation.conversations

**Session chat (phiên trò chuyện)**

| Cột               | Kiểu      | Mô tả                  |
| ----------------- | --------- | ---------------------- |
| `id`              | UUID      | ID phiên (Primary Key) |
| `user_id`         | UUID      | FK tới user            |
| `title`           | VARCHAR   | Tiêu đề chat           |
| `message_count`   | INT       | Số lượng tin nhắn      |
| `last_message_at` | TIMESTAMP | Tin nhắn cuối cùng     |
| `created_at`      | TIMESTAMP | Ngày tạo               |
| `updated_at`      | TIMESTAMP | Ngày cập nhật          |
| `deleted_at`      | TIMESTAMP | Soft delete            |

### 📌 conversation.messages

**Tin nhắn trong cuộc trò chuyện**

| Cột                 | Kiểu      | Mô tả                        |
| ------------------- | --------- | ---------------------------- |
| `id`                | UUID      | ID tin nhắn (Primary Key)    |
| `conversation_id`   | UUID      | FK tới conversations         |
| `role`              | ENUM      | USER / ASSISTANT             |
| `content`           | TEXT      | Nội dung tin nhắn            |
| `sources`           | JSONB     | Các tài liệu nguồn tham khảo |
| `model_used`        | VARCHAR   | Model AI sử dụng             |
| `tokens_prompt`     | INT       | Tokens input                 |
| `tokens_completion` | INT       | Tokens output                |
| `tokens_total`      | INT       | Tổng tokens                  |
| `latency_ms`        | INT       | Độ trễ (ms)                  |
| `confidence`        | ENUM      | Mức độ tin cậy               |
| `has_sources`       | BOOLEAN   | Có tài liệu nguồn hay không  |
| `created_at`        | TIMESTAMP | Ngày tạo                     |

### 📌 conversation.unanswered_questions

**Câu hỏi mà AI không trả lời được**

| Cột                    | Kiểu      | Mô tả                    |
| ---------------------- | --------- | ------------------------ |
| `id`                   | UUID      | ID (Primary Key)         |
| `user_id`              | UUID      | FK tới user              |
| `message_id`           | UUID      | FK tới messages          |
| `conversation_id`      | UUID      | FK tới conversations     |
| `question`             | TEXT      | Câu hỏi gốc              |
| `question_normalized`  | TEXT      | Câu hỏi đã chuẩn hóa     |
| `search_query`         | TEXT      | Query tìm kiếm           |
| `top_similarity_score` | DECIMAL   | Điểm tương đồng cao nhất |
| `resolved`             | BOOLEAN   | Đã giải quyết hay không  |
| `resolved_by`          | UUID      | Người giải quyết         |
| `resolved_at`          | TIMESTAMP | Thời gian giải quyết     |
| `priority`             | VARCHAR   | Mức ưu tiên              |
| `created_at`           | TIMESTAMP | Ngày tạo                 |

---

## 📈 Schema: Analytics (Thống kê & Audit)

### 📌 analytics.feedbacks

**Feedback: Like / Dislike câu trả lời**

| Cột               | Kiểu      | Mô tả                     |
| ----------------- | --------- | ------------------------- |
| `id`              | UUID      | ID feedback (Primary Key) |
| `user_id`         | UUID      | FK tới user               |
| `message_id`      | UUID      | FK tới messages           |
| `conversation_id` | UUID      | FK tới conversations      |
| `type`            | ENUM      | LIKE / DISLIKE            |
| `comment`         | TEXT      | Bình luận                 |
| `question_text`   | TEXT      | Câu hỏi                   |
| `answer_text`     | TEXT      | Câu trả lời               |
| `sources_used`    | JSONB     | Tài liệu tham khảo        |
| `created_at`      | TIMESTAMP | Ngày tạo                  |

### 📌 analytics.usage_stats

**Log sử dụng API**

| Cột                | Kiểu      | Mô tả                   |
| ------------------ | --------- | ----------------------- |
| `id`               | UUID      | ID log (Primary Key)    |
| `user_id`          | UUID      | FK tới user             |
| `service_name`     | VARCHAR   | Tên dịch vụ             |
| `endpoint`         | VARCHAR   | Endpoint API            |
| `method`           | VARCHAR   | HTTP method             |
| `response_time_ms` | INT       | Thời gian phản hồi (ms) |
| `status_code`      | INT       | HTTP status code        |
| `tokens_used`      | INT       | Tokens tiêu thụ         |
| `model_used`       | VARCHAR   | Model sử dụng           |
| `created_at`       | TIMESTAMP | Ngày tạo                |

### 📌 analytics.audit_logs

**Log hành động hệ thống (Audit)**

| Cột             | Kiểu      | Mô tả                |
| --------------- | --------- | -------------------- |
| `id`            | UUID      | ID log (Primary Key) |
| `user_id`       | UUID      | FK tới user          |
| `username`      | VARCHAR   | Tên đăng nhập        |
| `action`        | ENUM      | Hành động            |
| `resource_type` | ENUM      | Loại tài nguyên      |
| `resource_id`   | UUID      | ID tài nguyên        |
| `old_value`     | JSONB     | Giá trị cũ           |
| `new_value`     | JSONB     | Giá trị mới          |
| `ip_address`    | INET      | Địa chỉ IP           |
| `created_at`    | TIMESTAMP | Ngày tạo             |

### 📌 analytics.daily_aggregates

**Thống kê tổng hợp theo ngày**

| Cột                    | Kiểu | Mô tả                         |
| ---------------------- | ---- | ----------------------------- |
| `id`                   | UUID | ID (Primary Key)              |
| `date`                 | DATE | Ngày                          |
| `total_questions`      | INT  | Tổng câu hỏi                  |
| `total_conversations`  | INT  | Tổng phiên chat               |
| `unique_users_asked`   | INT  | Số user đã hỏi                |
| `total_likes`          | INT  | Tổng like                     |
| `total_dislikes`       | INT  | Tổng dislike                  |
| `avg_response_time_ms` | INT  | Thời gian phản hồi trung bình |

### 📌 analytics.hourly_aggregates

**Thống kê tổng hợp theo giờ**

| Cột               | Kiểu      | Mô tả            |
| ----------------- | --------- | ---------------- |
| `id`              | UUID      | ID (Primary Key) |
| `datetime`        | TIMESTAMP | Thời gian        |
| `hour`            | INT       | Giờ              |
| `total_questions` | INT       | Tổng câu hỏi     |
| `total_requests`  | INT       | Tổng yêu cầu     |
| `total_errors`    | INT       | Tổng lỗi         |
| `unique_users`    | INT       | Số user          |

### 📌 analytics.department_daily_stats

**Thống kê theo phòng ban (theo ngày)**

| Cột               | Kiểu | Mô tả            |
| ----------------- | ---- | ---------------- |
| `id`              | UUID | ID (Primary Key) |
| `date`            | DATE | Ngày             |
| `department_id`   | UUID | FK tới phòng ban |
| `total_questions` | INT  | Tổng câu hỏi     |
| `unique_users`    | INT  | Số user          |
| `likes`           | INT  | Tổng like        |
| `dislikes`        | INT  | Tổng dislike     |

### 📌 analytics.popular_questions

**Câu hỏi phổ biến**

| Cột                   | Kiểu | Mô tả               |
| --------------------- | ---- | ------------------- |
| `id`                  | UUID | ID (Primary Key)    |
| `question_normalized` | TEXT | Câu hỏi (chuẩn hóa) |
| `question_sample`     | TEXT | Mẫu câu hỏi         |
| `ask_count`           | INT  | Số lần hỏi          |
| `unique_users_count`  | INT  | Số user hỏi         |
| `total_likes`         | INT  | Tổng like           |
| `total_dislikes`      | INT  | Tổng dislike        |

### 📌 analytics.document_popularity

**Tài liệu được trích dẫn nhiều**

| Cột                       | Kiểu | Mô tả                |
| ------------------------- | ---- | -------------------- |
| `id`                      | UUID | ID (Primary Key)     |
| `document_id`             | UUID | FK tới documents     |
| `total_citations`         | INT  | Tổng trích dẫn       |
| `unique_questions_cited`  | INT  | Số câu hỏi tham khảo |
| `citations_with_likes`    | INT  | Trích dẫn có like    |
| `citations_with_dislikes` | INT  | Trích dẫn có dislike |

### 📌 analytics.report_exports

**Export báo cáo**

| Cột            | Kiểu      | Mô tả                       |
| -------------- | --------- | --------------------------- |
| `id`           | UUID      | ID (Primary Key)            |
| `report_type`  | ENUM      | Loại báo cáo                |
| `title`        | VARCHAR   | Tiêu đề                     |
| `format`       | ENUM      | Định dạng (PDF, Excel, ...) |
| `file_key`     | VARCHAR   | Key file                    |
| `status`       | VARCHAR   | Trạng thái                  |
| `requested_by` | UUID      | Người yêu cầu               |
| `created_at`   | TIMESTAMP | Ngày tạo                    |

---

## 🛠️ Các thành phần khác

### Enum Types

| Enum                | Schema       | Giá trị                                |
| ------------------- | ------------ | -------------------------------------- |
| `user_role`         | core         | USER, MANAGER, ADMIN                   |
| `account_status`    | core         | ACTIVE, DEACTIVATED, REVOKED           |
| `document_status`   | metadata     | DRAFT, PUBLISHED                       |
| `processing_status` | knowledge    | PENDING, PROCESSING, COMPLETED, FAILED |
| `message_role`      | conversation | USER, ASSISTANT                        |
| `feedback_type`     | analytics    | LIKE, DISLIKE                          |

### Database Functions

| Hàm                             | Chức năng                                   |
| ------------------------------- | ------------------------------------------- |
| `update_updated_at_column()`    | Tự động cập nhật trường `updated_at`        |
| `update_tag_usage_count()`      | Cập nhật số lần sử dụng tag                 |
| `update_conversation_stats()`   | Cập nhật `message_count` trong conversation |
| `generate_conversation_title()` | Tự động tạo tiêu đề chat                    |
| `check_document_access()`       | Kiểm tra quyền truy cập tài liệu            |

### Database Views

| View                                   | Chức năng                           |
| -------------------------------------- | ----------------------------------- |
| `core.v_users_full`                    | Join user + profile + department    |
| `metadata.v_document_metadata_full`    | Metadata đầy đủ với danh mục & tags |
| `knowledge.v_documents_with_status`    | Document + thống kê chunks          |
| `conversation.v_conversations_summary` | Tóm tắt conversations               |
| `analytics.v_feedback_summary`         | Thống kê feedback                   |
| `analytics.v_recent_audit_activity`    | Audit log gần đây                   |

### Triggers

| Trigger              | Chức năng                             |
| -------------------- | ------------------------------------- |
| `update_updated_at`  | Tự động update timestamp `updated_at` |
| `tag_usage_count`    | Tăng/giảm tag usage count             |
| `conversation_stats` | Cập nhật message_count                |
| `generate_title`     | Tự động tạo tiêu đề chat              |

---

## 📝 Ghi chú thiết kế

- **Soft Delete**: Bảng có trường `deleted_at` sử dụng soft delete
- **Timestamps**: Tất cả bảng có `created_at` và `updated_at` (ngoại trừ joining tables)
- **Foreign Keys**: Sử dụng UUID cho tất cả PK/FK
- **JSONB**: Sử dụng cho dữ liệu linh hoạt (metadata, sources, ...)
- **Partitioning**: Bảng lớn có thể cần partition theo thời gian (analytics tables)
