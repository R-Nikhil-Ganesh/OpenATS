-- ==============================================================
-- 008_indexes.sql
-- Performance indexes for all frequently queried columns and
-- IVFFlat approximate-nearest-neighbor indexes for pgvector.
-- ==============================================================

-- ------------------------------------------------------------
-- Users
-- ------------------------------------------------------------
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ------------------------------------------------------------
-- Jobs
-- ------------------------------------------------------------
CREATE INDEX idx_jobs_status ON job_requisitions(status);
CREATE INDEX idx_jobs_created_by    ON job_requisitions(created_by);

-- ------------------------------------------------------------
-- Candidates
-- ------------------------------------------------------------
CREATE INDEX idx_candidates_email  ON candidates(email);

-- ------------------------------------------------------------
-- Resumes
-- ------------------------------------------------------------
CREATE INDEX idx_resumes_candidate ON resumes(candidate_id);
CREATE INDEX idx_resumes_hash      ON resumes(content_hash);

-- ------------------------------------------------------------
-- Applications
-- ------------------------------------------------------------
CREATE INDEX idx_applications_job_status    ON applications(job_id, status);
CREATE INDEX idx_applications_candidate     ON applications(candidate_id);
CREATE INDEX idx_applications_status ON applications(status);

-- ------------------------------------------------------------
-- AI Evaluations
-- ------------------------------------------------------------
CREATE INDEX idx_evaluations_application ON application_ai_evaluations(application_id);
CREATE INDEX idx_evaluations_tier        ON application_ai_evaluations(tier);

-- ------------------------------------------------------------
-- State History
-- ------------------------------------------------------------
CREATE INDEX idx_state_history_application ON application_state_history(application_id);
CREATE INDEX idx_state_history_changed_at  ON application_state_history(changed_at DESC);

-- ------------------------------------------------------------
-- Processing Jobs
-- ------------------------------------------------------------
CREATE INDEX idx_processing_jobs_application ON resume_processing_jobs(application_id);
CREATE INDEX idx_processing_jobs_status      ON resume_processing_jobs(status);

-- ------------------------------------------------------------
-- Role History Snapshots
-- ------------------------------------------------------------
CREATE INDEX idx_role_history_job    ON role_history_snapshots(job_id);

-- ------------------------------------------------------------
-- Embeddings — IVFFlat for approximate nearest neighbor search
-- lists=100 for resume_embeddings (larger corpus expected)
-- lists=50  for job_embeddings   (smaller corpus)
-- ------------------------------------------------------------
CREATE INDEX idx_resume_embeddings_ivfflat
  ON resume_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_job_embeddings_ivfflat
  ON job_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);
