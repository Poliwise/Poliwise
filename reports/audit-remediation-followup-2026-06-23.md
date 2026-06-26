# Audit remediation follow-up — 2026-06-23

This report records the fixes applied after the verification pass identified remaining audit issues.

## Scope addressed in this follow-up

Resolved in this pass:

- OnlyOffice callback token and callback session validation
- OnlyOffice callback download hardening and bounded temporary-file handling
- Gateway upload contract for document creation
- Frontend unanswered-question admin contract mismatch
- Backend unanswered-question analytics payload/status alignment

Already confirmed as fixed before this pass:

- Password change page no longer falls back to `/api/v1/auth/password`

## Changes made

### 1. OnlyOffice callback identity and download path

Files:

- `services/knowledge-service/src/main/java/com/poliwise/knowledge/service/OnlyOfficeService.java`
- `services/knowledge-service/src/main/java/com/poliwise/knowledge/controller/OnlyOfficeController.java`
- `services/knowledge-service/src/main/java/com/poliwise/knowledge/config/OnlyOfficeProperties.java`

What changed:

- Added top-level callback JWT claims: `action`, `documentId`, `key`
- Enforced callback session matching against the active document lock
- Replaced unbounded `readAllBytes()` callback download with:
  - origin validation
  - no credentials/fragments
  - no redirects
  - connect/read timeouts from config
  - bounded streaming to a temporary file
  - explicit cleanup of temporary files
- Normalized callback download host translation from host-mapped `localhost:8888` to internal OnlyOffice service address

### 2. Document upload contract through gateway

Files:

- `services/knowledge-service/src/main/java/com/poliwise/knowledge/controller/DocumentController.java`
- `frontend/web/services/document.service.ts`
- `frontend/web/lib/api.ts`

What changed:

- Backend upload endpoint now accepts both:
  - `POST /api/v1/documents`
  - `POST /api/v1/documents/upload`
- Frontend upload calls now target gateway path:
  - `/api/v1/documents/upload`
- Removed stale direct browser use of the legacy unanswered route and legacy direct upload path in the API client

### 3. Unanswered-question admin contract

Files:

- `services/feedback-service/src/main/java/com/poliwise/feedback/controller/AnalyticsController.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/service/DashboardService.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/dto/response/UnansweredQuestionResponse.java`
- `frontend/web/lib/api.ts`
- `frontend/web/app/admin/unanswered/page.tsx`

What changed:

- Standardized unresolved-admin traffic on `/api/v1/analytics/unanswered`
- Added optional status parameter handling in analytics controller/service
- Changed backend unanswered payload shape to match admin UI expectations:
  - `askCount`
  - `firstAskedAt`
  - `lastAskedAt`
  - `status`
  - `suggestedAnswer`
- Frontend no longer miscasts the full API envelope as an array
- Frontend unanswered page now reads `response.data` and reloads against the selected status filter

## Verification performed

Code-level verification completed:

- Removed stale frontend references to:
  - `/api/v1/ai/unanswered`
  - `/api/v1/auth/password`
- Confirmed current upload client path uses `/api/v1/documents/upload`
- Confirmed OnlyOffice callback controller now checks authenticated callback principal against active lock state

Docker/runtime verification completed:

- Rebuilt successfully in Docker:
  - `services/knowledge-service`
  - `services/feedback-service`
  - `frontend/web`
- Confirmed gateway login works for seeded admin account
- Confirmed live upload through gateway works on:
  - `POST /api/v1/documents/upload`
- Confirmed live unanswered admin APIs now work end-to-end:
  - `GET /api/v1/analytics/unanswered?status=ANSWERED`
  - `GET /api/v1/analytics/unanswered?status=REJECTED`
  - `PUT /api/v1/analytics/unanswered/{id}/resolve`
  - `PUT /api/v1/analytics/unanswered/{id}/reject`
- Confirmed persisted database state after runtime calls in `conversation.unanswered_questions`

Additional fixes discovered and resolved during live verification:

### 4. Feedback unanswered-question persistence bugs found at runtime

Files:

- `services/feedback-service/src/main/java/com/poliwise/feedback/service/DashboardService.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/entity/UnansweredQuestion.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/repository/UnansweredQuestionRepository.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/consumer/UnansweredQuestionConsumer.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/enums/PriorityLevel.java`

What changed:

- Added write transactions on unanswered resolve/reject methods
- Fixed PostgreSQL enum persistence for `conversation.unanswered_questions.priority`
- Replaced string priority handling with a typed `PriorityLevel` enum

Runtime evidence:

- Resolve API returned success and row persisted with:
  - `resolved = true`
  - `resolution_notes = 'Verified from runtime test'`
- Reject API returned success and row persisted with:
  - `resolved = true`
  - `resolution_notes = 'Rejected'`

### 5. Feedback audit-log enum persistence bug found at runtime

Files:

- `services/feedback-service/src/main/java/com/poliwise/feedback/entity/AuditLog.java`

What changed:

- Added PostgreSQL named-enum JDBC mapping for:
  - `action`
  - `resourceType`

Runtime evidence:

- Feedback-service no longer throws:
  - `column "action" is of type analytics.audit_action but expression is of type character varying`
- Document upload events were processed successfully after the fix

### 6. Report export persistence, streaming, retry, and dead-letter handling

Files:

- `services/feedback-service/.dockerignore`
- `services/feedback-service/src/main/java/com/poliwise/feedback/config/RabbitMQConfig.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/controller/ReportController.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/dto/response/ReportDownload.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/listener/ReportExportListener.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/listener/ReportExportMessageRecoverer.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/service/ReportExportFailureService.java`
- `services/feedback-service/src/main/java/com/poliwise/feedback/service/ReportExportService.java`
- `services/feedback-service/src/test/java/com/poliwise/feedback/**`

What changed:

- Publish `report.export.requested` only after the `PENDING` database transaction commits
- Stream stored MinIO objects to HTTP responses instead of loading the full artifact with `readAllBytes()`
- Return the correct filename extension and media type for the typed export format
- Ignore duplicate messages for reports already marked `COMPLETED`
- Retry report generation exactly three times with bounded backoff
- Commit terminal `FAILED` state in an independent transaction before rejecting the message
- Route exhausted messages to `poliwise.feedback.report.export.dlq`
- Make MinIO bucket creation safe when concurrent workers race to create the same bucket
- Include `src/test` in the Docker build context so `mvn verify` runs tests

Verification evidence:

- Docker builder ran `mvn verify`: 4 tests, 0 failures, 0 errors
- Successful report `2380355b-deca-444f-8c8c-ce7c253ebb8f`:
  - status `COMPLETED`
  - download HTTP `200`
  - `Content-Type: text/csv;charset=UTF-8`
  - filename ends with `.csv`
- Failure probe with MinIO temporarily unavailable:
  - exactly 3 processing attempts
  - report `b72597b1-3127-4fae-9bc8-d76c234f6779` persisted as `FAILED`
  - safe error message persisted
  - message reached the report-export DLQ
- The test DLQ message was purged and MinIO, RabbitMQ, PostgreSQL, feedback-service, gateway, and frontend returned healthy

## Remaining work not addressed in this follow-up

These items were not remediated in this pass:

- Browser verification against a live stack
- Large-volume report verification with more than 500 matching records
- Automated PostgreSQL/MinIO integration tests beyond the verified live Docker probes

## Recommended next verification steps

1. Verify the OnlyOffice save callback in a browser against the live stack
2. Verify report generation with more than 500 matching rows
3. Add automated integration coverage for:
   - unanswered resolve/reject persistence
   - feedback enum mappings against PostgreSQL named enums
   - PostgreSQL transaction and MinIO failure recovery
