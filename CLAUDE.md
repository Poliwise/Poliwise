# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Repository Shape

Poliwise is a multi-service repository with three main areas:

- `frontend/web`: Next.js 16 App Router frontend.
- `services/api-gateway`: NestJS API gateway intended to be the single entry point for clients.
- `services/*-service`: Spring Boot 3 / Java 17 microservices, each owning its own data model.
- `docs/`: product and architecture notes.
- `infrastructure/init-db/`: SQL initialization scripts for PostgreSQL schemas.
- `config/`: Centralized configuration files (RabbitMQ env).

---

## Repository Root

```
C:\Poliwise\
├── config/
│   └── rabbitmq.env
├── docs/
│   ├── func_per_services.md
│   ├── db_per_services.md
│   └── allow_per_role.md
├── frontend/
│   └── web/                   # Next.js 16 App Router frontend
├── infrastructure/
│   └── init-db/               # SQL schema init scripts per service
├── services/
│   ├── api-gateway/           # NestJS API Gateway
│   ├── auth-service/          # Spring Boot Auth Service (port 8081)
│   ├── user-service/          # Spring Boot User Service (port 8082)
│   ├── knowledge-service/     # Spring Boot Knowledge Service (port 8083)
│   ├── metadata-service/      # Spring Boot Metadata Service (port 8084)
│   └── feedback-service/      # Spring Boot Feedback Service (port 8085)
├── docker-compose.yml         # Full-stack orchestration
├── .env files per service
├── README.md
├── codebase-map.html
└── CLAUDE.md (this file)
```

---

## Common Commands

### Frontend (`frontend/web`)

- Install deps: `cd frontend/web && pnpm install`
- Start dev server: `cd frontend/web && pnpm dev`
- Build: `cd frontend/web && pnpm build`
- Start production server: `cd frontend/web && pnpm start`
- Lint: `cd frontend/web && pnpm lint`

### API gateway (`services/api-gateway`)

- Install deps: `cd services/api-gateway && pnpm install`
- Start in watch mode: `cd services/api-gateway && pnpm run start:dev`
- Start once: `cd services/api-gateway && pnpm run start`
- Build: `cd services/api-gateway && pnpm run build`
- Lint: `cd services/api-gateway && pnpm run lint`
- Run tests: `cd services/api-gateway && pnpm test`
- Run e2e tests: `cd services/api-gateway && pnpm run test:e2e`

### Spring Boot services

Use the Maven wrapper from each service directory.

- Run locally: `cd services/<service-name> && ./mvnw spring-boot:run`
- Build jar: `cd services/<service-name> && ./mvnw package`
- Run tests: `cd services/<service-name> && ./mvnw test`
- Run a single test class: `cd services/<service-name> && ./mvnw -Dtest=ClassName test`
- Run a single test method: `cd services/<service-name> && ./mvnw -Dtest=ClassName#methodName test`

---

## Architecture Overview

### Frontend (`frontend/web`)

Next.js 16 App Router application. Structure:

```
frontend/web/
├── app/                        # App Router pages
│   ├── layout.tsx              # Root layout
│   ├── page.tsx               # Home (AI Chat Q&A)
│   ├── globals.css
│   ├── login/                 # Login page
│   ├── documents/             # Document management
│   ├── profile/               # User profile
│   ├── analytics/             # Analytics dashboard (Manager/Admin)
│   └── admin/users/           # User management (Admin)
├── components/
│   ├── layout/                # MainLayout, Header, Sidebar
│   ├── ui/loading/            # LoadingScreen component
│   └── common/
├── services/                  # API client layer
│   ├── api-client.ts          # Axios instance with interceptors
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── ai.service.ts
│   ├── analytics.service.ts
│   └── ...
├── store/                     # Zustand state management
│   ├── auth-store.ts
│   └── ui-store.ts
├── interfaces/                # TypeScript interfaces & enums
├── types/                     # Global type definitions
│   ├── auth.ts
│   ├── ai.ts
│   └── ...
├── hooks/
├── utils/
├── lib/
├── constants/
├── public/
├── .env.local                 # NEXT_PUBLIC_API_URL=http://localhost:3001
├── package.json               # next 16.1.6, react 19.2.3, tailwindcss v4, zustand, axios
└── pnpm-lock.yaml
```

### API Gateway (`services/api-gateway`)

NestJS 11 service. Single entry point for all clients. Responsibilities:

- JWT validation (passport-jwt, jsonwebtoken)
- RBAC enforcement (guards + decorators)
- Rate limiting (NestJS Throttler, per-role limits)
- Circuit breaker (Opossum for downstream service resilience)
- Request proxying/routing to downstream microservices
- Trace ID generation and propagation
- Response normalization (ApiResponseDto)
- CORS handling, Helmet security headers
- Structured logging (Winston, nest-winston)
- Global exception filtering
- Health check endpoints (health indicators per downstream service)

```
services/api-gateway/src/
├── main.ts
├── app.module.ts
├── config/configuration.ts        # JWT secret, CORS, downstream service URLs
├── auth/                           # Auth proxy + JWT strategy
│   ├── auth-proxy.controller.ts
│   ├── strategies/jwt.strategy.ts
│   └── services/jwt-auth.service.ts
├── proxy/                          # General proxy for downstream services
│   ├── proxy.controller.ts
│   └── proxy.service.ts
├── health/                         # Health checks per service
│   ├── health.controller.ts
│   └── indicators/services.indicator.ts
├── logging/
│   └── winston.config.ts
└── common/
    ├── decorators/               # @Roles(), @Public(), @CurrentUser()
    ├── guards/                   # JwtAuthGuard, RbacGuard
    ├── filters/                  # HttpExceptionFilter
    ├── interceptors/             # Logging, TraceId, ResponseTransform, RateLimit, Timeout
    └── dto/                      # ApiResponseDto, ErrorResponseDto
```

### Spring Microservices

All Java services use the same broad pattern:
- Spring Boot 3.3–3.4 + Java 17
- JPA entities and repositories per service
- PostgreSQL driver
- Spring Security, validation, OpenFeign, RabbitMQ, actuator
- Package layout: `config`, `controller`, `dto`, `entity`, `enums`, `exception`, `mapper`, `repository`, `service`

#### `auth-service` (port 8081) — `poliwise_auth` DB

- Authentication: login, register, logout, logout-all-devices
- JWT lifecycle: access tokens (15min), refresh tokens (7 days)
- Login history tracking
- Token blacklist for revocation
- Auto-creates default Admin account on startup (`AdminInitializer`)
- Key entity: `User` (with `UserRole` enum: USER/MANAGER/ADMIN, `AccountStatus`: ACTIVE/DEACTIVATED/REVOKED)
- Publishes events via RabbitMQ (e.g., `User.status.changed`, `User.revoked`)

#### `user-service` (port 8082) — `poliwise_user` DB

- User profile and department management
- Account state workflows (status changes)
- Publishes `User.status.changed` and `User.revoked` events
- Controllers still largely placeholders; entities and repositories are defined
- Key entities: `User`, `UserProfile`, `Department`

#### `knowledge-service` (port 8083) — `poliwise_knowledge` DB

- Physical document lifecycle and processing pipeline
- Document upload, parsing, chunking, embedding
- Processing job tracking (ETL pipeline)
- Document versioning
- Key entities: `Document`, `DocumentVersion`, `ProcessingJob`
- Enums: `ProcessingStatus` (UPLOADED, PARSING, CHUNKING, EMBEDDING, COMPLETED, FAILED), `FileType`, `ChunkingStrategy`, `EmbeddingModel`

#### `metadata-service` (port 8084) — `poliwise_metadata` DB

- Document metadata management
- Categories, tags, access rules
- Document lifecycle status (DRAFT, PUBLISHED, ARCHIVED, EXPIRED)
- Access control rules per document
- Key entities: `DocumentMetadata`, `DocumentAccessRule`, `Tag`, `Category`, `DocumentTag`

#### `feedback-service` (port 8085) — `poliwise_analytics` DB

- User feedback (like/dislike)
- Usage statistics and aggregates (hourly, daily)
- Audit logs
- Popular questions tracking
- Document popularity metrics
- Report export tracking
- Unanswered question registry
- Key entities: `Feedback`, `UsageStat`, `AuditLog`, `DailyAggregate`, `HourlyAggregate`, `DepartmentDailyStat`, `PopularQuestion`, `DocumentPopularity`, `ReportExport`, `UnansweredQuestion`

---

## Intended Domain Boundaries

Strong database ownership per service:

| Schema | Owner | Purpose |
|--------|-------|---------|
| `poliwise_auth` | auth-service | Authentication, JWT, login history, RBAC state |
| `poliwise_user` | user-service | User profile, department, account state |
| `poliwise_knowledge` | knowledge-service | Documents, versions, chunks, processing jobs |
| `poliwise_metadata` | metadata-service | Document metadata, categories, tags, access rules |
| `poliwise_analytics` | feedback-service | Feedback, usage stats, aggregates, audit logs |

---

## Event-Driven Integration

RabbitMQ-based integration between services. Core events:

- `User.status.changed` — User account status transitions
- `User.revoked` — Account revocation (triggers cleanup across services)
- `Document.uploaded` — New document available
- `Document.deleted` — Document removed
- `Unanswered.question` — AI couldn't answer, routed to feedback

All Java services include Spring AMQP (RabbitMQ) dependencies. Config for external RabbitMQ (CloudAMQP) lives in `config/rabbitmq.env` and is loaded by each service.

---

## RBAC Model

Three roles defined in `docs/allow_per_role.md`:

| Role | Capabilities |
|------|-------------|
| **USER** | AI Q&A with sourced answers, self-service profile, feedback |
| **MANAGER** | All USER capabilities + analytics dashboard, report exports, view unanswered questions |
| **ADMIN** | All MANAGER capabilities + upload documents, manage metadata, manage user accounts |

Use `docs/allow_per_role.md` as the source of truth for permission details.

---

## Docker Orchestration

`docker-compose.yml` defines:

| Service | Port | Notes |
|---------|------|-------|
| postgres | 5432 | All schemas in one DB |
| rabbitmq | 5672/15672 | Management UI enabled |
| auth-service | 8081 | |
| user-service | 8082 | |
| knowledge-service | 8083 | |
| metadata-service | 8084 | |
| feedback-service | 8085 | |
| api-gateway | 3000 | |
| frontend | 3001 | |

All services share `poliwise-network` bridge network. Data volumes: `postgres_data`, `rabbitmq_data`.

---

## Working Guidance

- Check `docs/func_per_services.md`, `docs/db_per_services.md`, and `docs/allow_per_role.md` before making architectural changes; they currently describe intended behavior that may not be fully implemented.
- Expect many files to be generated starter code or skeletal implementations. Verify whether behavior is actually implemented before extending it.
- Ignore `target/` outputs in Spring services and `node_modules/` under the frontend.
- There is no committed `.cursorrules`, `.cursor/rules/`, or `.github/copilot-instructions.md` file.
