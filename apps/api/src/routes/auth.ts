import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { query, withTenant } from '../db/pool';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { JwtPayload } from '../types';

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  tenantName: z.string().min(2).max(100),
  tenantSlug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

// ─── POST /auth/register-tenant ──────────────────────────────────────────────

router.post(
  '/register-tenant',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { tenantName, tenantSlug, email, password, fullName } = req.body as z.infer<typeof registerSchema>;

    try {
      // Check slug uniqueness (no RLS needed — public lookup)
      const slugCheck = await query<{ id: string }>(
        'SELECT id FROM tenants WHERE slug = $1',
        [tenantSlug]
      );
      if (slugCheck.rowCount && slugCheck.rowCount > 0) {
        res.status(409).json({
          error: { code: 'SLUG_TAKEN', message: 'Tenant slug is already taken' },
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const tenantId = uuidv4();
      const userId = uuidv4();

      // Insert tenant and owner user in a transaction (no tenant context yet)
      const client = await (await import('../db/pool')).pool.connect();
      try {
        await client.query('BEGIN');
        const tenantResult = await client.query<{ id: string; name: string; slug: string; created_at: Date }>(
          `INSERT INTO tenants (id, name, slug, plan, is_active)
           VALUES ($1, $2, $3, 'free', true)
           RETURNING id, name, slug, created_at`,
          [tenantId, tenantName, tenantSlug]
        );
        const tenant = tenantResult.rows[0];

        await client.query(
          `INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, $5, 'owner', true)`,
          [userId, tenantId, email, passwordHash, fullName]
        );
        await client.query('COMMIT');

        res.status(201).json({
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            createdAt: tenant.created_at,
          },
          user: {
            id: userId,
            email,
            fullName,
            role: 'owner',
          },
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email, password, tenantSlug } = req.body as z.infer<typeof loginSchema>;

    try {
      // Find tenant by slug
      const tenantResult = await query<{ id: string; name: string; slug: string; is_active: boolean }>(
        'SELECT id, name, slug, is_active FROM tenants WHERE slug = $1',
        [tenantSlug]
      );
      if (!tenantResult.rows[0] || !tenantResult.rows[0].is_active) {
        res.status(401).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        });
        return;
      }
      const tenant = tenantResult.rows[0];

      // Find user within tenant
      const userResult = await withTenant(tenant.id, async (client) => {
        return client.query<{
          id: string;
          email: string;
          password_hash: string;
          full_name: string;
          role: string;
          is_active: boolean;
        }>(
          'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1 AND tenant_id = $2',
          [email, tenant.id]
        );
      });

      const user = userResult.rows[0];
      if (!user || !user.is_active) {
        res.status(401).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        });
        return;
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        res.status(401).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        });
        return;
      }

      const jwtPayload: JwtPayload = {
        userId: user.id,
        tenantId: tenant.id,
        role: user.role,
        email: user.email,
      };

      const accessToken = signAccessToken(jwtPayload);
      const refreshToken = signRefreshToken(jwtPayload);
      const tokenHash = hashToken(refreshToken);

      // Decode to get expiry
      const decoded = jwt.decode(refreshToken) as { exp: number };
      const expiresAt = new Date(decoded.exp * 1000);

      await withTenant(tenant.id, async (client) => {
        await client.query(
          `INSERT INTO refresh_tokens (id, user_id, tenant_id, token_hash, expires_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [uuidv4(), user.id, tenant.id, tokenHash, expiresAt]
        );
        await client.query(
          'UPDATE users SET last_login_at = NOW() WHERE id = $1',
          [user.id]
        );
      });

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

    try {
      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;
      } catch {
        res.status(401).json({
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' },
        });
        return;
      }

      const tokenHash = hashToken(refreshToken);

      const tokenResult = await withTenant(decoded.tenantId, async (client) => {
        return client.query<{
          id: string;
          revoked_at: Date | null;
          expires_at: Date;
        }>(
          `SELECT id, revoked_at, expires_at FROM refresh_tokens
           WHERE token_hash = $1 AND tenant_id = $2`,
          [tokenHash, decoded.tenantId]
        );
      });

      const tokenRow = tokenResult.rows[0];
      if (!tokenRow || tokenRow.revoked_at !== null || tokenRow.expires_at < new Date()) {
        res.status(401).json({
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid, revoked, or expired' },
        });
        return;
      }

      const newAccessToken = signAccessToken({
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        role: decoded.role,
        email: decoded.email,
      });

      res.json({ accessToken: newAccessToken });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post(
  '/logout',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // The token in the header is the access token; we look up refresh tokens for this user
      // In practice the client must send the refresh token in the body for revocation
      // Here we revoke all refresh tokens for this user session (or specific one if provided)
      const { refreshToken } = req.body as { refreshToken?: string };

      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await withTenant(req.tenantId!, async (client) => {
          await client.query(
            `UPDATE refresh_tokens SET revoked_at = NOW()
             WHERE token_hash = $1 AND user_id = $2 AND tenant_id = $3`,
            [tokenHash, req.user!.userId, req.tenantId]
          );
        });
      } else {
        // Revoke all refresh tokens for this user
        await withTenant(req.tenantId!, async (client) => {
          await client.query(
            `UPDATE refresh_tokens SET revoked_at = NOW()
             WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
            [req.user!.userId, req.tenantId]
          );
        });
      }

      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await withTenant(req.tenantId!, async (client) => {
        return client.query<{
          id: string;
          email: string;
          full_name: string;
          role: string;
          last_login_at: Date | null;
          created_at: Date;
        }>(
          `SELECT id, email, full_name, role, last_login_at, created_at
           FROM users WHERE id = $1 AND tenant_id = $2`,
          [req.user!.userId, req.tenantId]
        );
      });

      const user = result.rows[0];
      if (!user) {
        res.status(404).json({
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
        return;
      }

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
