-- ==============================================================
-- 002_tenants_and_users.sql
-- Multi-tenant foundation: tenants, users, and refresh tokens
-- ==============================================================

-- ------------------------------------------------------------
-- Tenants — top-level organizational units
-- ------------------------------------------------------------
CREATE TABLE tenants (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,  -- for subdomain routing
  plan        VARCHAR(50)  DEFAULT 'trial',  -- trial, starter, pro, enterprise
  is_active   BOOLEAN      DEFAULT true,
  settings    JSONB        DEFAULT '{}',
  created_at  TIMESTAMPTZ  DEFAULT now(),
  updated_at  TIMESTAMPTZ  DEFAULT now()
);

-- ------------------------------------------------------------
-- Users — tenant-scoped human actors
-- ------------------------------------------------------------
CREATE TABLE users (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role            user_role    NOT NULL DEFAULT 'recruiter',
  is_active       BOOLEAN      DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT now(),
  updated_at      TIMESTAMPTZ  DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- ------------------------------------------------------------
-- Refresh tokens — persistent JWT refresh token store
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT now()
);
