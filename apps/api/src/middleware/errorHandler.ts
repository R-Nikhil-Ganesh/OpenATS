import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { MulterError } from 'multer';

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Central Express error handler. Maps known error types to structured JSON
 * responses: { error: { code, message, details? } }
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Log all errors server-side
  console.error(`[Error] ${req.method} ${req.path}:`, err.message, err.stack);

  // Zod validation errors → 400
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // JWT errors → 401
  if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
    return;
  }

  if (err instanceof jwt.TokenExpiredError) {
    res.status(401).json({
      error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' },
    });
    return;
  }

  // Multer errors → 400
  if (err instanceof MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'File is too large',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    res.status(400).json({
      error: {
        code: 'UPLOAD_ERROR',
        message: messages[err.code] || err.message,
      },
    });
    return;
  }

  // Explicit statusCode on error
  if (err.statusCode) {
    res.status(err.statusCode).json({
      error: {
        code: err.code || 'ERROR',
        message: err.message,
      },
    });
    return;
  }

  // Generic 500
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
    },
  });
}
