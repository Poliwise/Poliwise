# Presentation Readiness Handoff - 2026-06-25

## Scope

This pass intentionally avoids P2 implementation before the June 26 presentation. It only updates setup documentation and records validation status for coworker testing.

## Branch And Baseline

- Planned branch from handoff plan: `fix/p0-p1-security-correctness`
- Observed branch during this pass: `fix/audited-security-and-logic`
- Planned baseline from handoff plan: `0d082f1`
- Observed `HEAD` during this pass: `88d4a24`
- Status: baseline mismatch observed; do not claim the planned branch/baseline is confirmed until checked in the intended worktree.

## Documentation Changes

- Replaced the placeholder root `README.md` with a coworker quickstart.
- Added password reset setup variables to `services/auth-service/.env.example`:
  - `AUTH_PASSWORD_RESET_TTL=PT30M`
  - `AUTH_PASSWORD_RESET_FRONTEND_URL=http://localhost:3000/reset-password`
- Added this presentation readiness report.

## P0/P1 Change Summary

The current working tree already contains P0/P1-oriented changes before this documentation pass. Based on the checked-out files, the stabilization area includes:

- Password reset and forgot-password frontend routes and auth proxy endpoints.
- Admin unanswered question frontend flow.
- OnlyOffice/document preview and conflict handling changes.
- Feedback/report export/unanswered question persistence changes.
- Service Dockerfile and Compose hardening work.

This report does not reclassify or approve those changes as production-ready; it records the pre-presentation handoff state.

## Intentionally Deferred

- P2 bookmarks.
- P2 notifications.
- Durable user settings.
- User-managed API keys.
- Clean-volume bootstrap validation unless explicitly scheduled before the presentation.
- Email delivery demo unless SMTP credentials and the full reset path are pre-tested.

## Validation Results

| Command | Result | Notes |
| --- | --- | --- |
| `docker compose config --quiet` | Pass | Command exited 0. |
| `docker compose build auth-service user-service metadata-service knowledge-service feedback-service api-gateway frontend ingestion-service` | Pass | All eight requested images built successfully. Feedback-service tests ran during the build with `Tests run: 4, Failures: 0, Errors: 0, Skipped: 0`; warning stack traces were expected assertions in failure-path tests. |
| `git diff --check` | Pass | Command exited 0. Git printed Windows LF-to-CRLF normalization warnings for existing working-copy files. |
| `git status --short --branch` | Warning | Working tree is not clean and branch is `fix/audited-security-and-logic`, not the planned `fix/p0-p1-security-correctness`. Many modified/untracked files pre-existed this documentation pass. |

## Live Stack Observation

`docker compose ps --format json` showed an existing live stack, so this pass did not run `docker compose down`, remove volumes, or recreate containers. The observed core services were running and healthy, including:

- `poliwise-frontend`
- `poliwise-api-gateway`
- `poliwise-auth-service`
- `poliwise-user-service`
- `poliwise-knowledge-service`
- `poliwise-metadata-service`
- `poliwise-feedback-service`
- `poliwise-ingestion-service`
- `poliwise-ai-qa-service`
- `poliwise-postgres`
- `poliwise-rabbitmq`
- `poliwise-minio`
- `poliwise-redis`
- `poliwise-onlyoffice`

## Coworker Setup Steps

Run from the repository root:

```powershell
Copy-Item .env.example .env
Copy-Item services\auth-service\.env.example services\auth-service\.env
```

Then edit the copied env files:

- Set strong local values for placeholders in `.env`.
- Set auth-service local secrets in `services\auth-service\.env`.
- Set `GROQ_API_KEY` in `.env` if the AI demo is needed.
- Keep `EMAIL_ENABLED=false` unless SMTP delivery has been tested.

Validate and start:

```powershell
docker compose config --quiet
docker compose build auth-service user-service metadata-service knowledge-service feedback-service api-gateway frontend ingestion-service
docker compose up -d
docker compose ps
```

## Default Local URLs

- Frontend: http://localhost:3000
- API gateway: http://localhost:3001
- MinIO console: http://localhost:9001
- RabbitMQ management: http://localhost:15672
- OnlyOffice document server: http://localhost:8888

## Recommended Demo Flow

1. Login.
2. Document list and document read.
3. Document upload, only if seeded credentials allow it.
4. AI Q&A.
5. Admin unanswered page.
6. Policy compare.
7. Password reset page.

## Do Not Demo Unless Pre-Tested

- Clean-volume bootstrap.
- Email delivery.
- P2 features.

## Known Gaps And Warnings

- The checkout used for this pass was not on the planned branch/baseline.
- The working tree had many pre-existing unrelated modifications before this documentation pass.
- Build success alone is not a full release gate; browser smoke testing and persistence checks are still needed before declaring the presentation flow ready.
