-- ==============================================================
-- 006_embeddings.sql
-- Vector embedding tables for semantic similarity search
-- ==============================================================

-- ------------------------------------------------------------
-- Resume Embeddings — sentence-transformer vectors per resume
-- ------------------------------------------------------------
CREATE TABLE resume_embeddings (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id   UUID         NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  model_name  VARCHAR(255) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  embedding   vector(384)  NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (resume_id, model_name)
);

-- ------------------------------------------------------------
-- Job Embeddings — sentence-transformer vectors per job req
-- ------------------------------------------------------------
CREATE TABLE job_embeddings (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID         NOT NULL REFERENCES job_requisitions(id) ON DELETE CASCADE,
  model_name  VARCHAR(255) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  embedding   vector(384)  NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (job_id, model_name)
);
