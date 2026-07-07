import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../db/pool';
import { resumeQueue } from '../db/redis';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApplicationStatus } from '../types';

const router = Router();
router.use(authenticate);

// ─── Status transition rules ──────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  reviewable: ['screening', 'rejected'],
  screening: ['interviewing', 'rejected'],
  interviewing: ['hired', 'rejected'],
  hired: ['archived'],
  rejected: ['archived'],
};

const MILESTONES_TRIGGERING_SNAPSHOT: ApplicationStatus[] = ['screening', 'hired'];

// ─── Schema ───────────────────────────────────────────────────────────────────

const patchStatusSchema = z.object({
  status: z.enum([
    'reviewable',
    'screening',
    'interviewing',
    'hired',
    'rejected',
    'archived',
  ]),
  note: z.string().max(2000).optional(),
});

const reprocessSchema = z.object({});

// ─── GET /:id — Full application detail ──────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTransaction(async (client) => {
      const appRes = await client.query(
        `SELECT
           a.id, a.status, a.applied_at, a.updated_at,
           a.job_id, a.candidate_id, a.resume_id,
           c.full_name, c.email, c.phone, c.linkedin_url, c.location,
           r.original_filename AS file_name, r.storage_path, r.extracted_markdown,
           r.file_size_bytes, r.mime_type,
           ae.id AS eval_id, ae.score, ae.tier,
           ae.reasons->'strengths' AS strengths, ae.reasons->'weaknesses' AS weaknesses, ae.recommendation,
           ae.raw_response, ae.model_name, ae.scored_at AS evaluated_at,
           rpj.status AS processing_status,

           rpj.error_message, rpj.attempts, rpj.bullmq_job_id,
           rpj.started_at AS processing_started_at,
           rpj.completed_at AS processing_completed_at
         FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         JOIN resumes r ON r.id = a.resume_id
         LEFT JOIN LATERAL (
           SELECT * FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         LEFT JOIN LATERAL (
           SELECT * FROM resume_processing_jobs
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) rpj ON true
         WHERE a.id = $1`,
        [req.params.id]
      );

      if (!appRes.rows[0]) return null;

      const histRes = await client.query(
        `SELECT sh.*, u.full_name AS changed_by_name
         FROM application_state_history sh
         LEFT JOIN users u ON u.id = sh.changed_by
         WHERE sh.application_id = $1
         ORDER BY sh.created_at ASC`,
        [req.params.id]
      );

      return { application: appRes.rows[0], history: histRes.rows };
    });

    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id/status — Advance status ──────────────────────────────────────

router.patch(
  '/:id/status',
  validate(patchStatusSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { status: newStatus, note } = req.body as z.infer<typeof patchStatusSchema>;

    try {
      const updated = await withTransaction(async (client) => {
        const appRes = await client.query<{
          id: string;
          status: ApplicationStatus;
          job_id: string;
          candidate_id: string;
          resume_id: string;
        }>(
          'SELECT id, status, job_id, candidate_id, resume_id FROM applications WHERE id = $1',
          [req.params.id]
        );

        const app = appRes.rows[0];
        if (!app) {
          return null;
        }

        const allowed = ALLOWED_TRANSITIONS[app.status] || [];
        if (!allowed.includes(newStatus)) {
          throw Object.assign(
            new Error(`Transition from '${app.status}' to '${newStatus}' is not allowed`),
            { statusCode: 422, code: 'INVALID_TRANSITION' }
          );
        }

        // Update application status
        await client.query(
          'UPDATE applications SET status = $1, updated_at = NOW() WHERE id = $2',
          [newStatus, app.id]
        );

        // Record state history
        await client.query(
          `INSERT INTO application_state_history
             (id, application_id, from_status, to_status, changed_by, note)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [uuidv4(), app.id, app.status, newStatus, req.user!.userId, note ?? null]
        );

        // Trigger role history snapshot for milestone transitions
        if (MILESTONES_TRIGGERING_SNAPSHOT.includes(newStatus)) {
          const evalRes = await client.query(
            `SELECT tier, score FROM application_ai_evaluations
             WHERE application_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [app.id]
          );
          const jobRes = await client.query(
            'SELECT title, department FROM job_requisitions WHERE id = $1',
            [app.job_id]
          );
          const candidateRes = await client.query(
            'SELECT full_name FROM candidates WHERE id = $1',
            [app.candidate_id]
          );

          const evalRow = evalRes.rows[0] || {};
          const jobRow = jobRes.rows[0] || {};
          const candidateRow = candidateRes.rows[0] || {};

          await client.query(
            `INSERT INTO role_history_snapshots
               (id, job_id, application_id, evaluation_id,
                milestone, snapshot_data)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              uuidv4(),
              app.job_id,
              app.id,
              evalRow.id || null,
              newStatus,
              JSON.stringify({
                transitioned_by: req.user!.userId,
                note,
                candidate_id: app.candidate_id,
                job_title: jobRow.title || '',
                department: jobRow.department || null,
                candidate_name: candidateRow.full_name || '',
                tier: evalRow.tier || 'unscored',
                score: evalRow.score || null,
              }),
            ]
          );
        }

        return { id: app.id, fromStatus: app.status, toStatus: newStatus };
      });

      if (!updated) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
        return;
      }

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /:id/reprocess — Re-queue for processing ───────────────────────────

router.post(
  '/:id/reprocess',
  requireRole('owner'),
  validate(reprocessSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await withTransaction(async (client) => {
        const appRes = await client.query<{
          id: string;
          job_id: string;
          resume_id: string;
        }>(
          `SELECT a.id, a.job_id, r.storage_path AS resume_path
           FROM applications a
           JOIN resumes r ON r.id = a.resume_id
           WHERE a.id = $1`,
          [req.params.id]
        );

        const app = appRes.rows[0] as (typeof appRes.rows[0] & { resume_path: string }) | undefined;
        if (!app) return null;

        // Reset existing processing job
        await client.query(
          `UPDATE resume_processing_jobs
           SET status = 'queued', error_message = NULL,
               bullmq_job_id = NULL, started_at = NULL, completed_at = NULL,
               attempts = 0, updated_at = NOW()
           WHERE application_id = $1`,
          [app.id]
        );

        // Reset application status
        await client.query(
          "UPDATE applications SET status = 'queued', updated_at = NOW() WHERE id = $1",
          [app.id]
        );

        return { appId: app.id, jobId: app.job_id, resumePath: app.resume_path };
      });

      if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
        return;
      }

      // Enqueue in BullMQ
      const bullJob = await resumeQueue.add(
        'process-resume',
        {
          applicationId: result.appId,
          resumePath: result.resumePath,
          jobId: result.jobId,
          reprocess: true,
        },
        { jobId: `reprocess-${result.appId}-${Date.now()}` }
      );

      // Store BullMQ job id
      await withTransaction(async (client) => {
        await client.query(
          'UPDATE resume_processing_jobs SET bullmq_job_id = $1 WHERE application_id = $2',
          [bullJob.id, result.appId]
        );
      });

      res.json({ applicationId: result.appId, bullmqJobId: bullJob.id, status: 'queued' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /:id/history — State history ────────────────────────────────────────

router.get('/:id/history', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTransaction(async (client) => {
      return client.query(
        `SELECT sh.id, sh.from_status, sh.to_status, sh.note, sh.created_at,
                u.full_name AS changed_by_name, u.email AS changed_by_email
         FROM application_state_history sh
         LEFT JOIN users u ON u.id = sh.changed_by
         WHERE sh.application_id = $1
         ORDER BY sh.created_at ASC`,
        [req.params.id]
      );
    });

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/resume — Download resume PDF ───────────────────────────────────

router.get('/:id/resume', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTransaction(async (client) => {
      const appRes = await client.query(
        `SELECT r.storage_path
         FROM applications a
         JOIN resumes r ON r.id = a.resume_id
         WHERE a.id = $1`,
        [req.params.id]
      );
      return appRes.rows[0];
    });

    if (!result || !result.storage_path) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resume not found' } });
      return;
    }

    res.sendFile(result.storage_path);
  } catch (err) {
    next(err);
  }
});

export default router;
