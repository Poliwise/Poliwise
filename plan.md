# Poliwise — Kế Hoạch Triển Khai & Đánh Giá

> Cập nhật: Tháng 4/2026
> Nguồn đánh giá: Khám phá codebase thực tế tại thời điểm làm việc
> **LƯU Ý QUAN TRỌNG:** feedback-service đã bị xóa hoàn toàn — cần tái tạo từ đầu dựa trên kế hoạch này.

---

## I. TỔNG QUAN HỆ THỐNG

Poliwise là hệ thống Hỏi-Đáp AI dựa trên tài liệu tri thức nội bộ (RAG), kiến trúc microservices:

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│                    (Next.js Web UI)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ http (port 3001)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                     API Gateway (NestJS)                     │
│              port 3000 | JWT + RBAC + RateLimit             │
└──────┬─────────────┬─────────────┬─────────────┬────────────┘
       │             │             │             │
  ┌────▼───┐  ┌──────▼────┐  ┌───▼────┐  ┌────▼──────────┐
  │ Auth   │  │ User      │  │Knowledge│  │ Metadata       │
  │:8081   │  │ :8082     │  │ :8083   │  │ :8084          │
  │✅ FULL │  │ ✅ FULL    │  │ ⚠️ 75%  │  │ ⚠️ 70%         │
  └────┬───┘  └─────┬─────┘  └───┬────┘  └────┬─────────┘
       │            │            │            │
  ┌────▼────────────▼────────────▼────────────▼───────┐
  │              RabbitMQ (CloudAMQP)                  │
  └────────────────────────┬─────────────────────────┘
                     ┌─────────────────────────┐
                     │ Feedback :8085           │
                     │ 🔄 ĐANG TÁI TẠO         │
                     │ (cần rebuild hoàn toàn)  │
                     └─────────────────────────┘
```

---

## II. BẢNG TỔNG HỢP TRẠNG THÁI

| # | Service | Port | Hoàn thành | Chi tiết |
|---|---------|------|:-----------:|----------|
| 1 | Auth Service | 8081 | ✅ 90% | Login, JWT, Refresh, Logout, Account lockout, Login history, RabbitMQ events, 14 unit tests |
| 2 | API Gateway | 3000 | ✅ 90% | Proxy, JWT, RBAC guards, Rate limit, Circuit breaker, Health check, Logging |
| 3 | User Service | 8082 | ✅ 85% | CRUD, Profile, Department, Status workflow, RabbitMQ events |
| 4 | Knowledge Service | 8083 | ⚠️ 75% | Upload, Parse, Chunk → EMBEDDING/INDEXING PLACEHOLDER, Versioning, Comparison |
| 5 | Metadata Service | 8084 | ⚠️ 70% | Metadata CRUD, Tags, Categories, Access rules, Scheduled expiration |
| 6 | Feedback Service | 8085 | 🔄 0% | **ĐÃ BỊ XÓA — ĐANG TÁI TẠO TOÀN BỘ** |
| 7 | Frontend | 3001 | ⚠️ 80% | Pages đầy đủ, API client, Zustand store — thiếu tests, charts placeholders |

> **Loại trừ:** AI Q&A Service (FastAPI) và Vector Search Service (Milvus) — do người khác làm.

---

## III. ĐÁNH GIÁ CHI TIẾT TỪNG SERVICE

### ✅ Auth Service (90%)

**Thực sự có:**
- 6 endpoints: `/login`, `/register`, `/refresh`, `/logout`, `/logout-all`, `/sessions`
- JWT lifecycle: Access token 15ph, Refresh token 7 ngày, token rotation
- Account lockout sau 5 lần đăng nhập sai (30 phút)
- Login history: SUCCESS / FAILED_CREDENTIALS / FAILED_LOCKED / FAILED_DEACTIVATED / FAILED_REVOKED
- Refresh token reuse detection → revoke all tokens
- Token blacklist (AccessTokenBlacklist table)
- Dual filter chain: public endpoints vs authenticated
- RabbitMQ publisher: `user.registered`, `user.status.changed`
- Admin auto-create on startup (`AdminInitializer`)
- BCrypt password hashing
- 14 unit tests cho `AuthService`

**Còn thiếu:**
- Password reset (quên mật khẩu)
- Change password (đổi mật khẩu)
- Revoke user account endpoint (ADMIN gọi revoke → invalidate all tokens)
- API documentation (Swagger/OpenAPI)
- Integration tests

---

### ✅ API Gateway (90%)

**Thực sự có:**
- Proxy controller route tất cả request đến downstream
- JWT validation via `passport-jwt`
- RBAC guards: `@Roles()`, `@Public()`, `@CurrentUser()`
- Interceptors: Logging, TraceId, ResponseTransform, Timeout, RateLimit (per-role)
- Health indicators cho auth/user/knowledge/metadata/feedback services
- Circuit breaker (Opossum) cho downstream services
- Winston structured logging
- Global exception filter
- Helmet security headers + CORS

**Còn thiếu:**
- Endpoint `/circuit-breakers` trả về trạng thái CB instances
- Refresh-token proxy route sang auth-service
- RBAC permission matrix test (verify guards thực sự hoạt động)
- Swagger docs

---

### ✅ User Service (85%)

**Thực sự có:**
- 5 endpoints: `GET /profile`, `PUT /profile`, `GET /users` (search), `PUT /users/{id}/status`, `DELETE /users/{id}`
- Entities: `User`, `UserProfile`, `Department`
- `DataInitializer` tạo 8 departments mặc định
- Status workflow: ACTIVE ↔ DEACTIVATED, → REVOKED (một chiều)
- Pessimistic locking khi update status
- RabbitMQ publisher: `user.status.changed`, `user.revoked`
- OpenFeign client sang auth-service (AccountStatusClient)
- Spring Security config (JWT filter, RBAC)
- User search với pagination + filters

**Còn thiếu:**
- Integration tests
- Verify duplicate file trùng (UserSearchCriteria) đã được xử lý chưa
- API docs

---

### ⚠️ Knowledge Service (75%)

**Thực sự có:**
- DocumentController: upload, list, get, delete (soft)
- Processing endpoints: trigger parse/chunk/embed/index, check job status
- DocumentVersionController: list versions, compare
- MinIO integration: upload, download, delete files
- PDF parsing (Apache PDFBox), DOCX parsing (Apache POI)
- Text chunking: recursive character + semantic
- PolicyComparisonService: text diff giữa 2 versions
- Processing job tracking với step-by-step status
- DocumentVersion entity với diff storage
- RabbitMQ events: `document.uploaded`, `document.deleted`
- RabbitMQ consumer: nhận events từ metadata-service

**Còn thiếu (CHẶN LUỒNG AI Q&A):**
- **Embedding service — placeholder thuần túy** (chưa gọi embedding API)
- **Indexing sang vector DB — placeholder thuần túy** (chưa tích hợp Milvus/Qdrant)
- `chunks` table/entity chưa thấy trong codebase (db_per_services.md định nghĩa chunks ở vector schema, nhưng knowledge-service chưa lưu chunks)
- API docs

---

### ⚠️ Metadata Service (70%)

**Thực sự có:**
- DocumentMetadataController: CRUD + filter by access
- TagController: CRUD tags
- CategoryController: CRUD categories
- AccessRuleController: quản lý access rules
- `DocumentExpirationScheduler`: chạy daily @ 00:00 để đánh dấu EXPIRED
- `DocumentEventConsumer`: listen `document.uploaded`, `document.deleted`
- Services: `DocumentMetadataService`, `TagService`, `CategoryService`, `AccessRuleService`
- DTOs: TagRequest/Response, CategoryRequest/Response, AccessRuleRequest/Response

**Còn thiếu:**
- Validation đầy đủ cho DTOs
- Integration tests
- API docs

---

### 🔄 Feedback Service (0%) — ĐANG TÁI TẠO TOÀN BỘ

**Nền tảng:** Đã bị xóa hoàn toàn, cần tái tạo từ đầu.

**Database:** Supabase PostgreSQL — schema `analytics` + `conversation`
- Supabase URL: `aws-1-ap-southeast-2.pooler.supabase.com`
- Database: `postgres`
- Schema `analytics`: feedbacks, usage_stats, audit_logs, daily_aggregates, hourly_aggregates, department_daily_stats, popular_questions, document_popularity, report_exports
- Schema `conversation`: unanswered_questions

**Cấu hình đã có (feedback-tai-nguyen/):**
- `pom.xml` — Spring Boot 3.4.3, Java 17, đầy đủ dependencies
- `application.yml` — kết nối Supabase PostgreSQL + CloudAMQP RabbitMQ
- `.env` — credentials (Supabase + CloudAMQP)
- `Dockerfile` — Alpine-based multi-stage build
- `application-docker.yml` — docker profile

**Cần tạo lại hoàn toàn:**
- ❌ Tất cả Entities (Feedback, UsageStat, AuditLog, DailyAggregate, HourlyAggregate, DepartmentDailyStat, PopularQuestion, DocumentPopularity, ReportExport, UnansweredQuestion)
- ❌ Tất cả Enums (FeedbackType, AuditAction, ResourceType, ExportFormat, ReportType, ConfidenceLevel)
- ❌ Tất cả Repositories (10 interfaces)
- ❌ Tất cả DTOs
- ❌ Tất cả Services (FeedbackService, AnalyticsService, AuditLogService, ReportExportService, DashboardService)
- ❌ Tất cả Controllers (FeedbackController, AnalyticsController, DashboardController, ReportController, AuditController)
- ❌ RabbitMQ Consumers (UnansweredQuestionConsumer, DocumentEventConsumer, UserEventConsumer)
- ❌ Scheduled Jobs (StatsAggregationScheduler, CleanupScheduler)
- ❌ Security Config (JWT filter, RBAC)
- ❌ Exception Handling (GlobalExceptionHandler + custom exceptions)
- ❌ Main Application class

**Tác động:** Chặn Analytics Dashboard (Manager/Admin), Feedback collection, Audit logging, Report export.

---

### ⚠️ Frontend (80%)

**Thực sự có:**
- Pages: `/` (AI Chat), `/login`, `/documents`, `/profile`, `/analytics`, `/admin/users`
- Components: `MainLayout`, `Sidebar`, `Header`, `Toast`, `LoadingScreen`
- API client layer: `api-client.ts` (Axios + interceptors), 6 service files
- Zustand stores: `auth-store.ts`, `ui-store.ts`
- TypeScript types cho auth, AI, documents, analytics, users
- Tailwind CSS v4
- Responsive layout

**Còn thiếu:**
- Integration với analytics endpoints (feedback-service chưa có)
- Charts/visualizations trên Analytics page (chỉ có placeholder icons)
- Duplicate API client (`lib/api.ts` vs `services/api-client.ts` — cần thống nhất)
- Custom hooks (`useAuth`, `useDocument`, `useAnalytics`)
- Error handling nâng cao (retry, offline indicator)
- E2E tests
- Responsive mobile layout testing

---

## IV. PHỤ THUỘC GIỮA CÁC SERVICE

```
feedback-service (ĐANG TÁI TẠO) ← KHÔNG phụ thuộc gì, CÓ THỂ làm ngay
    ↓ sau khi Feedback Controller xong

api-gateway: thêm route /feedback → feedback-service:8085

frontend: analytics page kết nối /api/v1/analytics → API Gateway

knowledge-service (75%) → phụ thuộc Vector Search Service (Milvus)
    ↓ sau khi vector DB được setup

ai-qa-service ← cần: knowledge chunks + vector search + metadata access
```

---

## V. LỘ TRÌNH TRIỂN KHAI STEP-BY-STEP

### GIAI ĐOẠN 1: TÁI TẠO FEEDBACK SERVICE TỪ ĐẦU
**Ưu tiên: CAO NHẤT** — Service đã bị xóa hoàn toàn, không phụ thuộc service nào khác

---

### GIAI ĐOẠN 2: Hoàn thiện API Gateway
**Ưu tiên: CAO** — Cần route feedback-service sau khi GĐ1 xong

---

### GIAI ĐOẠN 3: Hoàn thiện Frontend
**Ưu tiên: CAO** — Kết nối analytics endpoints sau GĐ1+2

---

### GIAI ĐOẠN 4: Hoàn thiện Knowledge Service
**Ưu tiên: TRUNG BÌNH** — Phụ thuộc Vector Search Service (Milvus) từ bên ngoài

---

### GIAI ĐOẠN 5: Kiểm thử & Tích hợp
**Ưu tiên: THẤP** — Khi tất cả features cơ bản đã xong

---

## VI. CHI TIẾT TÁI TẠO FEEDBACK SERVICE

> **Nền tảng:** folder `services/feedback-tai-nguyen/` đã có pom.xml, application.yml, Dockerfile, .env
> **Database:** Supabase PostgreSQL — schema `analytics` (feedbacks, usage_stats, audit_logs, daily_aggregates, hourly_aggregates, department_daily_stats, popular_questions, document_popularity, report_exports) + schema `conversation` (unanswered_questions)
> **Message broker:** CloudAMQP (fuji.lmq.cloudamqp.com)

---

### Bước 1.1 — Tạo cấu trúc thư mục Spring Boot

```
services/feedback-tai-nguyen/src/main/java/com/poliwise/feedback/
├── FeedbackServiceApplication.java          ← Main class (@SpringBootApplication)
├── entity/
│   ├── Feedback.java
│   ├── UsageStat.java
│   ├── AuditLog.java
│   ├── DailyAggregate.java
│   ├── HourlyAggregate.java
│   ├── DepartmentDailyStat.java
│   ├── PopularQuestion.java
│   ├── DocumentPopularity.java
│   ├── ReportExport.java
│   └── UnansweredQuestion.java
├── enums/
│   ├── FeedbackType.java                    ← LIKE, DISLIKE
│   ├── AuditAction.java
│   ├── ResourceType.java
│   ├── ExportFormat.java
│   ├── ReportType.java
│   ├── LoginStatus.java
│   ├── ConfidenceLevel.java
│   └── ExportStatus.java
├── repository/
│   ├── FeedbackRepository.java
│   ├── UsageStatRepository.java
│   ├── AuditLogRepository.java
│   ├── DailyAggregateRepository.java
│   ├── HourlyAggregateRepository.java
│   ├── DepartmentDailyStatRepository.java
│   ├── PopularQuestionRepository.java
│   ├── DocumentPopularityRepository.java
│   ├── ReportExportRepository.java
│   └── UnansweredQuestionRepository.java
├── dto/
│   ├── request/
│   │   ├── FeedbackRequest.java
│   │   ├── ReportExportRequest.java
│   │   ├── AuditLogSearchRequest.java
│   │   └── AnalyticsRequest.java
│   └── response/
│       ├── ApiResponse.java
│       ├── FeedbackResponse.java
│       ├── AnalyticsSummaryResponse.java
│       ├── UnansweredQuestionResponse.java
│       ├── AuditLogResponse.java
│       ├── ReportExportResponse.java
│       ├── DashboardOverviewResponse.java
│       ├── TrendResponse.java
│       ├── DepartmentStatsResponse.java
│       ├── PopularQuestionResponse.java
│       └── DocumentPopularityResponse.java
├── service/
│   ├── FeedbackService.java
│   ├── AnalyticsService.java
│   ├── AuditLogService.java
│   ├── ReportExportService.java
│   └── DashboardService.java
├── controller/
│   ├── FeedbackController.java
│   ├── AnalyticsController.java
│   ├── DashboardController.java
│   ├── ReportController.java
│   └── AuditController.java
├── consumer/
│   ├── UnansweredQuestionConsumer.java
│   ├── DocumentEventConsumer.java
│   └── UserEventConsumer.java
├── scheduler/
│   ├── StatsAggregationScheduler.java
│   └── CleanupScheduler.java
├── config/
│   ├── SecurityConfig.java
│   ├── RabbitMQConfig.java
│   └── AsyncConfig.java
├── security/
│   ├── JwtAuthenticationFilter.java
│   └── UserPrincipal.java
├── exception/
│   ├── GlobalExceptionHandler.java
│   ├── FeedbackNotFoundException.java
│   ├── ReportGenerationException.java
│   ├── ReportNotReadyException.java
│   └── ResourceNotFoundException.java
└── mapper/
    └── FeedbackMapper.java

services/feedback-tai-nguyen/src/main/resources/
├── application.yml                          ← đã có, cập nhật thêm actuator + openfeign
└── application-docker.yml                   ← đã có

services/feedback-tai-nguyen/src/test/java/com/poliwise/feedback/
├── service/
│   ├── FeedbackServiceTest.java
│   ├── AnalyticsServiceTest.java
│   └── DashboardServiceTest.java
└── controller/
    └── FeedbackControllerTest.java
```

---

### Bước 1.2 — Tạo Entity Classes (10 entities)

**Quy tắc mapping:**
- Schema `analytics` → package `entity`
- Schema `conversation` → package `entity`
- Table `feedbacks` → `Feedback.java`
- Table `usage_stats` → `UsageStat.java`
- Table `audit_logs` → `AuditLog.java`
- Table `daily_aggregates` → `DailyAggregate.java`
- Table `hourly_aggregates` → `HourlyAggregate.java`
- Table `department_daily_stats` → `DepartmentDailyStat.java`
- Table `popular_questions` → `PopularQuestion.java`
- Table `document_popularity` → `DocumentPopularity.java`
- Table `report_exports` → `ReportExport.java`
- Table `conversation.unanswered_questions` → `UnansweredQuestion.java`

**Mapping chi tiết từng entity:**

#### Feedback.java
```java
@Entity @Table(name = "feedbacks", schema = "analytics")
- id: UUID (PK, @GeneratedValue)
- userId: UUID (NOT NULL)
- messageId: UUID (NOT NULL)
- conversationId: UUID (NOT NULL)
- type: FeedbackType enum (NOT NULL)
- comment: String (nullable)
- questionText: String (nullable)
- answerText: String (nullable)
- sourcesUsed: JSON (nullable) — dùng @Column(columnDefinition = "jsonb")
- userDepartmentId: UUID (nullable)
- userRole: String (nullable)
- createdAt: Instant
- updatedAt: Instant
- UNIQUE CONSTRAINT: user_id + message_id
```

#### UsageStat.java
```java
@Entity @Table(name = "usage_stats", schema = "analytics")
- id: UUID (PK)
- userId: UUID (nullable)
- userRole: String (nullable)
- userDepartmentId: UUID (nullable)
- serviceName: String (NOT NULL)
- endpoint: String (NOT NULL)
- method: String (NOT NULL)
- responseTimeMs: Integer (NOT NULL)
- statusCode: Integer (NOT NULL)
- requestSizeBytes: Integer (nullable)
- responseSizeBytes: Integer (nullable)
- isError: Boolean (default false)
- errorCode: String (nullable)
- errorMessage: String (nullable)
- tokensUsed: Integer (nullable)
- modelUsed: String (nullable)
- chunksRetrieved: Integer (nullable)
- confidence: String (nullable)
- traceId: String (nullable)
- ipAddress: String (nullable)
- userAgent: String (nullable)
- createdAt: Instant
```

#### AuditLog.java
```java
@Entity @Table(name = "audit_logs", schema = "analytics")
- id: UUID (PK)
- userId: UUID (nullable)
- username: String (nullable)
- userRole: String (nullable)
- action: AuditAction enum (NOT NULL)
- resourceType: ResourceType enum (NOT NULL)
- resourceId: UUID (nullable)
- resourceName: String (nullable)
- oldValue: JSON (nullable)
- newValue: JSON (nullable)
- changedFields: String[] (nullable)
- ipAddress: String (nullable)
- userAgent: String (nullable)
- traceId: String (nullable)
- serviceName: String (nullable)
- metadata: JSON (nullable)
- createdAt: Instant
```

#### DailyAggregate.java
```java
@Entity @Table(name = "daily_aggregates", schema = "analytics")
- id: UUID (PK)
- date: LocalDate (NOT NULL, UNIQUE)
- totalQuestions: Integer
- totalConversations: Integer
- uniqueUsersAsked: Integer
- totalLikes: Integer
- totalDislikes: Integer
- feedbackRatio: BigDecimal
- avgResponseTimeMs: Integer
- p50ResponseTimeMs: Integer
- p95ResponseTimeMs: Integer
- p99ResponseTimeMs: Integer
- totalRequests: Integer
- totalErrors: Integer
- errorRate: BigDecimal
- totalTokensUsed: Long
- avgTokensPerQuestion: Integer
- avgChunksRetrieved: BigDecimal
- documentsUploaded: Integer
- documentsPublished: Integer
- uniqueActiveUsers: Integer
- newUsers: Integer
- unansweredQuestions: Integer
- resolvedQuestions: Integer
- computedAt: Instant
- createdAt: Instant
- updatedAt: Instant
```

#### HourlyAggregate.java
```java
@Entity @Table(name = "hourly_aggregates", schema = "analytics")
- id: UUID (PK)
- datetime: Instant (NOT NULL, UNIQUE)
- hour: Integer (0-23)
- totalQuestions: Integer
- totalRequests: Integer
- totalErrors: Integer
- uniqueUsers: Integer
- avgResponseTimeMs: Integer
- likes: Integer
- dislikes: Integer
- computedAt: Instant
```

#### DepartmentDailyStat.java
```java
@Entity @Table(name = "department_daily_stats", schema = "analytics")
- id: UUID (PK)
- date: LocalDate (NOT NULL)
- departmentId: UUID (NOT NULL)
- totalQuestions: Integer
- uniqueUsers: Integer
- likes: Integer
- dislikes: Integer
- topCategories: JSON (nullable)
- computedAt: Instant
- UNIQUE CONSTRAINT: date + departmentId
```

#### PopularQuestion.java
```java
@Entity @Table(name = "popular_questions", schema = "analytics")
- id: UUID (PK)
- questionNormalized: String (NOT NULL)
- questionSample: String (NOT NULL)
- askCount: Integer
- uniqueUsersCount: Integer
- firstAskedAt: Instant
- lastAskedAt: Instant
- totalLikes: Integer
- totalDislikes: Integer
- commonSourceDocuments: JSON (nullable)
- detectedCategory: String (nullable)
- detectedDepartmentId: UUID (nullable)
- createdAt: Instant
- updatedAt: Instant
```

#### DocumentPopularity.java
```java
@Entity @Table(name = "document_popularity", schema = "analytics")
- id: UUID (PK)
- documentId: UUID (NOT NULL, UNIQUE)
- totalCitations: Integer
- uniqueQuestionsCited: Integer
- citationsWithLikes: Integer
- citationsWithDislikes: Integer
- firstCitedAt: Instant (nullable)
- lastCitedAt: Instant (nullable)
- citationsLast7Days: Integer
- citationsLast30Days: Integer
- createdAt: Instant
- updatedAt: Instant
```

#### ReportExport.java
```java
@Entity @Table(name = "report_exports", schema = "analytics")
- id: UUID (PK)
- reportType: ReportType enum (NOT NULL)
- title: String (NOT NULL)
- dateFrom: LocalDate (nullable)
- dateTo: LocalDate (nullable)
- departmentId: UUID (nullable)
- filters: JSON (nullable)
- format: ExportFormat enum (NOT NULL)
- fileKey: String (nullable)
- fileSizeBytes: Integer (nullable)
- status: String (NOT NULL) — PENDING/PROCESSING/COMPLETED/FAILED
- errorMessage: String (nullable)
- requestedBy: UUID (NOT NULL)
- createdAt: Instant
- completedAt: Instant (nullable)
- downloadedAt: Instant (nullable)
- expiresAt: Instant (nullable)
```

#### UnansweredQuestion.java
```java
@Entity @Table(name = "unanswered_questions", schema = "conversation")
- id: UUID (PK)
- userId: UUID (NOT NULL)
- messageId: UUID (nullable)
- conversationId: UUID (nullable)
- question: String (NOT NULL)
- questionNormalized: String (nullable)
- attemptedContext: JSON (nullable)
- searchQuery: String (nullable)
- topSimilarityScore: BigDecimal (nullable)
- userDepartmentId: UUID (nullable)
- userRole: String (nullable)
- resolved: Boolean (default false)
- resolvedBy: UUID (nullable)
- resolvedAt: Instant (nullable)
- resolutionNotes: String (nullable)
- relatedDocumentId: UUID (nullable)
- category: String (nullable)
- priority: String (default 'NORMAL')
- createdAt: Instant
- updatedAt: Instant
```

---

### Bước 1.3 — Tạo Enum Classes

```
enums/FeedbackType.java     → LIKE, DISLIKE
enums/AuditAction.java      → LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, TOKEN_REFRESH,
                              PASSWORD_CHANGE, USER_CREATE, USER_UPDATE, USER_DEACTIVATE,
                              USER_ACTIVATE, USER_REVOKE, USER_DELETE, DOCUMENT_UPLOAD,
                              DOCUMENT_UPDATE, DOCUMENT_DELETE, DOCUMENT_PUBLISH,
                              DOCUMENT_ARCHIVE, DOCUMENT_VERSION_CREATE, QUESTION_ASK,
                              CONVERSATION_CREATE, CONVERSATION_DELETE, FEEDBACK_SUBMIT,
                              SETTINGS_UPDATE, BULK_IMPORT, REPORT_EXPORT
enums/ResourceType.java     → USER, DOCUMENT, CONVERSATION, MESSAGE, FEEDBACK,
                              DEPARTMENT, CATEGORY, TAG, SETTINGS
enums/ExportFormat.java     → CSV, PDF, XLSX, JSON
enums/ReportType.java       → USAGE_SUMMARY, QUESTION_ANALYTICS, FEEDBACK_ANALYSIS,
                              USER_ENGAGEMENT, DOCUMENT_POPULARITY,
                              UNANSWERED_QUESTIONS, DEPARTMENT_BREAKDOWN
enums/LoginStatus.java      → SUCCESS, FAILED_CREDENTIALS, FAILED_DEACTIVATED,
                              FAILED_REVOKED, FAILED_LOCKED
enums/ConfidenceLevel.java  → HIGH, MEDIUM, LOW, UNKNOWN
enums/ExportStatus.java     → PENDING, PROCESSING, COMPLETED, FAILED
```

---

### Bước 1.4 — Tạo Repository Interfaces (10 repositories)

| Repository | Entity | Methods quan trọng |
|---|---|---|
| `FeedbackRepository` | Feedback | findByConversationId, findByUserId, countByType, findByUserIdAndMessageId |
| `UsageStatRepository` | UsageStat | findByCreatedAtBetween, countByServiceNameAndIsError, sumResponseTimeByService |
| `AuditLogRepository` | AuditLog | findByAction, findByUserId, findByResourceTypeAndResourceId, search (Pageable + Spec) |
| `DailyAggregateRepository` | DailyAggregate | findByDateBetween, findByDate |
| `HourlyAggregateRepository` | HourlyAggregate | findByDatetimeBetween, findByDatetime |
| `DepartmentDailyStatRepository` | DepartmentDailyStat | findByDateAndDepartmentId, findByDateBetween |
| `PopularQuestionRepository` | PopularQuestion | findTopByOrderByAskCountDesc, findByAskCountGreaterThan |
| `DocumentPopularityRepository` | DocumentPopularity | findByDocumentId, findTopByOrderByTotalCitationsDesc |
| `ReportExportRepository` | ReportExport | findByRequestedBy, findByStatus, findByExpiresAtBefore |
| `UnansweredQuestionRepository` | UnansweredQuestion | findByResolved, findByUserId, findByPriority |

**Lưu ý:** Cần dùng `@Repository` annotation, kế thừa `JpaRepository<,>`, dùng `@Query` cho các câu truy vấn phức tạp.

---

### Bước 1.5 — Tạo DTO Classes

#### Request DTOs:
```
FeedbackRequest.java
  - messageId: UUID (@NotNull)
  - conversationId: UUID (@NotNull)
  - type: FeedbackType (@NotNull)
  - comment: String (@Size(max = 1000), nullable)

ReportExportRequest.java
  - reportType: ReportType (@NotNull)
  - title: String (@NotBlank, @Size(max = 255))
  - dateFrom: LocalDate (nullable)
  - dateTo: LocalDate (nullable)
  - departmentId: UUID (nullable)
  - format: ExportFormat (@NotNull)

AuditLogSearchRequest.java
  - action: AuditAction (nullable)
  - userId: UUID (nullable)
  - resourceType: ResourceType (nullable)
  - resourceId: UUID (nullable)
  - fromDate: LocalDateTime (nullable)
  - toDate: LocalDateTime (nullable)

AnalyticsRequest.java
  - fromDate: LocalDate (nullable)
  - toDate: LocalDate (nullable)
  - departmentId: UUID (nullable)
```

#### Response DTOs (dùng chung ApiResponse wrapper):
```
ApiResponse<T>.java
  - success: boolean
  - data: T
  - message: String (nullable)
  - timestamp: Instant

FeedbackResponse.java
  - id, userId, messageId, conversationId, type, comment,
    questionText, answerText, createdAt

AnalyticsSummaryResponse.java
  - totalQuestions, totalFeedbacks, totalLikes, totalDislikes,
    avgSatisfactionRate, avgResponseTimeMs, topCategories: List,
    dateFrom, dateTo

UnansweredQuestionResponse.java
  - id, question, userId, userDepartmentId, category, priority,
    resolved, createdAt, resolvedAt

AuditLogResponse.java
  - id, userId, username, userRole, action, resourceType,
    resourceId, resourceName, ipAddress, createdAt

ReportExportResponse.java
  - id, reportType, title, format, status, fileKey, fileSizeBytes,
    requestedBy, createdAt, completedAt, expiresAt, errorMessage

DashboardOverviewResponse.java
  - totalQuestionsToday, totalQuestionsWeek, totalFeedbacks,
    satisfactionRate, activeUsersToday, unansweredCount,
    topQuestions: List, topDocuments: List

TrendResponse.java
  - date, totalQuestions, totalFeedbacks, avgResponseTimeMs,
    uniqueUsers, likes, dislikes

DepartmentStatsResponse.java
  - departmentId, departmentName, totalQuestions, uniqueUsers,
    likes, dislikes, satisfactionRate

PopularQuestionResponse.java
  - id, questionSample, askCount, totalLikes, totalDislikes,
    commonSourceDocuments, detectedCategory

DocumentPopularityResponse.java
  - documentId, totalCitations, uniqueQuestionsCited,
    citationsLast7Days, lastCitedAt
```

---

### Bước 1.6 — Tạo Service Classes (5 services)

#### FeedbackService.java
```java
// Phương thức cần implement:
- createFeedback(UUID userId, FeedbackRequest) → FeedbackResponse
- getFeedbacksByConversation(UUID conversationId) → List<FeedbackResponse>
- getFeedbacksByUser(UUID userId, Pageable) → Page<FeedbackResponse>
- getFeedbackStats(LocalDate from, LocalDate to) → AnalyticsSummaryResponse
- deleteFeedback(UUID id, UUID userId) → void (403 nếu không phải chủ)
```

#### AnalyticsService.java
```java
// Phương thức cần implement:
- getSummary(AnalyticsRequest) → AnalyticsSummaryResponse
- getTopQuestions(int limit, LocalDate from, LocalDate to) → List<PopularQuestionResponse>
- getTopDocuments(int limit) → List<DocumentPopularityResponse>
- getDepartmentStats(UUID departmentId, LocalDate date) → DepartmentStatsResponse
- getTrends(int days) → List<TrendResponse>
- incrementQuestionCount(UUID userId, UUID departmentId, String userRole) → void
- incrementDocumentView(UUID documentId) → void (upsert DocumentPopularity)
- recordFeedback(UUID userId, FeedbackType type) → void
```

#### AuditLogService.java
```java
// Phương thức cần implement:
- logAction(UUID userId, String username, String userRole, AuditAction action,
            ResourceType resourceType, UUID resourceId, String resourceName,
            String ipAddress, String userAgent, String traceId, String serviceName,
            Map<String, Object> metadata) → void
- searchLogs(AuditLogSearchRequest, Pageable) → Page<AuditLogResponse>
- getAuditLogById(UUID id) → AuditLogResponse
- cleanupOldLogs(int retentionDays) → long (số bản ghi đã xóa)
```

#### ReportExportService.java
```java
// Phương thức cần implement:
- createReport(UUID requestedBy, ReportExportRequest) → ReportExportResponse
- getReportStatus(UUID id) → ReportExportResponse
- generateReport(UUID id) → void (@Async)
- downloadReport(UUID id) → byte[] (403 nếu không phải chủ hoặc chưa COMPLETED)
- deleteExpiredReports() → void (scheduled)
```

#### DashboardService.java
```java
// Phương thức cần implement:
- getOverview() → DashboardOverviewResponse
- getTrends(int days) → List<TrendResponse>
- getDepartmentBreakdown(LocalDate from, LocalDate to) → List<DepartmentStatsResponse>
- getUnansweredQuestions(Pageable) → Page<UnansweredQuestionResponse>
```

---

### Bước 1.7 — Tạo Controller Classes (5 controllers)

#### FeedbackController.java — USER, MANAGER, ADMIN
| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| POST | `/api/v1/feedback` | USER | Submit feedback (like/dislike + comment) |
| GET | `/api/v1/feedback/conversation/{id}` | USER | List feedbacks cho conversation |

#### AnalyticsController.java — MANAGER, ADMIN
| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| GET | `/api/v1/analytics/summary` | MANAGER | Tổng quan thống kê |
| GET | `/api/v1/analytics/questions` | MANAGER | Top câu hỏi phổ biến |
| GET | `/api/v1/analytics/documents` | MANAGER | Top tài liệu được trích dẫn |
| GET | `/api/v1/analytics/feedback` | MANAGER | Phân tích feedback |
| GET | `/api/v1/analytics/departments/{deptId}` | MANAGER | Thống kê theo phòng ban |
| GET | `/api/v1/analytics/trends` | MANAGER | Trend analysis (ngày) |

#### DashboardController.java — MANAGER, ADMIN
| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| GET | `/api/v1/dashboard/overview` | MANAGER | Tổng quan dashboard |
| GET | `/api/v1/dashboard/trends` | MANAGER | Trend analysis |
| GET | `/api/v1/dashboard/departments` | MANAGER | Thống kê theo phòng ban |
| GET | `/api/v1/dashboard/unanswered` | MANAGER | Câu hỏi chưa trả lời |

#### ReportController.java — MANAGER, ADMIN
| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| POST | `/api/v1/reports/export` | MANAGER | Tạo export job |
| GET | `/api/v1/reports/{id}` | MANAGER | Kiểm tra status |
| GET | `/api/v1/reports/{id}/download` | MANAGER | Download file |
| GET | `/api/v1/reports` | MANAGER | Danh sách reports của user |

#### AuditController.java — ADMIN only
| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| GET | `/api/v1/audit-logs` | ADMIN | Danh sách audit logs (phân trang, filter) |
| GET | `/api/v1/audit-logs/{id}` | ADMIN | Chi tiết 1 log |

---

### Bước 1.8 — Tạo RabbitMQ Consumer Layer

#### UnansweredQuestionConsumer.java
```
- Exchange: poliwise.events (TopicExchange)
- Queue: poliwise.feedback.unanswered
- Routing key: unanswered.question
- Message payload: { question, userId, departmentId, userRole, messageId, conversationId, timestamp }
- Xử lý:
  1. Save vào UnansweredQuestion entity
  2. Upsert PopularQuestion: normalize question text, increment askCount
  3. Update uniqueUsersCount
  4. Log vào AuditLog
```

#### DocumentEventConsumer.java
```
- Exchange: poliwise.events (TopicExchange)
- Queue: poliwise.feedback.document
- Routing keys: document.uploaded, document.deleted
- Xử lý document.uploaded:
  1. Log vào AuditLog (DOCUMENT_UPLOAD)
  2. Khởi tạo DocumentPopularity entry với count = 0
- Xử lý document.deleted:
  1. Log vào AuditLog (DOCUMENT_DELETE)
  2. (Không xóa DocumentPopularity vì giữ lại lịch sử)
```

#### UserEventConsumer.java
```
- Exchange: poliwise.events (TopicExchange)
- Queue: poliwise.feedback.user
- Routing key: user.status.changed
- Xử lý:
  1. Parse UserStatusChangedEvent
  2. Log vào AuditLog (USER_UPDATE)
```

---

### Bước 1.9 — Tạo Scheduled Jobs

#### StatsAggregationScheduler.java
```
@Scheduled(cron = "0 0 * * * *")  // Mỗi giờ đầu
- Aggregate UsageStats (1 giờ trước) → HourlyAggregate
- Upsert vào hourly_aggregates

@Scheduled(cron = "0 0 0 * * *")  // Mỗi ngày 00:00
- Aggregate HourlyAggregate (hôm qua) → DailyAggregate
- Upsert vào daily_aggregates
- Aggregate by department → DepartmentDailyStat
- Cleanup UsageStats cũ (> 7 ngày)
- Cleanup HourlyAggregate cũ (> 30 ngày)
```

#### CleanupScheduler.java
```
@Scheduled(cron = "0 0 1 * * *")  // Mỗi ngày 01:00
- Cleanup old AuditLogs (> 90 ngày theo retention policy)
- Cleanup expired ReportExport records (> 7 ngày sau completed)
- Cleanup old UnansweredQuestions đã resolved > 180 ngày
```

---

### Bước 1.10 — Tạo Security Config

#### SecurityConfig.java
```
- JWT filter chain (JwtAuthenticationFilter)
- Endpoint permissions:
  - /actuator/** → PUBLIC
  - /api/v1/feedback/** → USER+
  - /api/v1/analytics/** → MANAGER+
  - /api/v1/dashboard/** → MANAGER+
  - /api/v1/reports/** → MANAGER+
  - /api/v1/audit-logs/** → ADMIN only
- CSRF disabled (stateless JWT)
- CORS enabled
```

#### JwtAuthenticationFilter.java
```
- Extract JWT từ Authorization header (Bearer token)
- Validate JWT signature và expiration
- Extract userId, username, role từ claims
- Set Authentication in SecurityContextHolder
- Dùng JWT secret từ application.yml (poliwise.jwt.secret)
```

---

### Bước 1.11 — Tạo Exception Handling

#### GlobalExceptionHandler.java
```
- @ExceptionHandler(FeedbackNotFoundException) → 404
- @ExceptionHandler(ReportNotReadyException) → 409
- @ExceptionHandler(ReportGenerationException) → 500
- @ExceptionHandler(ResourceNotFoundException) → 404
- @ExceptionHandler(MethodArgumentNotValidException) → 400
- @ExceptionHandler(AccessDeniedException) → 403
- @ExceptionHandler(Exception) → 500 (generic)
```

#### Custom Exceptions:
```
FeedbackNotFoundException(id) → "Feedback not found: {id}"
ReportNotReadyException(id) → "Report still generating: {id}"
ReportGenerationException(msg) → "Failed to generate report: {msg}"
ResourceNotFoundException(type, id) → "{type} not found: {id}"
UnauthorizedFeedbackAccessException → "Cannot access this feedback"
InvalidDateRangeException → "dateFrom must be before dateTo"
```

---

### Bước 1.12 — Tạo/Update Configuration Files

#### application.yml (update)
```yaml
# Thêm vào existing application.yml:
spring:
  jackson:
    serialization:
      write-dates-as-timestamps: false
    default-property-inclusion: non_null

poliwise:
  jwt:
    secret: ${POLIWISE_JWT_SECRET}
    issuer: ${POLIWISE_JWT_ISSUER}
  cleanup:
    audit-retention-days: 90
    report-expiry-days: 7
    usage-stats-retention-days: 7
    hourly-aggregate-retention-days: 30
```

#### application-docker.yml (đã có, verify)
- Đảm bảo ddl-auto: update

---

### Bước 1.13 — Tạo Unit Tests

```
src/test/java/com/poliwise/feedback/
├── service/
│   ├── FeedbackServiceTest.java     ← create, getByConversation, stats
│   ├── AnalyticsServiceTest.java    ← summary, top questions, department stats
│   └── DashboardServiceTest.java   ← overview, trends
└── controller/
    └── FeedbackControllerTest.java ← POST feedback, GET by conversation
```

---

### GIAI ĐOẠN 2: Hoàn thiện API Gateway

---

### GIAI ĐOẠN 1: Hoàn thiện Feedback Service

**Mục tiêu:** Từ 30% → 95%

---

### Bước 1.1 — Tạo DTO Layer

```
services/feedback-service/src/main/java/com/poliwise/feedback/dto/
```

| File | Mô tả |
|------|-------|
| `FeedbackRequest.java` | conversationId, type (LIKE/DISLIKE), rating (1-5), comment |
| `FeedbackResponse.java` | id, conversationId, type, rating, comment, userId, createdAt |
| `AnalyticsSummaryResponse.java` | totalQuestions, totalFeedbacks, avgSatisfaction, topTags |
| `UnansweredQuestionResponse.java` | id, question, askedBy, askedAt, department |
| `AuditLogResponse.java` | id, action, userId, targetId, details, timestamp |
| `ReportExportRequest.java` | type (CSV/PDF/EXCEL), dateFrom, dateTo, filters |
| `ReportExportResponse.java` | id, status, downloadUrl, format, createdAt |
| `DashboardResponse.java` | overview stats, trends, department breakdown |
| `UsageStatResponse.java` | date, questionCount, feedbackCount, uniqueUsers |

---

### Bước 1.2 — Tạo Service Layer (5 services)

```
services/feedback-service/src/main/java/com/poliwise/feedback/service/
```

**1. FeedbackService.java**
```java
// Phương thức cần implement:
- createFeedback(FeedbackRequest) → save to Feedback entity
- getFeedbacksByConversation(String conversationId) → List<Feedback>
- getFeedbackStats() → tổng hợp like/dislike, rating avg
- deleteFeedback(UUID id, UUID userId) → soft delete hoặc hard delete
```

**2. AnalyticsService.java**
```java
// Phương thức cần implement:
- getSummary(LocalDate from, LocalDate to) → AnalyticsSummaryResponse
- getTopQuestions(int limit) → List<PopularQuestionResponse>
- getTopDocuments(int limit) → List<DocumentPopularityResponse>
- getDepartmentStats(UUID departmentId, LocalDate date) → DepartmentDailyStat
- getTrends(Period period) → List<DailyAggregate>
- incrementQuestionCount(UUID userId, UUID departmentId) → ghi UsageStat
- incrementDocumentView(UUID documentId) → update DocumentPopularity
```

**3. AuditLogService.java**
```java
// Phương thức cần implement:
- logAction(String action, UUID userId, String targetId, String details)
- searchLogs(String action, UUID userId, LocalDateTime from, LocalDateTime to, Pageable)
- getAuditLogById(UUID id)
- cleanupOldLogs(int retentionDays) → @Scheduled xóa logs > 90 ngày
```

**4. ReportExportService.java**
```java
// Phương thức cần implement:
- createReport(ReportExportRequest) → tạo job, trả về id
- getReportStatus(UUID id) → PENDING/GENERATING/COMPLETED/FAILED
- generateReport(UUID id) → @Async tạo file
- downloadReport(UUID id) → trả về file resource
- Formats: CSV (Apache Commons CSV), PDF (iText/OpenPDF), XLSX (Apache POI)
```

**5. DashboardService.java**
```java
// Phương thức cần implement:
- getOverview() → DashboardResponse: total users, total questions, satisfaction rate, active today
- getTrends(int days) → trend data cho charts
- getDepartmentBreakdown() → thống kê theo từng phòng ban
- getUnansweredQuestions(Pageable) → danh sách câu hỏi chưa trả lời
```

---

### Bước 1.3 — Tạo Controller Layer (5 controllers)

```
services/feedback-service/src/main/java/com/poliwise/feedback/controller/
```

**1. FeedbackController.java** — USER, MANAGER, ADMIN

| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| POST | `/api/v1/feedback` | USER | Submit feedback (like/dislike + comment) |
| GET | `/api/v1/feedback/conversation/{id}` | USER | List feedbacks cho conversation |

**2. AnalyticsController.java** — MANAGER, ADMIN

| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| GET | `/api/v1/analytics/summary` | MANAGER | Tổng quan thống kê |
| GET | `/api/v1/analytics/questions` | MANAGER | Top câu hỏi phổ biến |
| GET | `/api/v1/analytics/documents` | MANAGER | Top tài liệu được trích dẫn |
| GET | `/api/v1/analytics/feedback` | MANAGER | Phân tích feedback |
| GET | `/api/v1/analytics/departments/{deptId}` | MANAGER | Thống kê theo phòng ban |

**3. DashboardController.java** — MANAGER, ADMIN

| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| GET | `/api/v1/dashboard/overview` | MANAGER | Tổng quan dashboard |
| GET | `/api/v1/dashboard/trends` | MANAGER | Trend analysis |

**4. ReportController.java** — MANAGER, ADMIN

| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| POST | `/api/v1/reports/export` | MANAGER | Tạo export job |
| GET | `/api/v1/reports/{id}` | MANAGER | Kiểm tra status |
| GET | `/api/v1/reports/{id}/download` | MANAGER | Download file |

**5. AuditController.java** — ADMIN only

| Method | Endpoint | Role | Mô tả |
|--------|----------|------|-------|
| GET | `/api/v1/audit-logs` | ADMIN | Danh sách audit logs (phân trang) |
| GET | `/api/v1/audit-logs/{id}` | ADMIN | Chi tiết 1 log |

---

### Bước 1.4 — Tạo RabbitMQ Consumer Layer

```
services/feedback-service/src/main/java/com/poliwise/feedback/consumer/
```

**1. UnansweredQuestionConsumer.java**
```
- Listen: unanswered.question queue (exchange: poliwise.events, routingKey: unanswered.question)
- Khi nhận message:
  → Parse message: question text, userId, departmentId, timestamp
  → Save vào UnansweredQuestion entity
  → Update PopularQuestion: increment count hoặc create new
  → Optionally: send notification cho MANAGER (future)
```

**2. DocumentEventConsumer.java**
```
- Listen: poliwise.knowledge.document events
- Khi nhận Document.uploaded:
  → Log vào AuditLog
  → Khởi tạo DocumentPopularity entry với count = 0
- Khi nhận Document.deleted:
  → Log vào AuditLog
```

**3. UserEventConsumer.java**
```
- Listen: poliwise.auth.user.status.changed
- Log vào AuditLog khi có status change
```

---

### Bước 1.5 — Tạo Scheduled Jobs

```
services/feedback-service/src/main/java/com/poliwise/feedback/scheduler/
```

**StatsAggregationScheduler.java**
```
@Scheduled(cron = "0 0 * * * *")  // Mỗi giờ
- Aggregate UsageStats → HourlyAggregate
- Update PopularQuestion counts

@Scheduled(cron = "0 0 0 * * *")  // Mỗi ngày 00:00
- Aggregate HourlyAggregate → DailyAggregate
- Aggregate by department → DepartmentDailyStat
- Cleanup UsageStats cũ (> 7 ngày)

@Scheduled(cron = "0 0 1 * * *")  // Mỗi ngày 01:00
- Cleanup old AuditLogs (> 90 ngày theo retention policy)
- Cleanup expired ReportExport records (> 7 ngày)
```

---

### Bước 1.6 — Thêm Spring Security Config

```
services/feedback-service/src/main/java/com/poliwise/feedback/config/
```

**SecurityConfig.java**
```
- Spring Security với JWT filter (tương tự user-service)
- Endpoint permissions:
  - /api/v1/feedback/** → USER+
  - /api/v1/analytics/** → MANAGER+
  - /api/v1/dashboard/** → MANAGER+
  - /api/v1/reports/** → MANAGER+
  - /api/v1/audit-logs/** → ADMIN only
- Public: actuator, health
```

**RabbitMQConfig.java**
```
- Exchange: poliwise.events (TopicExchange)
- Queues:
  - poliwise.feedback.unanswered (binding: unanswered.question)
  - poliwise.feedback.document (binding: document.uploaded, document.deleted)
  - poliwise.feedback.user (binding: user.status.changed)
- Jackson2JsonMessageConverter
- Dead Letter Queue cho failed messages
```

**AsyncConfig.java**
```
- Enable @Async cho report generation
- ThreadPoolTaskExecutor: core=2, max=5, queue=100
```

---

### Bước 1.7 — Thêm Exception Handling

```
services/feedback-service/src/main/java/com/poliwise/feedback/exception/
```

| Exception | HTTP Status | Message |
|-----------|-------------|---------|
| `FeedbackNotFoundException` | 404 | Feedback not found |
| `ReportGenerationException` | 500 | Failed to generate report |
| `InvalidDateRangeException` | 400 | dateFrom > dateTo |
| `ReportNotReadyException` | 409 | Report still generating |
| `UnauthorizedFeedbackAccessException` | 403 | Cannot access this feedback |

**GlobalExceptionHandler** trả về ApiResponseDto chuẩn:

```java
{
  "success": false,
  "error": { "code": "FEEDBACK_NOT_FOUND", "message": "..." },
  "timestamp": "2026-04-07T00:00:00Z"
}
```

---

### Bước 1.8 — Viết Unit Tests cho FeedbackService

```
services/feedback-service/src/test/java/com/poliwise/feedback/service/
```

| Test class | Coverage |
|-----------|----------|
| `FeedbackServiceTest.java` | create, getByConversation, stats |
| `AnalyticsServiceTest.java` | summary, top questions, department stats |
| `AuditLogServiceTest.java` | logAction, search, cleanup |
| `ReportExportServiceTest.java` | create job, generate CSV, generate PDF |
| `DashboardServiceTest.java` | overview, trends, department breakdown |

---

### GIAI ĐOẠN 2: Hoàn thiện API Gateway

**Mục tiêu:** Từ 90% → 98%

---

### Bước 2.1 — Thêm Route cho Feedback Service

```
services/api-gateway/src/proxy/proxy.service.ts
```

```typescript
// Thêm mapping mới:
'feedback': 'http://localhost:8085'
```

**Kiểm tra proxy.controller.ts** đã có route `/feedback/**` → feedback-service:8085 chưa.

### Bước 2.2 — Thêm Circuit Breaker Status Endpoint

```
services/api-gateway/src/health/health.controller.ts
```

```typescript
// Thêm endpoint:
GET /health/circuit-breakers
// Response:
{
  "circuitBreakers": [
    { "name": "auth-service", "status": "CLOSED", "failures": 0, "threshold": 5 },
    { "name": "user-service", "status": "CLOSED", "failures": 0, "threshold": 5 },
    // ...
  ]
}
```
Sử dụng Opossum API: `circuitBreaker.stats()`, `circuitBreaker.status()`.

### Bước 2.3 — Thêm Refresh Token Proxy Route

```
services/api-gateway/src/proxy/proxy.controller.ts
```

```typescript
// Thêm route:
POST /auth/refresh → forward to auth-service:8081/api/v1/auth/refresh
// PUBLIC route — không cần JWT validation
```

### Bước 2.4 — Thêm Rate Limit Config cho Feedback Endpoints

Kiểm tra `throttler` config trong `app.module.ts`:
```typescript
// Thêm limits cho feedback
{ ttl: 60000, limit: 100, method: 'ALL', path: 'feedback' }
{ ttl: 60000, limit: 10, method: 'POST', path: 'reports/export' }
```

### Bước 2.5 — Viết Unit Tests cho Gateway

```
services/api-gateway/src/
```

| Test | Mục tiêu |
|------|----------|
| `proxy.controller.spec.ts` | Proxy routing hoạt động đúng |
| `jwt.strategy.spec.ts` | JWT parsing, claims extraction |
| `rbac.guard.spec.ts` | Role enforcement |

---

### GIAI ĐOẠN 3: Hoàn thiện Frontend

**Mục tiêu:** Từ 80% → 95%

---

### Bước 3.1 — Thống nhất API Client

```
frontend/web/
```

```
1. Kiểm tra xem có file trùng:
   - lib/api.ts cũ
   - services/api-client.ts mới
2. Giữ lại services/api-client.ts (đầy đủ hơn)
3. Xóa lib/api.ts
4. Update tất cả imports trong pages/components dùng lib/api.ts
```

### Bước 3.2 — Kết nối Analytics Endpoints

```
frontend/web/services/
```

```typescript
// feedback.service.ts — tạo mới nếu chưa có
// Cập nhật analytics.service.ts:
export const analyticsService = {
  getSummary: (params) => apiClient.get('/feedback/analytics/summary', { params }),
  getTopQuestions: (params) => apiClient.get('/feedback/analytics/questions', { params }),
  getTopDocuments: (params) => apiClient.get('/feedback/analytics/documents', { params }),
  getDashboardOverview: () => apiClient.get('/dashboard/overview'),
  getDashboardTrends: (days) => apiClient.get('/dashboard/trends', { params: { days } }),
  exportReport: (data) => apiClient.post('/reports/export', data),
  getReportStatus: (id) => apiClient.get(`/reports/${id}`),
}
```

### Bước 3.3 — Implement Charts cho Analytics Page

```
frontend/web/app/analytics/page.tsx
```

**Thêm thư viện:** `recharts` (React charts library)

| Component | Chart Type | Data |
|-----------|-----------|------|
| `QuestionTrendChart` | Line chart | Questions/day tuần qua |
| `SatisfactionChart` | Pie/Donut | Like/Dislike ratio |
| `DepartmentBreakdown` | Bar chart | Questions per department |
| `TopDocumentsChart` | Horizontal bar | Most cited documents |
| `ResponseTimeTrend` | Area chart | Avg response time |
| `FeedbackDistribution` | Bar chart | Feedback by rating |

### Bước 3.4 — Tạo Custom Hooks

```
frontend/web/hooks/
```

| Hook | Mục đích |
|------|----------|
| `useAuth.ts` | login, logout, refreshToken, currentUser |
| `useDocument.ts` | upload, list, get, delete (CRUD) |
| `useAnalytics.ts` | summary, trends, dashboard data |
| `useFeedback.ts` | submit feedback, get conversation feedbacks |
| `useToast.ts` | toast notifications |

### Bước 3.5 — Cải thiện Error Handling

```
frontend/web/services/api-client.ts
```

```typescript
// Response interceptor:
- 401 → auto-refresh token, retry request
- 403 → show toast "Bạn không có quyền thực hiện thao tác này"
- 429 → show toast "Quá nhiều yêu cầu, vui lòng thử lại sau"
- 500 → show toast "Lỗi server, vui lòng liên hệ quản trị viên"
- Network error → show toast "Không có kết nối mạng"
```

### Bước 3.6 — Responsive Improvements

```
frontend/web/components/layout/Sidebar.tsx
frontend/web/app/globals.css
```

- Mobile: collapsible sidebar, hamburger menu
- Tablet: 2-column layout for documents page
- Analytics page: stacked charts on mobile

---

### GIAI ĐOẠN 4: Hoàn thiện Knowledge Service

**Mục tiêu:** Từ 75% → 95% (phụ thuộc Vector Search Service)

---

### Bước 4.1 — Định nghĩa Chunk Entity (nếu Milvus chưa sẵn sàng)

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/entity/
```

```java
@Entity
@Table(name = "chunks")
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
    // metadata: sourcePage, paragraphNumber
}
```

### Bước 4.2 — Implement Embedding Service thực sự

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/service/EmbeddingService.java
```

**Tùy chọn A: OpenAI Embeddings**
```java
// pom.xml: openai-java dependency
@Autowired OpenAIApi openAIApi;
public float[] generateEmbedding(String text) {
    EmbeddingRequest request = EmbeddingRequest.builder()
        .input(text)
        .model("text-embedding-3-small")
        .build();
    EmbeddingResponse response = openAIApi.createEmbedding(request);
    return response.getData().get(0).getEmbedding();
}
```

**Tùy chọn B: HuggingFace Transformers (self-hosted)**
```java
// pom.xml: spring-ai để hỗ trợ multi-provider
@Autowired EmbeddingClient embeddingClient;
public float[] generateEmbedding(String text) {
    return embeddingClient.embed(text);
}
```

### Bước 4.3 — Implement Vector Indexing

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/service/VectorIndexService.java
```

```java
// Gọi Vector Search Service (Milvus) qua HTTP/grpc
@Autowired RestTemplate restTemplate;

public void indexChunks(List<Chunk> chunks) {
    // 1. Generate embeddings cho từng chunk
    // 2. Batch upsert vào Milvus:
    //    POST {vector-service-url}/collections/{collection}/upsert
    //    { vectors: [...], ids: [...], metadata: {documentId, chunkIndex} }
}

public void deleteFromIndex(UUID documentId) {
    // DELETE {vector-service-url}/collections/{collection}/delete
    // { filter: documentId = '...' }
}
```

### Bước 4.4 — Hoàn thiện Processing Pipeline

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/service/DocumentProcessingService.java
```

```java
@Async
public void processDocument(UUID documentId) {
    // Bước 1: PARSING — Apache PDFBox/POI/Tika
    // Bước 2: CHUNKING — TextChunkingService (đã có)
    // Bước 3: EMBEDDING — EmbeddingService (implement ở 4.2)
    // Bước 4: INDEXING — VectorIndexService (implement ở 4.3)
    // Bước 5: Save chunks to DB
    // Update ProcessingJob status: UPLOADED → PARSING → CHUNKING → EMBEDDING → INDEXING → COMPLETED
    // Nếu lỗi: status = FAILED, lưu error message
}
```

### Bước 4.5 — Thêm OpenAPI Documentation

```
services/knowledge-service/src/main/java/com/poliwise/knowledge/
```

```java
// pom.xml: springdoc-openapi-starter-webmvc-ui
// DocumentController.java thêm annotations:
@RestController
@RequestMapping("/api/v1/documents")
@Tag(name = "Documents", description = "Document management and processing")
public class DocumentController {
    @Operation(summary = "Upload document", description = "...")
    @ApiResponse(responseCode = "201", description = "Document uploaded successfully")
    // ...
}
```

---

### GIAI ĐOẠN 5: Kiểm thử & Tích hợp

**Mục tiêu:** Đảm bảo toàn bộ hệ thống chạy end-to-end

---

### Bước 5.1 — End-to-End Test Flow

```
Tạo kịch bản E2E:

1. ADMIN login → nhận JWT
2. ADMIN upload PDF document → /api/v1/documents
3. Chờ processing pipeline hoàn thành
4. USER login → nhận JWT
5. USER hỏi câu hỏi → /api/v1/ai/ask
6. USER gửi feedback → /api/v1/feedback
7. MANAGER login → xem analytics → /api/v1/analytics/summary
8. MANAGER export report → /api/v1/reports/export → download CSV
```

### Bước 5.2 — Integration Tests cho Auth Service

```
services/auth-service/src/test/java/com/poliwise/auth/
```

- Test với TestContainers (PostgreSQL thực)
- Test JWT validation
- Test account lockout flow
- Test refresh token rotation
- Test RabbitMQ event publishing

### Bước 5.3 — Verify Docker Compose

```bash
# Kiểm tra tất cả services khởi động đúng
docker-compose up -d
# Check health: curl http://localhost:3000/health
# Check logs: docker-compose logs -f [service-name]
```

### Bước 5.4 — Load Testing

```bash
# Dùng k6 hoặc Artillery
# Kịch bản: 100 concurrent users, 10-minute sustained load
# Metrics: p95 latency, error rate, throughput
```

### Bước 5.5 — API Documentation (Swagger)

Thêm Swagger UI cho mỗi service:
```
- auth-service: http://localhost:8081/swagger-ui.html
- user-service: http://localhost:8082/swagger-ui.html
- knowledge-service: http://localhost:8083/swagger-ui.html
- metadata-service: http://localhost:8084/swagger-ui.html
- feedback-service: http://localhost:8085/swagger-ui.html
- api-gateway: http://localhost:3000/api/docs
```

---

## VII. TÓM TẮT THỨ TỰ ƯU TIÊN

```
GIAI ĐOẠN 1: TÁI TẠO FEEDBACK SERVICE (0% → 95%)
  Step 1.1:  Tạo cấu trúc thư mục + main class
  Step 1.2:  Tạo 10 Entity classes (ánh xạ schema analytics + conversation)
  Step 1.3:  Tạo 8 Enum classes
  Step 1.4:  Tạo 10 Repository interfaces
  Step 1.5:  Tạo Request/Response DTOs + ApiResponse wrapper
  Step 1.6:  Tạo 5 Service classes
  Step 1.7:  Tạo 5 Controller classes
  Step 1.8:  Tạo 3 RabbitMQ Consumers
  Step 1.9:  Tạo 2 Scheduled Jobs
  Step 1.10: Tạo SecurityConfig + JwtAuthenticationFilter
  Step 1.11: Tạo GlobalExceptionHandler + custom exceptions
  Step 1.12: Cập nhật application.yml
  Step 1.13: Viết Unit Tests

GIAI ĐOẠN 2: API Gateway (90% → 98%)
  Step 2.1: Thêm route /feedback → feedback-service
  Step 2.2: Circuit breaker status endpoint
  Step 2.3: Refresh token proxy route
  Step 2.4: Rate limit config cho feedback
  Step 2.5: Unit tests

GIAI ĐOẠN 3: Frontend (80% → 95%)
  Step 3.1: Thống nhất API client
  Step 3.2: Kết nối analytics endpoints
  Step 3.3: Implement charts (recharts)
  Step 3.4: Tạo 5 custom hooks
  Step 3.5: Error handling nâng cao
  Step 3.6: Responsive improvements

GIAI ĐOẠN 4: Knowledge Service (75% → 95%)
  Step 4.1: Chunk entity (nếu Milvus chưa sẵn sàng)
  Step 4.2: Embedding service thực sự
  Step 4.3: Vector indexing
  Step 4.4: Hoàn thiện pipeline async
  Step 4.5: OpenAPI docs

GIAI ĐOẠN 5: Testing & Integration
  Step 5.1: E2E test flow
  Step 5.2: Integration tests (TestContainers)
  Step 5.3: Docker Compose verification
  Step 5.4: Load testing
  Step 5.5: Swagger docs toàn hệ thống
```

---

## VIII. CÁC VẤN ĐỀ CẦN PHỐI HỢP VỚI TEAM

1. **Vector Search Service (Milvus/Qdrant)** — ai đang setup? Cần IP/endpoint để knowledge-service kết nối.
2. **AI Q&A Service (FastAPI)** — ai đang làm? Cần biết expected API contract để API Gateway proxy đúng.
3. **Embedding Provider** — OpenAI hay self-hosted HuggingFace? Ảnh hưởng EmbeddingService implementation.
4. **Admin mặc định** — ai tạo account Admin đầu tiên? Hiện tại auto-create từ env vars.
5. **Report Export format** — cần xác nhận: CSV + PDF là đủ hay cần thêm XLSX/JSON?
