-- ==============================================================
-- 005_applications.sql
-- Applications, AI evaluations, state history, processing jobs,
-- and role history snapshots
-- ==============================================================

-- ------------------------------------------------------------
-- Applications — the join between a candidate, resume, and job
-- ------------------------------------------------------------
CREATE TABLE applications (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID                NOT NULL REFERENCES candidates(id),
  resume_id       UUID                NOT NULL REFERENCES resumes(id),
  job_id          UUID                NOT NULL REFERENCES job_requisitions(id) ON DELETE CASCADE,
  status          application_status  NOT NULL DEFAULT 'uploaded',
  applied_at      TIMESTAMPTZ         DEFAULT now(),
  reviewed_by     UUID                REFERENCES users(id),
  reviewer_notes  TEXT,
  created_at      TIMESTAMPTZ         DEFAULT now(),
  updated_at      TIMESTAMPTZ         DEFAULT now(),
  UNIQUE (candidate_id, job_id)  -- one application per candidate per job
);

-- ------------------------------------------------------------
-- Application AI Evaluations — LLM scoring results
-- ------------------------------------------------------------
CREATE TABLE application_ai_evaluations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  model_name            VARCHAR(255) NOT NULL,
  model_version         VARCHAR(100),
  tier                  ai_tier     NOT NULL DEFAULT 'unscored',
  score                 NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  matched_skills        JSONB       DEFAULT '[]',      -- [{skill, confidence}]
  missing_requirements  JSONB       DEFAULT '[]',      -- [string]
  reasons               JSONB       DEFAULT '{}',      -- {strengths: [], weaknesses: []}
  recommendation        TEXT,
  raw_response          TEXT,                          -- full LLM output for audit trail
  scored_at             TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Application State History — immutable audit log of transitions
-- ------------------------------------------------------------
CREATE TABLE application_state_history (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID                NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status     application_status,
  to_status       application_status  NOT NULL,
  changed_by      UUID                REFERENCES users(id),
  note            TEXT,
  changed_at      TIMESTAMPTZ         DEFAULT now()
);

-- ------------------------------------------------------------
-- Resume Processing Jobs — BullMQ job tracking
-- ------------------------------------------------------------
CREATE TABLE resume_processing_jobs (
  id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID                    NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  bullmq_job_id   VARCHAR(255),
  status          processing_job_status   NOT NULL DEFAULT 'queued',
  progress        INTEGER                 DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message   TEXT,
  error_stack     TEXT,
  attempts        INTEGER                 DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ             DEFAULT now(),
  updated_at      TIMESTAMPTZ             DEFAULT now()
);

-- ------------------------------------------------------------
-- Role History Snapshots — denormalized point-in-time records
-- ------------------------------------------------------------
CREATE TABLE role_history_snapshots (
  id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID                NOT NULL REFERENCES job_requisitions(id),
  application_id  UUID                NOT NULL REFERENCES applications(id),
  evaluation_id   UUID                REFERENCES application_ai_evaluations(id),
  milestone       application_status  NOT NULL,  -- 'screening', 'hired', etc.
  snapshot_data   JSONB               NOT NULL DEFAULT '{}',  -- full denormalized snapshot
  captured_at     TIMESTAMPTZ         DEFAULT now()
);
