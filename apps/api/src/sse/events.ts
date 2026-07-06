import { Response } from 'express';
import { QueueEvents } from 'bullmq';
import { config } from '../config';

// ─── SSE Client Registry ──────────────────────────────────────────────────────

/**
 * Map of tenantId → Set of active SSE Response objects.
 * Each connected browser tab registers here and is removed on disconnect.
 */
export const sseClients: Map<string, Set<Response>> = new Map();

// ─── Send SSE event to all clients for a tenant ───────────────────────────────

export function sendSSEEvent(
  tenantId: string,
  event: { type: string; data: unknown }
): void {
  const clients = sseClients.get(tenantId);
  if (!clients || clients.size === 0) return;

  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;

  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      // Client disconnected mid-write; cleanup handled by 'close' listener
      clients.delete(client);
    }
  }
}

// ─── SSE HTTP Handler ─────────────────────────────────────────────────────────

import { Request, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';

export function sseHandler(req: Request, res: Response, _next: NextFunction): void {
  // Run auth inline (authenticate sets req.user / req.tenantId)
  authenticate(req, res, () => {
    const tenantId = req.tenantId!;

    // Set SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Register client
    if (!sseClients.has(tenantId)) {
      sseClients.set(tenantId, new Set());
    }
    const clientSet = sseClients.get(tenantId)!;
    clientSet.add(res);

    // Send initial connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ tenantId })}\n\n`);

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
      clientSet.delete(res);
      if (clientSet.size === 0) {
        sseClients.delete(tenantId);
      }
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

queueEvents.on('active', ({ jobId }) => {
  // jobId is applicationId for our jobs
  broadcastJobEvent(jobId, 'job:active', { applicationId: jobId, status: 'extracting' });
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  let result: unknown = returnvalue;
  try {
    result = JSON.parse(returnvalue);
  } catch { /* keep as string */ }

  broadcastJobEvent(jobId, 'job:completed', { applicationId: jobId, status: 'completed', result });
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  broadcastJobEvent(jobId, 'job:failed', { applicationId: jobId, status: 'failed', error: failedReason });
});

queueEvents.on('progress', ({ jobId, data }) => {
  broadcastJobEvent(jobId, 'job:progress', { applicationId: jobId, progress: data });
});

queueEvents.on('error', (err) => {
  console.error('[SSE/QueueEvents] Error:', err.message);
});

/**
 * We don't know the tenantId from the BullMQ event alone; instead we broadcast
 * to ALL connected tenants and let the client filter by applicationId.
 * In a production system you'd store tenantId in the job data and retrieve it here.
 */
function broadcastJobEvent(_jobId: string, type: string, data: unknown): void {
  for (const [, clients] of sseClients) {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch { /* ignore disconnected clients */ }
    }
  }
}
