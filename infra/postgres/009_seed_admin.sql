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
  '$2y$12$N9mB7Qo.5wHwU./6fU7xO.e/e9wYc5b5n9/N.0v.h.8jD7L.g.Y6W',
  'Local Admin',
  'owner',
  true
) ON CONFLICT (email) DO NOTHING;
