import { Response } from 'express';
import { QueueEvents, Job } from 'bullmq';
import { config } from '../config';
import { query } from '../db/pool';
import { resumeQueue } from '../db/redis';

// ─── SSE Client Registry ──────────────────────────────────────────────────────

/**
 * Set of active SSE Response objects.
 * Each connected browser tab registers here and is removed on disconnect.
 */
export const sseClients: Set<Response> = new Set();

// ─── SSE HTTP Handler ─────────────────────────────────────────────────────────

import { Request, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';

export function sseHandler(req: Request, res: Response, _next: NextFunction): void {
  // Native EventSource can't set custom headers, so the client passes the
  // access token as a query param instead. Bridge it into the normal
  // Authorization header before delegating to the shared auth middleware —
  // every other route keeps requiring a real Bearer header.
  if (!req.headers.authorization && typeof req.query.token === 'string') {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }

  authenticate(req, res, () => {
    // Set SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Register client
    sseClients.add(res);

    // Send initial connected event (unnamed so it doesn't confuse onmessage parsers)
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Heartbeat every 30 seconds to prevent proxy timeouts
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });
}

// ─── BullMQ QueueEvents listener ─────────────────────────────────────────────

const queueEvents = new QueueEvents(config.queue.name, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
  },
});

// The BullMQ job id equals the applicationId for a first-time upload (see
// upload.ts), but reprocess jobs use a distinct `reprocess-<id>-<ts>` id
// (applications.ts) to avoid colliding with the original job in BullMQ's
// registry. Resolve the real applicationId from the job's own data so both
// paths broadcast under a consistent id.
async function resolveApplicationId(bullJobId: string): Promise<string> {
  try {
    const job = await Job.fromId(resumeQueue, bullJobId);
    const dataAppId = job?.data?.applicationId;
    if (typeof dataAppId === 'string') return dataAppId;
  } catch (err) {
    console.error('[SSE] Failed to resolve job data for', bullJobId, err);
  }
  return bullJobId;
}

async function broadcastForApplication(
  bullJobId: string,
  fields: Record<string, unknown>
): Promise<void> {
  if (sseClients.size === 0) return;

  const applicationId = await resolveApplicationId(bullJobId);

  let jobId: string | null = null;
  try {
    const result = await query<{ job_id: string }>(
      'SELECT job_id FROM applications WHERE id = $1',
      [applicationId]
    );
    jobId = result.rows[0]?.job_id ?? null;
  } catch (err) {
    console.error('[SSE] Failed to resolve job_id for application', applicationId, err);
  }

  const payload = JSON.stringify({ applicationId, jobId, ...fields });
  const frame = `data: ${payload}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      // Client disconnected mid-write; cleanup handled by 'close' listener
      sseClients.delete(client);
    }
  }
}

queueEvents.on('active', ({ jobId }) => {
  void broadcastForApplication(jobId, { type: 'progress', progress: 0 });
});

queueEvents.on('progress', ({ jobId, data }) => {
  const progress = typeof data === 'number' ? data : undefined;
  void broadcastForApplication(jobId, { type: 'progress', progress });
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  let result: { tier?: string; score?: number } = {};
  try {
    result = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
  } catch {
    /* keep result empty if unparsable */
  }
  void broadcastForApplication(jobId, {
    type: 'completed',
    tier: result.tier,
    score: result.score,
  });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  void broadcastForApplication(jobId, { type: 'failed', error: failedReason });
});

queueEvents.on('error', (err) => {
  console.error('[SSE/QueueEvents] Error:', err.message);
});
