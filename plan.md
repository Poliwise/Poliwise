# Poliwise - Kế Hoạch Triển Khai

## I. BẢNG TỔNG HỢP TRẠNG THÁI MỖI SERVICE

| # | Service | Tiến độ | Ghi chú |
|---|---------|---------|---------|
| 1 | **API Gateway** | ✅ 95% | Hoàn thiện. Chỉ thiếu endpoint `/circuit-breakers` trả về state |
| 2 | **Auth Service** | ✅ **HOÀN THÀNH** | (1) Admin check bằng @PreAuthorize, (2) RabbitMQ event publishing (UserRegisteredEvent, UserStatusChangedEvent), (3) Unit tests viết xong (14 tests passed) |
| 3 | **User Service** | ✅ 90% | Gần hoàn chỉnh. Thiếu: (1) file trùng, (2) init department data |
| 4 | **Knowledge Service** | ⚠️ 30% | Chỉ có Entity/Repository/Enum. Thiếu hoàn toàn: Service, Controller, Upload, Parsing, Chunking, Embedding |
| 5 | **Metadata Service** | ⚠️ 40% | Có Entity/Enum/Repository. Thiếu: Controller, Service, Scheduled job (expiration), DTO còn lại |
| 6 | **Feedback Service** | ⚠️ 35% | Có Entity/Enum/Repository. Thiếu hoàn toàn: Controller, Service, DTO, RabbitMQ Consumer |
| 7 | **Frontend** | ⚠️ 80% | UI pages đầy đủ. Thiếu: (1) duplicate API client, (2) charts placeholders, (3) hooks, (4) Error handling nâng cao |

> **Loại trừ:** AI Q&A Service (FastAPI) và Vector Search Service (Milvus) do người khác làm.

---

## II. KẾ HOẠCH CHI TIẾT TỪNG SERVICE

---

### SERVICE 1: API Gateway — Hoàn thiện cuối cùng

**Ưu tiên: THẤP**

```
Bước 1: Thêm endpoint /circuit-breakers trong health controller
  → Trả về trạng thái của tất cả circuit breaker instances (OPEN/HALF_OPEN/CLOSED)
  → File: services/api-gateway/src/health/health.controller.ts
  → Tham khảo opossum API để lấy trạng thái
```

---

### SERVICE 2: Auth Service — Hoàn thiện phần còn thiếu

**Ưu tiên: CAO** — Service nền tảng, ảnh hưởng toàn hệ thống.

```
Bước 1: Thêm Admin check trong register endpoint
  → File: services/auth-service/src/main/java/com/poliwise/auth/service/AuthService.java
  → Thêm kiểm tra: chỉ ADMIN mới được register tài khoản mới
  → Hoặc dùng @PreAuthorize("hasRole('ADMIN')") trên controller

Bước 2: Implement RabbitMQ event publishing
  → Tạo RabbitMQConfig.java (queue, exchange, binding)
  → Tạo event class: UserRegisteredEvent, UserStatusChangedEvent
  → Publish event khi: register thành công, status thay đổi
  → File: services/auth-service/src/main/java/com/poliwise/auth/
  → Dependencies đã có sẵn spring-boot-starter-amqp
```

---

### SERVICE 3: User Service — Xử lý issues nhỏ

**Ưu tiên: TRUNG BÌNH** — Logic chính đã hoàn thiện.

```
Bước 1: Xóa file trùng UserSearchCriteria.java
  → Kiểm tra file trùng trong dto/
  → Giữ lại file có nội dung đầy đủ, xóa file trùng

Bước 2: Thêm init department data
  → File: services/user-service/src/main/java/com/poliwise/user/UserServiceApplication.java
  → Thêm @Bean CommandLineRunner hoặc @PostConstruct để tạo default departments
  → Departments: Engineering, HR, Finance, Legal, Operations, Marketing, IT, Admin

Bước 3: Cập nhật UpdateProfileRequest để hỗ trợ email update (tùy chọn)
  → Hiện tại email không thể update — cân nhắc có cho phép không
```

---

### SERVICE 4: Knowledge Service — Triển khai từ đầu

**Ưu tiên: CAO** — Core feature của hệ thống. Cần nhiều bước nhất.

```
Bước 1: Thêm dependencies còn thiếu vào pom.xml
  → Apache PDFBox (pdf extraction)
  → Apache POI (docx/xlsx extraction)
  → Apache Tika (OCR + multi-format parsing)
  → MinIO SDK (S3-compatible object storage)
  → Embedding client (OpenAI/HuggingFace)

Bước 2: Tạo Config layer
  → MinioConfig.java — kết nối MinIO, tạo bucket
  → EmbeddingConfig.java — c���u hình embedding API
  → ChunkingConfig.java — cấu hình chunk size, overlap

Bước 3: Tạo Service layer (5 services)
  → DocumentUploadService.java — nhận file, validate, lưu MinIO
  → DocumentParsingService.java — parse PDF/DOCX/XLSX/image
  → TextChunkingService.java — recursive character + semantic chunking
  → EmbeddingService.java — gọi embedding API
  → DocumentVersionService.java — version control, diff

Bước 4: Tạo Controller layer (3 controllers)
  → DocumentController.java — upload, list, get, delete (soft delete)
  → DocumentVersionController.java — version history, diff
  → DocumentProcessingController.java — trạng thái processing job

Bước 5: Implement Policy Comparison feature
  → Tạo PolicyComparisonService.java
  → Text diff giữa 2 versions
  → Highlight thay đổi

Bước 6: Integrate với Vector Search Service
  → Gọi vector-search-service qua HTTP/gRPC để index chunks
  → Bulk indexing khi document hoàn thành

Bước 7: RabbitMQ events
  → Document.uploaded — khi upload thành công
  → Document.deleted — khi xóa document
```

---

### SERVICE 5: Metadata Service — Triển khai Controller/Service

**Ưu tiên: CAO** — Phụ thuộc vào Knowledge Service để hiển thị metadata.

```
Bước 1: Hoàn thiện DTO còn thiếu
  → TagResponse.java, UpdateTagRequest.java
  → AccessRuleResponse.java, AccessFilterRequest.java, AccessFilterResponse.java
  → UpdateDocumentMetadataRequest.java
  → UpdateCategoryRequest.java

Bước 2: Tạo Service layer (4 services)
  → DocumentMetadataService.java — CRUD metadata, filter theo quyền
  → TagService.java — CRUD tags
  → CategoryService.java — CRUD categories (hierarchical)
  → AccessRuleService.java — quản lý access rules

Bước 3: Tạo Controller layer (4 controllers)
  → DocumentMetadataController.java
    - GET /api/v1/metadata/{docId} — xem metadata (Admin)
    - POST /api/v1/metadata — tạo metadata
    - PUT /api/v1/metadata/{docId} — cập nhật
    - DELETE /api/v1/metadata/{docId} — xóa
    - GET /api/v1/metadata/documents/accessible — filter theo quyền user

  → TagController.java — CRUD tags

  → CategoryController.java — CRUD categories với hierarchical support

  → AccessRuleController.java — CRUD access rules cho document

Bước 4: Tạo Scheduled Job cho expiration check
  → DocumentExpirationScheduler.java
  → @Scheduled(cron = "0 0 0 * * *") — chạy hàng ngày lúc midnight
  → Tự động đánh dấu EXPIRED khi expiryDate < now
  → Gửi notification (email/log) cho Admin khi document sắp hết hạn (trong 7 ngày)
```

---

### SERVICE 6: Feedback Service — Triển khai từ đầu

**Ưu tiên: TRUNG BÌNH** — Không blocking các service khác nhưng cần cho Dashboard.

```
Bước 1: Tạo DTO layer
  → FeedbackRequest.java, FeedbackResponse.java
  → AnalyticsSummaryResponse.java
  → UnansweredQuestionResponse.java
  → AuditLogResponse.java
  → ReportExportRequest.java, ReportExportResponse.java
  → DashboardResponse.java

Bước 2: Tạo Service layer (5 services)
  → FeedbackService.java — lưu feedback (like/dislike + comment)
  → AnalyticsService.java — thống kê tổng hợp (daily/weekly/monthly)
  → AuditLogService.java — ghi nhận audit logs
  → ReportExportService.java — tạo file export (CSV, PDF, XLSX, JSON)
  → DashboardService.java — data cho Manager/Admin dashboard

Bước 3: Tạo Controller layer (3 controllers)
  → FeedbackController.java
    - POST /api/v1/feedback — submit feedback
    - GET /api/v1/feedback/conversation/{id}

  → AnalyticsController.java
    - GET /api/v1/analytics/summary — tổng quan
    - GET /api/v1/analytics/questions — top questions
    - GET /api/v1/analytics/documents — top documents
    - GET /api/v1/analytics/feedback — feedback analysis
    - GET /api/v1/analytics/departments/{deptId} — theo department

  → DashboardController.java (Manager/Admin)
    - GET /api/v1/dashboard/overview
    - GET /api/v1/dashboard/trends

  → ReportController.java (Manager/Admin)
    - POST /api/v1/reports/export
    - GET /api/v1/reports/{id}
    - GET /api/v1/reports/{id}/download

  → AuditController.java (Admin)
    - GET /api/v1/audit-logs
    - GET /api/v1/audit-logs/{id}

Bước 4: Tạo RabbitMQ Consumers (2 consumers)
  → UnansweredQuestionConsumer.java
    - Lắng nghe: unanswered.question queue
    - Lưu vào UnansweredQuestion entity
    - Cập nhật PopularQuestion stats

  → AuditLogConsumer.java
    - Lắng nghe: tất cả events từ các service
    - Ghi vào AuditLog entity
```

---

### SERVICE 7: Frontend — Xử lý issues & cải thiện UX

**Ưu tiên: TRUNG BÌNH** — UI đã tốt, cần fix issues và bổ sung.

```
Bước 1: Xóa duplicate API client
  → Kiểm tra xem page nào dùng lib/api.ts, page nào dùng services/api-client.ts
  → Thống nhất chỉ dùng 1 client duy nhất (services/api-client.ts)
  → Xóa lib/api.ts hoặc services/api-client.ts

Bước 2: Implement actual charts cho Analytics page
  → Thêm chart library (recharts hoặc chart.js)
  → Thay placeholder icons bằng actual charts:
    - Line chart: question trend over time
    - Bar chart: feedback distribution
    - Pie chart: department breakdown
    - Area chart: response time trends

Bước 3: Thêm custom hooks
  → useAuth.ts — auth state hook
  → useDocument.ts — document CRUD hooks
  → useAnalytics.ts — analytics data fetching hooks
  → useFeedback.ts — feedback hooks

Bước 4: Cải thiện Error handling
  → Toast notification cho tất cả API errors
  → Retry logic cho failed requests
  → Offline indicator

Bước 5: Responsive improvements
  → Kiểm tra mobile layout
  → Tablet optimization
```

---

## III. THỨ TỰ ƯU TIÊN THỰC HIỆN

### Giai đoạn 1: Nền tảng (2 tuần)

| # | Task | Service | Mô tả |
|---|------|---------|-------|
| 1 | Admin check trong register + RabbitMQ events | Auth | Chỉ ADMIN được register, publish events |
| 2 | Fix issues nhỏ (file trùng, init departments) | User | Dọn dẹp, thêm init data |

### Giai đoạn 2: Core Features (3-4 tuần)

| # | Task | Service | Mô tả |
|---|------|---------|-------|
| 3 | Triển khai upload, parsing, chunking, embedding | Knowledge | Full document pipeline |
| 4 | Triển khai Controller/Service + scheduled job | Metadata | CRUD metadata + auto expiration |

### Giai đoạn 3: Analytics & Frontend (2 tuần)

| # | Task | Service | Mô tả |
|---|------|---------|-------|
| 5 | Triển khai Analytics + Dashboard + Report export | Feedback | Full analytics pipeline |
| 6 | Fix duplicate, implement charts, add hooks | Frontend | UX improvements |

### Giai đoạn 4: Hoàn thiện (1 tuần)

| # | Task | Service | Mô tả |
|---|------|---------|-------|
| 7 | Hoàn thiện circuit-breaker endpoint | API Gateway | Endpoint trả về trạng thái CB |
| 8 | Testing & Integration testing | Tất cả | End-to-end testing |

---

## IV. CÁC VẤN ĐỀ CẦN LƯU Ý

### 1. Dependencies còn thiếu (Knowledge Service)
- Apache PDFBox, Apache POI, Apache Tika
- MinIO SDK
- Embedding client (OpenAI/HuggingFace)

### 2. Database Schema
- Kiểm tra và đảm bảo schema đã được init đầy đủ trong `infrastructure/init-db/`
- Auth Service dùng schema `core`
- User Service dùng schema `core`
- Metadata Service dùng schema `poliwise_metadata`
- Feedback Service dùng schema `poliwise_analytics`

### 3. RabbitMQ Events
- Cần định nghĩa rõ message format cho từng event
- User.status.changed → Auth Service để invalidate token
- User.revoked → tất cả service để cleanup
- Document.uploaded → Metadata Service, Vector Search Service
- Document.deleted → Metadata Service, Vector Search Service
- Unanswered.question → Feedback Service

### 4. Security
- JWT secret cần được quản lý tập trung
- BCrypt password hashing đã implement
- RBAC enforcement qua Spring Security + API Gateway guards

### 5. Integration Points
- Knowledge Service → Vector Search Service (HTTP/gRPC)
- Knowledge Service → Metadata Service (HTTP)
- AI Q&A Service ← API Gateway (HTTP proxy)
- Tất cả services ← Auth Service (internal validation)