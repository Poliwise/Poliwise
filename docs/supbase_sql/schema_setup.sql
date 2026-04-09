-- ============================================================
-- CREATE SCHEMAS FOR POLIWISE
-- ============================================================

-- Core schema: Authentication, Users, Departments
CREATE SCHEMA IF NOT EXISTS core;

-- Metadata schema: Document metadata, Access control, Categories
CREATE SCHEMA IF NOT EXISTS metadata;

-- Knowledge schema: Documents, Chunks, Processing
CREATE SCHEMA IF NOT EXISTS knowledge;

-- Conversation schema: Q&A conversations, Messages
CREATE SCHEMA IF NOT EXISTS conversation;

-- Analytics schema: Feedbacks, Stats, Audit logs
CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant usage to authenticated users (Supabase)
GRANT USAGE ON SCHEMA core TO authenticated;
GRANT USAGE ON SCHEMA metadata TO authenticated;
GRANT USAGE ON SCHEMA knowledge TO authenticated;
GRANT USAGE ON SCHEMA conversation TO authenticated;
GRANT USAGE ON SCHEMA analytics TO authenticated;

-- Grant usage to service_role (backend services)
GRANT ALL ON SCHEMA core TO service_role;
GRANT ALL ON SCHEMA metadata TO service_role;
GRANT ALL ON SCHEMA knowledge TO service_role;
GRANT ALL ON SCHEMA conversation TO service_role;
GRANT ALL ON SCHEMA analytics TO service_role;