-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- ============================================================
-- Core Schema RLS
-- ============================================================
ALTER TABLE core.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass" ON core.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON core.user_profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON core.refresh_tokens FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON core.login_history FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON core.departments FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Metadata Schema RLS
-- ============================================================
ALTER TABLE metadata.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.document_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.document_access_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass" ON metadata.categories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON metadata.tags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON metadata.document_metadata FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON metadata.document_tags FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON metadata.document_access_rules FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Knowledge Schema RLS
-- ============================================================
ALTER TABLE knowledge.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge.embedding_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass" ON knowledge.documents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON knowledge.document_versions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON knowledge.chunks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON knowledge.processing_jobs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON knowledge.embedding_cache FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Conversation Schema RLS
-- ============================================================
ALTER TABLE conversation.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation.unanswered_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass" ON conversation.conversations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON conversation.messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON conversation.unanswered_questions FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- Analytics Schema RLS
-- ============================================================
ALTER TABLE analytics.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.daily_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.hourly_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.department_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.popular_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.document_popularity ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass" ON analytics.feedbacks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON analytics.usage_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON analytics.audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON analytics.daily_aggregates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON analytics.hourly_aggregates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON analytics.department_daily_stats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON analytics.popular_questions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON analytics.document_popularity FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON analytics.report_exports FOR ALL USING (auth.role() = 'service_role');