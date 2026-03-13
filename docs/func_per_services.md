# Hướng Dẫn Chức Năng Từng Microservice

Tài liệu này mô tả vai trò, chức năng chính và trách nhiệm của mỗi service trong hệ thống Poliwise.

---

## 1️⃣ API Gateway

**Vai trò**: Entry point duy nhất của toàn bộ hệ thống

### Chức năng chính:
- Entry point cho toàn bộ hệ thống
- Routing request đến đúng service (HTTP proxy / gRPC call)
- Rate limiting (per user, per endpoint, per role)
- JWT Validation (chỉ verify token hợp lệ, không xử lý business logic auth)
- RBAC Enforcement (kiểm tra role + trạng thái tài khoản từ token claims)
- Trace ID Generation (Tạo X-Trace-ID cho mỗi request, truyền xuống tất cả services)
- Request/Response Logging (ghi log structured JSON)
- Circuit Breaker (ngắt service lỗi, trả fallback response)
- Request Validation (schema validation cơ bản trước khi forward)
- CORS Handling (xử lý cross-origin requests)
- Response Transformation (chuẩn hóa response format)

---

## 2️⃣ Authentication & RBAC Service

**Vai trò**: Quản lý xác thực, phân quyền và JWT lifecycle

### Chức năng chính:
- **Đăng nhập**: Username/password → JWT access + refresh token
- **Đăng ký**: Chỉ Admin được phép tạo
- **Refresh token rotation**: Cấp lại access token khi hết hạn
- **Logout**: Invalidate token
- **JWT Lifecycle Management**:
  - Access Token: 15 phút
  - Refresh Token: 7 ngày
  - Token blacklist TTL: bằng thời gian còn lại của token
- **Internal Auth Endpoint**: API Gateway gọi để verify token
- **Password Hashing**: Bcrypt
- **Account Status Validation**: Kiểm tra trạng thái khi đăng nhập
  - `Active` → Cho phép
  - `Deactivated` → Lỗi ACCOUNT_DEACTIVATED
  - `Revoked` → Lỗi ACCOUNT_REVOKED

---

## 3️⃣ User Service

**Vai trò**: Quản lý thông tin người dùng, nhân viên và trạng thái tài khoản

### Chức năng chính:
- **Xem thông tin**: User xem của mình, Admin xem tất cả
- **Cập nhật profile**: Tên, email, department, avatar
- **Tìm kiếm nhân viên**: Admin/Manager tìm theo tên, phòng ban, role
- **Thay đổi trạng thái tài khoản** (Admin only):
  - `Active` ↔ `Deactivated`
  - `Active`/`Deactivated` → `Revoked` (một chiều)
- **Soft Delete**: Xóa tài khoản, anonymize PII
- **Danh sách nhân viên**: Phân trang, lọc, sắp xếp

### Event Publishing (RabbitMQ):
- `User.status.changed` → Auth Service invalidate token
- `User.revoked` → Tất cả services cleanup

---

## 4️⃣ AI Q&A Service (LLM Orchestrator)

**Vai trò**: Xử lý câu hỏi từ người dùng và sinh câu trả lời từ tài liệu

### Chức năng chính:
- **Query Processing**:
  - Nhận câu hỏi từ user (qua API Gateway)
  - Query rewriting / reformulation (tối ưu câu hỏi cho search)
  - Gọi vector search service lấy top-K chunks liên quan
- **Access Control Filtering**:
  - Gọi Metadata & Document service để filter theo quyền truy cập (department/role)
  - Chỉ lấy document còn hiệu lực
- **Response Generation**:
  - Xây dựng context từ chunks đã filter
  - Gọi LLM API
  - Sinh câu trả lời có trích dẫn (document name, page, chunk ID)
  - Cá nhân hóa nội dung dựa trên department
- **Conversation Management**:
  - Lưu lịch sử: question + answer + sources + metadata
  - Detect câu hỏi không trả lời → Publish "unanswered_question" event
  - Streaming response (SSE) cho UX tốt hơn

---

## 5️⃣ Vector Search Service

**Vai trò**: Thực hiện semantic search trên vector embeddings

### Chức năng chính:
- **Semantic Search**:
  - Nhận query embedding từ AI Q&A service (hoặc nhận text rồi tự embed)
  - Thực hiện similarity search (cosine similarity / inner product)
  - Trả về top-K chunks phù hợp kèm similarity score
- **Hybrid Search**: Kết hợp semantic + keyword
- **Metadata Filtering**: Lọc theo department, document_type, effective_date
- **Vector Index Management**:
  - Tạo, cập nhật, xóa index
  - Bulk indexing từ Knowledge Management Service
  - Sync khi document thay đổi

---

## 6️⃣ Knowledge Management Service

**Vai trò**: Quản lý kho tri thức nội bộ - upload, xử lý, và index tài liệu

### Chức năng chính:
- **Document Upload**:
  - Hỗ trợ: PDF, DOCX, XLSX, images
  - Validation: type, size limit 50MB, optional virus scan
  - Lưu file gốc vào MinIO (object storage)
- **Document Processing**:
  - PDF → Text extraction (Apache PDFBox)
  - DOCX → Text extraction (Apache POI)
  - Images → OCR (Tesseract via Apache Tika)
- **Text Chunking Strategies**:
  - Recursive character splitting (default: chunk_size=1000, overlap=200)
  - Semantic chunking (cho tài liệu dài, phức tạp)
- **Embedding Generation**:
  - Gọi Embedding API (OpenAI / self-hosted)
  - Gửi vectors sang vector search service để index
- **Metadata Tagging** (tự động + thủ công):
  - Document_type, department, effective_date, expire_date, tags
- **Version Control**:
  - Mỗi upload cùng document → tạo version mới
  - Giữ lịch sử tất cả versions
  - So sánh diff giữa 2 versions (text diff)
- **Policy Comparison**: So sánh 2 tài liệu chính sách → highlight thay đổi
- **Soft Delete**: Xóa tài liệu, xóa vectors liên quan

---

## 7️⃣ Metadata & Document Service

**Vai trò**: Quản lý metadata, trạng thái, và quyền truy cập tài liệu

### Chức năng chính:
- **Metadata Management**:
  - Tiêu đề, mô tả, tags, document_type
  - Ngày hiệu lực (effective_date) / ngày hết hạn (expire_date)
  - Trạng thái: `DRAFT` / `PUBLISHED` / `ARCHIVED` / `EXPIRED`
- **Department Classification**: Phân loại document theo phòng ban
- **Access Control**:
  - `PUBLIC`: Tất cả nhân viên
  - `DEPARTMENT_ONLY`: Chỉ phòng ban liên quan
  - `RESTRICTED`: Chỉ role cụ thể
- **Access Filtering API**:
  - Nhận user info (role, department) từ AI Service
  - Trả về danh sách document_ids mà user có quyền xem
- **Category & Tag Management**: Quản lý danh mục tài liệu
- **Validity Checking**:
  - Tự động đánh dấu expired khi quá expire_date (scheduled job)
  - Cảnh báo admin khi sắp hết hạn

---

## 8️⃣ Feedback & Analytics Service

**Vai trò**: Thu thập feedback người dùng và cung cấp analytics

### Chức năng chính:
- **Feedback Collection**: Like/dislike + optional comment
- **Unanswered Questions**: Consume event từ RabbitMQ
- **Statistics**:
  - Số câu hỏi theo ngày / tuần / tháng
  - Tỷ lệ hài lòng (like/dislike ratio)
  - Top câu hỏi phổ biến
  - Top tài liệu được trích dẫn nhiều nhất
  - Thời gian phản hồi trung bình
  - Thống kê theo phòng ban
- **Dashboard** (cho Manager & Admin):
  - Tổng quan sử dụng hệ thống
  - Trend analysis
  - User engagement metrics
- **Report Export**: CSV, PDF
- **Audit Log**: Consume event từ tất cả services để ghi nhận hoạt động

---

## 9️⃣ Frontend

**Vai trò**: Giao diện web cho người dùng

### Công nghệ:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Responsive Design

---

## Quy Ước Chung

### Event Publishing (RabbitMQ)
- `User.status.changed`: Auth Service listen để invalidate token
- `User.revoked`: Tất cả services listen để cleanup
- `Document.uploaded`: Knowledge Service publish
- `Document.deleted`: Metadata Service publish
- `Unanswered.question`: AI Service publish → Feedback Service consume

### API Response Format
Tất cả services trả về response chuẩn:
```json
{
  "success": true,
  "data": {...},
  "message": "Optional message",
  "timestamp": "ISO-8601"
}
```

### Error Handling
- Standardized error codes
- Structured error responses
- Proper HTTP status codes
- Request tracing via X-Trace-ID
