# Audit Task: Identify Code Mismatches vs. FEATURE_DESIGN.md

## Context

We are working on the **Poliwise** project — a multi-service RAG (Retrieval-Augmented Generation) knowledge management system. The repository is at `c:\Users\Tien\university\TTCS\do_an_cuoi_ky\Poliwise` and is a git repository.

The repo contains a recently updated **design specification** at `docs/FEATURE_DESIGN.md` (1347 lines) that describes how every feature in the system is supposed to work. The actual codebase is partially implemented — some features match the spec, some are partially implemented, and some are missing entirely.

**We need a thorough, evidence-based audit** to answer one critical question:

> *Given our deadline of end-of-day Sunday (~44 hours from now, minus sleep = ~30 working hours), is it feasible to bring the codebase into alignment with `docs/FEATURE_DESIGN.md`? What specifically is mismatched, what is already aligned, and what is the minimum viable path forward?*

---

## Project Background (Read These First)

Before starting, read these files to understand the architecture and conventions:

1. **`CLAUDE.md`** (at repo root, 241 lines) — Working rules, repo overview, common commands, service responsibilities, DB ownership boundaries, RBAC model.
2. **`docs/FEATURE_DESIGN.md`** (1347 lines) — The design spec to audit against.
3. **`reports/project-audit-2026-06-23.md`** and **`reports/audit-remediation-followup-2026-06-23.md`** — Previous audit reports showing the existing report format and style. Use the same style.

---

## Services & Schemas Map

| Service | Port | Schema | Language |
|---------|------|--------|----------|
| `frontend/web` | 3000 | — | Next.js 16 / TypeScript |
| `services/api-gateway` | 3001 | — | NestJS 11 / TypeScript |
| `services/auth-service` | 8081 | `core` | Spring Boot 3 / Java 17 |
| `services/user-service` | 8082 | `public` (default) | Spring Boot 3 / Java 17 |
| `services/knowledge-service` | 8083 | `knowledge` | Spring Boot 3 / Java 17 |
| `services/metadata-service` | 8084 | `metadata` | Spring Boot 3 / Java 17 |
| `services/feedback-service` | 8085 | `analytics` | Spring Boot 3 / Java 17 |
| `services/ai-qa-service` | 8086 | `conversation` | FastAPI / Python |
| `services/ingestion-service` | 8088 | `knowledge` (write) | FastAPI / Python |
| `infrastructure/init-db/` | — | — | SQL |
| `infrastructure/seed/` | — | — | SQL seed data |

---

## What I Need You to Do

### Phase 1 — Section-by-Section Code Inspection

Walk through **every numbered section in `docs/FEATURE_DESIGN.md`** (sections 1–15) and inspect the corresponding implementation in the codebase. For each section, produce a row in a table with:

| Section | Feature in design | Expected behavior | Actual code location(s) | Status | Gap / Mismatch | Effort to fix |
|---------|-------------------|-------------------|-------------------------|--------|----------------|---------------|

**Status values**: `MATCH` / `PARTIAL` / `MISSING` / `MISMATCH` / `PLANNED` (only documented, not implemented).

**Effort values**: `S` (<1h), `M` (1–3h), `L` (3–6h), `XL` (6h+).

### Phase 2 — Schema-Level Audit

Compare the **database schema** described in `FEATURE_DESIGN.md` against the actual SQL files in `infrastructure/init-db/` and `infrastructure/seed/`. Specifically check:

1. **Junction table `metadata.department_documents`** — Does it exist? If not, document the gap. Many-to-Many design in Section 2.3 depends on this.
2. **`knowledge.chunks.allowed_departments`, `allowed_roles`, `allowed_users`** arrays — Do these columns exist?
3. **`knowledge.document_versions.file_checksum`, `content_hash`, `semantic_fingerprint`** — Deduplication fields from Section 5.
4. **`analytics.audit_logs.department_id`** — Section 10.3 audit log enhancement.
5. **`core.users.strike_count`, `last_violation_at`** — Section 14 (planned).
6. Any enum types referenced in the design that are missing in `infrastructure/init-db/*.sql`.

For each, report: `EXISTS` / `PARTIAL` / `MISSING` and where to find it (or what's missing).

### Phase 3 — Script & Pipeline Audit

Check these specific files/scripts that are critical to the data pipeline:

1. **`services/ingestion-service/src/scripts/ingest_modal.py`** (817 lines) — Does it align with the new schema (junction table, ACL flattened arrays on chunks)?
2. **`services/ingestion-service/src/scripts/generate_seed_sql.py`** — Same audit.
3. **`infrastructure/seed/seed_data.sql`** and **`infrastructure/seed/seed_data_download.sql`** — Newer seed files. Do they assume the new schema?
4. **`scripts/testing/test_seed.sql`** — Test seed. Schema alignment?

For each, list concrete code locations (file path + line range) that need changes.

### Phase 4 — Frontend & API Gateway Audit

1. **Frontend upload form** in `frontend/web/` — Does it currently have a department selector for ADMIN? Is there a dropdown component ready, or does it need to be built?
2. **API Gateway route config** — Are the upload routes enforcing `ADMIN` role? Are there any new routes needed for junction table CRUD?
3. **Frontend services** (`frontend/web/services/*.service.ts`) — Any client code that needs updating to handle the new relationships.

### Phase 5 — Feature-by-Feature Effort Estimate

For **every feature that is `MISSING`, `PARTIAL`, or `MISMATCH`**, produce a concrete implementation plan with:
- **Files to change** (with paths)
- **Approximate LoC change**
- **Effort estimate** (S/M/L/XL)
- **Dependencies** (which other features must be done first)
- **Risk level** (Low/Medium/High)

### Phase 6 — Feasibility Verdict & Minimum Viable Path

Based on your findings, give a clear verdict:

1. **Total estimated effort** to bring codebase to 100% spec compliance (sum of XL/L/M/S).
2. **Critical path** — Which features MUST be done for the deadline?
3. **Defer-able features** — Which can be marked "documented but not implemented" in the final report?
4. **Recommended MVP scope** — The minimum set of features to ship by Sunday EOD.
5. **Risk callouts** — What's likely to break, what's untested, what assumptions need verification.

---

## Deliverables

Produce your output as **`reports/feature-design-audit-2026-06-27.md`** (use today's date if different).

The report must include:

1. **Executive summary** (3–5 paragraphs) — Overall match rate, biggest gaps, feasibility verdict.
2. **Section-by-section mismatch table** (Phase 1 output).
3. **Schema-level mismatch table** (Phase 2 output).
4. **Script audit table** (Phase 3 output).
5. **Frontend/gateway audit findings** (Phase 4 output).
6. **Effort estimate matrix** (Phase 5 output) — sortable by effort and risk.
7. **Feasibility verdict & recommended MVP** (Phase 6 output) — with explicit hour estimates.
8. **Concrete next-step checklist** for the next 30 hours, ordered by priority.

Use the same style and structure as the existing `reports/project-audit-2026-06-23.md` and `reports/audit-remediation-followup-2026-06-23.md` — match their tone, headings, and table formatting.

---

## Critical Reminders

- **Be evidence-based.** Every claim must cite a file path and line number. Don't say "the upload flow is incomplete" — say "`services/knowledge-service/src/main/java/.../UploadService.java:142` does not create a `department_documents` entry, but `docs/FEATURE_DESIGN.md:160` requires it."
- **Don't just read — verify.** When the design says something should exist, grep for it. When it shouldn't exist, grep to confirm absence.
- **Respect ownership boundaries** (per `CLAUDE.md` Section 6). Note when a feature crosses schema ownership — that's a coordination risk.
- **Don't propose new features.** Only identify gaps between design and code, and estimate effort to close them.
- **Don't write any code.** This is an audit. Output is a report only.
- **Match the report style** of existing files in `reports/`.

---

## Tools & Approach

You have access to:
- `Read`, `Grep`, `Glob` — for inspecting files
- `SemanticSearch` — for finding code by meaning (use for exploring unfamiliar areas)
- `Task` (with `explore` subagent) — for parallel exploration of multiple service codebases
- `Shell` — for `ls`, `wc -l`, etc. (do NOT use for editing files)

**Suggested approach**:
1. First, run `SemanticSearch` queries on each service to understand its high-level structure.
2. Then launch parallel `explore` subagents — one per service + one for SQL/scripts — to gather detailed evidence.
3. Synthesize findings into the report.
4. Be skeptical: if a subagent says "matches", verify with a targeted `Grep` before recording it as `MATCH`.

---

## Output Path

Write the final report to:
```
c:\Users\Tien\university\TTCS\do_an_cuoi_ky\Poliwise\reports\feature-design-audit-2026-06-27.md
```

After writing the report, print a **3-line summary** in your final response:
1. Total mismatch count by status (e.g., "12 MISSING, 8 PARTIAL, 5 MISMATCH, 70 MATCH").
2. Estimated total effort (hours).
3. Feasibility verdict (one of: `FEASIBLE` / `TIGHT-BUT-FEASIBLE` / `NOT-FEASIBLE-WITHOUT-CUTS` / `NOT-FEASIBLE`).
