---
title: Service Responsibilities & Ownership
description: Definitive guide to service ownership, responsibilities, and boundaries in Poliwise
type: service-boundaries
version: 1.0
---

# Service Responsibilities & API Contracts

## Purpose

This document defines which service owns which feature, event contracts, and API boundaries. It is the **single source of truth** for feature ownership in the Poliwise microservices architecture.

## When to Use

Consult this file before implementing any feature to determine:
- Which service should implement the feature
- What events are involved in cross-service communication
- API boundary rules
- Database schema ownership

---

## Service Ownership Matrix

| Service | Owned Schemas | Primary Responsibilities | Technology | Port |
|---------|---------------|-------------------------|------------|------|
| `auth-service` | `core` | Users, roles, permissions, JWT lifecycle, login history | Spring Boot 3.4.3 | 8081 |
| `user-service` | `public` (default) | User profiles, departments, account status | Spring Boot 3.4.3 | 8082 |
| `knowledge-service` | `knowledge` | Document storage, file management, processing job tracking | Spring Boot 3.4.3 | 8083 |
| `metadata-service` | `metadata` | Document metadata, categories, tags, access rules | Spring Boot 3.4.3 | 8084 |
| `feedback-service` | `analytics` | Usage stats, unanswered questions, reports, feedback | Spring Boot 3.4.3 | 8085 |
| `ingestion-service` | `knowledge` (writes only) | File extraction, standardization, chunking, embedding generation | FastAPI (Python) | 8088 |
| `ai-qa-service` | `conversation`, `analytics` (writes) | Query processing, retrieval orchestration, LLM generation, conversation management | FastAPI (Python) | 8086 |
| `api-gateway` | None (routing only) | JWT validation, RBAC, rate limiting, proxy, tracing, circuit breaking | NestJS 11.x | 3000 |

---

## Critical Boundaries

### Database Schema Boundaries

**RULE**: Each service owns exactly one PostgreSQL schema. Services must **never** modify tables outside their owned schema.

```text
Service A (auth-service)   → owns → core
Service B (user-service)   → owns → public
Service C (metadata)       → owns → metadata
Service D (knowledge)      → owns → knowledge (reads only)
Service E (ingestion)      → owns → knowledge (writes only)
Service F (ai-qa)          → owns → conversation, analytics (writes)
```

**Prohibited**: Cross-schema SQL joins. If service needs data from another schema, use HTTP/RPC or events.

**Example - Anti-Pattern** (DO NOT DO):
```sql
-- In ai-qa-service trying to join metadata
SELECT c.*, dm.title
FROM knowledge.chunks c
JOIN metadata.document_metadata dm ON dm.document_id = c.document_id  -- ❌ CROSS-SCHEMA JOIN
WHERE ...;
```

**Correct Pattern**:
```python
# ai-qa-service calls metadata-service via HTTP
metadata = await metadata_service_client.get_document_metadata(document_id)
# Then join in application code OR the metadata should already be denormalized in knowledge.chunks via flattening
```

### Event-Driven Communication

All asynchronous service communication uses RabbitMQ via the `poliwise.events` exchange.

#### Events Published by Services

| Event | Publisher | Payload | Purpose |
|-------|-----------|---------|---------|
| `user.status.changed` | user-service | `{user_id, old_status, new_status}` | Notify other services of account status change |
| `document.uploaded` | ingestion-service | `{document_id, document_version_id, title, department_id, status}` | Notify that document is ready for search |
| `document.deleted` | knowledge-service | `{document_id, reason}` | Trigger cleanup in dependent services |
| `ingestion.requested` | knowledge-service | `{document_id, document_version_id, file_key, bucket_name, job_id, metadata}` | Start document processing |
| `unanswered.question` | ai-qa-service | `{user_id, message_id, conversation_id, question, search_query, top_similarity_score, priority}` | Notify feedback service of gaps |

#### Events Consumed by Services

| Service | Consumed Events | Handler |
|---------|----------------|---------|
| `ingestion-service` | `ingestion.requested` | Start ETL pipeline |
| `ingestion-service` | `document.deleted` | Soft delete chunks |
| `ai-qa-service` | `user.status.changed` | Invalidate user caches |
| `feedback-service` | `unanswered.question` | Store for admin review |
| `knowledge-service` | `document.uploaded` | Update document counters |
| `metadata-service` | `document.uploaded` | Update metadata stats |

### API Contracts (Synchronous)

All service-to-service HTTP communication **must**:
1. Go through API Gateway (except AI services internal calls)
2. Include user context headers: `X-User-Id`, `X-Role`, `X-Department-Id`, `X-Trace-ID`
3. Use standardized response format:
   ```json
   {
     "success": true,
     "data": {...},
     "message": "Optional message",
     "timestamp": "ISO-8601"
   }
   ```

#### Service Endpoint Reference

**auth-service** (`:8081`):
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/sessions
```

**user-service** (`:8082`):
```
GET    /api/v1/users/me
GET    /api/v1/users/{id}
PUT    /api/v1/users/me
GET    /api/v1/users           # Admin only, with filters
PATCH  /api/v1/users/me/status # User self-deactivate
DELETE /api/v1/users/{id}      # Admin only
```

**knowledge-service** (`:8083`):
```
GET    /api/v1/documents
GET    /api/v1/documents/{id}
POST   /api/v1/documents/upload
DELETE /api/v1/documents/{id}
```

**metadata-service** (`:8084`):
```
GET    /api/v1/metadata/categories
GET    /api/v1/metadata/tags
GET    /api/v1/metadata/documents/{id}
PUT    /api/v1/metadata/documents/{id}
POST   /api/v1/metadata/access-rules
GET    /api/v1/metadata/documents/{id}/access
```

**feedback-service** (`:8085`):
```
GET    /api/v1/analytics/dashboard
GET    /api/v1/ai/history
POST   /api/v1/feedback
GET    /api/v1/ai/unanswered      # Manager+
PUT    /api/v1/ai/unanswered/{id}/resolve
```

**ai-qa-service** (`:8086`):
```
POST   /api/v1/ai/chat
POST   /api/v1/ai/chat/stream
GET    /api/v1/ai/conversations
GET    /api/v1/ai/conversations/{id}
DELETE /api/v1/ai/conversations/{id}
GET    /api/v1/ai/unanswered      # Manager+
PUT    /api/v1/ai/unanswered/{id}/resolve
```

**ingestion-service** (`:8088`):
```
POST   /api/v1/ingest              # Admin only
GET    /api/v1/ingest/{job_id}/status
POST   /api/v1/ingest/{doc_id}/reindex
DELETE /api/v1/documents/{doc_id}
POST   /api/v1/embed/query         # Internal only
POST   /api/v1/embed/batch         # Internal only
POST   /api/v1/rerank              # Internal only
POST   /api/v1/search/hybrid       # Internal only
```

---

## Implementation Guidelines

### When Adding a New Feature

1. **Determine ownership** using the Service Ownership Matrix above
2. **Check database boundaries**: Does it need new tables? Add to the service's owned schema
3. **Define API contracts** if cross-service communication needed:
   - Synchronous? → Add endpoint to service, update gateway routing
   - Asynchronous? → Define event payload, publish/consume
4. **Update this document**: Keep ownership matrix and event contracts current

### Prohibited Patterns (Anti-Patterns)

| Pattern | Why It's Bad | Correct Approach |
|---------|--------------|------------------|
| Direct service-to-service HTTP bypassing gateway | No JWT validation, no tracing, no rate limiting | Route all client-facing traffic through gateway. For internal AI services, document the exception and ensure authentication |
| Cross-schema SQL joins | Violates service autonomy, creates tight coupling | Use HTTP/RPC or denormalize data via events |
| Modifying another service's tables | Schema ownership violation, can break other service | Each service only touches its own schema |
| Implementing ingestion logic in knowledge-service | Mixing responsibilities, violates separation | Ingestion belongs to `ingestion-service` (Python) |
| Putting business logic in API Gateway | Gateway should only route/guard | Keep business logic in microservices |
| Hardcoding service URLs | Inflexible, breaks across environments | Use environment variables: `KNOWLEDGE_SERVICE_URL`, etc. |

---

## Cross-Service Data Synchronization

### Recommended Pattern: Event-Driven Sync

When service A needs data from service B:

1. Service B publishes events when its data changes
2. Service A consumes events and updates its own denormalized copy
3. Service A queries its own database (no cross-schema joins)

**Example**: AI service needs `document_metadata` for filtering.

**Approach A (Anti-pattern)**: Join `knowledge.chunks` → `metadata.document_metadata` in SQL query → ❌ Cross-schema join

**Approach B (Correct)**:
- Ingestion service flattens ACLs into `knowledge.chunks` at ingestion time (see `contexts/authorization/dual-strategy.md`)
- AI service queries only `knowledge.chunks` with pre-flattened `allowed_roles`, `allowed_departments`, `access_level`

**Approach C (Event sync)**: If metadata changes (title, status), publish `document.metadata.updated` event → AI service updates its own `ai_document_cache` table.

---

## Error Handling & Resilience

### Circuit Breaker Configuration

Configure per-service circuit breakers in API Gateway:

| Service | Failure Threshold | Timeout (ms) | Recovery Time (s) |
|---------|-------------------|--------------|-------------------|
| auth-service | 5 | 30000 | 30 |
| user-service | 5 | 30000 | 30 |
| knowledge-service | 5 | 60000 | 60 |
| metadata-service | 5 | 30000 | 30 |
| feedback-service | 5 | 30000 | 30 |

Circuit breaker opens after threshold consecutive failures. Default fallback response:
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable",
    "retryAfter": 30
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Retry Strategy

For **idempotent** operations (GET, PUT, DELETE), configure retries:
- Max attempts: 3
- Backoff: Exponential (1s, 2s, 4s)
- Timeout: 30s total

For **non-idempotent** operations (POST): no retry (could create duplicates).

---

## API Gateway Routing Configuration

All routes defined in `services/api-gateway/src/proxy/proxy.controller.ts`:

```typescript
const routes: ProxyRoute[] = [
  // Auth (handled by auth module internally)
  { path: '/api/v1/auth/login', method: 'POST', target: AUTH_SERVICE_URL, guards: [], roles: [] },
  
  // User service
  { path: '/api/v1/users/me', method: 'GET', target: USER_SERVICE_URL, guards: [JwtAuthGuard], roles: ['USER', 'MANAGER', 'ADMIN'] },
  { path: '/api/v1/users', method: 'GET', target: USER_SERVICE_URL, guards: [JwtAuthGuard], roles: ['MANAGER', 'ADMIN'] },
  
  // Knowledge service
  { path: '/api/v1/documents', method: 'GET', target: KNOWLEDGE_SERVICE_URL, guards: [JwtAuthGuard], roles: ['USER', 'MANAGER', 'ADMIN'] },
  { path: '/api/v1/documents/upload', method: 'POST', target: KNOWLEDGE_SERVICE_URL, guards: [JwtAuthGuard], roles: ['ADMIN'] },
  
  // AI service
  { path: '/api/v1/ai/chat', method: 'POST', target: AI_QA_SERVICE_URL, guards: [JwtAuthGuard, RolesGuard], roles: ['USER', 'MANAGER', 'ADMIN'] },
  { path: '/api/v1/ai/chat/stream', method: 'POST', target: AI_QA_SERVICE_URL, guards: [JwtAuthGuard, RolesGuard], roles: ['USER', 'MANAGER', 'ADMIN'] },
  
  // Analytics
  { path: '/api/v1/analytics/dashboard', method: 'GET', target: FEEDBACK_SERVICE_URL, guards: [JwtAuthGuard], roles: ['MANAGER', 'ADMIN'] },
  
  // Public health check (no auth)
  { path: '/health', method: 'GET', target: API_GATEWAY_URL, guards: [], roles: [] },
];
```

---

## Testing Strategy

### Service Isolation Tests

Each service should have unit tests mocking dependencies:

```java
// UserService test - should NOT touch database directly
@SpringBootTest
class UserServiceTest {
    @MockBean
    private UserRepository userRepository;
    
    @Test
    void getUserById_ShouldReturnUser() {
        // Given
        User user = new User("John", "user@example.com");
        when(userRepository.findById(any())).thenReturn(Optional.of(user));
        
        // When
        User result = userService.getUserById(UUID.randomUUID());
        
        // Then
        assertEquals("John", result.getName());
    }
}
```

### Integration Tests (Cross-Service)

Use testcontainers for PostgreSQL and RabbitMQ:

```java
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@Testcontainers
class DocumentIngestionIntegrationTest {
    
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
    
    @Container
    static RabbitMQContainer rabbitmq = new RabbitMQContainer("rabbitmq:3.13-management");
    
    @Test
    void testDocumentUploadToIngestionFlow() {
        // 1. Upload document via knowledge-service
        UUID documentId = knowledgeClient.uploadDocument(file);
        
        // 2. Wait for ingestion.requested event
        // 3. Verify ingestion-service processed it
        // 4. Query chunks from knowledge.chunks
        // 5. Verify AI search returns results
    }
}
```

---

## Service Startup Order

In `docker-compose.yml`, ensure correct dependency order:

```yaml
services:
  postgres:
    # DB first
    
  rabbitmq:
    # Message queue second
    
  api-gateway:
    depends_on:
      postgres: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
      auth-service: { condition: service_healthy }
      user-service: { condition: service_healthy }
      # Gateway depends on all backend services to be healthy for health checks
    
  auth-service:
    depends_on:
      postgres: { condition: service_healthy }
      rabbitmq: { condition: service_healthy }
    
  # ... other services
```

---

## References

- **System Architecture**: `contexts/architecture/system-overview.md` - component diagram and data flows
- **Database Schema**: `contexts/database/schema.md` - table definitions per schema
- **Event Contracts**: `contexts/service-boundaries/events.md` - complete RabbitMQ event catalog
- **AI Architecture**: `contexts/architecture/ai-service-architecture.md` - detailed AI pipeline
- **Authorization**: `contexts/authorization/dual-strategy.md` - permission patterns

---

**Last Updated**: 2026-04-08
**Maintained By**: Architecture Team
**Critical**: Any changes to service boundaries require team-wide review.
