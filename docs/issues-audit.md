# Poliwise Issues Audit

> Generated: 2026-05-21
> Status: Tracking file for incremental fixes before re-ingest

---

## CRITICAL

### C1. Credentials lộ trong `.env` files ✅ FIXED
- **Status**: FIXED
- **Files**: `auth-service/.env`, `ingestion-service/.env`, `api-gateway/.env`
- **Fix**: 
  - Created `.env.example` templates (gitignored `.env` already was)
  - Empty values in example files require explicit configuration
  - Admin password now randomly generated on initial deployment
  - Added `FRONTEND_ORIGIN` env var instead of hardcoded `*` CORS

### C2. JWT Secret yếu ✅ FIXED
- **Files**: `auth-service/.env:32`, `api-gateway/.env:3`
- **Issue**: `AUTH_JWT_SECRET=poliwise-jwt-secret-key-must-be-at-least-256-bits-long-for-hs256` — predictable string
- **Impact**: Forge JWT token được, bypass auth, escalate lên admin
- **Fix**: Generate `openssl rand -base64 32` → secret mới `4lTpNSfCheaqHiIEL511uzLRdH3HAyAUpKYea2NYMsk=`, update cả auth-service và api-gateway `.env` files

### C3. Default admin password hardcoded ✅ FIXED
- **Fix**: 
  - `AdminInitializer.java`: Tự động generate random 16 ký tự nếu `ADMIN_PASSWORD` không set
  - `mustChangePassword=true` mặc định cho admin tạo mới
  - `007_seed_data.sql`: Dùng `uuid_generate_v4()`, password chỉ làm fallback nếu initializer chưa chạy

### C4. Pipeline orchestrator stub methods (dead code) ✅ FIXED → REFACTORED
- **File**: `ai-qa-service/src/services/pipeline/pipeline_orchestrator.py`
- **Issue**: `_save_layer2_exchange()`, `_save_layer3_exchange()`, `_maybe_generate_title()` = `pass`
- **Impact**: Nếu orchestrator được dùng thay vì `chat.py` → không lưu conversation, không generate title
- **Fix**: 
  - Implement đầy đủ `PipelineOrchestrator` với `process()` và `process_stream()` methods
  - Implement `_save_layer2_exchange()`, `_save_layer3_exchange()` để lưu conversation history
  - Clean `chat.py` từ ~550 lines → ~250 lines, delegate vào orchestrator
  - Giữ response formatting logic trong chat.py (endpoint-specific)

### C5. Document deletion không xóa chunks ✅ FIXED
- **File**: `ingestion-service/src/events/consumer.py:66`
- **Issue**: `on_document_deleted()` có `# TODO: Soft-delete chunks for this document` nhưng không implement
- **Impact**: Xóa document → orphaned chunks vẫn hiện trong search results
- **Fix**: 
  - Thêm `soft_delete_chunks()` vào `ChunkRepository` — set `deleted_at = NOW()` cho tất cả chunks của document
  - Implement handler trong `consumer.py` — gọi repository, commit transaction, log count
  - Search queries (vector + BM25) đã filter `deleted_at IS NULL` → chunks bị xóa sẽ không hiện trong kết quả

### H1. Event timestamp hardcoded ✅ FIXED
- **File**: `ingestion-service/src/events/publisher.py:23`
- **Issue**: `"timestamp": "2024-01-15T10:30:00Z"` với comment `# TODO: Use actual timestamp`
- **Impact**: Tất cả events cùng timestamp → không debug, không event ordering, audit trail vô nghĩa
- **Fix**: Dùng `datetime.now(timezone.utc).isoformat()` thay vì hardcoded string

### H2. Rate limiting fail open khi Redis down ✅ FIXED
- **File**: `ai-qa-service/src/api/dependencies/rate_limit.py`
- **Issue**: `except Exception: logger.error(...); return` → Redis down = bypass rate limit
- **Impact**: Không protect khỏi abuse khi Redis outage
- **Fix**: 
  - Thêm `InMemoryRateLimiter` class với local dict + TTL cleanup
  - Khi Redis fail → fallback sang in-memory thay vì bypass
  - Vẫn có protection cơ bản (per-process) khi Redis down

### H3. Gateway rate limiter in-memory (không shared)
- **File**: `api-gateway/src/common/interceptors/rate-limit.interceptor.ts:17`
- **Issue**: `private readonly recordStore = new Map<string, RateLimitRecord>()` — per-process
- **Impact**: Multi-instance → user hit nhiều instance = vượt limit
- **Fix**: Dùng Redis cho distributed rate limiting

### H4. Thiếu FK constraint: `conversation.conversations.user_id` ✅ FIXED
- **File**: `infrastructure/init-db/004_conversation.sql:21`
- **Issue**: `user_id UUID NOT NULL` không có `REFERENCES core.users(id)`
- **Impact**: Orphaned conversations cho user đã xóa
- **Fix**: Migration 002 — thêm FK `REFERENCES core.users(id) ON DELETE CASCADE`

### H5. Thiếu FK constraint: `metadata.document_metadata.document_id` ✅ FIXED
- **File**: `infrastructure/init-db/002_metadata.sql:50`
- **Issue**: `document_id UUID UNIQUE NOT NULL` không FK tới `knowledge.documents(id)`
- **Impact**: Metadata tồn tại cho document không tồn tại
- **Fix**: Migration 002 — thêm FK `REFERENCES knowledge.documents(id) ON DELETE CASCADE`

### H6. Thiếu FK constraint: `analytics.feedbacks` (message_id, conversation_id, user_id) ✅ FIXED
- **File**: `infrastructure/init-db/005_analytics.sql:50-52`
- **Issue**: Không FK cho `message_id`, `conversation_id`, `user_id`
- **Impact**: Feedback reference deleted records, không cleanup
- **Fix**: Migration 002 — thêm 3 FK constraints với `ON DELETE SET NULL`

### H7. CORS `*` + `allowCredentials=true` ✅ FIXED
- **Fix**: Tất cả `SecurityConfig.java` files trong auth/knowledge/metadata/feedback/user services đều dùng `FRONTEND_ORIGIN` env var (default: `http://localhost:3000`)

### H8. `SecurityUtils` return `null` silently ✅ FIXED
- **Fix**: Cả `knowledge-service` và `metadata-service` SecurityUtils đều throw `IllegalStateException` khi không có authenticated user context

### H9. Contract Mismatch của sự kiện `unanswered.question` ✅ FIXED
- **Fix**: `UnansweredQuestionConsumer.java` giờ đọc từ `payload` key và dùng `snake_case` keys (`user_id`, `message_id`, `conversation_id`, `top_similarity_score`, v.v.)

---

## MEDIUM

### M1. `start_char_index` / `end_char_index` không được populate ✅ FIXED
- **File**: `ingestion-service/src/services/chunker.py`
- **Issue**: Chunker dùng token positions (tiktoken), không convert sang character offsets → fields luôn = 0
- **Impact**: Document highlight không hoạt động chính xác
- **Fix**: 
  - Thêm `_build_token_char_index()` dùng cumulative decoding để map token → char position
  - `_hierarchical_chunk`: Track position trong normalized_text khi iterate sections
  - `_recursive_chunk` + `_create_child_chunks`: Dùng token-char index để convert token boundaries → char boundaries
  - API: Thêm fields vào `RetrievalChunk`, `ChunkRef`, SQL queries
  - Frontend: Thêm `startCharIndex`/`endCharIndex` vào `ChunkRef`, map trong `api.ts`
  - `DocumentViewerModal`: Ưu tiên dùng offset để extract text từ cleanedContent, fallback text matching
  - `cleanMarkdown()`: Thêm whitespace normalization (`[ \t]+` → space) để match ingestion standardizer

### M2. Analytics tables không bao giờ được viết
- **Tables**: `analytics.usage_stats`, `analytics.audit_logs`, `analytics.daily_aggregates`, `analytics.hourly_aggregates`, `analytics.popular_questions`, `analytics.document_popularity`
- **Issue**: Schema có nhưng không service nào viết data vào
- **Impact**: Analytics dashboard trống
- **Fix**: Implement usage stats collection + scheduled aggregation jobs

### M3. `fingerprint_embedding` không được lưu ✅ FIXED
- **File**: `ingestion-service/src/services/pipeline.py:123-127`
- **Issue**: `fingerprint_embedding VECTOR(1024)` được tính bởi deduplicator nhưng không lưu vào DB
- **Impact**: Layer 3 dedup chỉ hoạt động trong cùng session, không so sánh được với document cũ
- **Fix**: 
  - Truyền `dup_semantic.vector` vào `ver_repo.update_version(fingerprint_embedding=...)`
  - `version_repo.py` đã hỗ trợ parameter này từ trước

### M4. `similarity_to_previous` không được tính ✅ FIXED
- **File**: `infrastructure/init-db/003_knowledge.sql:82`
- **Issue**: Column tồn tại cho version similarity detection nhưng không populate
- **Impact**: Không detect được document version mới có khác biệt không
- **Fix**: 
  - Trong pipeline.py, sau khi có fingerprint embedding → compute similarity với version gần nhất
  - Dùng `ver_repo.find_near_duplicates()` với threshold=0.0 để lấy version gần nhất
  - Pass `similarity_to_previous` vào `ver_repo.update_version()`

### M5. `ocr_confidence` không được set ✅ FIXED
- **Columns**: `ocr_confidence`
- **File**: `ingestion-service/src/services/extractors/pdf.py`, `image.py`
- **Issue**: Column tồn tại nhưng không service nào viết — chỉ set placeholder `0.0` hoặc `0.95`
- **Impact**: OCR confidence không phản ánh chất lượng thực tế
- **Fix**: 
  - PDF extractor: Dùng `pytesseract.image_to_data()` với `Output.DICT` để lấy confidence per word
  - Image extractor: Same approach — tính avg confidence từ tất cả words
  - Pipeline: Pass `ocr_confidence` từ extracted metadata vào `doc_repo.update_ocr_confidence()`

### M6. `question_normalized` không normalize ✅ FIXED
- **File**: `infrastructure/init-db/004_conversation.sql:57`
- **Issue**: Endpoint ghi `message.content` vào cả `question` và `question_normalized` mà không normalize
- **Impact**: Normalized search trên unanswered questions không hiệu quả hơn regular search
- **Fix**: Apply text normalization (lowercase, strip punctuation, etc.)

### M7. BM25 dùng English stemmer cho Vietnamese content ✅ FIXED
- **File**: `ai-qa-service/src/db/repositories/chunk_repo.py:108`, `008_ai_indexes.sql:22`
- **Issue**: `to_tsvector('english', ...)` và `plainto_tsquery('english', ...)` cho tất cả content
- **Impact**: Vietnamese text search kém chính xác — English stemmer biến đổi sai từ tiếng Việt
- **Fix**: 
  - Đổi `'english'` → `'simple'` trong cả SQL queries và generated column
  - `'simple'` dictionary chỉ lowercase + split, không stemming → phù hợp tiếng Việt
  - Migration script `001_bm25_simple_dictionary.sql` để update existing data
  - Tạo migration file trong `infrastructure/init-db/migrations/`

### M8. `vector_indexed` không bao giờ set TRUE ✅ FIXED
- **File**: `infrastructure/init-db/003_knowledge.sql:113`
- **Issue**: `vector_indexed BOOLEAN DEFAULT FALSE` nhưng không code nào set TRUE sau khi indexing
- **Impact**: Không track được chunk nào đã được index vào HNSW
- **Fix**: Migration 002 — `UPDATE knowledge.chunks SET vector_indexed = TRUE WHERE embedding_vector IS NOT NULL`

### M9. Report export filename hardcoded
- **File**: `feedback-service/.../ReportController.java`
- **Issue**: Download endpoint trả hardcoded filename `report-{id}.csv`
- **Impact**: Có thể không generate actual file content
- **Fix**: Verify `ReportExportService` có real file generation logic

### M10. Event publishing failures silently swallowed ✅ FIXED
- **File**: `auth-service/.../AuthService.java:103-105`
- **Issue**: `catch (Exception e) { }` — empty catch block khi event publishing fails
- **Impact**: User status change events có thể bị mất không notification
- **Fix**: Thêm `log.error()` với đầy đủ context (user ID, error message, stack trace)

### M11. `user_profiles` table không được manage
- **File**: `infrastructure/init-db/001_core.sql:44-59`
- **Issue**: `core.user_profiles` có `deleted_at` nhưng không trigger auto-update, không JPA entity trong auth-service
- **Impact**: Table được tạo nhưng không service nào manage — orphaned profiles accumulate
- **Fix**: Thêm UserProfile entity vào user-service hoặc xóa table

---

## LOW

### L1. `tags.usage_count` không update khi soft-delete ✅ FIXED
- **File**: `infrastructure/init-db/002_metadata.sql:40`
- **Issue**: Trigger update `usage_count` on INSERT/DELETE của `document_tags` nhưng không on soft-delete của `document_metadata`
- **Impact**: Usage count có thể inflated nếu documents soft-deleted
- **Fix**: Migration 002 — thêm trigger `trg_update_tag_usage_on_soft_delete` update tag usage count khi document soft-deleted/restored

### L2. `language` default `'vi'` — assumption sai ✅ FIXED
- **File**: `infrastructure/init-db/003_knowledge.sql:49`
- **Issue**: `language VARCHAR(10) DEFAULT 'vi'` giả định tất cả documents tiếng Việt
- **Impact**: English/multilingual documents có incorrect language metadata
- **Fix**: Migration 002 — `ALTER COLUMN language DROP DEFAULT`

### L3. `chunk_type` default `'child'` ✅ FIXED
- **File**: `infrastructure/init-db/003_knowledge.sql:100`
- **Issue**: `chunk_type knowledge.chunk_type DEFAULT 'child'` — parent chunks có thể không được tạo
- **Impact**: Nếu parent-child chunking strategy dùng, parent chunks có thể missing
- **Fix**: Migration 002 — `ALTER COLUMN chunk_type SET DEFAULT 'parent'`

### L4. Dead code: `pipeline_orchestrator.py`, `title_generator.py` ✅ FIXED → REFACTORED
- **Files**: `ai-qa-service/src/services/pipeline/pipeline_orchestrator.py`, `title_generator.py`
- **Issue**: Files tồn tại nhưng không được import hoặc dùng — `chat.py` implement inline
- **Impact**: Maintenance burden, confusion về implementation canonical
- **Fix**: 
  - Implement đầy đủ `PipelineOrchestrator` với `process()` và `process_stream()`
  - Clean `chat.py` từ ~550 lines → ~250 lines
  - `title_generator.py` vẫn là dead code (title generation handled by DB trigger)

### L5. `content_tsv` generated column dùng English cho Vietnamese ✅ FIXED
- **File**: `infrastructure/init-db/008_ai_indexes.sql:22`
- **Issue**: `GENERATED ALWAYS AS (to_tsvector('english', content)) STORED`
- **Impact**: Vietnamese documents full-text search miss matches
- **Fix**: Migration 001 — đổi `'english'` → `'simple'` cho cả chunks và messages tables

### L6. Seed data dùng predictable UUIDs ✅ FIXED
- **Fix**: Tất cả UUIDs trong `007_seed_data.sql` đã đổi sang `uuid_generate_v4()`

### L7. `chat_stream` hardcoded `limit=5` ✅ FIXED
- **File**: `ai-qa-service/src/api/routes/chat.py:442`
- **Issue**: `limit=5` hardcoded trong streaming endpoint trong khi non-streaming dùng `settings.retrieval_limit` (10)
- **Impact**: Streaming responses có ít context hơn → answer quality khác nhau
- **Fix**: Đổi `limit=5` → `limit=settings.retrieval_limit` để consistent với non-streaming endpoint

### L8. `knowledge.chunks.bucket_name` redundant ✅ FIXED
- **File**: `infrastructure/init-db/003_knowledge.sql:121`
- **Issue**: `bucket_name VARCHAR(100)` trên chunks table duplicate từ `knowledge.documents`
- **Impact**: Data inconsistency nếu bucket names change
- **Fix**: Migration 002 — `ALTER TABLE knowledge.chunks DROP COLUMN bucket_name`

### L9. `metadata.document_access_rules` thiếu index ✅ FIXED
- **File**: `infrastructure/init-db/002_metadata.sql:85-100`
- **Issue**: Không index trên `target_role`, `target_department_id`, `target_user_id`
- **Impact**: Access check queries full table scan
- **Fix**: Migration 002 — `CREATE INDEX idx_access_rules_targets ON metadata.document_access_rules(target_type, target_role, target_department_id, target_user_id)`

---

## Priority Fix Order (Before Re-ingest)

| Priority | Issue | Status | Reason |
|----------|-------|--------|--------|
| ~~1~~ | ~~**M1** — Chunk character offsets~~ | ✅ DONE | Highlight dùng offsets thay vì text matching |
| ~~2~~ | ~~**C5** — Document deletion cleanup~~ | ✅ DONE | Soft-delete chunks khi xóa document |
| ~~3~~ | ~~**H1** — Event timestamp~~ | ✅ DONE | Events dùng real UTC timestamp |
| ~~4~~ | ~~**M7** — BM25 Vietnamese stemmer~~ | ✅ DONE | Đổi 'english' → 'simple' cho tiếng Việt |
| ~~5~~ | ~~**L7** — chat_stream retrieval limit~~ | ✅ DONE | Consistent retrieval limit |
| ~~6~~ | ~~**H4-H6** — FK constraints~~ | ✅ DONE | Migration 002 thêm FK cho conversations, metadata, feedbacks |
| ~~7~~ | ~~**M6** — question_normalized~~ | ✅ DONE | Trigger auto-normalize unanswered questions |
| ~~8~~ | ~~**M8** — vector_indexed flag~~ | ✅ DONE | Set TRUE cho chunks đã có embedding |
| ~~9~~ | ~~**M10** — Event publishing failures~~ | ✅ DONE | Thêm log.error() thay vì empty catch |
| ~~10~~ | ~~**L2** — language default~~ | ✅ DONE | DROP DEFAULT 'vi' → NULL |
| ~~11~~ | ~~**L3** — chunk_type default~~ | ✅ DONE | Đổi default 'child' → 'parent' |
| ~~12~~ | ~~**L9** — access_rules index~~ | ✅ DONE | Thêm composite index cho access checks |
| ~~13~~ | ~~**C2** — JWT Secret~~ | ✅ DONE | Generate secret mới, update auth-service + api-gateway |
| ~~14~~ | ~~**H2** — Rate limit fail-open~~ | ✅ DONE | In-memory fallback khi Redis down |
| ~~15~~ | ~~**M3** — Fingerprint embedding~~ | ✅ DONE | Lưu fingerprint vào DB trong pipeline |
| ~~16~~ | ~~**M4** — Similarity to previous~~ | ✅ DONE | Compute similarity khi có version mới |
| ~~17~~ | ~~**M5** — OCR confidence~~ | ✅ DONE | Real OCR confidence từ Tesseract image_to_data |
| ~~18~~ | ~~**L1** — Tag usage count~~ | ✅ DONE | Trigger update on soft-delete |
| ~~19~~ | ~~**L4** — PipelineOrchestrator~~ | ✅ DONE | Refactor chat.py → dùng orchestrator |
| ~~20~~ | ~~**L5** — content_tsv English~~ | ✅ DONE | Migration 001 đổi 'english' → 'simple' |
| ~~21~~ | ~~**L8** — bucket_name redundant~~ | ✅ DONE | DROP column trong migration 002 |
| ~~22~~ | ~~**C1, C3** — Credentials, Admin password~~ | ✅ DONE | Tạo .env.example, random password generation, mustChangePassword flag |
| ~~23~~ | ~~**H3** — Gateway rate limiter~~ | ✅ DONE | Redis integration cho distributed rate limiting |
| ~~24~~ | ~~**H7** — CORS~~ | ✅ DONE | Restrict tới FRONTEND_ORIGIN env var |
| ~~25~~ | ~~**H8** — SecurityUtils~~ | ✅ DONE | Throw IllegalStateException thay vì return null |
| ~~26~~ | ~~**H9** — Event contract mismatch~~ | ✅ DONE | Java consumer extract từ payload key, snake_case mapping |
| ~~27~~ | ~~**L6** — Seed UUIDs~~ | ✅ DONE | Dùng uuid_generate_v4() thay vì predictable UUIDs |
| 1 | **M2** — Analytics tables | TODO | Not your part |
| 2 | **M9, M11** — Report export, user_profiles | TODO | Not your part |
