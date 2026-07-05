import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

import { config } from './config';
import { pool } from './db/pool';
import { redis } from './db/redis';

// Routes
import authRouter from './routes/auth';
import jobsRouter from './routes/jobs';
import uploadRouter from './routes/upload';
import applicationsRouter from './routes/applications';
import candidatesRouter from './routes/candidates';
import roleHistoryRouter from './routes/roleHistory';
import dashboardRouter from './routes/dashboard';

// SSE
import { sseHandler } from './sse/events';

// Error handler
import { errorHandler } from './middleware/errorHandler';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const app = express();

// Ensure uploads directory exists
const uploadDir = path.resolve(config.upload.dir);
fs.mkdirSync(uploadDir, { recursive: true });

// ─── Security & Logging Middleware ────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Body Parser ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/auth', authRouter);
app.use('/jobs', jobsRouter);
app.use('/jobs', uploadRouter);       // POST /jobs/:jobId/resumes
app.use('/applications', applicationsRouter);
app.use('/candidates', candidatesRouter);
app.use('/role-history', roleHistoryRouter);
app.use('/dashboard', dashboardRouter);

// SSE endpoint
app.get('/events', sseHandler);

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  console.info(`[API] Server listening on port ${config.port}`);
  console.info(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.info(`[API] CORS origin: ${config.frontend.url}`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.info(`[API] Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    console.info('[API] HTTP server closed');

    try {
      await pool.end();
      console.info('[DB] Pool closed');
    } catch (err) {
      console.error('[DB] Error closing pool:', err);
    }

    try {
      await redis.quit();
      console.info('[Redis] Connection closed');
    } catch (err) {
      console.error('[Redis] Error closing connection:', err);
    }

    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[API] Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
