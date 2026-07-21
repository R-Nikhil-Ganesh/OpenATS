-- ==============================================================
-- 001_extensions_and_types.sql
-- Enable required PostgreSQL extensions and define custom ENUMs
-- ==============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search / trigram matching

-- ------------------------------------------------------------
-- Lifecycle status enum for applications and resume_processing_jobs
-- ------------------------------------------------------------
CREATE TYPE application_status AS ENUM (
  'uploaded',
  'queued',
  'extracting',
  'extracted',
  'scoring',
  'reviewable',
  'screening',
  'interviewing',
  'hired',
  'rejected',
  'archived'
);

-- ------------------------------------------------------------
-- User roles within a tenant
-- ------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
  'owner',            -- tenant admin, can manage all
  'hiring_manager',   -- creates jobs, views all
  'recruiter',        -- uploads, reviews, advances
  'viewer'            -- read-only
);

-- ------------------------------------------------------------
-- Job requisition lifecycle
-- ------------------------------------------------------------
CREATE TYPE job_status AS ENUM (
  'draft',
  'active',
  'paused',
  'closed',
  'archived'
);

-- ------------------------------------------------------------
-- AI scoring tier for candidate evaluation
-- ------------------------------------------------------------
CREATE TYPE ai_tier AS ENUM ('A', 'B', 'C', 'unscored');

-- ------------------------------------------------------------
-- Async processing job status
-- ------------------------------------------------------------
CREATE TYPE processing_job_status AS ENUM (
  'queued',
  'extracting',
  'extracted',
  'scoring',
  'completed',
  'failed'
);
