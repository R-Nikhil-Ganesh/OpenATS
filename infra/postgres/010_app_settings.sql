-- ==============================================================
-- 010_app_settings.sql
-- Global key/value application settings (single-org install).
-- Currently used to let an owner pick which LLM model backs each
-- AI feature: resume scoring, candidate compare, and compare chat.
-- ==============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT        NOT NULL,
  updated_by  UUID        REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed the model-selection keys with the same defaults the services
-- fall back to in code, so a fresh install has sensible values.
INSERT INTO app_settings (key, value) VALUES
  ('scoring_model', 'llama3.2:3b'),
  ('compare_model', 'qwen2.5-coder:7b'),
  ('chat_model',    'qwen2.5-coder:7b')
ON CONFLICT (key) DO NOTHING;
