-- ============================================================
-- POLIWISE DATABASE INIT (SELF-HOSTED POSTGRES)
-- ============================================================
-- This script is executed automatically by postgres container on first boot.
-- Schema execution order is CRITICAL - numbered prefix ensures order.
--
-- Execution sequence:
--   001-005: Core tables (schema, enum, columns, basic indexes)
--   006:    Triggers and functions (depends on tables)
--   007:    Seed data (depends on tables)
--   008:    AI indexes (depends on tables, runs last for memory allocation)
-- ============================================================

\i /docker-entrypoint-initdb.d/001_core.sql
\i /docker-entrypoint-initdb.d/002_metadata.sql
\i /docker-entrypoint-initdb.d/003_knowledge.sql
\i /docker-entrypoint-initdb.d/004_conversation.sql
\i /docker-entrypoint-initdb.d/005_analytics.sql
\i /docker-entrypoint-initdb.d/006_functions_triggers.sql
\i /docker-entrypoint-initdb.d/007_seed_data.sql
\i /docker-entrypoint-initdb.d/008_ai_indexes.sql