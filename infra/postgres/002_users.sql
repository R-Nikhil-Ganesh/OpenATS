-- ==============================================================
-- 002_users.sql
-- Users and refresh tokens
-- ==============================================================

-- ------------------------------------------------------------
-- Users — system users
-- ------------------------------------------------------------
CREATE TABLE users (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role            user_role    NOT NULL DEFAULT 'recruiter',
  is_active       BOOLEAN      DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT now(),
  updated_at      TIMESTAMPTZ  DEFAULT now()
);

-- ------------------------------------------------------------
-- Refresh tokens — persistent JWT refresh token store
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT now()
);
