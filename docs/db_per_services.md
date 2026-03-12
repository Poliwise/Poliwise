# Database Schema cho Poliwise

---

## 🔐 DB 1: Auth & RBAC Service

**Database**: `poliwise_auth`

**Mục đích**: Dịch vụ này nắm giữ "chìa khóa" vào hệ thống. Nó chỉ quan tâm đến việc định danh và quyền hạn.

### Bảng

| Bảng             | Schema | Chi tiết                                         |
| ---------------- | ------ | ------------------------------------------------ |
| `users`          | core   | id, username, email, password_hash, role, status |
| `refresh_tokens` | core   | Lưu trữ token làm mới                            |
| `login_history`  | core   | Lịch sử đăng nhập                                |

### Enums

- `user_role`
- `account_status`
- `login_status`

---

## 👥 DB 2: User Service

**Database**: `poliwise_user`

**Mục đích**: Quản lý thông tin chi tiết về con người và tổ chức.

### Bảng

| Bảng            | Schema | Chi tiết                      |
| --------------- | ------ | ----------------------------- |
| `user_profiles` | core   | Thông tin chi tiết người dùng |
| `departments`   | core   | Thông tin phòng ban           |

### Ghi chú

> ℹ️ Bảng `users` ở đây có thể là một bản sao thu gọn (chứa `id`, `name`, `department_id`) được đồng bộ qua Event từ Auth Service để phục vụ truy vấn thông tin nhân viên nhanh.

---

## 📚 DB 3: Knowledge Management (KMS)

**Database**: `poliwise_knowledge`

**Mục đích**: Tập trung vào vòng đời vật lý của tài liệu và quá trình xử lý ETL (Extract, Transform, Load).

### Bảng

| Bảng                | Schema    | Chi tiết            |
| ------------------- | --------- | ------------------- |
| `documents`         | knowledge | Tài liệu chính      |
| `document_versions` | knowledge | Phiên bản tài liệu  |
| `processing_jobs`   | knowledge | Công việc xử lý ETL |

### Enums

- `processing_status`
- `file_type`
- `chunking_strategy`
- `processing_step`

---

## 🏷️ DB 4: Metadata & Document Service

**Database**: `poliwise_metadata`

**Mục đích**: Quản lý "phần hồn" (logic) của tài liệu và phân quyền truy cập.

### Bảng

| Bảng                    | Schema   | Chi tiết              |
| ----------------------- | -------- | --------------------- |
| `document_metadata`     | metadata | Metadata tài liệu     |
| `categories`            | metadata | Danh mục tài liệu     |
| `tags`                  | metadata | Thẻ tài liệu          |
| `document_tags`         | metadata | Liên kết tài liệu-thẻ |
| `document_access_rules` | metadata | Quy tắc truy cập      |

### Enums

- `document_status`
- `access_level`

---

## 💬 DB 5: AI Q&A Service

**Database**: `poliwise_conversation`

**Mục đích**: Lưu trữ lịch sử hội thoại và quản lý ngữ cảnh RAG.

### Bảng

| Bảng            | Schema       | Chi tiết           |
| --------------- | ------------ | ------------------ |
| `conversations` | conversation | Các cuộc hội thoại |
| `messages`      | conversation | Tin nhắn           |

### Enums

- `message_role`
- `confidence_level`

---

## 🔍 DB 6: Vector Search Service

**Database**: `poliwise_vector`

**Mục đích**: Kết hợp giữa PostgreSQL (lưu thông tin chunk) và Milvus (lưu vector).

### Bảng

| Bảng              | Schema    | Chi tiết                 |
| ----------------- | --------- | ------------------------ |
| `chunks`          | knowledge | Đoạn văn bản từ tài liệu |
| `embedding_cache` | knowledge | Cache embedding          |

### Ghi chú

> ℹ️ Bảng `chunks` sẽ lưu `document_id` (UUID) để link ngược lại KMS khi cần lấy nội dung gốc.

---

## 📊 DB 7: Feedback & Analytics

**Database**: `poliwise_analytics`

**Mục đích**: Kho dữ liệu phục vụ báo cáo và giám sát.

### Bảng

| Bảng                     | Schema       | Chi tiết                     |
| ------------------------ | ------------ | ---------------------------- |
| `feedbacks`              | analytics    | Phản hồi người dùng          |
| `usage_stats`            | analytics    | Thống kê sử dụng             |
| `audit_logs`             | analytics    | Nhật ký kiểm tra             |
| `daily_aggregates`       | analytics    | Dữ liệu tổng hợp theo ngày   |
| `hourly_aggregates`      | analytics    | Dữ liệu tổng hợp theo giờ    |
| `department_daily_stats` | analytics    | Thống kê phòng ban theo ngày |
| `popular_questions`      | analytics    | Các câu hỏi phổ biến         |
| `document_popularity`    | analytics    | Độ phổ biến tài liệu         |
| `report_exports`         | analytics    | Xuất báo cáo                 |
| `unanswered_questions`   | conversation | Câu hỏi chưa trả lời         |

### Ghi chú

> ℹ️ Bảng `unanswered_questions` được chuyển về đây vì nó phục vụ mục đích cải thiện tri thức và phân tích.
