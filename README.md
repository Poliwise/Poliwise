# Poliwise Coworker Quickstart

This checkout is intended for pre-presentation coworker testing of the current P0/P1 stabilization branch.

## Branch And Baseline

- Planned branch for handoff: `fix/p0-p1-security-correctness`
- Current checkout observed during this handoff pass: `fix/audited-security-and-logic`
- Planned baseline from the handoff plan: `0d082f1`
- Current `HEAD` observed during this handoff pass: `88d4a24`

Confirm the branch before pushing or asking coworkers to test:

```powershell
git status --short --branch
git rev-parse --short HEAD
```

## Required Setup

Copy environment examples before starting Docker Compose:

```powershell
Copy-Item .env.example .env
Copy-Item services\auth-service\.env.example services\auth-service\.env
```

Set real local secret values in `.env` and `services\auth-service\.env`. For an AI demo, set `GROQ_API_KEY` in `.env`.

Email delivery is optional for the presentation. Keep `EMAIL_ENABLED=false` unless SMTP credentials have been tested.

## Docker Commands

Validate Compose configuration:

```powershell
docker compose config --quiet
```

Build the presentation-critical services:

```powershell
docker compose build auth-service user-service metadata-service knowledge-service feedback-service api-gateway frontend ingestion-service
```

Start the stack without deleting volumes:

```powershell
docker compose up -d
```

Check service status:

```powershell
docker compose ps
```

## Local URLs

- Frontend: http://localhost:3000
- API gateway: http://localhost:3001
- MinIO console: http://localhost:9001
- RabbitMQ management: http://localhost:15672
- OnlyOffice document server: http://localhost:8888

## Presentation Smoke Test

Run this flow before handing the branch to a coworker:

1. Log in with a seeded or configured account.
2. Open the document list and read a document.
3. Upload a document if the available account has the required permission.
4. Ask an AI Q&A question.
5. Open the admin unanswered questions page.
6. Run policy compare if demo data is available.
7. Open the password reset page at http://localhost:3000/reset-password.

## Known Non-Blocking Warnings

- Do not run destructive volume resets before the presentation unless clean bootstrap has already been tested.
- Do not demo email delivery unless SMTP credentials and the full reset email path have been pre-tested.
- Do not demo P2 features before they are implemented and validated.
- Docker may print local credential/config warnings on Windows; validate whether the actual Compose command still succeeds.
