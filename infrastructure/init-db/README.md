# Database Setup (Mode A)

This project uses one PostgreSQL database (`poliwise`) with 5 schemas:
- `core`
- `metadata`
- `knowledge`
- `conversation`
- `analytics`

The default init flow is executed by Docker on first startup via:
- `infrastructure/init-db/init.sql`

RLS script is intentionally excluded from default bootstrap because it is Supabase-specific.
Cross-schema views in `docs/supbase_sql/consolidate_cros.sql` are also excluded from default bootstrap to avoid blocking Hibernate auto-migration in `user-service`.

## 1. Start Infrastructure

```powershell
docker compose up -d postgres rabbitmq minio
```

## 2. Verify Database Initialization

```powershell
docker compose logs postgres --tail 200
docker compose exec -T postgres psql -U poliwise -d poliwise -c "\dn"
```

Expected schemas: `analytics`, `conversation`, `core`, `knowledge`, `metadata`, `public`.

## 3. Verify Core Tables Quickly

```powershell
docker compose exec -T postgres psql -U poliwise -d poliwise -c "SELECT COUNT(*) FROM core.users;"
docker compose exec -T postgres psql -U poliwise -d poliwise -c "SELECT COUNT(*) FROM metadata.categories;"
docker compose exec -T postgres psql -U poliwise -d poliwise -c "SELECT COUNT(*) FROM knowledge.documents;"
docker compose exec -T postgres psql -U poliwise -d poliwise -c "SELECT COUNT(*) FROM conversation.conversations;"
docker compose exec -T postgres psql -U poliwise -d poliwise -c "SELECT COUNT(*) FROM analytics.feedbacks;"
```

## 4. Start Application Services

```powershell
docker compose up -d auth-service user-service knowledge-service metadata-service feedback-service api-gateway frontend
```

## 5. Full Bring-up

```powershell
docker compose up -d
```

## 6. Re-run Initialization from Scratch

Postgres init scripts run only when database volume is empty.

```powershell
docker compose down
docker volume rm poliwise_postgres_data
docker compose up -d postgres
```

Or run one command from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\infrastructure\init-db\reset-and-bootstrap.ps1
```

Force mode (skip confirmation):

```powershell
powershell -ExecutionPolicy Bypass -File .\infrastructure\init-db\reset-and-bootstrap.ps1 -Force
```

## 7. Optional AI/Vector Enhancements

`infrastructure/init-db/init-enhancements.sql` is optional and should be applied only after validating table names and pgvector availability in your PostgreSQL image.

## 8. Optional Cross-Schema Views

Apply consolidated views only after schema is stable:

```powershell
docker compose exec -T postgres psql -U poliwise -d poliwise -f /docker-entrypoint-initdb.d/supbase_sql/consolidate_cros.sql
```
