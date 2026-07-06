-- ==============================================================
-- 003_jobs.sql
-- Job requisitions — the core recruiting pipeline entity
-- ==============================================================

CREATE TABLE job_requisitions (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   VARCHAR(255) NOT NULL,
  department              VARCHAR(255),
  location                VARCHAR(255),
  employment_type         VARCHAR(100),                 -- full-time, contract, etc.
  status                  job_status   NOT NULL DEFAULT 'draft',
  raw_jd                  TEXT         NOT NULL,        -- original JD text as submitted
  normalized_jd           TEXT,                         -- AI-cleaned and structured JD
  required_skills         JSONB        DEFAULT '[]',    -- [{skill, level}]
  nice_to_have_skills     JSONB        DEFAULT '[]',    -- [{skill}]
  experience_years_min    INTEGER,
  experience_years_max    INTEGER,
  created_by              UUID         NOT NULL REFERENCES users(id),
  closed_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  DEFAULT now(),
  updated_at              TIMESTAMPTZ  DEFAULT now()
);
