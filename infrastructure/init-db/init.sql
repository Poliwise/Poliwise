-- ============================================================
-- POLIWISE DATABASE INIT (SELF-HOSTED POSTGRES)
-- ============================================================
-- This script is executed automatically by postgres container on first boot.
-- It intentionally skips Supabase-specific RLS policies.

-- Core schema: Authentication, users, departments
CREATE SCHEMA IF NOT EXISTS core;

-- Metadata schema: Categories, tags, ACL
CREATE SCHEMA IF NOT EXISTS metadata;

-- Knowledge schema: Documents, chunks, processing
CREATE SCHEMA IF NOT EXISTS knowledge;

-- Conversation schema: Chat sessions and messages
CREATE SCHEMA IF NOT EXISTS conversation;

-- Analytics schema: Feedback and reporting
CREATE SCHEMA IF NOT EXISTS analytics;

-- Load table definitions in dependency order.
\i /docker-entrypoint-initdb.d/supbase_sql/user_and_authen.sql
\i /docker-entrypoint-initdb.d/supbase_sql/document_metadata.sql
\i /docker-entrypoint-initdb.d/supbase_sql/knowledge_management.sql
\i /docker-entrypoint-initdb.d/supbase_sql/conversation_and_message_store.sql
\i /docker-entrypoint-initdb.d/supbase_sql/analysis.sql

-- Load shared triggers/functions and cross-schema views.
\i /docker-entrypoint-initdb.d/supbase_sql/automic_timestamp_etc.sql

-- NOTE: consolidate_cros.sql is not loaded by default in Mode A.
-- Some services (e.g., user-service) use Hibernate schema update and can
-- alter table columns during startup; dependent views can block that flow.
-- Run consolidate_cros.sql manually when your schema is stabilized.

-- Apply compatibility and seed scripts.
\i /docker-entrypoint-initdb.d/supbase_sql/migration_fix_ip_address.sql
\i /docker-entrypoint-initdb.d/supbase_sql/seed_default.sql

-- Apply additional additive patch set.
\i /docker-entrypoint-initdb.d/supbase_sql_update_v1/001_pure_additions.sql
\i /docker-entrypoint-initdb.d/supbase_sql_update_v1/002_staging_upload.sql

-- Apply Phase 2 migrations (redundancy detection + indexes)
\i /docker-entrypoint-initdb.d/supbase_sql_update_v2/001_redundancy_detection.sql
