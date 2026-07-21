-- ==============================================================
-- 012_conflict_resolution.sql
-- A resume's extracted email can collide with a different, already-
-- existing candidate row (e.g. the same person re-uploads a resume as
-- a fresh application before the worker has a chance to recognize them
-- by email). Give the worker a place to pause and record that instead
-- of crashing through the candidates.email unique constraint.
-- ==============================================================

ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'duplicate_candidate';
ALTER TYPE processing_job_status ADD VALUE IF NOT EXISTS 'needs_review';

ALTER TABLE resume_processing_jobs
  ADD COLUMN IF NOT EXISTS conflict_data JSONB DEFAULT NULL;
