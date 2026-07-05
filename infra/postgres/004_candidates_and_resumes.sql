-- ==============================================================
-- 004_candidates_and_resumes.sql
-- Candidate profiles and uploaded resume documents
-- ==============================================================

-- ------------------------------------------------------------
-- Candidates — de-duplicated person identities per tenant
-- ------------------------------------------------------------
CREATE TABLE candidates (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name     VARCHAR(255),
  email         VARCHAR(255),
  phone         VARCHAR(100),
  linkedin_url  VARCHAR(500),
  github_url    VARCHAR(500),
  location      VARCHAR(255),
  created_at    TIMESTAMPTZ  DEFAULT now(),
  updated_at    TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (tenant_id, email)          -- one candidate profile per tenant per email
);

-- ------------------------------------------------------------
-- Resumes — uploaded resume documents, linked to candidates
-- ------------------------------------------------------------
CREATE TABLE resumes (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  candidate_id          UUID          REFERENCES candidates(id) ON DELETE SET NULL,
  original_filename     VARCHAR(500)  NOT NULL,
  storage_path          VARCHAR(1000) NOT NULL,
  file_size_bytes       INTEGER       NOT NULL,
  mime_type             VARCHAR(100)  DEFAULT 'application/pdf',
  content_hash          VARCHAR(64),                    -- SHA-256 for dedup detection
  extracted_markdown    TEXT,                           -- PyMuPDF4LLM output
  extraction_metadata   JSONB         DEFAULT '{}',     -- page count, column count, etc.
  extracted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   DEFAULT now(),
  updated_at            TIMESTAMPTZ   DEFAULT now()
);
