import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload, UserRole } from '../types';

/**
 * Verifies the JWT access token from the Authorization: Bearer header.
 * Attaches decoded payload to req.user and req.tenantId.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' },
      });
      return;
    }
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
    });
  }
}

/**
 * Role-based access control middleware factory.
 * Must be used after authenticate.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }
    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
        },
      });
      return;
    }
    next();
  };
}
