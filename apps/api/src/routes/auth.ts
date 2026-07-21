import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool, query } from '../db/pool';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { JwtPayload } from '../types';

const router = Router();

// ─── Schemas ────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    try {
      const userResult = await query<{
        id: string;
        email: string;
        password_hash: string;
        full_name: string;
        role: string;
        is_active: boolean;
      }>(
        'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1',
        [email]
      );

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
        role: user.role,
        email: user.email,
      };

      const accessToken = signAccessToken(jwtPayload);
      const refreshToken = signRefreshToken(jwtPayload);
      const tokenHash = hashToken(refreshToken);

      // Decode to get expiry
      const decoded = jwt.decode(refreshToken) as { exp: number };
      const expiresAt = new Date(decoded.exp * 1000);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [uuidv4(), user.id, tokenHash, expiresAt]
        );
        await client.query(
          'UPDATE users SET last_login_at = NOW() WHERE id = $1',
          [user.id]
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

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

      const tokenResult = await query<{
        id: string;
        revoked_at: Date | null;
        expires_at: Date;
        is_active: boolean;
      }>(
        `SELECT rt.id, rt.revoked_at, rt.expires_at, u.is_active
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = $1`,
        [tokenHash]
      );

      const tokenRow = tokenResult.rows[0];
      if (
        !tokenRow ||
        tokenRow.revoked_at !== null ||
        tokenRow.expires_at < new Date() ||
        !tokenRow.is_active
      ) {
        res.status(401).json({
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid, revoked, or expired' },
        });
        return;
      }

      const newAccessToken = signAccessToken({
        userId: decoded.userId,
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
      const { refreshToken } = req.body as { refreshToken?: string };

      if (refreshToken) {
        const tokenHash = hashToken(refreshToken);
        await query(
          `UPDATE refresh_tokens SET revoked_at = NOW()
           WHERE token_hash = $1 AND user_id = $2`,
          [tokenHash, req.user!.userId]
        );
      } else {
        await query(
          `UPDATE refresh_tokens SET revoked_at = NOW()
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [req.user!.userId]
        );
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
      const result = await query<{
        id: string;
        email: string;
        full_name: string;
        role: string;
        last_login_at: Date | null;
        created_at: Date;
      }>(
        `SELECT id, email, full_name, role, last_login_at, created_at
         FROM users WHERE id = $1`,
        [req.user!.userId]
      );

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
