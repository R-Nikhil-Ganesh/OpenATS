-- ==============================================================
-- 011_resume_profile.sql
-- Structured candidate profile (name/links/skills/experience/education)
-- extracted from each resume's markdown by a small LLM, independent of
-- any job description. Lets the compare/scoring steps work off a
-- structured profile instead of re-reading raw markdown each time.
-- ==============================================================

ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS profile_json  JSONB       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS profile_model VARCHAR(255),
  ADD COLUMN IF NOT EXISTS profiled_at   TIMESTAMPTZ;

INSERT INTO app_settings (key, value) VALUES
  ('profile_model', 'qwen2.5-coder:1.5b')
ON CONFLICT (key) DO NOTHING;
