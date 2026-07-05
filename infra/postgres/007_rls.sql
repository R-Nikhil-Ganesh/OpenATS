-- ==============================================================
-- 007_rls.sql
-- Row-Level Security policies for all tenant-scoped tables.
-- Each policy enforces that rows are only visible / mutable
-- when app.current_tenant_id session variable matches tenant_id.
-- ==============================================================

-- ------------------------------------------------------------
-- Application role for the API server
-- The app sets: SET LOCAL app.current_tenant_id = '<uuid>';
-- This role is used at runtime (not superuser) so RLS applies.
-- ------------------------------------------------------------
CREATE ROLE openats_app LOGIN PASSWORD 'changeme';

-- ==============================================================
-- users
-- ==============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- refresh_tokens
-- ==============================================================
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_tenant_isolation ON refresh_tokens
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- job_requisitions
-- ==============================================================
ALTER TABLE job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requisitions FORCE ROW LEVEL SECURITY;

CREATE POLICY job_requisitions_tenant_isolation ON job_requisitions
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- candidates
-- ==============================================================
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;

CREATE POLICY candidates_tenant_isolation ON candidates
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- resumes
-- ==============================================================
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes FORCE ROW LEVEL SECURITY;

CREATE POLICY resumes_tenant_isolation ON resumes
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- applications
-- ==============================================================
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications FORCE ROW LEVEL SECURITY;

CREATE POLICY applications_tenant_isolation ON applications
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- application_ai_evaluations
-- ==============================================================
ALTER TABLE application_ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_ai_evaluations FORCE ROW LEVEL SECURITY;

CREATE POLICY application_ai_evaluations_tenant_isolation ON application_ai_evaluations
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- application_state_history
-- ==============================================================
ALTER TABLE application_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_state_history FORCE ROW LEVEL SECURITY;

CREATE POLICY application_state_history_tenant_isolation ON application_state_history
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- resume_processing_jobs
-- ==============================================================
ALTER TABLE resume_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_processing_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY resume_processing_jobs_tenant_isolation ON resume_processing_jobs
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- role_history_snapshots
-- ==============================================================
ALTER TABLE role_history_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_history_snapshots FORCE ROW LEVEL SECURITY;

CREATE POLICY role_history_snapshots_tenant_isolation ON role_history_snapshots
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- resume_embeddings
-- ==============================================================
ALTER TABLE resume_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_embeddings FORCE ROW LEVEL SECURITY;

CREATE POLICY resume_embeddings_tenant_isolation ON resume_embeddings
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- job_embeddings
-- ==============================================================
ALTER TABLE job_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_embeddings FORCE ROW LEVEL SECURITY;

CREATE POLICY job_embeddings_tenant_isolation ON job_embeddings
  FOR ALL
  USING      (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ==============================================================
-- Grant all table permissions to openats_app role
-- ==============================================================
GRANT ALL ON TABLE tenants                    TO openats_app;
GRANT ALL ON TABLE users                      TO openats_app;
GRANT ALL ON TABLE refresh_tokens             TO openats_app;
GRANT ALL ON TABLE job_requisitions           TO openats_app;
GRANT ALL ON TABLE candidates                 TO openats_app;
GRANT ALL ON TABLE resumes                    TO openats_app;
GRANT ALL ON TABLE applications               TO openats_app;
GRANT ALL ON TABLE application_ai_evaluations TO openats_app;
GRANT ALL ON TABLE application_state_history  TO openats_app;
GRANT ALL ON TABLE resume_processing_jobs     TO openats_app;
GRANT ALL ON TABLE role_history_snapshots     TO openats_app;
GRANT ALL ON TABLE resume_embeddings          TO openats_app;
GRANT ALL ON TABLE job_embeddings             TO openats_app;
