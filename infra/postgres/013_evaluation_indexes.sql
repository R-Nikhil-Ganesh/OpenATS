-- ==============================================================
-- 013_evaluation_indexes.sql
-- The dominant query pattern against application_ai_evaluations and
-- resume_processing_jobs is "latest row for this application"
-- (WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1), used
-- throughout candidates/jobs/applications/dashboard routes. The plain
-- single-column indexes from 008_indexes.sql satisfy the WHERE but
-- still require a sort; add composite indexes so Postgres can walk
-- the index directly in the needed order.
-- ==============================================================

CREATE INDEX IF NOT EXISTS idx_evaluations_app_created
  ON application_ai_evaluations(application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_app_created
  ON resume_processing_jobs(application_id, created_at DESC);
