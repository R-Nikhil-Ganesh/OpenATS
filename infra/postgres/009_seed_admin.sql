-- ==============================================================
-- 009_seed_admin.sql
-- Seed an initial admin user
-- ==============================================================

-- Seed an admin user (password: 'admin')
-- password_hash generated using bcrypt with salt rounds 12
-- The hash below is for 'admin'
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'admin@local.host',
  '$2a$12$fz5vkPBWTAqpw/4vEkWVZuoc0g4gDR3uHRfwP12iulNjpw4ajOVIm',
  'Local Admin',
  'owner',
  true
) ON CONFLICT (email) DO NOTHING;
