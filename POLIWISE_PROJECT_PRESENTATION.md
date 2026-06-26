# POLIWISE - Hệ Thống Quản Lý Tri Thức Doanh Nghiệp

## 📋 Mục Lục

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
3. [Docker Stack](#3-docker-stack)
4. [Luồng Request: Frontend → Gateway → Services](#4-luồng-request-frontend--gateway--services)
5. [Các Chức Năng Chính](#5-các-chức-năng-chính)
6. [Chi Tiết Từng Service](#6-chi-tiết-từng-service)
7. [Cơ Sở Dữ Liệu](#7-cơ-sở-dữ-liệu)
8. [Event-Driven Communication](#8-event-driven-communication)
9. [Security & RBAC](#9-security--rbac)
10. [Kết Luận](#10-kết-luận)

---

# 1. Tổng Quan Dự Án

## 1.1 Giới Thiệu

**Poliwise** là một hệ thống **Enterprise Knowledge Management Platform** được xây dựng theo kiến trúc microservices, hỗ trợ:

- 📄 **Quản lý tài liệu** doanh nghiệp (upload, version, phân quyền)
- 🤖 **AI-powered Q&A** - Hỏi đáp thông minh dựa trên tài liệu nội bộ
- 📊 **Analytics & Reporting** - Thống kê sử dụng, báo cáo
- 🔐 **RBAC** - Phân quyền chi tiết theo vai trò

## 1.2 Công Nghệ Sử Dụng

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js | 16.1.6 |
| | React | 19.2.3 |
| | TypeScript | 5.x |
| | Zustand | 5.x (State Management) |
| | Tailwind CSS | 4.x |
| **API Gateway** | NestJS | 11.x |
| **Backend Services** | Spring Boot | 3.4.3 |
| | Java | 17 |
| **AI Services** | Python FastAPI | 0.115+ |
| **Database** | PostgreSQL | 16 |
| | pgvector | (Vector Search) |
| **Message Queue** | RabbitMQ | 3.13 |
| **Cache** | Redis | 7 |
| **Storage** | MinIO | (S3-compatible) |
| **Document Editing** | OnlyOffice | 8.1.0 |

---

# 2. Kiến Trúc Hệ Thống

## 2.1 Tổng Quan Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│                    (Browser / Mobile / Desktop)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Next.js)                                  │
│                              Port: 3000                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Login   │  │   Chat   │  │Documents │  │Analytics │  │  Admin   │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (NestJS)                                │
│                              Port: 3001                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  JWT Auth │ RBAC │ Rate Limit │ Circuit Breaker │ Logging │ TraceID │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│ Spring Boot   │          │ Spring Boot   │          │ Spring Boot   │
│ Services      │          │ Services      │          │ Services      │
│ (Java 17)     │          │ (Java 17)     │          │ (Java 17)     │
└───────────────┘          └───────────────┘          └───────────────┘
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│ auth-service  │          │knowledge-svc  │          │metadata-svc  │
│ (8081)        │          │ (8083)        │          │ (8084)        │
├───────────────┤          ├───────────────┤          ├───────────────┤
│user-service   │          │feedback-svc   │          │               │
│ (8082)        │          │ (8085)        │          │               │
└───────────────┘          └───────────────┘          └───────────────┘
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PYTHON AI SERVICES                                  │
│                              Ports: 8086, 8088                               │
│  ┌────────────────────────┐    ┌────────────────────────┐                   │
│  │   ai-qa-service         │    │  ingestion-service     │                   │
│  │   (8086) - Chat Q&A     │    │  (8088) - Document     │                   │
│  │   - Semantic Search     │    │    Processing          │                   │
│  │   - Streaming Response  │    │  - Text Extraction     │                   │
│  │   - RAG Pipeline        │    │  - Chunking            │                   │
│  └────────────────────────┘    │  - Embedding           │                   │
│                                └────────────────────────┘                   │
│  ┌────────────────────────┐                                                │
│  │   bge-m3-embedding     │                                                │
│  │   (TEI - HuggingFace)  │                                                │
│  │   Port: 80             │                                                │
│  └────────────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │PostgreSQL│  │ RabbitMQ │  │  Redis   │  │  MinIO   │  │OnlyOffice│     │
│  │  :5432   │  │  :5672   │  │  :6379   │  │ :9000    │  │  :8888   │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Directory Structure

```
Poliwise/
├── frontend/web/                    # Next.js Frontend
│   ├── app/                        # App Router Pages
│   │   ├── login/
│   │   ├── register/
│   │   ├── (chat)/
│   │   ├── documents/
│   │   ├── analytics/
│   │   ├── profile/
│   │   └── admin/
│   ├── components/                 # React Components
│   │   ├── chat/                  # Chat components
│   │   ├── ui/                    # Base UI components
│   │   └── documents/             # Document components
│   ├── services/                   # API service clients
│   ├── store/                     # Zustand stores
│   └── types/                     # TypeScript types
│
├── services/
│   ├── api-gateway/               # NestJS API Gateway
│   ├── auth-service/              # Spring Boot Auth
│   ├── user-service/              # Spring Boot User
│   ├── knowledge-service/         # Spring Boot Knowledge
│   ├── metadata-service/          # Spring Boot Metadata
│   ├── feedback-service/          # Spring Boot Analytics
│   ├── ai-qa-service/             # Python FastAPI AI
│   └── ingestion-service/         # Python FastAPI Ingestion
│
├── infrastructure/
│   ├── init-db/                   # SQL initialization
│   └── onlyoffice/                # OnlyOffice configs
│
├── contexts/                      # Architecture docs
├── config/                       # Shared configs
├── docker-compose.yml            # Main compose
└── .env                         # Environment
```

---

# 3. Docker Stack

## 3.1 Services Overview

| Service | Container Name | Port(s) | Image |
|---------|--------------|---------|-------|
| **Infrastructure** ||||
| `postgres` | poliwise-postgres | 5432 | pgvector/pgvector:pg16 |
| `rabbitmq` | poliwise-rabbitmq | 5672, 15672 | rabbitmq:3.13-management-alpine |
| `minio` | poliwise-minio | 9000, 9001 | minio/minio:RELEASE.2024-05-10 |
| `redis` | poliwise-redis | 6379 | redis:7-alpine |
| `onlyoffice` | onlyoffice-ds | 8888, 8443 | onlyoffice/documentserver:8.1.0 |
| `onlyoffice-redis` | onlyoffice-redis | - | redis:7-alpine |
| **Backend Services** ||||
| `api-gateway` | api-gateway | 3001 | Node.js/NestJS |
| `auth-service` | auth-service | 8081 | Spring Boot |
| `user-service` | user-service | 8082 | Spring Boot |
| `knowledge-service` | knowledge-service | 8083 | Spring Boot |
| `metadata-service` | metadata-service | 8084 | Spring Boot |
| `feedback-service` | feedback-service | 8085 | Spring Boot |
| `ai-qa-service` | ai-qa-service | 8086 | Python/FastAPI |
| `ingestion-service` | ingestion-service | 8088 | Python/FastAPI |
| `bge-m3-embedding` | embedding-model | 80 | HuggingFace TEI |
| **Frontend** ||||
| `frontend` | frontend | 3000 | Next.js |

## 3.2 Network Topology

```bash
# All services on shared network
poliwise-network:
  driver: bridge
  ipam:
    config:
      - subnet: 172.20.0.0/16

# Service communication:
# - Frontend → API Gateway (port 3001)
# - API Gateway → Spring Services (ports 8081-8085)
# - API Gateway → Python Services (ports 8086, 8088)
# - Python Services → Database (port 5432)
# - Spring Services → MinIO (port 9000)
# - All services → RabbitMQ (port 5672)
# - All services → Redis (port 6379)
```

## 3.3 Volume Mounts

```yaml
# PostgreSQL - Persistent data
volumes:
  postgres_data: /var/lib/postgresql/data

# MinIO - Document storage
volumes:
  minio_data: /data

# OnlyOffice - License and logs
volumes:
  onlyoffice_data: /var/www/onlyoffice/Data
  onlyoffice_logs: /var/log/onlyoffice

# RabbitMQ - Message persistence
volumes:
  rabbitmq_data: /var/lib/rabbitmq
```

---

# 4. Luồng Request: Frontend → Gateway → Services

## 4.1 Full Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. USER ACTION                                     │
│                    User clicks "Chat" or "Upload Document"                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        2. FRONTEND (Next.js)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ 1. Check auth state (Zustand store)                                     ││
│  │ 2. Get JWT from localStorage                                            ││
│  │ 3. Call API via axios client                                           ││
│  │    POST https://api-gateway:3001/api/v1/ai/chat/stream                   ││
│  │    Headers: Authorization: Bearer <jwt_token>                           ││
│  │    Body: { question: "...", conversationId: "..." }                    ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        3. API GATEWAY (NestJS)                              │
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ TraceID  │───▶│ Logging  │───▶│RateLimit │───▶│   JWT    │              │
│  │Intercep. │    │Intercep. │    │Intercep. │    │  Guard   │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                                │                            │
│                                                ▼                            │
│                                        ┌──────────────┐                     │
│                                        │  Roles Guard │                     │
│                                        │  (RBAC)      │                     │
│                                        └──────────────┘                     │
│                                                                              │
│  Processing:                                                                 │
│  1. Extract & validate JWT token                                            │
│  2. Check user role against endpoint requirements                            │
│  3. Apply rate limits (100/min for USER, 200/min for MANAGER)               │
│  4. Log request with traceId                                                 │
│  5. Forward to downstream service                                            │
│                                                                              │
│  Response headers added:                                                      │
│  - X-User-Id: <user_id>                                                      │
│  - X-Role: <user_role>                                                       │
│  - X-Trace-ID: <trace_id>                                                    │
│  - X-Forwarded-For: <client_ip>                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │ auth-service │ │knowledge-svc │ │ ai-qa-svc   │
          │   (8081)     │ │   (8083)     │ │   (8086)     │
          └──────────────┘ └──────────────┘ └──────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      4. DOWNSTREAM SERVICES                                  │
│                                                                              │
│  Each service:                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 1. Validate X-User-Id header (internal auth)                         │    │
│  │ 2. Apply business logic                                              │    │
│  │ 3. Query PostgreSQL database                                        │    │
│  │ 4. Publish events to RabbitMQ (if needed)                           │    │
│  │ 5. Return response to API Gateway                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        5. RESPONSE FLOW                                     │
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Timeout    │───▶│  Response    │───▶│  Exception   │                  │
│  │  Intercep.   │    │ Transform    │    │   Filter     │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                              │
│  Response normalization:                                                      │
│  {                                                                          │
│    "success": true,                                                         │
│    "data": { ... },                                                         │
│    "message": "Success",                                                    │
│    "timestamp": "2024-01-15T10:30:00Z",                                     │
│    "traceId": "abc123"                                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        6. FRONTEND HANDLING                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 1. Axios interceptor catches response                               │    │
│  │ 2. Check success: true/false                                       │    │
│  │ 3. If 401 → attempt token refresh → retry request                  │    │
│  │ 4. If success → update state (React Query cache)                   │    │
│  │ 5. Display data or error toast                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Specific Flows

### Flow A: Document Upload

```
User clicks Upload
       │
       ▼
Frontend: Select file → POST /api/v1/documents/upload
       │
       ▼
API Gateway: Validate JWT, Check ADMIN role → Forward to knowledge-service
       │
       ▼
knowledge-service:
  1. Save file to MinIO (S3)
  2. Create document record (status: STAGING)
  3. Publish "document.uploaded" event
       │
       ▼
RabbitMQ: Route to ingestion-service
       │
       ▼
ingestion-service:
  1. Extract text from document
  2. Chunk text (overlap)
  3. Generate embeddings via bge-m3-embedding
  4. Store chunks in PostgreSQL (with pgvector)
  5. Update document status → READY
       │
       ▼
Frontend: Show upload success, prompt metadata confirmation
       │
       ▼
User confirms metadata (category, tags, access rules)
       │
       ▼
metadata-service: Create document metadata + access rules
```

### Flow B: AI Chat (RAG Pipeline)

```
User types question
       │
       ▼
Frontend: POST /api/v1/ai/chat/stream (SSE)
       │
       ▼
API Gateway: Validate JWT, Check USER role → Forward to ai-qa-service
       │
       ▼
ai-qa-service:
  1. Extract user context (department, role)
  2. Embed question via bge-m3-embedding
  3. Semantic search in PostgreSQL (pgvector similarity)
  4. Apply access control filters (department, role, user)
  5. Construct prompt with retrieved context
  6. Call LLM (configurable: OpenAI/Anthropic/custom)
  7. Stream response back via SSE
       │
       ▼
Frontend: Render streaming tokens in real-time
       │
       ▼
User can: Copy answer, Provide feedback (like/dislike), Mark unanswered
```

### Flow C: OnlyOffice Collaborative Editing

```
Admin clicks "Edit in OnlyOffice"
       │
       ▼
Frontend: GET /api/v1/documents/{id}/editor-config
       │
       ▼
API Gateway → knowledge-service: Generate OnlyOffice JWT
       │
       ▼
knowledge-service:
  1. Check document lock status
  2. If locked → return conflict error
  3. If not → create lock record
  4. Generate JWT for OnlyOffice (includes permissions)
  5. Return editor config with JWT
       │
       ▼
Frontend: Open OnlyOffice editor iframe with JWT
       │
       ▼
User edits document in browser
       │
       ▼
OnlyOffice: Autosave to knowledge-service (/save-callback)
       │
       ▼
knowledge-service:
  1. Verify OnlyOffice JWT signature
  2. Download new version from OnlyOffice
  3. Upload to MinIO
  4. Create new document version
  5. Publish "document.updated" event
  6. Trigger re-processing (if text changed)
       │
       ▼
Frontend: Show "Document saved" notification
```

---

# 5. Các Chức Năng Chính

## 5.1 Authentication & Authorization

### 5.1.1 Login Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LOGIN SEQUENCE                                    │
│                                                                              │
│   Browser              Frontend           API Gateway       auth-service     │
│      │                    │                   │               │            │
│      │──POST /login──────▶│                   │               │            │
│      │                    │──POST /auth/login─▶│               │            │
│      │                    │                    │──POST /──────▶│            │
│      │                    │                    │               │            │
│      │                    │                    │◀──Tokens──────│            │
│      │                    │◀──{access, refresh}│               │            │
│      │◀──Login Success────│                   │               │            │
│      │                    │                   │               │            │
│      │ Store tokens in localStorage          │               │            │
│      │                    │                   │               │            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.1.2 Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TOKEN REFRESH SEQUENCE                               │
│                                                                              │
│   API Request fails (401)                                                   │
│       │                                                                      │
│       ▼                                                                      │
│   Check: Is refresh token available?                                        │
│       │                                                                      │
│       ├── YES → POST /auth/refresh with refresh_token                       │
│       │         │                                                            │
│       │         ▼                                                            │
│       │    Save new access_token                                            │
│       │         │                                                            │
│       │         ▼                                                            │
│       │    Retry original request with new token                             │
│       │         │                                                            │
│       │         ▼                                                            │
│       │    ✓ Success                                                        │
│       │                                                                      │
│       └── NO  → Redirect to /login                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.1.3 Session Management

- Multiple sessions per user (different devices)
- View active sessions with device/IP/location
- Revoke individual sessions
- "Logout All" for complete session wipeout

## 5.2 Document Management

### 5.2.1 Upload Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DOCUMENT UPLOAD FLOW                                │
│                                                                              │
│  1. User selects file (drag-drop or browse)                                 │
│     Supported: PDF, DOCX, DOC, PPTX, PPT, XLSX, XLS, TXT, MD               │
│                                                                              │
│  2. Frontend validates:                                                     │
│     - File type                                                             │
│     - File size (max 100MB)                                                 │
│     - Filename characters                                                   │
│                                                                              │
│  3. Upload via XHR (for progress tracking)                                 │
│     POST /api/v1/documents/upload                                          │
│     Content-Type: multipart/form-data                                       │
│                                                                              │
│  4. Backend processing (async):                                            │
│     ┌─────────────────────────────────────────────────────────────────┐    │
│     │ Document Status Progression:                                    │    │
│     │                                                                 │    │
│     │ STAGING ──▶ UPLOADED ──▶ PARSING ──▶ PARSED ──▶ CHUNKING     │    │
│     │                                     │                          │    │
│     │                                     ▼                          │    │
│     │                                 CHUNKED ──▶ EMBEDDING ──▶     │    │
│     │                                                   │           │    │
│     │                                                   ▼           │    │
│     │                              EMBEDDED ──▶ INDEXING ──▶ READY  │    │
│     └─────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  5. User confirms metadata:                                                │
│     - Title (pre-filled from filename)                                      │
│     - Category (tree selector)                                             │
│     - Tags (multi-select with create)                                       │
│     - Language (default: Vietnamese)                                       │
│     - Is Policy? (boolean flag)                                             │
│     - Access Rules (ROLE/DEPARTMENT/USER targets)                           │
│                                                                              │
│  6. Document goes LIVE for AI search                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2.2 Version Management

- Every upload creates a new version
- Version history with timestamps and changelogs
- Compare any two versions
- Rollback to previous version (ADMIN only)

### 5.2.3 Collaborative Editing

- OnlyOffice Document Server integration
- Real-time collaborative editing
- Document locking to prevent conflicts
- Automatic version creation on save

## 5.3 AI Q&A System

### 5.3.1 Chat Interface

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHAT INTERFACE LAYOUT                                │
│                                                                              │
│  ┌─────────────────┐  ┌───────────────────────────────────────────────┐    │
│  │ CONVERSATIONS   │  │  CURRENT CONVERSATION                        │    │
│  │                 │  │                                               │    │
│  │ [+] New Chat    │  │  ┌─────────────────────────────────────────┐  │    │
│  │                 │  │  │ User: What is the travel policy?      │  │    │
│  │ Today           │  │  └─────────────────────────────────────────┘  │    │
│  │  • Travel policy│  │                                               │    │
│  │  • Leave request│  │  ┌─────────────────────────────────────────┐  │    │
│  │                 │  │  │ AI: Based on the policy document...    │  │    │
│  │ Yesterday       │  │  │ [Streaming response]                   │  │    │
│  │  • IT request   │  │  └─────────────────────────────────────────┘  │    │
│  │  • Expense claim│  │                                               │    │
│  │                 │  │  ┌─────────────────────────────────────────┐  │    │
│  │ This Week       │  │  │ Sources:                               │  │    │
│  │  • Onboarding   │  │  │ 📄 Policy_2024.pdf (92%)              │  │    │
│  │                 │  │  │ 📄 Travel_Guidelines.pdf (78%)         │  │    │
│  │                 │  │  └─────────────────────────────────────────┘  │    │
│  │                 │  │                                               │    │
│  │                 │  │  ┌─────────────────────────────────────────┐  │    │
│  │                 │  │  │ 👍 👎 Mark Unanswered                   │  │    │
│  │                 │  │  └─────────────────────────────────────────┘  │    │
│  │                 │  │                                               │    │
│  │                 │  │  ┌─────────────────────────────────────────┐  │    │
│  │                 │  │  │ Type your question...          [Send]  │  │    │
│  │                 │  │  └─────────────────────────────────────────┘  │    │
│  └─────────────────┘  └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3.2 RAG Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RAG (Retrieval-Augmented Generation)                     │
│                                                                              │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│  │  Query   │────▶│ Embedding│────▶│  Vector  │────▶│  Filter  │          │
│  │  Input   │     │  (bge-m3)│     │  Search  │     │  (ACL)   │          │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘          │
│                                                           │                  │
│                                                           ▼                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│  │  LLM     │◀────│  Prompt  │◀────│  Context │◀────│  Top-K   │          │
│  │ Response │     │ Builder  │     │Retrieval │     │ Chunks   │          │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘          │
│                                                                              │
│  Access Control Filter:                                                     │
│  - PUBLIC: visible to all authenticated users                               │
│  - DEPARTMENT_ONLY: only users in same department                           │
│  - RESTRICTED: only users meeting specific rules                           │
│                                                                              │
│  Rule Evaluation:                                                           │
│  - ALLOW + ROLE match → Include                                             │
│  - ALLOW + DEPARTMENT match → Include                                       │
│  - ALLOW + USER match → Include                                             │
│  - DENY → Exclude (regardless of other matches)                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5.4 Analytics & Reporting

### 5.4.1 Dashboard Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ANALYTICS DASHBOARD                               │
│                                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │  Total     │  │  Active    │  │  Questions │  │  Unanswered│          │
│  │  Users     │  │  Sessions  │  │  Today     │  │  (Pending) │          │
│  │   1,247    │  │     89     │  │    342     │  │     12     │          │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘          │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           USAGE TRENDS                               │  │
│  │                                                                       │  │
│  │     █                                                               │  │
│  │   █ █   █                                                         │  │
│  │ █ █ █ █ █ █                                                     │  │
│  │ ───────────────────────────────────────────────────────────────  │  │
│  │ Mon   Tue   Wed   Thu   Fri   Sat   Sun                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                   │
│  │   TOP DOCUMENTS         │  │   TOP QUESTIONS        │                   │
│  │   ─────────────         │  │   ─────────────        │                   │
│  │   1. Policy_2024.pdf    │  │   1. Travel policy?    │                   │
│  │   2. Employee_Guide.docx│  │   2. Leave request?    │                   │
│  │   3. IT_Guidelines.pdf   │  │   3. Expense claim?    │                   │
│  └─────────────────────────┘  └─────────────────────────┘                   │
│                                                                              │
│  [📊 Export Report]                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4.2 Report Export

- Formats: CSV, XLSX, PDF, JSON
- Types: Usage reports, Question reports, Feedback reports
- Scheduled exports (daily/weekly/monthly)

## 5.5 Admin Features

### 5.5.1 User Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER MANAGEMENT PANEL                                │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search users...                              [+ Add User] [📤 CSV] │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────┬──────────┬────────────┬────────┬─────────┬─────────────┐    │
│  │ User  │   Email  │  Department│  Role  │ Status  │   Actions   │    │
│  ├───────┼──────────┼────────────┼────────┼─────────┼─────────────┤    │
│  │ john  │john@..   │ Engineering│ MANAGER│ ACTIVE  │ [✏️][🔄][🗑️]│    │
│  │ sarah  │sarah@.. │ Marketing  │ USER   │ ACTIVE  │ [✏️][🔄][🗑️]│    │
│  │ mike  │mike@..   │ Sales      │ USER   │ DEACTIV │ [✏️][🔄][🗑️]│    │
│  │ lisa  │lisa@..   │ HR         │ ADMIN  │ ACTIVE  │ [✏️][🔄][🗑️]│    │
│  └───────┴──────────┴────────────┴────────┴─────────┴─────────────┘    │
│                                                                              │
│  Status Actions:                                                            │
│  - Deactivate → Account disabled, cannot login                            │
│  - Reactivate → Restore deactivated account                                │
│  - Revoke → Permanent ban, all sessions terminated                        │
│                                                                              │
│  Role Assignment:                                                           │
│  - USER: Basic access                                                       │
│  - MANAGER: + Analytics, Reports                                            │
│  - ADMIN: Full access                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.5.2 Department Management

- Hierarchical tree structure
- Drag-drop reorganization
- Assign users to departments
- Department-level statistics

### 5.5.3 Audit Logs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AUDIT LOGS                                        │
│                                                                              │
│  Filter by: [Action ▼] [User ▼] [Date Range ▼] [Search ▼]                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  ▼ Authentication (24 entries)                                            │    │
│    • john.doe logged in from 192.168.1.100 at 2024-01-15 09:30            │
│    • john.doe logged out at 2024-01-15 17:45                              │
│    • mike.smith failed login attempt (wrong password) at 2024-01-15 10:12 │
│  ▼ Document Operations (18 entries)                                       │    │
│    • admin uploaded "Policy_2024.pdf" at 2024-01-15 11:00                │
│    • john.doe downloaded "Employee_Guide.docx" at 2024-01-15 14:30        │
│  ▼ AI Chat (156 entries)                                                   │    │
│    • sarah.jones asked "What is the leave policy?" at 2024-01-15 15:00    │
│    • john.doe marked answer as unhelpful at 2024-01-15 15:05               │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 6. Chi Tiết Từng Service

## 6.1 API Gateway (Port 3001)

### Responsibilities
- **Single Entry Point**: All frontend requests go through here
- **JWT Validation**: Verify and decode access tokens
- **RBAC Enforcement**: Check user roles against endpoint requirements
- **Rate Limiting**: Redis-backed per-user/per-IP limits
- **Circuit Breaker**: Opossum for resilience against downstream failures
- **Request Logging**: Every request logged with trace ID
- **Response Normalization**: Consistent API response format

### Key Components

```
src/
├── auth/
│   ├── auth-proxy.controller.ts    # Auth endpoint proxies
│   ├── strategies/jwt.strategy.ts  # Passport JWT strategy
│   └── services/jwt-auth.service.ts # Token verification
├── proxy/
│   ├── proxy.controller.ts         # All route proxies
│   └── proxy.service.ts            # Axios forwarding + circuit breakers
├── health/
│   ├── health.controller.ts        # Health/readiness endpoints
│   └── indicators/                 # Per-service health checks
└── common/
    ├── guards/
    │   ├── jwt-auth.guard.ts       # JWT validation
    │   └── rbac.guard.ts          # Role-based access
    ├── interceptors/
    │   ├── trace-id.interceptor.ts # Trace ID propagation
    │   ├── logging.interceptor.ts  # Request logging
    │   ├── rate-limit.interceptor.ts # Rate limiting
    │   ├── timeout.interceptor.ts  # Request timeout
    │   └── response-transform...   # Response normalization
    └── filters/
        └── http-exception.filter.ts # Error handling
```

### Rate Limits

| Role | Limit | Window |
|------|-------|--------|
| Anonymous | 20 req | 60s |
| USER | 100 req | 60s |
| MANAGER | 200 req | 60s |
| ADMIN | 500 req | 60s |

### Circuit Breaker Config

- **Timeout**: 30s (configurable per service)
- **Error Threshold**: 50%
- **Volume Threshold**: 10 requests before evaluation
- **States**: CLOSED → OPEN → HALF_OPEN → CLOSED

## 6.2 Auth Service (Port 8081)

### Database Schema: `core`

### Entities
- **User**: username, email, password_hash, role, status, department_id
- **RefreshToken**: token, user_id, device, ip, expires_at
- **AccessTokenBlacklist**: jti, expires_at
- **LoginHistory**: user_id, action, device, ip, location, timestamp

### Endpoints
```
POST /api/v1/auth/login          - Login (public)
POST /api/v1/auth/register       - Register (ADMIN)
POST /api/v1/auth/refresh        - Refresh token (public)
POST /api/v1/auth/logout         - Logout
POST /api/v1/auth/logout-all     - Logout all devices
GET  /api/v1/auth/sessions       - List active sessions
POST /api/v1/auth/forgot-password - Password recovery
POST /api/v1/auth/send-otp       - Send OTP
POST /api/v1/auth/verify-otp     - Verify OTP
POST /api/v1/auth/reset-password - Reset with OTP
POST /api/v1/auth/change-password - Change password
GET  /api/v1/auth/me             - Current user
```

### Events Published
- `user.registered`
- `user.status.changed`
- `user.login.success/failed`
- `user.logout`

## 6.3 User Service (Port 8082)

### Database Schema: `core`

### Entities
- **UserProfile**: user_id, full_name, phone, position, avatar_url, bio
- **Department**: id, name, parent_id, path (for hierarchy)

### Endpoints
```
GET  /api/v1/users/me            - Get own profile
PUT  /api/v1/users/me            - Update own profile
GET  /api/v1/users               - Search users (ADMIN/MANAGER)
GET  /api/v1/users/{id}          - Get user detail
PUT  /api/v1/users/{id}          - Update user (ADMIN)
POST /api/v1/users/{id}/deactivate - Deactivate (ADMIN)
POST /api/v1/users/{id}/reactivate  - Reactivate (ADMIN)
POST /api/v1/users/{id}/revoke      - Revoke (ADMIN)

GET  /api/v1/departments        - List departments
GET  /api/v1/departments/tree    - Department tree
POST /api/v1/departments         - Create department (ADMIN)
PUT  /api/v1/departments/{id}    - Update department (ADMIN)
DELETE /api/v1/departments/{id}  - Delete department (ADMIN)
```

## 6.4 Knowledge Service (Port 8083)

### Database Schema: `knowledge`

### Entities
- **Document**: id, title, filename, minio_path, status, version_count
- **DocumentVersion**: document_id, version, changelog, minio_path, size
- **ProcessingJob**: document_id, status, step, error_message
- **DocumentLock**: document_id, user_id, locked_at, expires_at

### Document Status Progression
```
STAGING → UPLOADED → PARSING → PARSED → CHUNKING → CHUNKED → 
EMBEDDING → EMBEDDED → INDEXING → INDEXED → READY
     ↓
   FAILED
```

### Endpoints
```
POST /api/v1/documents/upload       - Upload document (ADMIN)
GET  /api/v1/documents             - List documents
GET  /api/v1/documents/{id}        - Get document detail
GET  /api/v1/documents/{id}/download - Download
DELETE /api/v1/documents/{id}       - Soft delete (ADMIN)
POST /api/v1/documents/{id}/process - Trigger processing
POST /api/v1/documents/{id}/confirm - Confirm metadata (ADMIN)

GET  /api/v1/documents/{id}/versions       - Version history
POST /api/v1/documents/{id}/versions       - New version (ADMIN)

GET  /api/v1/documents/{id}/lock           - Check lock
GET  /api/v1/documents/{id}/editor-config  - OnlyOffice config
POST /api/v1/documents/{id}/save-callback  - OnlyOffice save hook
```

### Events Published
- `document.uploaded`
- `document.deleted`
- `ingestion.requested`

## 6.5 Metadata Service (Port 8084)

### Database Schema: `metadata`

### Entities
- **DocumentMetadata**: document_id, title, description, category_id, language, is_policy
- **Category**: id, name, slug, parent_id, path
- **Tag**: id, name, color, icon, usage_count
- **DocumentTag**: document_id, tag_id
- **DocumentAccessRule**: document_id, target_type, target_id, permission

### Access Rule Model
```typescript
{
  documentId: "doc-123",
  rules: [
    { type: "ROLE", target: "ADMIN", permission: "VIEW" },      // Admins can view
    { type: "ROLE", target: "USER", permission: "VIEW" },       // All users can view
    { type: "DEPARTMENT", target: "dept-hr", permission: "VIEW" }, // HR can view
    { type: "USER", target: "john-doe", permission: "EDIT" },  // John can edit
    { type: "ROLE", target: "USER", permission: "DENY" }        // But not this doc
  ]
}
```

### Endpoints
```
GET  /api/v1/categories/active      - List active categories
GET  /api/v1/categories/tree       - Category tree
POST /api/v1/categories            - Create category (ADMIN)
PUT  /api/v1/categories/{id}       - Update category (ADMIN)

GET  /api/v1/tags                  - List tags
GET  /api/v1/tags/popular          - Popular tags
POST /api/v1/tags                  - Create tag (ADMIN)
PUT  /api/v1/tags/{id}             - Update tag (ADMIN)

POST /api/v1/metadata              - Create metadata (ADMIN)
GET  /api/v1/metadata/document/{docId} - Get by document
PUT  /api/v1/metadata/{id}        - Update (ADMIN)
POST /api/v1/metadata/{id}/publish - Publish (ADMIN)
POST /api/v1/metadata/{id}/archive - Archive (ADMIN)

POST /api/v1/metadata/{id}/rules   - Add access rule (ADMIN)
GET  /api/v1/metadata/{id}/rules   - Get rules
DELETE /api/v1/metadata/rules/{id} - Delete rule (ADMIN)
```

## 6.6 Feedback Service (Port 8085)

### Database Schema: `analytics`

### Entities
- **Feedback**: conversation_id, message_id, type (LIKE/DISLIKE), comment
- **AuditLog**: user_id, action, resource, resource_id, metadata, timestamp
- **UsageStat**: date, endpoint, count, avg_response_time
- **UnansweredQuestion**: question, conversation_id, status (PENDING/RESOLVED/REJECTED)
- **ReportExport**: type, format, parameters, status, file_path

### Endpoints
```
POST /api/v1/feedback              - Submit feedback
GET  /api/v1/feedback/conversation/{id} - Get conversation feedback

GET  /api/v1/dashboard/overview   - Dashboard stats (MANAGER+)
GET  /api/v1/dashboard/trends      - Usage trends (MANAGER+)
GET  /api/v1/dashboard/unanswered  - Unanswered questions (MANAGER+)
PUT  /api/v1/dashboard/unanswered/{id}/resolve - Mark resolved
PUT  /api/v1/dashboard/unanswered/{id}/reject - Reject

GET  /api/v1/analytics/usage       - Usage analytics (MANAGER+)
GET  /api/v1/analytics/audit-logs  - Audit logs (ADMIN)

POST /api/v1/reports               - Generate report (MANAGER+)
GET  /api/v1/reports               - List reports (MANAGER+)
GET  /api/v1/reports/{id}/download - Download report
```

## 6.7 AI QA Service (Port 8086)

### Technology: Python FastAPI

### Endpoints
```
POST /api/v1/ai/chat               - Non-streaming chat
POST /api/v1/ai/chat/stream        - Streaming chat (SSE)
GET  /api/v1/ai/conversations      - List conversations
GET  /api/v1/ai/conversations/{id} - Get conversation
DELETE /api/v1/ai/conversations/{id} - Delete conversation
POST /api/v1/ai/conversations/{id}/messages/{msgId}/unanswered - Mark unanswered
```

### RAG Implementation
1. **Embedding**: Question embedded via bge-m3-embedding (port 80)
2. **Vector Search**: pgvector similarity search with HNSW index
3. **Access Control**: Filter chunks by user's role/department
4. **Context Window**: Top-K relevant chunks (configurable)
5. **Prompt Engineering**: System prompt + context + question
6. **LLM Call**: Configurable provider (OpenAI/Anthropic/custom)
7. **Response Streaming**: Server-Sent Events for real-time tokens

## 6.8 Ingestion Service (Port 8088)

### Technology: Python FastAPI

### Endpoints
```
POST /api/v1/ingest                - Start ingestion job
GET  /api/v1/ingest/{jobId}/status - Check job status
POST /api/v1/ingest/{docId}/reindex - Reindex document
```

### Processing Pipeline
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INGESTION PIPELINE                                │
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Download │───▶│  Extract │───▶│  Chunk   │───▶│  Embed   │              │
│  │  from    │    │   Text   │    │  Text    │    │  Chunks  │              │
│  │  MinIO   │    │          │    │          │    │          │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                                                              │              │
│                                                              ▼              │
│                                                         ┌──────────┐       │
│                                                         │  Store  │       │
│                                                         │  in PG  │       │
│                                                         └──────────┘       │
│                                                                              │
│  Chunking Strategy:                                                          │
│  - Chunk size: 500 tokens (configurable)                                    │
│  - Overlap: 50 tokens                                                        │
│  - Preserve semantic boundaries                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 7. Cơ Sở Dữ Liệu

## 7.1 Database Overview

**PostgreSQL 16 with pgvector extension**

| Schema | Service | Description |
|--------|---------|-------------|
| `core` | auth-service, user-service | Users, departments, auth data |
| `knowledge` | knowledge-service, ingestion-service | Documents, chunks, embeddings |
| `metadata` | metadata-service | Categories, tags, access rules |
| `analytics` | feedback-service | Feedback, audit logs, reports |

## 7.2 Key Tables

### core.users
```sql
CREATE TABLE core.users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL, -- USER, MANAGER, ADMIN
  status VARCHAR(20) NOT NULL, -- ACTIVE, DEACTIVATED, REVOKED
  department_id UUID,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  password_changed_at TIMESTAMP,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### knowledge.chunks (Critical for AI)
```sql
CREATE TABLE knowledge.chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  version INT NOT NULL,
  content TEXT NOT NULL,
  content_tsv TSVECTOR, -- For full-text search
  embedding VECTOR(1024), -- bge-m3 dimension
  chunk_index INT NOT NULL,
  -- Flattened ACL fields (denormalized for fast filtering)
  allowed_roles TEXT[] DEFAULT '{}',
  allowed_departments TEXT[] DEFAULT '{}',
  allowed_users TEXT[] DEFAULT '{}',
  access_level VARCHAR(20) NOT NULL, -- PUBLIC, DEPARTMENT_ONLY, RESTRICTED
  created_at TIMESTAMP DEFAULT now()
);

-- Vector index for semantic search
CREATE INDEX idx_chunks_embedding ON knowledge.chunks 
  USING hnsw (embedding vector_cosine_ops);

-- Full-text search index
CREATE INDEX idx_chunks_tsv ON knowledge.chunks USING gin(content_tsv);
```

### metadata.document_access_rules
```sql
CREATE TABLE metadata.document_access_rules (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  target_type VARCHAR(20) NOT NULL, -- ROLE, DEPARTMENT, USER
  target_id VARCHAR(255) NOT NULL, -- role_name, dept_id, user_id
  permission VARCHAR(20) NOT NULL, -- VIEW, EDIT, MANAGE, DENY
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(document_id, target_type, target_id)
);
```

## 7.3 Database Initialization

SQL scripts in `infrastructure/init-db/`:

| Script | Purpose |
|--------|---------|
| `000_bootstrap.sql` | Extension enablement (pgvector, uuid-ossp) |
| `001_core.sql` | Users, departments, login history |
| `002_metadata.sql` | Categories, tags, access rules |
| `003_knowledge.sql` | Documents, versions, chunks |
| `004_conversation.sql` | AI conversations, messages |
| `005_analytics.sql` | Feedback, audit logs, aggregates |
| `006_functions_triggers.sql` | Auto-update timestamps, triggers |
| `007_seed_data.sql` | Default admin user |
| `008_ai_indexes.sql` | Vector search indexes |
| `009_document_locks.sql` | OnlyOffice lock management |

---

# 8. Event-Driven Communication

## 8.1 RabbitMQ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RABBITMQ TOPOLOGY                                  │
│                                                                              │
│                           poliwise.events                                    │
│                          (Topic Exchange)                                    │
│                                  │                                          │
│        ┌─────────────┬───────────┼───────────┬─────────────┐                │
│        │             │           │           │             │                │
│        ▼             ▼           ▼           ▼             ▼                │
│   user.*      document.*   ingestion.*  metadata.*   unanswered.*          │
│        │             │           │           │             │                │
│        ▼             ▼           ▼           ▼             ▼                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │auth-svc  │ │knowledge │ │ingestion │ │metadata  │ │feedback  │         │
│  │user-svc  │ │-service  │ │-service  │ │-service  │ │-service  │         │
│  │ai-qa-svc │ │ai-qa-svc │ │ai-qa-svc │ │knowledge │ │          │         │
│  │feedback  │ │feedback  │ │metadata  │ │-service  │ │          │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.2 Event Definitions

### User Events
| Event | Routing Key | Payload | Published By | Consumed By |
|-------|-------------|---------|--------------|-------------|
| User Registered | `user.registered` | `{userId, email, role}` | auth-service | user-service |
| User Status Changed | `user.status.changed` | `{userId, oldStatus, newStatus}` | auth-service, user-service | auth-service, user-service |
| User Revoked | `user.revoked` | `{userId}` | user-service | All services |

### Document Events
| Event | Routing Key | Payload | Published By | Consumed By |
|-------|-------------|---------|--------------|-------------|
| Document Uploaded | `document.uploaded` | `{documentId, filename, uploaderId}` | knowledge-service | metadata-service, ai-qa-service, feedback-service |
| Document Deleted | `document.deleted` | `{documentId}` | knowledge-service | metadata-service, ai-qa-service, feedback-service |
| Ingestion Requested | `ingestion.requested` | `{documentId, versionId}` | knowledge-service | ingestion-service |

### Analytics Events
| Event | Routing Key | Payload | Published By | Consumed By |
|-------|-------------|---------|--------------|-------------|
| Unanswered Question | `unanswered.question` | `{question, conversationId, userId}` | ai-qa-service | feedback-service |

## 8.3 Event Flow Examples

### User Registration Flow
```
auth-service receives registration request
        │
        ▼
Create user in database
        │
        ▼
Publish "user.registered" event
        │
        ▼
user-service receives event
        │
        ▼
Create user profile in public schema
```

### Document Upload Flow
```
User uploads document via knowledge-service
        │
        ▼
knowledge-service:
  1. Save file to MinIO
  2. Create document record
  3. Publish "document.uploaded"
        │
        ▼
ingestion-service receives event
        │
        ▼
Extract text, chunk, embed
        │
        ▼
Publish "document.processed" (optional)
        │
        ▼
ai-qa-service receives "document.uploaded"
        │
        ▼
Index document for search
```

---

# 9. Security & RBAC

## 9.1 Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROLE HIERARCHY                                     │
│                                                                              │
│                              ADMIN (3)                                        │
│                    ┌─────────────────────────┐                               │
│                    │ Full system access      │                               │
│                    │ • User management       │                               │
│                    │ • Document upload      │                               │
│                    │ • Metadata management  │                               │
│                    │ • Audit logs           │                               │
│                    │ • System settings      │                               │
│                    └───────────┬─────────────┘                               │
│                                │                                             │
│                              MANAGER (2)                                     │
│                    ┌─────────────────────────┐                               │
│                    │ • Analytics dashboard   │                               │
│                    │ • Report export         │                               │
│                    │ • View unanswered Qs    │                               │
│                    │ • Resolve questions     │                               │
│                    └───────────┬─────────────┘                               │
│                                │                                             │
│                               USER (1)                                       │
│                    ┌─────────────────────────┐                               │
│                    │ • AI Q&A chat          │                               │
│                    │ • View documents       │                               │
│                    │ • Own profile          │                               │
│                    │ • Submit feedback      │                               │
│                    └─────────────────────────┘                               │
│                                                                              │
│   Role levels: ADMIN >= MANAGER >= USER                                     │
│   Access granted if: userRole >= requiredRole                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.2 Permission Matrix

| Feature | USER | MANAGER | ADMIN |
|---------|------|---------|-------|
| **Authentication** ||||
| Login/Logout | ✓ | ✓ | ✓ |
| Multi-session | ✓ | ✓ | ✓ |
| **AI Q&A** ||||
| Chat with AI | ✓ | ✓ | ✓ |
| View conversation history | ✓ | ✓ | ✓ |
| Delete conversation | ✓ | ✓ | ✓ |
| Submit feedback | ✓ | ✓ | ✓ |
| **Documents** ||||
| View documents | ✓ | ✓ | ✓ |
| Download documents | ✓ | ✓ | ✓ |
| Upload documents | ✗ | ✗ | ✓ |
| Delete documents | ✗ | ✗ | ✓ |
| Manage document metadata | ✗ | ✗ | ✓ |
| **Analytics** ||||
| View personal usage | ✓ | ✓ | ✓ |
| View dashboard | ✗ | ✓ | ✓ |
| Export reports | ✗ | ✓ | ✓ |
| View audit logs | ✗ | ✗ | ✓ |
| **Administration** ||||
| Manage users | ✗ | ✗ | ✓ |
| Manage departments | ✗ | ✗ | ✓ |
| Manage categories/tags | ✗ | ✗ | ✓ |
| System settings | ✗ | ✗ | ✓ |

## 9.3 Access Control Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ACCESS CONTROL CHECK                                   │
│                                                                              │
│   Request: User "john" (DEPARTMENT: Engineering, ROLE: USER)              │
│             wants to search documents                                        │
│                                                                              │
│   Step 1: Query chunks with semantic search                                  │
│           ↓                                                                  │
│   Step 2: Filter by access rules:                                          │
│           ┌─────────────────────────────────────────────────────────────┐   │
│           │ For each chunk:                                             │   │
│           │                                                              │   │
│           │  IF access_level = 'PUBLIC'                                 │   │
│           │    THEN ✓ Include                                           │   │
│           │                                                              │   │
│           │  IF access_level = 'DEPARTMENT_ONLY'                        │   │
│           │    IF user.department IN chunk.allowed_departments           │   │
│           │      THEN ✓ Include                                         │   │
│           │    ELSE ✗ Exclude                                           │   │
│           │                                                              │   │
│           │  IF access_level = 'RESTRICTED'                            │   │
│           │    Check rules:                                              │   │
│           │      FOR EACH rule WHERE permission = 'DENY'                │   │
│           │        IF rule matches user                                  │   │
│           │          THEN ✗ Exclude (DENY wins)                        │   │
│           │                                                              │   │
│           │      FOR EACH rule WHERE permission = 'VIEW'/'EDIT'          │   │
│           │        IF rule matches user                                  │   │
│           │          THEN ✓ Include                                     │   │
│           └─────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Result: Only accessible chunks returned                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.4 Security Headers & CORS

### API Gateway Configuration
```typescript
// CORS
{
  origin: process.env.FRONTEND_ORIGIN, // e.g., http://localhost:3000
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-ID']
}

// Security Headers (Helmet)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- Content-Security-Policy: default-src 'self'
```

---

# 10. Kết Luận

## 10.1 Architecture Strengths

1. **Scalability**: Microservices allow independent scaling
2. **Resilience**: Circuit breakers prevent cascade failures
3. **Security**: JWT + RBAC + rate limiting + audit logging
4. **Observability**: Trace IDs enable end-to-end request tracking
5. **Event-Driven**: Loose coupling via RabbitMQ
6. **Vector Search**: pgvector enables semantic document search
7. **Collaboration**: OnlyOffice integration for real-time editing

## 10.2 Technology Decisions

| Decision | Rationale |
|-----------|-----------|
| NestJS Gateway | TypeScript end-to-end, familiar patterns |
| Spring Boot Services | Enterprise Java, robust ecosystem |
| FastAPI for AI | Python ML ecosystem, async native |
| PostgreSQL + pgvector | Single DB, vector search without separate vector DB |
| RabbitMQ | Mature, reliable message broker |
| MinIO | S3-compatible, no vendor lock-in |

## 10.3 Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT TOPOLOGY                                 │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        LOAD BALANCER                                 │   │
│   │                      (nginx / cloud LB)                              │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                    │                    │                    │                │
│                    ▼                    ▼                    ▼                │
│            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐        │
│            │  Frontend    │    │  Frontend    │    │  Frontend    │        │
│            │  (Next.js)   │    │  (Next.js)   │    │  (Next.js)   │        │
│            │  Node 1      │    │  Node 2      │    │  Node 3      │        │
│            └──────────────┘    └──────────────┘    └──────────────┘        │
│                    │                    │                    │                │
│                    └────────────────────┼────────────────────┘                │
│                                         │                                     │
│                                         ▼                                     │
│            ┌──────────────────────────────────────────────────────┐         │
│            │                    API GATEWAY                         │         │
│            │                 (NestJS - scaled)                     │         │
│            │   • JWT Auth • RBAC • Rate Limit • Circuit Breaker   │         │
│            └──────────────────────────────────────────────────────┘         │
│                    │           │           │           │           │        │
│                    ▼           ▼           ▼           ▼           ▼        │
│            ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│            │ Auth │ │ User │ │Knowledge│ │Meta  │ │Feedback│ │ AI   │         │
│            │ :8081│ │ :8082│ │ :8083  │ │ :8084│ │ :8085 │ │ :8086│         │
│            └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘         │
│                 │                            │           │                 │
│                 │          ┌─────────────────┘           │                 │
│                 │          │                             │                 │
│                 ▼          ▼                             ▼                 │
│            ┌────────┐  ┌────────┐                   ┌────────┐            │
│            │Postgres│  │ MinIO  │                   │Embedding│            │
│            │ :5432  │  │ :9000  │                   │  :80   │            │
│            └────────┘  └────────┘                   └────────┘            │
│                 │                                                             │
│                 ▼                                                             │
│            ┌────────┐ ┌────────┐ ┌────────┐                                  │
│            │RabbitMQ│ │ Redis  │ │Ingestion│                                  │
│            │ :5672  │ │ :6379  │ │ :8088  │                                  │
│            └────────┘ └────────┘ └────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.4 Quick Reference - Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | All | PostgreSQL connection string |
| `RABBITMQ_URL` | All | RabbitMQ AMQP URL |
| `REDIS_URL` | All | Redis connection string |
| `MINIO_ENDPOINT` | knowledge | MinIO host |
| `MINIO_ACCESS_KEY` | knowledge | MinIO credentials |
| `JWT_SECRET` | auth, gateway | JWT signing secret (min 32 chars) |
| `FRONTEND_ORIGIN` | auth, gateway | CORS allowed origin |
| `OPENAI_API_KEY` | ai-qa | LLM API key |
| `EMBEDDING_URL` | ai-qa, ingestion | BGE-M3 TEI endpoint |

---

## 📞 Liên Hệ & Hỗ Trợ

**Poliwise** - Enterprise Knowledge Management Platform

- **Documentation**: `/docs/`
- **API Spec**: `/services/api-gateway/swagger-ui`
- **Health Check**: `GET /health`

---

*Document generated: 2024*
*Version: 1.0.0*
