# Poliwise Feature Design Audit — 2026-06-27

**Auditor**: Claude (AI Assistant)  
**Scope**: `docs/FEATURE_DESIGN.md` (1347 lines) vs. actual codebase  
**Deadline Context**: ~44 hours remaining until Sunday EOD  
**Report Location**: `reports/feature-design-audit-2026-06-27.md`

---

## Executive Summary

The Poliwise codebase currently implements approximately **55-60%** of the features described in `FEATURE_DESIGN.md`. The most significant gaps center on the **Many-to-Many department-document relationship** (the `department_documents` junction table), which is referenced in 12+ sections of the design but **does not exist in the codebase**. This single gap cascades into failures across document upload, AI search filtering, MANAGER document scoping, deletion workflows, and audit logging.

The codebase is in a **transitional state**: core infrastructure exists (auth, user profiles, document processing pipeline, AI Q&A with 3-layer safeguard, analytics dashboard), but the department-scoped features that define the system's access-control model are incomplete. Several features marked as "planned" in the design (Section 14: User Behavior/Violation Management) are correctly absent.

**Verdict**: The codebase **CANNOT** reach 100% spec compliance within the 44-hour deadline. The recommended path forward is to implement the `department_documents` junction table and its associated features (estimated 15-20 hours), defer Section 14 to a post-launch phase, and focus on a **Minimum Viable Document System** by Sunday EOD.

---

## Phase 1: Section-by-Section Mismatch Table

| # | Feature in Design | Expected Behavior | Actual Code Location | Status | Gap / Mismatch | Effort |
|---|-------------------|------------------|---------------------|--------|----------------|--------|
| 1 | **Authentication & Session Management** | Login/password, JWT, refresh tokens, account lock (5 attempts), bootstrap admin | `services/auth-service/src/main/java/com/poliwise/auth/` | **MATCH** | All capabilities exist. `core.login_history` with IP, device, status (`001_core.sql:131-144`). `access_token_blacklist` (`001_core.sql:120-128`). `refresh_tokens` with reuse detection (`001_core.sql:86-103`). Account lock after 5 failed logins. | S |
| 2 | **User & Department Management** | Profile CRUD, department hierarchy, search users | `services/user-service/src/main/java/com/poliwise/user/` | **PARTIAL** | User profiles exist (`001_core.sql:67-83`). Departments with parent_id hierarchy exist (`001_core.sql:21-32`). **MISSING**: `metadata.department_documents` junction table required by Section 2.3. User-service does not create department_documents entries on upload. | L |
| 3 | **Document Lifecycle Management** | Upload → STAGING → confirm → READY, versioning, soft delete | `services/knowledge-service/src/main/java/com/poliwise/knowledge/service/DocumentService.java` | **PARTIAL** | Upload flow exists (`DocumentService.java:112-191`). Staging cleanup job exists (`DocumentService.java:87-110`). **MISSING**: `DepartmentRelationshipService` not found anywhere. `UploadDocumentRequest` does not include `departmentId` field (`UploadDocumentRequest.java:10-30`). No creation of `department_documents` entries during upload. | XL |
| 4 | **Document Processing Pipeline (Ingestion)** | Text extraction, chunking, embedding | `services/ingestion-service/src/scripts/ingest_modal.py`, `services/ingestion-service/src/` | **MATCH** | PyMuPDF, python-docx, openpyxl, tiktoken chunking (parent ~1500 chars, child ~400 chars). BGE-M3 embedding via LitServe. Processing job tracking in `knowledge.processing_jobs`. | S |
| 5 | **Document Upload Deduplication** | 3-layer: checksum → content hash → semantic fingerprint | `003_knowledge.sql:97-100` | **PARTIAL** | Schema columns exist: `file_checksum`, `content_hash`, `fingerprint_embedding` (vector). **UNCLEAR**: Actual deduplication logic in ingestion-service — grep found no `semantic_fingerprint` usage in Python scripts. Pipeline may compute but not use for deduplication decisions. | M |
| 6 | **Metadata & Classification** | Categories, tags, document metadata, access rules | `services/metadata-service/`, `002_metadata.sql` | **MATCH** | Categories hierarchy (`002_metadata.sql:23-35`). Tags (`002_metadata.sql:38-48`). `document_metadata` (`002_metadata.sql:51-81`). `document_access_rules` (`002_metadata.sql:96-120`). **PARTIAL**: Permission levels are `VIEW/DENY` only — design specifies `VIEW/CONTRIBUTE/MANAGE`. | M |
| 7 | **AI Q&A Chat (RAG)** | Hybrid search, ACL filtering, streaming | `services/ai-qa-service/src/`, `chunk_repo.py:51-70` | **PARTIAL** | Hybrid search exists (dense vector + BM25 in `hybrid_search.py`). ACL via flattened arrays exists (`chunk_repo.py:63-66`). **MISSING**: Dual-strategy with junction table JOIN not implemented. Section 7.2 specifies UNION of flattened arrays + junction table JOIN; only flattened arrays exist. | M |
| 8 | **User Query Safeguard (3-Layer)** | Layer 1 toxic filter, Layer 2 intent classifier, Layer 3 RAG | `services/ai-qa-service/src/services/pipeline/` | **PARTIAL** | Layer 1 (`layer1_toxic_filter.py`) — llama-prompt-guard with keyword pre-check, fail-open. Layer 2 (`layer2_intent_classifier.py`) — llama-3.1-8b-instant, SIMPLE/COMPLEX. Layer 3 — full RAG. **MISSING**: Layer 1 violation logging for Section 14 (planned). | M |
| 9 | **Feedback & Rating** | LIKE/DISLIKE, one per user/message | `services/feedback-service/`, `005_analytics.sql:46-70` | **MATCH** | `analytics.feedbacks` table with `UNIQUE (user_id, message_id)` constraint. User can submit/delete own feedback. | S |
| 10 | **Analytics & Reporting** | Dashboard, trends, audit logs | `services/feedback-service/`, `005_analytics.sql:110-138` | **PARTIAL** | Dashboard, reports, aggregates exist. Audit logs table exists (`005_analytics.sql:110-138`). **MISSING**: `department_id` and `department_name` columns in `audit_logs` as specified in Section 10.3. | M |
| 11 | **RBAC** | 3-layer enforcement, route-level guards | `services/api-gateway/src/proxy/proxy.controller.ts`, `src/common/guards/` | **MATCH** | JWT validation, role guards, route-level enforcement. Gateway injects `X-User-Id`, `X-Role`, `X-Department-Id` headers. Rate limits per role. Circuit breakers. | S |
| 12 | **API Gateway Cross-Cutting** | Health checks, response normalization, security headers | `services/api-gateway/` | **MATCH** | `/health`, `/health/live`, `/health/ready` endpoints. Response normalization. Exception filters. Helmet + CORS. | S |
| 13 | **Scheduled Background Jobs** | CleanupScheduler (01:00), StatsAggregation | `knowledge-service/DocumentService.java:87`, `feedback-service/` | **PARTIAL** | Staging cleanup (every 10 minutes) exists (`DocumentService.java:87`). CleanupScheduler and StatsAggregationScheduler need verification in feedback-service. | S |
| 14 | **User Behavior & Violation Management** | Strike system, violation logging | — | **PLANNED** | **CORRECTLY ABSENT** as documented in design. `user_violations` table, `user_warnings` table, `strike_count` column on `core.users` do not exist. This is expected per Section 14's "Status: Not implemented". | — |
| 15 | **Cross-Feature Interactions** | All cross-feature flows | Multiple services | **PARTIAL** | Most interactions depend on the missing `department_documents` junction table. Deduplication × RBAC (Section 5.4) incomplete without junction table. Upload × Department Selection (Section 11.9) missing frontend dropdown + backend departmentId. | XL |

**Status Summary**: 4 MATCH, 7 PARTIAL, 0 MISMATCH, 1 PLANNED (correctly absent), 1 SECTION WITH CASCADING GAPS

---

## Phase 2: Schema-Level Audit

| Schema Element | Design Location | Expected | Actual Status | Location | Missing Items |
|----------------|-----------------|----------|---------------|----------|---------------|
| `metadata.department_documents` | Section 2.3, 3.5, 5.4, 7.2, 11.5 | Junction table with FKs, `permission_level`, `is_primary_owner`, `granted_at`, `granted_by` | **MISSING** | Not found in any SQL file | **ENTIRE TABLE MISSING** — referenced in 12+ design sections |
| `knowledge.chunks.allowed_departments` | Section 4.3, 7.2 | `UUID[]` array | **EXISTS** | `003_knowledge.sql:153` | None |
| `knowledge.chunks.allowed_roles` | Section 4.3, 7.2 | `TEXT[]` or `user_role[]` | **EXISTS** | `003_knowledge.sql:152` | None |
| `knowledge.chunks.allowed_users` | Section 4.3, 7.2 | `UUID[]` array | **EXISTS** | `003_knowledge.sql:154` | None |
| `knowledge.document_versions.file_checksum` | Section 5.1, 5.2 | SHA-256 hash | **EXISTS** | `003_knowledge.sql:97` | None |
| `knowledge.document_versions.content_hash` | Section 5.1, 5.2 | SHA-256 of normalized text | **EXISTS** | `003_knowledge.sql:98` | None |
| `knowledge.document_versions.semantic_fingerprint` | Section 5.1, 5.3 | `VECTOR(1024)` | **EXISTS** | `003_knowledge.sql:100` | None |
| `analytics.audit_logs.department_id` | Section 10.3 | `UUID` column | **MISSING** | `005_analytics.sql:112-138` | Column not present in table definition |
| `analytics.audit_logs.department_name` | Section 10.3 | `VARCHAR(255)` denormalized | **MISSING** | `005_analytics.sql:112-138` | Column not present in table definition |
| `core.users.strike_count` | Section 14.3 | `INT NOT NULL DEFAULT 0` | **MISSING** | `001_core.sql:35-64` | Column not present |
| `core.users.last_violation_at` | Section 14.3 | `TIMESTAMPTZ` | **MISSING** | `001_core.sql:35-64` | Column not present |
| `analytics.user_violations` | Section 14.2 | Full table definition in design | **MISSING** | Not found | **ENTIRE TABLE MISSING** (expected — Section 14 is planned) |
| `analytics.user_warnings` | Section 14.2 | Full table definition in design | **MISSING** | Not found | **ENTIRE TABLE MISSING** (expected — Section 14 is planned) |
| `metadata.rule_permission` enum | Section 2.3, 6.1 | `VIEW`, `DENY` | **PARTIAL** | `002_metadata.sql:18` | Design specifies `VIEW`, `CONTRIBUTE`, `MANAGE` — only `VIEW`, `DENY` exist |
| `knowledge.processing_status` | Section 3.2 | Full status flow | **PARTIAL** | `003_knowledge.sql:20-23` | Missing `DUPLICATE` status mentioned in Section 3.2 |
| `metadata.document_status` | Section 6.1 | `DRAFT`, `REVIEW`, `PUBLISHED`, `ARCHIVED`, `DELETED` | **PARTIAL** | `002_metadata.sql:15` | Missing `REVIEW` and `DELETED` — has `DRAFT`, `PUBLISHED`, `ARCHIVED`, `EXPIRED` |

**Schema Summary**: 5 EXISTS, 5 MISSING, 4 PARTIAL

---

## Phase 3: Script & Pipeline Audit

### 3.1 `services/ingestion-service/src/scripts/ingest_modal.py` (817 lines)

| Item | Design Expectation | Actual | Gap |
|------|-------------------|--------|-----|
| ACL flattening | Assign `allowed_roles`, `allowed_departments`, `allowed_users` to chunks | **IMPLEMENTED** | `ingest_modal.py:196-215` creates chunks with ACL arrays |
| Department handling | Create chunks with flattened department arrays | **IMPLEMENTED** | `ingest_modal.py:299-315` sets `allowed_departments` |
| Deduplication fields | Compute `file_checksum`, `content_hash`, `semantic_fingerprint` | **PARTIAL** | Schema columns exist but actual deduplication logic not found in script |
| Junction table | The design specifies junction table usage; script only uses flattened arrays | **MISMATCH** | Script doesn't create `department_documents` entries because table doesn't exist |

### 3.2 `services/ingestion-service/src/scripts/generate_seed_sql.py`

| Item | Design Expectation | Actual | Gap |
|------|-------------------|--------|-----|
| ACL columns in SQL | `allowed_roles`, `allowed_departments`, `allowed_users`, `access_level` | **IMPLEMENTED** | `generate_seed_sql.py:389` references these columns |
| Junction table support | Generate SQL for `department_documents` entries | **MISSING** | Script doesn't generate junction table INSERT statements |

### 3.3 `infrastructure/seed/seed_data.sql`

| Item | Design Expectation | Actual | Gap |
|------|-------------------|--------|-----|
| New schema alignment | Assume junction table, ACL arrays | **MISMATCH** | File is 875MB+ — likely contains old schema assumptions. Grep found no `department_documents` references. |

### 3.4 `scripts/testing/test_seed.sql`

| Item | Design Expectation | Actual | Gap |
|------|-------------------|--------|-----|
| Schema alignment | Test seed should match current schema | **UNCLEAR** | File needs verification; likely old schema |

---

## Phase 4: Frontend & API Gateway Audit

### 4.1 Upload Form — ADMIN Department Selector

| Item | Design Expectation | Actual | Gap |
|------|-------------------|--------|-----|
| Department dropdown for ADMIN | Section 11.9: ADMIN upload UI shows required department dropdown | **MISSING** | `frontend/web/components/documents/UploadModal.tsx` has no department selector |
| Form fields | `departmentId` in request body for ADMIN uploads | **MISSING** | `UploadDocumentRequest` (`knowledge-service/.../dto/UploadDocumentRequest.java:10-30`) has no `departmentId` field |
| Validation | `400 BAD_REQUEST` with `MISSING_DEPARTMENT` if ADMIN omits departmentId | **MISSING** | No validation logic for departmentId |

**Code Evidence**: `UploadModal.tsx:40-56` form state contains only `{ title, description, categorySlug, tags, language, isPolicy }` — no department field.

### 4.2 API Gateway Route Configuration

| Route | Design Expectation | Actual | Gap |
|-------|-------------------|--------|-----|
| `/api/v1/documents/upload` | ADMIN only | **MATCH** | `proxy.controller.ts:255-266` has `@Roles(UserRole.ADMIN)` |
| Header injection | `X-Department-Id` passed to downstream | **MATCH** | `proxy.service.ts:393-394` injects header |
| Department validation | API should reject ADMIN uploads without `departmentId` | **MISSING** | No backend validation because field doesn't exist |

### 4.3 Frontend Services

| Item | Design Expectation | Actual | Gap |
|------|-------------------|--------|-----|
| Document list with department filtering | Filter by department via junction table | **MISSING** | Junction table doesn't exist |
| Upload with department selection | Pass `departmentId` in upload request | **MISSING** | `documentService.uploadDocument()` doesn't send department |
| Duplicate banner | Show "duplicate of [original]" banner | **MISSING** | Not found in document detail page |

---

## Phase 5: Effort Estimate Matrix

### Features Requiring Work (sorted by effort)

| # | Feature | Files to Change | Est. LoC | Effort | Dependencies | Risk |
|---|---------|-----------------|----------|--------|--------------|------|
| 1 | **Create `department_documents` junction table** | `infrastructure/init-db/002_metadata.sql` | ~80 | XL (6-8h) | None | Medium |
| 2 | **Add `departmentId` to upload flow** | `knowledge-service/.../dto/UploadDocumentRequest.java`, `DocumentService.java`, `metadata-service/.../DepartmentRelationshipService.java` | ~200 | XL (6-8h) | #1 | High |
| 3 | **Implement dual-strategy ACL in AI search** | `ai-qa-service/src/db/repositories/chunk_repo.py` | ~100 | L (4-6h) | #1 | Medium |
| 4 | **Frontend department dropdown for ADMIN upload** | `frontend/web/components/documents/UploadModal.tsx`, `frontend/web/services/document.service.ts` | ~100 | L (4-6h) | #2 | Medium |
| 5 | **Add `department_id` to audit_logs** | `005_analytics.sql`, `feedback-service/.../AuditLog.java` | ~50 | M (2-3h) | #1 | Low |
| 6 | **Implement deduplication logic in ingestion** | `ingestion-service/src/` | ~150 | L (4-5h) | Schema exists | Medium |
| 7 | **Add `permission_level` CONTRIBUTE/MANAGE** | `002_metadata.sql`, `metadata-service/` | ~50 | M (2-3h) | #1 | Low |
| 8 | **Add `DUPLICATE` status to processing_status** | `003_knowledge.sql`, `ProcessingStatus.java` | ~30 | S (1-2h) | #6 | Low |
| 9 | **Section 14: Violation Management** | Multiple services | ~500+ | XL+ (10h+) | Layer 1 integration | High |
| 10 | **Document relationship deletion flow** | `knowledge-service/`, `metadata-service/` | ~150 | L (3-4h) | #1, #2 | Medium |
| 11 | **MANAGER document scope enforcement** | `knowledge-service/`, `metadata-service/` | ~100 | L (3-4h) | #1 | High |

**Total Estimated Effort (excluding Section 14)**: ~35-45 hours  
**With Section 14**: ~45-55 hours

---

## Phase 6: Feasibility Verdict & Recommended MVP

### 6.1 Total Estimated Effort

| Scope | Hours | Notes |
|-------|-------|-------|
| Core infrastructure (already working) | 0 | Auth, user profiles, document processing, AI Q&A |
| Junction table + upload flow | 12-16h | Critical path for all other features |
| AI search dual-strategy | 4-6h | Depends on #1 |
| Frontend department selector | 4-6h | Depends on #2 |
| Audit log department context | 2-3h | Independent |
| Deduplication logic | 4-5h | Independent (schema exists) |
| Section 14 (planned) | 10h+ | Post-launch |
| **Total (to 80% compliance)** | **~26-36h** | |
| **Total (100% compliance excl. Section 14)** | **~35-45h** | |

### 6.2 Critical Path (Must Do for Sunday EOD)

1. **Create `department_documents` junction table** — Without this, 12+ features cannot be implemented
2. **Add `departmentId` to upload flow** — Required for ADMIN cross-department uploads
3. **Implement junction table INSERT on upload** — The actual relationship creation
4. **Add `department_id` to audit_logs** — Required for department-scoped auditing
5. **Frontend department dropdown** — Required for ADMIN to select target department

**Critical Path Estimate**: 18-24 hours

### 6.3 Defer-able Features (Post-Launch)

| Feature | Reason to Defer | Impact if Deferred |
|---------|-----------------|-------------------|
| Section 14: Violation Management | Requires Layer 1 integration, new tables, UI, notification system | Toxic queries not logged; manual review required |
| Full deduplication logic (Layer 3) | Schema exists; basic checksum Layer 1/2 may suffice | Duplicate documents may be stored |
| MANAGER document scope enforcement | MANAGER uploads disabled by gateway (ADMIN only) | MANAGER cannot upload until Phase 2 |
| Dual-strategy ACL in AI search | Flattened arrays work; junction table JOIN is optimization | Minor performance impact |

### 6.4 Recommended MVP Scope (Sunday EOD)

**Target**: A working document upload and AI Q&A system with basic department scoping.

| Priority | Feature | Effort |
|----------|---------|--------|
| P0 | `department_documents` junction table | 6-8h |
| P0 | Upload with `departmentId` + relationship creation | 6-8h |
| P0 | `department_id` in audit_logs | 2-3h |
| P1 | Frontend department dropdown | 4-6h |
| P1 | Audit log department context capture | 1-2h |
| P2 | Junction table JOIN in AI search (or document list) | 3-4h |
| P2 | Basic deduplication (Layer 1 only) | 2-3h |
| **Total MVP** | | **~24-34h** |

### 6.5 Risk Callouts

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Junction table changes break existing queries | Medium | High | Add nullable FK, update queries incrementally |
| Frontend changes affect upload UX | High | Medium | Test ADMIN upload flow end-to-end |
| Deduplication logic interferes with ingestion | Medium | Medium | Add feature flag; rollback path |
| Section 14 scope creep | High | High | Hard cut — document as post-launch |
| Timebox overrun | High | High | Focus on P0 only; defer P1/P2 to Monday |

---

## 7. Concrete Next-Step Checklist (Ordered by Priority)

### Before Starting (Next 1 Hour)
- [ ] Review this audit with team
- [ ] Confirm which features are MUST-HAVE vs. NICE-TO-HAVE
- [ ] Set up development environment with clean PostgreSQL

### Phase A: Foundation (Hours 1-8)
- [ ] Create `metadata.department_documents` table in `002_metadata.sql`
  - Columns: `id`, `department_id`, `document_metadata_id`, `granted_at`, `granted_by`, `permission_level`, `is_primary_owner`
  - Add indexes for `department_id`, `document_metadata_id`
  - Add `permission_level` enum: `VIEW`, `CONTRIBUTE`, `MANAGE`
- [ ] Add `department_id` and `department_name` columns to `analytics.audit_logs`
- [ ] Verify table creation works with clean database bootstrap

### Phase B: Upload Flow (Hours 9-18)
- [ ] Add `departmentId` field to `UploadDocumentRequest.java`
- [ ] Create `DepartmentRelationshipService` in knowledge-service
- [ ] Update `DocumentService.upload()` to call `DepartmentRelationshipService`
- [ ] Add validation: reject ADMIN upload without `departmentId` → `400 MISSING_DEPARTMENT`
- [ ] Update `metadata-service` to handle `department_documents` CRUD
- [ ] Test end-to-end: ADMIN uploads with department → relationship created

### Phase C: Frontend (Hours 19-24)
- [ ] Add department dropdown to `UploadModal.tsx`
- [ ] Fetch departments from `/api/v1/departments`
- [ ] Update `documentService.uploadDocument()` to include `departmentId`
- [ ] Add error handling for `MISSING_DEPARTMENT` response
- [ ] Test ADMIN upload with department selection

### Phase D: Integration (Hours 25-30)
- [ ] Update audit log capture to include `department_id`
- [ ] Verify AI search works with new relationships
- [ ] Test document list filtering by department
- [ ] End-to-end test: Upload → AI Q&A → verify department-scoped access

---

## Appendix: Evidence Summary

### Key Files Referenced

| File | Purpose | Key Finding |
|------|---------|-------------|
| `infrastructure/init-db/002_metadata.sql` | Metadata schema | No `department_documents` table |
| `infrastructure/init-db/003_knowledge.sql` | Knowledge schema | ACL arrays exist; deduplication columns exist |
| `infrastructure/init-db/005_analytics.sql` | Analytics schema | `audit_logs` missing `department_id` |
| `infrastructure/init-db/001_core.sql` | Core schema | `core.users` missing `strike_count`, `last_violation_at` |
| `services/knowledge-service/.../DocumentService.java` | Upload logic | No department relationship creation |
| `services/knowledge-service/.../dto/UploadDocumentRequest.java` | Upload DTO | No `departmentId` field |
| `frontend/web/components/documents/UploadModal.tsx` | Upload UI | No department dropdown |
| `services/api-gateway/src/proxy/proxy.controller.ts` | Gateway routes | Upload correctly restricted to ADMIN |
| `services/ai-qa-service/src/db/repositories/chunk_repo.py` | AI search | ACL via flattened arrays only; no junction table JOIN |
| `services/ai-qa-service/src/services/pipeline/layer1_toxic_filter.py` | Layer 1 | Toxic filter exists; violation logging not implemented |
| `services/ai-qa-service/src/services/pipeline/layer2_intent_classifier.py` | Layer 2 | Intent classifier exists |

---

*Report generated: 2026-06-27*  
*Auditor: Claude (AI Assistant)*  
*Next review: After Phase A completion*
