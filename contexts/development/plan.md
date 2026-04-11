# Poliwise — Kế Hoạch Triển Khai & Đánh Giá

> Cập nhật: Tháng 4/2026 (rà soát thực tế toàn bộ codebase)
> Nguồn đánh giá: Khám phá thực tế từng file nguồn

---

## I. TỔNG QUAN HỆ THỐNG

Poliwise là hệ thống Hỏi-Đáp AI dựa trên tài liệu tri thức nội bộ (RAG), kiến trúc microservices:

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTS                                  │
│                  (Next.js Web UI, port 3001)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ http
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              API Gateway (NestJS, port 3000)                   │
│        JWT + RBAC + RateLimit + Circuit Breaker               │
└──────┬─────────────┬─────────────┬─────────────┬────────────┘
       │             │             │             │
  ┌────▼───┐  ┌─────▼─────┐ ┌───▼────┐  ┌────▼──────────┐
  │ Auth   │  │ User      │ │Knowledge│  │ Metadata      │
  │ :8081  │  │ :8082     │ │ :8083   │  │ :8084         │
  │✅ 95%  │  │ ✅ 88%    │ │ ⚠️ 70%  │  │ ✅ 90%        │
  └────┬───┘  └─────┬─────┘ └───┬────┘  └────┬─────────┘
       │             │            │             │
  ┌────▼────────────▼────────────▼─────────────▼─────────┐
  │               RabbitMQ (CloudAMQP)                     │
  │  poliwise.events exchange + Dead Letter Queues         │
  └────────────────────────┬──────────────────────────────┘
                     ┌─────▼──────────┐
                     │ Feedback:8085  │
                     │ ✅ 85%         │
                     │ (70 Java files)│
                     └────────────────┘
```

---

## II. BẢNG TỔNG HỢP TRẠNG THÁI

| # | Service | Port | Hoàn thành | Chi tiết |
|---|---------|------|:----------:|----------|
| 1 | Auth Service | 8081 | ✅ 95% | Login, JWT, Refresh, Logout, Account lockout, Login history, RabbitMQ events, 14 unit tests |
| 2 | API Gateway | 3000 | ✅ 92% | Proxy, JWT, RBAC, Rate limit, Circuit breaker, Health check, Logging |
| 3 | User Service | 8082 | ✅ 88% | CRUD, Profile, Department, Status workflow, RabbitMQ events, JPA Specification search |
| 4 | Knowledge Service | 8083 | ⚠️ 70% | Upload, Parse, Chunk → **EMBEDDING/INDEXING PLACEHOLDER**, Versioning, Comparison, MinIO |
| 5 | Metadata Service | 8084 | ✅ 90% | Metadata CRUD, Tags, Categories, Access rules, Scheduled expiration, Full business logic |
| 6 | Feedback Service | 8085 | ✅ 85% | **ĐÃ TÁI TẠO HOÀN TOÀN** — 70 Java files, 10 entities, 5 controllers, 6 services, 3 consumers, 2 schedulers |
| 7 | Frontend (Next.js) | 3001 | ⚠️ 82% | Pages đầy đủ, API client, Zustand store, 54 interface files — thiếu charts, custom hooks |

> **Loại trừ:** AI Q&A Service (FastAPI) và Vector Search Service (Milvus) — do người khác làm.

---

## III. ĐÁNH GIÁ CHI TIẾT TỪNG SERVICE

### ✅ Auth Service (95%)

**Thực sự có:**
- 6 endpoints: `/login`, `/register`, `/refresh`, `/logout`, `/logout-all-devices`, `/sessions`
- JWT lifecycle: Access token 15ph, Refresh token 7 ngày, token rotation
- Account lockout sau 5 lần đăng nhập sai (lock duration configurable)
- Login history: SUCCESS / FAILED_CREDENTIALS / FAILED_LOCKED / FAILED_DEACTIVATED / FAILED_REVOKED
- Refresh token reuse detection → revoke all tokens
- Token blacklist (AccessTokenBlacklist table)
- Dual filter chain: public endpoints vs authenticated
- RabbitMQ publisher: `user.registered`, `user.status.changed`
- Admin auto-create on startup (`AdminInitializer`)
- BCrypt password hashing
- 14 unit tests cho `AuthService`
- `JwtTokenProvider` hoàn chỉnh: create, verify, blacklist, extract claims

**Còn thiếu:**
- Password reset (quên mật khẩu)
- Change password (đổi mật khẩu)
- Revoke user account endpoint (ADMIN gọi revoke → invalidate all tokens)
- API documentation (Swagger/OpenAPI)
- Integration tests
- Feign clients (interface `FeignConfig` trống)
- AuthMapper chưa sử dụng
- CORS policy quá permissive (`allowedOriginPatterns: *`)
- **Bug tiềm ẩn:** `AuthProperties` định nghĩa path `auth.login.maxFailedAttempts` nhưng `application.yml` dùng `auth.jwt.max-failed-attempts` (prefix không khớp)

---

### ✅ API Gateway (92%)

**Thực sự có:**
- Proxy controller route tất cả request đến downstream (AUTH, USER, KNOWLEDGE, METADATA, FEEDBACK)
- JWT validation via `passport-jwt` + custom guard
- RBAC guards: `@Roles()`, `@Public()`, `@CurrentUser()` — hỗ trợ role hierarchy
- Interceptors: Logging, TraceId, ResponseTransform, Timeout, RateLimit (per-role: PUBLIC 20/m, USER 100/m, MANAGER 200/m, ADMIN 500/m)
- Health indicators cho tất cả 5 downstream services
- Circuit breaker (Opossum) cho downstream services
- Winston structured logging
- Global exception filter với ErrorCode enum
- Helmet security headers + CORS
- Sensitive data masking trong logs
- Shutdown hooks enabled

**Còn thiếu:**
- Unit tests (không có file `*.spec.ts` nào)
- E2E tests
- `/health/circuit-breakers` endpoint trả về dữ liệu trống (chỉ có cấu trúc, logic chưa implement)
- Refresh token proxy route (`/auth/refresh` được handle trực tiếp bởi auth-proxy, nhưng chưa có route riêng)
- File upload proxy chỉ là basic forwarding, không có multipart handling đặc biệt
- Swagger docs

---

### ✅ User Service (88%)

**Thực sự có:**
- 8 endpoints: `GET /me`, `GET /{userId}`, `PUT /me`, `GET /me/status`, `PATCH /me/department`, `GET /` (search + pagination), `PATCH /{userId}/status`, `DELETE /{userId}`
- Entities: `User`, `UserProfile`, `Department`
- `DataInitializer` tạo 8 departments mặc định
- Status workflow: ACTIVE ↔ DEACTIVATED, → REVOKED (một chiều)
- Pessimistic locking khi update status (`findByIdForUpdate`)
- RabbitMQ publisher: `user.status.changed`, `user.revoked`
- JPA Specification cho tìm kiếm linh hoạt (keyword, role, status, department)
- Soft delete với anonymize PII thực sự
- Spring Security config (JWT filter, dual chain)
- `JwtValidationService` trong feedback-service gọi sang auth-service để verify token

**Còn thiếu:**
- Integration tests
- Feign clients (interface `FeignConfig` trống, `@EnableFeignClients` nhưng không có client nào)
- RabbitMQ consumer (chỉ publish, không nhận event từ các service khác)
- File SQL schema (DDL `validate` nhưng schema phải tồn tại sẵn)

---

### ⚠️ Knowledge Service (70%)

**Thực sự có:**
- DocumentController: upload, get, delete (soft), trigger process, list versions
- PolicyComparisonController: so sánh 2 tài liệu
- MinIO integration: upload, download, delete, pre-signed URL (đầy đủ)
- PDF parsing (Apache PDFBox), DOCX parsing (Apache Tika), XLSX/XLS (Tika), TXT, PNG/JPG (OCR cơ bản)
- Text chunking: 4 chiến lược đầy đủ — RECURSIVE, FIXED_SIZE, SENTENCE, SEMANTIC
- PolicyComparisonService: text diff đơn giản giữa 2 versions
- Processing job tracking với step-by-step status
- DocumentVersion entity với diff storage
- RabbitMQ events: `document.uploaded`, `document.deleted`
- RabbitMQ consumer: nhận events từ metadata-service
- WebClient đã cấu hình trỏ OpenAI nhưng chưa gọi

**Còn thiếu (CHẶN LUỒNG AI Q&A):**
- **Embedding service — placeholder thuần túy** (`EmbeddingService.generateEmbedding()` trả về `List.of(0.0)`)
- **Vector indexing — placeholder thuần túy** (bước INDEXING trong pipeline chỉ là update status, không gọi Milvus)
- **Chunk entity** chưa tồn tại trong database (plan định nghĩa `chunks` ở vector schema, nhưng knowledge-service chưa lưu chunks)
- **Async processing** — `processDocument()` là synchronous, không có `@Async`
- Tests

---

### ✅ Metadata Service (90%)

**Thực sự có (không có trong plan.md gốc):**
- DocumentMetadataController: CRUD + filter by access + update status + pagination
- TagController: CRUD tags
- CategoryController: CRUD categories
- AccessRuleController: quản lý access rules + filter by document
- `DocumentExpirationScheduler`: chạy daily @ 00:00 để đánh dấu EXPIRED
- `DocumentEventConsumer`: listen `document.uploaded`, `document.deleted`
- `UserEventConsumer`: listen `user.status.changed`, `user.revoked`
- Services: `DocumentMetadataService`, `TagService`, `CategoryService`, `AccessRuleService` đầy đủ logic
- DTOs: TagRequest/Response, CategoryRequest/Response, AccessRuleRequest/Response
- `TagRepository`, `CategoryRepository`, `AccessRuleRepository`
- Validation đầy đủ cho DTOs
- Global exception handler

**Còn thiếu:**
- Integration tests
- API docs
- Thống kê usage metrics cho metadata (truy cập document)

---

### ✅ Feedback Service (85%) — ĐÃ TÁI TẠO HOÀN TOÀN

**ĐÃ CÓ ĐẦY ĐỦ (70 Java files):**

*Entity Layer (10 entities):*
- `Feedback`, `UsageStat`, `AuditLog`, `DailyAggregate`, `HourlyAggregate`, `DepartmentDailyStat`, `PopularQuestion`, `DocumentPopularity`, `ReportExport`, `UnansweredQuestion`
- Tất cả mapping schema `analytics` và `conversation` (Supabase PostgreSQL)

*Enum Layer (8 enums):*
- `FeedbackType` (LIKE/DISLIKE), `AuditAction` (26 actions), `ResourceType`, `ReportType`, `ExportFormat`, `ExportStatus`, `LoginStatus`, `ConfidenceLevel`

*Repository Layer (10 interfaces):*
- JPA repositories với custom queries và `@Query` annotations

*DTO Layer (15 DTOs):*
- Request: `FeedbackRequest`, `ReportExportRequest`, `AnalyticsRequest`, `AuditLogSearchRequest`
- Response: `ApiResponse`, `FeedbackResponse`, `AnalyticsSummaryResponse`, `PopularQuestionResponse`, `DocumentPopularityResponse`, `DashboardOverviewResponse`, `TrendResponse`, `UnansweredQuestionResponse`, `AuditLogResponse`, `ReportExportResponse`, `DepartmentStatsResponse`

*Service Layer (6 services):*
- `FeedbackService`: create, getByConversation, getByUser, delete (permission check)
- `AnalyticsService`: summary, topQuestions, topDocuments, departmentStats, trends
- `DashboardService`: overview, trends, unansweredQuestions
- `AuditLogService`: logAction, searchLogs, cleanupOldLogs
- `ReportExportService`: createAsync, generateReport (CSV/JSON), download, deleteExpired
- `JwtValidationService`: validate token, extract user principal

*Controller Layer (5 controllers, tất cả endpoint đều có RBAC):*
- `FeedbackController`: POST, GET by conversation, GET by user, DELETE (USER/MANAGER/ADMIN)
- `AnalyticsController`: summary, top questions, top documents, feedback, department stats, trends (MANAGER/ADMIN)
- `DashboardController`: overview, trends, unanswered (MANAGER/ADMIN)
- `AuditController`: search logs, get by ID (ADMIN only)
- `ReportController`: export, status, download, list (MANAGER/ADMIN)

*RabbitMQ Consumer Layer (3 consumers):*
- `UnansweredQuestionConsumer`: listen `unanswered.question` → save + upsert PopularQuestion + audit log
- `DocumentEventConsumer`: listen `document.uploaded/deleted` → update DocumentPopularity + audit
- `UserEventConsumer`: listen `user.status.changed` → audit log

*Scheduler Layer (2 schedulers):*
- `CleanupScheduler`: cleanup old audit logs (90 days), expired reports (7 days), resolved questions (180 days)
- `StatsAggregationScheduler`: hourly aggregation → HourlyAggregate, daily aggregation → DailyAggregate + DepartmentDailyStat

*Security Layer:*
- `SecurityConfig`: dual filter chain (public/authenticated)
- `JwtAuthenticationFilter`: validate JWT, extract claims, set SecurityContext
- RBAC với `hasRole()` checks trong mỗi controller

**Còn thiếu / giản lược:**
- Report export chỉ generate CSV và JSON; PDF và XLSX được define nhưng fallthrough về CSV
- `DocumentPopularity` citation counts không được tăng khi document được cite (chỉ khởi tạo record)
- `AnalyticsService.getSummary().topCategories` luôn trả về empty list
- `UsageStat` entity tồn tại nhưng **không có endpoint/controller/service** để nhận usage data
- Không có tests
- Không có mapper (dùng manual mapping)
- Không có Feign clients
- Không có AI Q&A integration (feedback-service nhận `unanswered.question` event nhưng không gọi AI service)

**Database:** Supabase PostgreSQL — schema `analytics` + `conversation`

**Không có folder `feedback-tai-nguyen`** — không tồn tại trong codebase.

---

### ⚠️ Frontend (82%)

**Thực sự có:**
- Pages: `/` (AI Chat), `/login`, `/documents`, `/profile`, `/analytics`, `/admin/users`
- Components: `MainLayout`, `Sidebar`, `Header`, `Toast`, `LoadingScreen`
- API client layer: `lib/api.ts` (Axios + interceptors) — **đang sử dụng**
- `services/` directory có 7 service files nhưng **KHÔNG được sử dụng** (chỉ có `lib/api.ts` được import)
- Zustand stores: `auth-store.ts` (with localStorage persistence), `ui-store.ts`
- 54 interface files cho TypeScript types đầy đủ
- Tailwind CSS v4 + SCSS
- Responsive layout
- JWT decode với `jwt-decode`

**Còn thiếu:**
- Charts/visualizations trên Analytics page (chỉ có placeholder icons — kế hoạch dùng `recharts` nhưng chưa cài)
- **Trang bị thiếu:**
  - `/settings` — có Sidebar link nhưng page không tồn tại
  - `/forgot-password` — có link trong login page nhưng không tồn tại
  - `/admin/documents` — có Sidebar link nhưng page không tồn tại
  - `/admin/metadata` — có Sidebar link nhưng page không tồn tại
  - `/admin/unanswered` — có Sidebar link nhưng page không tồn tại
- Custom hooks (hooks/ directory trống)
- `react-query` đã install nhưng không sử dụng
- Duplicated API client: `services/` vs `lib/api.ts` — cần thống nhất hoặc xóa `services/`
- Error handling nâng cao (retry, offline indicator)
- E2E tests
- Responsive mobile layout testing

---

## IV. PHỤ THUỘC GIỮA CÁC SERVICE

```
AI Q&A Service (FastAPI) ← CẦN: knowledge chunks + vector search + metadata access
    ↑ chưa tồn tại

knowledge-service (70%) → phụ thuộc Vector Search Service (Milvus)
    ↓ sau khi vector DB được setup

feedback-service (85%) ✅ → API Gateway route /feedback
    ↓ sau khi controller xong

api-gateway (92%) → route tất cả services

frontend (82%) → kết nối API Gateway
```

---

## V. LỘ TRÌNH TRIỂN KHAI STEP-BY-STEP

### GIAI ĐOẠN 1: Hoàn thiện Knowledge Service + AI Q&A
**Ưu tiên: CAO NHẤT** — Chặn luồng core RAG

### GIAI ĐOẠN 2: Hoàn thiện Frontend Analytics
**Ưu tiên: CAO** — Cần charts thực sự cho Manager/Admin

### GIAI ĐOẠN 3: Fix FEEDBACK SERVICE + API Gateway
**Ưu tiên: CAO** — Report export, usage stats, circuit breaker status

### GIAI ĐOẠN 4: Tạo trang còn thiếu
**Ưu tiên: TRUNG BÌNH** — Settings, Forgot Password, Admin sub-pages

### GIAI ĐOẠN 5: Kiểm thử & Tích hợp
**Ưu tiên: THẤP** — Khi tất cả features cơ bản đã xong

---

## VI. CHI TIẾT TỪNG BƯỚC

### GIAI ĐOẠN 1: Hoàn thiện Knowledge Service

**Mục tiêu:** Từ 70% → 90%

#### Bước 1.1 — Định nghĩa Chunk Entity + Repository

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/entity/
├── Chunk.java          ← Entity mới
services/knowledge-service/src/main/java/com/poliwise/knowledge/repository/
├── ChunkRepository.java ← Repository mới
```

```java
@Entity
@Table(name = "chunks", schema = "knowledge")
public class Chunk {
    @Id UUID id;
    UUID documentId;
    UUID versionId;
    int chunkIndex;
    @Column(columnDefinition = "TEXT")
    String content;
    String embeddingVector; // Base64 encoded float array (cache)
    int startPosition;
    int endPosition;
    int sourcePage;
    int paragraphNumber;
    OffsetDateTime createdAt;
}
```

#### Bước 1.2 — Implement Embedding Service thực sự

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/service/EmbeddingService.java
```

```java
// Tùy chọn: OpenAI API (đã có WebClient config trỏ api.openai.com)
@Autowired WebClient openAIWebClient;

public List<Float> generateEmbedding(String text) {
    // Gọi POST /v1/embeddings với model text-embedding-3-small
    // Trả về List<Float> vector
}
```

Hoặc dùng Spring AI cho multi-provider support.

#### Bước 1.3 — Implement Vector Indexing (gọi Milvus)

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/service/VectorIndexService.java ← TẠO MỚI
```

```java
// Gọi Vector Search Service qua HTTP/gRPC
public void indexChunks(List<Chunk> chunks) {
    // 1. Generate embeddings
    // 2. Batch upsert vào Milvus
}

public void deleteFromIndex(UUID documentId) {
    // DELETE from Milvus by documentId filter
}
```

#### Bước 1.4 — Hoàn thiện Processing Pipeline (Async)

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/service/DocumentProcessingService.java ← CẬP NHẬT
```

```java
@Async
public void processDocument(UUID documentId) {
    // Bước 1: PARSING ✅ (đã có)
    // Bước 2: CHUNKING ✅ (đã có)
    // Bước 3: EMBEDDING ← implement bước 1.2
    // Bước 4: INDEXING ← implement bước 1.3
    // Bước 5: Save chunks to DB ← implement bước 1.1
    // Update ProcessingJob status: COMPLETED
}
```

#### Bước 1.5 — Thêm Integration với AI Q&A Service

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/service/DocumentSearchService.java ← TẠO MỚI
```

Khi AI Q&A service sẵn sàng, knowledge-service cần cung cấp endpoint để:
- AI service lấy chunks theo document ID
- AI service search chunks bằng text (hybrid search)

---

### GIAI ĐOẠN 2: Hoàn thiện Frontend Analytics

**Mục tiêu:** Từ 82% → 95%

#### Bước 2.1 — Cài đặt thư viện Charts

```bash
cd frontend/web
pnpm add recharts
```

#### Bước 2.2 — Implement Charts cho Analytics Page

```
frontend/web/app/analytics/page.tsx
```

| Component | Chart Type | Data |
|-----------|-----------|------|
| `QuestionTrendChart` | Line | Questions/day (7 ngày gần nhất) |
| `SatisfactionChart` | Donut | Like/Dislike ratio |
| `DepartmentBreakdownChart` | Bar | Questions per department |
| `TopDocumentsChart` | Horizontal Bar | Most cited documents |
| `ResponseTimeChart` | Area | Avg response time |
| `FeedbackDistribution` | Bar | Feedback count by type |

#### Bước 2.3 — Xóa services/ directory (duplicate)

Xóa 7 file trong `services/` vì `lib/api.ts` đang được sử dụng.
Update imports nếu có file nào reference services/.

#### Bước 2.4 — Tạo trang còn thiếu

```
frontend/web/app/
├── settings/page.tsx           ← TẠO (change password, preferences)
├── forgot-password/page.tsx    ← TẠO (password reset flow)
├── admin/documents/page.tsx    ← TẠO (admin document management)
├── admin/metadata/page.tsx     ← TẠO (admin metadata management)
└── admin/unanswered/page.tsx   ← TẠO (unanswered question queue)
```

---

### GIAI ĐOẠN 3: Fix Feedback Service + API Gateway

#### Bước 3.1 — Fix Report Export Service

`ReportExportService.generateCsvReport()` hiện tại chỉ output metadata. Cần thêm dữ liệu thực:
- USAGE_SUMMARY: daily_aggregates data
- QUESTION_ANALYTICS: popular_questions data
- FEEDBACK_ANALYSIS: feedback data
- DEPARTMENT_BREAKDOWN: department_daily_stats data

#### Bước 3.2 — Thêm UsageStat Recording

`UsageStat` entity tồn tại nhưng không có endpoint để nhận data. Cần:
- Tạo `UsageStatController` với endpoint nhận usage data
- Hoặc tích hợp trong API Gateway interceptor

#### Bước 3.3 — Fix DocumentPopularity citation counting

Trong `DocumentEventConsumer` khi nhận event `document.uploaded`, cần tăng citation count khi document được sử dụng trong câu trả lời AI.

#### Bước 3.4 — Implement Circuit Breaker Status Endpoint

`/health/circuit-breakers` trong API Gateway trả về empty data. Cần implement:
```typescript
// services/api-gateway/src/health/health.controller.ts
GET /health/circuit-breakers
// Response: array of circuit breaker stats từ Opossum
```

#### Bước 3.5 — Thêm Unit Tests

```
services/feedback-service/src/test/java/com/poliwise/feedback/
├── service/
│   ├── FeedbackServiceTest.java
│   ├── AnalyticsServiceTest.java
│   └── DashboardServiceTest.java
└── controller/
    └── FeedbackControllerTest.java

services/api-gateway/src/
├── proxy.controller.spec.ts
├── jwt-auth.guard.spec.ts
└── rbac.guard.spec.ts
```

---

### GIAI ĐOẠN 4: Kiểm thử & Tích hợp

#### Bước 4.1 — Verify Docker Compose

```bash
docker-compose up -d
# Check health: curl http://localhost:3000/health
# Check logs: docker-compose logs -f [service-name]
```

#### Bước 4.2 — End-to-End Test Flow

```
1. ADMIN login → nhận JWT
2. ADMIN upload PDF document → /api/v1/documents
3. Chờ processing pipeline hoàn thành (4 bước)
4. USER login → nhận JWT
5. USER hỏi câu hỏi → /api/v1/ai/ask (AI Q&A service)
6. USER gửi feedback → /api/v1/feedback
7. MANAGER login → xem analytics → /api/v1/analytics/summary
8. MANAGER export report → /api/v1/reports/export → download CSV
```

#### Bước 4.3 — Load Testing

Dùng k6 hoặc Artillery:
- 100 concurrent users, 10-minute sustained load
- Metrics: p95 latency, error rate, throughput

---

## VII. TÓM TẮT THỨ TỰ ƯU TIÊN

```
GIAI ĐOẠN 1: Knowledge Service (70% → 90%)
  Step 1.1:  Chunk entity + repository
  Step 1.2:  Embedding service thực sự (OpenAI)
  Step 1.3:  Vector indexing (Milvus integration)
  Step 1.4:  Async processing pipeline
  Step 1.5:  AI Q&A service integration

GIAI ĐOẠN 2: Frontend (82% → 95%)
  Step 2.1:  Cài recharts
  Step 2.2:  Implement 6 chart components
  Step 2.3:  Xóa duplicate services/
  Step 2.4:  Tạo 5 trang còn thiếu

GIAI ĐOẠN 3: Feedback Service + API Gateway
  Step 3.1:  Fix report export data
  Step 3.2:  Thêm UsageStat recording
  Step 3.3:  Fix citation counting
  Step 3.4:  Circuit breaker status endpoint
  Step 3.5:  Unit tests

GIAI ĐOẠN 4: Testing & Integration
  Step 4.1:  Docker Compose verification
  Step 4.2:  E2E test flow
  Step 4.3:  Load testing
```

---

## VIII. CÁC VẤN ĐỀ CẦN PHỐI HỢP VỚI TEAM

1. **Vector Search Service (Milvus/Qdrant)** — ai đang setup? Cần IP/endpoint để knowledge-service kết nối.
2. **AI Q&A Service (FastAPI)** — ai đang làm? Cần biết expected API contract để API Gateway proxy đúng. Cần xác định routing path trong ProxyController.
3. **Embedding Provider** — OpenAI (đã có WebClient config) hay self-hosted HuggingFace? Ảnh hưởng `EmbeddingService` implementation.
4. **Admin mặc định** — hiện tại auto-create từ `AdminInitializer` với env vars.
5. **Report Export format** — CSV + JSON đủ hay cần thêm PDF/XLSX?
6. **Feedback Service database** — hiện dùng Supabase PostgreSQL (`analytics` schema), không phải local Postgres. Cần xác nhận đây là production DB hay cần migrate.
7. **MinIO configuration** — `application.yml` có endpoint default `http://localhost:9000` nhưng không có config trong docker-compose.yml cho MinIO service.
8. **Database Schema sync** — auth-service và user-service dùng `schema=core` nhưng docker-compose chỉ mount 1 init.sql cho PostgreSQL. Cần đảm bảo tất cả schemas (core, knowledge, metadata, analytics, conversation) được tạo.

---

## IX. SO SÁNH THỰC TRẠNG VS PLAN GỐC

| Điểm | Plan gốc | Thực tế |
|-------|----------|----------|
| Auth Service | 90% | 95% (AuthProperties bug mới phát hiện) |
| API Gateway | 90% | 92% (circuit breaker endpoint chưa implement) |
| User Service | 85% | 88% (JPA Specification search tốt hơn) |
| Knowledge Service | 75% | 70% (embedding/indexing confirmed placeholder) |
| Metadata Service | 70% | 90% (plan gốc đánh giá thấp — đã hoàn thiện) |
| Feedback Service | 0% | 85% (ĐÃ TÁI TẠO với 70 files) |
| Frontend | 80% | 82% (54 interface files, 5 pages thiếu) |
| Thứ tự ưu tiên | Feedback trước | **Thay đổi:** Knowledge Service (AI Q&A) là critical path mới |
| Folder feedback-tai-nguyen | Tồn tại | **Không tồn tại** |
| Infrastructure folder | Tồn tại | **Không tồn tại** (chỉ có docker-compose.yml và config/) |
