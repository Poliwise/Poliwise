# Poliwise Project Completion Audit

**Audit date:** 2026-06-22  
**Repository:** `Poliwise/Poliwise`  
**Audited baseline:** `main` after PR #14 (`d9691b99e82c34bd469e85310cc8aabef422a729`)  
**PR reviewed:** #14, `Feature/onlyoffice`  
**Overall verdict:** Merged and buildable, but not production-ready.

## 1. Executive Summary

PR #14 was 19 commits behind `main`, touched 149 files after integration, and originally had five textual conflicts. The conflicts were resolved without dropping the newer AI-QA pipeline, frontend API mappings, JVM limits, streaming proxy behavior, or MinIO content-reading support already present on `main`.

Before merge, the following PR blockers were also corrected:

- Mapped the Docker `ONLYOFFICE_*` variables to Spring's `poliwise.onlyoffice.*` configuration namespace.
- Made the callback filter use the same `OnlyOfficeProperties` secret source as the editor service.
- Replaced the public UUID-only document file URL with a one-hour, document-bound signed JWT URL.
- Replaced the dead `blob:placeholder` re-edit URL with a backend-served signed URL.
- Added the missing `rehype-raw` lockfile snapshot required for frozen dependency installation.
- Added the OnlyOffice variables to the root `.env.example`.

The merged tree compiles, but important work remains. The highest-risk gaps are database migration delivery for existing installations, broken unauthenticated service-to-service statistics calls, weak callback claim binding, missing tests for the new OnlyOffice and analytics code, failing Python suites, a failing frontend lint gate, and the absence of CI.

## 2. Merge and Conflict Resolution Record

| Item | Result |
|---|---|
| Original PR state | `dirty`, no checks, no reviews |
| Conflicted files | `docker-compose.yml`, `frontend/web/lib/api.ts`, gateway `proxy.service.ts`, auth `AdminInitializer.java`, knowledge `StorageService.java` |
| Resolution commit | `1a36be0` (`Merge main and resolve PR conflicts`) |
| Blocker/security fix commit | `738eb64` (`fix(onlyoffice): bind runtime config and secure file downloads`) |
| Final GitHub merge | `d9691b99e82c34bd469e85310cc8aabef422a729` |
| Merge method | Merge commit |

Resolution decisions:

- Preserved the newer `main` JVM memory limits and added the OnlyOffice environment variables around them.
- Preserved both gateway streaming support and PR binary-file proxy support.
- Preserved both frontend response coercion and AI message/source mapping.
- Preserved the stronger first-login admin password warning.
- Preserved both public/internal MinIO URLs and `readFileContent`.

## 3. Verification Performed

| Check | Result | Notes |
|---|---|---|
| Git conflict scan | PASS | No unresolved conflict markers or unmerged paths |
| `docker compose config --quiet` | PASS | Warned only that `GROQ_API_KEY` was unset |
| Frontend `next build` | PASS | 25 routes generated; TypeScript passed |
| Frontend ESLint | FAIL | 67 errors and 100 warnings |
| API gateway `nest build` | PASS | TypeScript compilation passed |
| API gateway Jest | NO COVERAGE | `No tests found` |
| Auth service Maven tests | PASS | 14 tests passed |
| User service Maven tests | COMPILE ONLY | No test sources |
| Knowledge service Maven tests | COMPILE ONLY | No test sources |
| Metadata service Maven tests | COMPILE ONLY | No test sources |
| Feedback service Maven tests | COMPILE ONLY | No test sources; many Lombok builder-default warnings |
| AI-QA pytest | FAIL | 2 passed, 6 failed, 4 warnings |
| Ingestion pytest | FAIL | Collection error after discovering 24 tests |
| Full Docker end-to-end run | NOT PERFORMED | Requires database reset/migration decision, model/API credentials, and OnlyOffice runtime resources |

## 4. Critical and High-Priority Gaps

### C1. Existing databases will not receive the OnlyOffice tables

**Evidence:** `infrastructure/init-db/009_document_locks.sql` creates `knowledge.document_locks` and `knowledge.document_version_deletions`, but the repository has no Flyway/Liquibase migration path. The PostgreSQL entrypoint runs initialization files only when the data directory is empty.

**Impact:** An existing deployment can start the new application code against a database that has neither table. Lock acquisition, conflict resolution, and version deletion will fail at runtime.

**Required completion:** Add a versioned migration mechanism or an explicit, idempotent upgrade command. Verify upgrade from the current pre-PR schema without deleting the volume.

### C2. The database initialization directory has two execution mechanisms

**Evidence:** `docker-compose.yml:13` mounts the entire `infrastructure/init-db` directory into `/docker-entrypoint-initdb.d`, while `infrastructure/init-db/init.sql` includes `000_bootstrap.sql` through `008_ai_indexes.sql` again. `009_document_locks.sql` is not listed in `init.sql`.

**Impact:** A fresh PostgreSQL container can execute numbered scripts directly and then execute `init.sql`, repeating schema/data operations. Whether startup succeeds depends on every repeated statement being idempotent. The execution model is also unclear for `009`.

**Required completion:** Choose one mechanism: mount only `init.sql`, or remove `init.sql` and rely on numbered entrypoint files. Add a clean-volume bootstrap test.

### H1. Dashboard service-to-service statistics calls have a broken authentication contract

**Evidence:**

- `services/user-service/.../JwtAuthenticationFilter.java:121` skips `/api/v1/users/stats`.
- `services/knowledge-service/.../JwtAuthenticationFilter.java:151` skips `/api/v1/documents/stats`.
- Both Spring Security chains still require `.anyRequest().authenticated()`.
- `feedback-service` Feign clients call both endpoints without a user JWT or internal API key.
- `DashboardService.java:107-118` catches the resulting failure and silently leaves totals at zero.

**Impact:** Analytics can display plausible but incorrect zero user/document totals, hiding the integration failure.

**Required completion:** Define an authenticated internal-service contract, preferably an internal API key or service identity, and add an integration test covering the feedback-to-user and feedback-to-knowledge calls. Do not solve this by exposing the endpoints publicly.

### H2. OnlyOffice callback authentication does not bind all signed claims to the routed document

**Evidence:** `OnlyOfficeCallbackFilter` verifies a JWT, but `OnlyOfficeController.java:222-225` constructs a new principal from the path `documentId` and request-body `key` rather than using and comparing the authenticated principal. The save service currently does not validate that the callback key belongs to the active lock.

**Impact:** A valid callback token could be replayed or confused across document routes if an attacker obtains a token and document identifier. The new file-download route is now document-bound, but callback handling still needs explicit claim/body/path consistency checks.

**Required completion:** Validate the Document Server's actual callback JWT shape, then compare signed `key`, callback-body `key`, path `documentId`, and active lock token. Add replay, wrong-document, wrong-key, expired-token, and tampered-token tests.

### H3. New core features have almost no automated coverage

**Evidence:** The frontend and gateway have zero test files. User, knowledge, metadata, and feedback services compile but have no test sources. PR #14 adds approximately 1,500 lines to `OnlyOfficeService`, more than 1,100 lines to `OnlyOfficeEditor`, report export logic, metrics, audit consumers, admin flows, and schema changes without focused tests.

**Impact:** Lock expiry, concurrent saves, conflict resolution, version deletion, JWT callbacks, binary proxying, report generation, and event consumers can regress without detection.

**Required completion:** Add unit and integration tests around the new domain flows, plus one Docker-backed browser test that opens, edits, saves, conflicts, resolves, and reopens a DOCX file.

### H4. AI-QA test suite is not green or hermetic

**Evidence:** `pytest` collected 8 tests and produced 2 passes / 6 failures. `tests/integration/test_health.py:10` expects `status: ok` while the application returns `status: healthy`. Five `test_pipeline_e2e.py` tests call a live server and fail with `httpx.ConnectError` when it is not running. Test import also requires `INTERNAL_API_KEY` and `GROQ_API_KEY` environment variables.

**Impact:** The suite cannot be used as a merge gate and mixes unit/in-process checks with unmanaged live-system checks.

**Required completion:** Align the health contract, mark live tests explicitly, provision their server/dependencies in CI, and provide safe test defaults or fixtures for required settings.

### H5. Ingestion tests fail during collection

**Evidence:** `pytest` discovers 24 tests but stops because `tests/ingestion_tests/test_ingestion_flow.py:19` imports `src.services.extractors.base.ExtractedDocument`; `src.services.extractors` is a module in the current layout, not the expected package.

**Impact:** No ingestion behavior is exercised, including extraction, deduplication, chunking, and embedding persistence.

**Required completion:** Repair imports/test package layout and run all 24 tests against the supported Python version.

## 5. Medium-Priority Gaps

### M1. Frontend lint is far from a usable quality gate

ESLint reports 67 errors and 100 warnings. Main categories are explicit `any`, synchronous `setState` in effects, unescaped JSX text, stale hook dependency lists, and unused imports/variables. The largest concentrations are in `app/documents/[id]/page.tsx`, `components/onlyoffice/OnlyOfficeEditor.tsx`, `lib/api.ts`, and admin pages.

**Completion criterion:** Reduce lint to zero errors, decide a warning budget, and enforce it in CI.

### M2. No CI/CD or required checks are configured

No `.github/workflows`, GitLab CI, Jenkinsfile, or Azure pipeline exists. PR #14 had zero check runs.

**Completion criterion:** Add a PR workflow for compose validation, frontend build/lint, gateway build/test, Maven tests, Python tests, secret scanning, and dependency scanning. Protect `main` with required checks.

### M3. Dependency health needs remediation

`npm ci` for the gateway reports 39 vulnerabilities: 1 low, 26 moderate, and 12 high. Frontend installation reports that `react-query@3.39.3` supports React only through 18 while the project uses React 19. The frontend package also declares a suspicious self-dependency, `"web": "file:"`.

**Completion criterion:** Review advisories in an approved environment, upgrade production dependencies, migrate from legacy React Query v3, remove the self-dependency, and lock the supported Node version to 20 or 22.

### M4. Production configuration still permits insecure fallback credentials

`docker-compose.yml` contains development defaults for JWT, Redis, RabbitMQ, MinIO, database credentials, and the OnlyOffice secret. `.env.example` now documents OnlyOffice values, but Compose does not fail closed if they are omitted.

**Completion criterion:** Use required-variable syntax for production, separate development and production Compose overlays, and load secrets from a secret manager or Docker secrets.

### M5. Configuration documentation is inconsistent

The root `.env.example` sets `NEXT_PUBLIC_API_URL=http://localhost:3000`, while the gateway is exposed on port `3001`. `knowledge-service/application.properties` defaults `knowledge.metadata.api-url` to port `8085`, although metadata-service runs on `8084`; Compose overrides it, but local startup does not.

**Completion criterion:** Generate or validate environment documentation from one source and add a configuration smoke test.

### M6. OnlyOffice runtime has not been proven end to end

The Document Server image, callback reachability, Redis password, signed file URL, forcesave command, lock expiry, and MinIO fetch path were compile-checked but not exercised together. The Compose reservation is 2 GB and limit is 4 GB, which also affects developer and CI capacity.

**Completion criterion:** Run a repeatable Docker scenario with browser automation and capture callback logs, version rows, lock rows, MinIO objects, and conflict outcomes.

### M7. Internationalization is partial

PR #14 adds a large i18n dictionary and language provider, but multiple pages/components still contain hard-coded Vietnamese strings. Error messages also remain embedded in API/client logic.

**Completion criterion:** Move user-visible strings to translation keys and add a route-level English/Vietnamese rendering check.

### M8. Report and analytics paths lack behavioral verification

`ReportExportService` and analytics/dashboard code grew substantially, but feedback-service has no tests. Numerous Lombok warnings indicate builder initializers that are ignored unless `@Builder.Default` is used.

**Completion criterion:** Add report format tests, aggregation tests, event-consumer tests, and fix or intentionally suppress each builder-default warning.

## 6. Lower-Priority Cleanup

- `knowledge-service/EmbeddingService.java:24-29` is an unused placeholder returning a one-dimensional zero vector; remove it or implement it to avoid accidental future use.
- `OnlyOfficeController.java:369-373` exposes an autocomplete callback placeholder that always returns 200; either implement the SDK contract or remove the endpoint/documentation.
- API metrics are in-memory and reset on gateway restart; use Prometheus-compatible counters if historical operational metrics are required.
- Pydantic v2 warnings remain in AI-QA models, and a settings field conflicts with the protected `model_` namespace.
- Scratch scripts and large local database/log artifacts have existed in repository history; keep generated data, credentials, and runtime diagnostics out of source control.
- Several architecture/context documents describe older service behavior and should be revalidated after the OnlyOffice and analytics merge.

## 7. Recommended Completion Order

1. Deliver a safe existing-database migration and remove duplicate bootstrap execution.
2. Fix internal stats authentication and add contract tests.
3. Complete callback claim/key/path validation and add OnlyOffice security tests.
4. Make AI-QA and ingestion pytest suites green and hermetic.
5. Add frontend/gateway/Java tests for the merged feature paths.
6. Reduce frontend lint to zero errors.
7. Add CI and protect `main` with required checks.
8. Run the full Docker + browser OnlyOffice conflict scenario.
9. Remediate dependencies and production secret handling.
10. Finish i18n, documentation alignment, warnings, and placeholder cleanup.

## 8. Definition of Production Ready

Poliwise should not be marked production-ready until all of the following are true:

- A pre-PR database can upgrade in place and a fresh database initializes exactly once.
- All builds, linters, and automated tests pass in CI from a clean checkout.
- OnlyOffice download and callback paths reject missing, expired, tampered, wrong-document, and replayed tokens.
- The edit/save/conflict/resolve/version-delete flows pass Docker-backed browser tests.
- Dashboard totals are retrieved through an authenticated internal contract and cannot silently degrade to zero.
- No high-severity production dependency advisories remain without documented acceptance.
- Production startup fails when mandatory secrets are absent or left at defaults.
- Operational runbooks cover backup, restore, schema migration, OnlyOffice storage, monitoring, and rollback.

## 9. Final Status

PR #14 is merged and the merged code compiles. The conflict resolution itself is complete. The project remains **feature-complete only at a prototype/integration level**, not production-complete, because critical migration, authentication-contract, security-validation, automated-test, and CI work remains.
