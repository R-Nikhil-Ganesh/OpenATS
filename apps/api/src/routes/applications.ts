import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
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

const resolveConflictSchema = z.object({
  action: z.enum(['override', 'discard']),
});

// ─── GET /:id — Full application detail ──────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTransaction(async (client) => {
      const appRes = await client.query(
        `SELECT
           a.id, a.status, a.applied_at, a.updated_at,
           a.job_id, a.candidate_id, a.resume_id,
           c.full_name, c.email, c.phone, c.linkedin_url, c.github_url, c.location,
           r.original_filename AS file_name, r.storage_path, r.extracted_markdown,
           r.file_size_bytes, r.mime_type, r.profile_json, r.profile_model, r.profiled_at,
           ae.id AS eval_id, ae.score, ae.tier,
           ae.matched_skills, ae.missing_requirements,
           ae.reasons->'strengths' AS strengths, ae.reasons->'weaknesses' AS weaknesses, ae.recommendation,
           ae.raw_response, ae.model_name, ae.scored_at AS evaluated_at,
           rpj.status AS processing_status,

           rpj.error_message, rpj.attempts, rpj.bullmq_job_id, rpj.conflict_data,
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
         ORDER BY sh.changed_at ASC`,
        [req.params.id]
      );

      return { application: appRes.rows[0], history: histRes.rows };
    });

    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return;
    }

    const app = result.application as { profile_json: unknown; extracted_markdown: string | null; resume_id: string };

    let profileStatus: 'ready' | 'pending' | 'none';
    if (app.profile_json) {
      profileStatus = 'ready';
    } else if (!app.extracted_markdown) {
      profileStatus = 'none';
    } else {
      profileStatus = 'pending';
      // Deterministic jobId makes this idempotent — repeated polls while
      // pending just hit the same in-flight/queued BullMQ job rather than
      // enqueueing duplicates.
      await resumeQueue.add(
        'process-resume',
        { applicationId: req.params.id, resumeId: app.resume_id, profileOnly: true },
        { jobId: `profile-${app.resume_id}` }
      );
    }

    res.json({ ...result, application: { ...result.application, profile_status: profileStatus } });
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

// ─── POST /:id/resolve-conflict — Resolve a duplicate-candidate pause ────────
//
// The worker parks an application in 'duplicate_candidate' when the resume's
// extracted email collides with a *different* existing candidate row. The
// recruiter decides here:
//   - 'override': same job as an existing application → treat this upload as
//     a newer resume for that same application (swap resume, drop the
//     duplicate). Different job → merge into the existing candidate identity.
//   - 'discard': same job → drop this duplicate upload entirely, existing
//     application stands untouched. Different job → keep this as a distinct
//     candidate (do not merge identities) and continue processing it.

router.post(
  '/:id/resolve-conflict',
  requireRole('owner'),
  validate(resolveConflictSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { action } = req.body as z.infer<typeof resolveConflictSchema>;

    try {
      const outcome = await withTransaction(async (client) => {
        const appRes = await client.query(
          `SELECT a.id, a.status, a.job_id, a.candidate_id, a.resume_id,
                  rpj.id AS proc_job_id, rpj.conflict_data
           FROM applications a
           JOIN LATERAL (
             SELECT * FROM resume_processing_jobs
             WHERE application_id = a.id
             ORDER BY created_at DESC LIMIT 1
           ) rpj ON true
           WHERE a.id = $1`,
          [req.params.id]
        );

        const app = appRes.rows[0];
        if (!app) return { kind: 'not_found' as const };

        if (app.status !== 'duplicate_candidate' || !app.conflict_data) {
          throw Object.assign(
            new Error('Application has no pending candidate conflict'),
            { statusCode: 422, code: 'NO_CONFLICT' }
          );
        }

        const conflict = app.conflict_data as {
          conflicting_candidate_id: string | null;
          conflicting_application_id: string | null;
          conflict_type: 'same_job_duplicate' | 'cross_job_merge';
        };

        if (action === 'discard' && conflict.conflict_type === 'same_job_duplicate') {
          // Drop this duplicate upload; the pre-existing application for this
          // candidate + job is untouched.
          await client.query('DELETE FROM resume_processing_jobs WHERE application_id = $1', [app.id]);
          await client.query('DELETE FROM applications WHERE id = $1', [app.id]);
          await client.query(
            `DELETE FROM candidates
             WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM applications WHERE candidate_id = $1)`,
            [app.candidate_id]
          );
          return { kind: 'discarded' as const };
        }

        if (action === 'discard') {
          // cross_job_merge discard: keep this as its own candidate identity
          // and resume processing without retrying the email merge.
          await client.query(
            `UPDATE resume_processing_jobs
             SET status = 'queued', conflict_data = NULL, error_message = NULL,
                 attempts = 0, updated_at = now()
             WHERE id = $1`,
            [app.proc_job_id]
          );
          await client.query(
            "UPDATE applications SET status = 'queued', updated_at = now() WHERE id = $1",
            [app.id]
          );
          return {
            kind: 'requeue' as const,
            applicationId: app.id as string,
            jobId: app.job_id as string,
            resumeId: app.resume_id as string,
            keepSeparate: true,
          };
        }

        // action === 'override'
        if (conflict.conflict_type === 'same_job_duplicate' && conflict.conflicting_application_id) {
          const targetApplicationId = conflict.conflicting_application_id;

          await client.query(
            `UPDATE applications SET resume_id = $1, status = 'queued', updated_at = now() WHERE id = $2`,
            [app.resume_id, targetApplicationId]
          );
          await client.query(`UPDATE resumes SET candidate_id = $1 WHERE id = $2`, [
            conflict.conflicting_candidate_id,
            app.resume_id,
          ]);
          await client.query('DELETE FROM application_ai_evaluations WHERE application_id = $1', [
            targetApplicationId,
          ]);
          await client.query(
            `UPDATE resume_processing_jobs
             SET status = 'queued', error_message = NULL, conflict_data = NULL,
                 bullmq_job_id = NULL, started_at = NULL, completed_at = NULL,
                 progress = 0, attempts = 0, updated_at = now()
             WHERE application_id = $1`,
            [targetApplicationId]
          );
          await client.query('DELETE FROM resume_processing_jobs WHERE application_id = $1', [app.id]);
          await client.query('DELETE FROM applications WHERE id = $1', [app.id]);
          await client.query('DELETE FROM candidates WHERE id = $1', [app.candidate_id]);

          return {
            kind: 'requeue' as const,
            applicationId: targetApplicationId,
            jobId: app.job_id as string,
            resumeId: app.resume_id as string,
            keepSeparate: false,
          };
        }

        // cross_job_merge override: merge this application's candidate
        // identity into the pre-existing candidate.
        await client.query(
          `UPDATE applications SET candidate_id = $1, status = 'queued', updated_at = now() WHERE id = $2`,
          [conflict.conflicting_candidate_id, app.id]
        );
        await client.query(`UPDATE resumes SET candidate_id = $1 WHERE id = $2`, [
          conflict.conflicting_candidate_id,
          app.resume_id,
        ]);
        await client.query(
          `UPDATE resume_processing_jobs
           SET status = 'queued', conflict_data = NULL, error_message = NULL,
               attempts = 0, updated_at = now()
           WHERE id = $1`,
          [app.proc_job_id]
        );
        await client.query('DELETE FROM candidates WHERE id = $1', [app.candidate_id]);

        return {
          kind: 'requeue' as const,
          applicationId: app.id as string,
          jobId: app.job_id as string,
          resumeId: app.resume_id as string,
          keepSeparate: false,
        };
      });

      if (outcome.kind === 'not_found') {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
        return;
      }

      if (outcome.kind === 'discarded') {
        res.json({ status: 'discarded' });
        return;
      }

      const resumeRes = await withTransaction((client) =>
        client.query('SELECT storage_path FROM resumes WHERE id = $1', [outcome.resumeId])
      );
      const resumePath = resumeRes.rows[0]?.storage_path;

      const bullJob = await resumeQueue.add(
        'process-resume',
        {
          applicationId: outcome.applicationId,
          resumePath,
          jobId: outcome.jobId,
          reprocess: true,
          keepSeparate: outcome.keepSeparate,
        },
        { jobId: `reprocess-${outcome.applicationId}-${Date.now()}` }
      );

      await withTransaction((client) =>
        client.query('UPDATE resume_processing_jobs SET bullmq_job_id = $1 WHERE application_id = $2', [
          bullJob.id,
          outcome.applicationId,
        ])
      );

      res.json({ applicationId: outcome.applicationId, bullmqJobId: bullJob.id, status: 'queued' });
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
        `SELECT sh.id, sh.from_status, sh.to_status, sh.note, sh.changed_at,
                u.full_name AS changed_by
         FROM application_state_history sh
         LEFT JOIN users u ON u.id = sh.changed_by
         WHERE sh.application_id = $1
         ORDER BY sh.changed_at ASC`,
        [req.params.id]
      );
    });

    res.json({ history: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id — Remove an application and its resume file ────────────────
//
// Hard-deletes the application (cascades ai evaluations, state history, and
// the processing job), then removes its resume row/file unless another
// application still points at it (possible after a resolve-conflict
// override reassigns a resume_id onto a different application), and the
// candidate row unless another application still references it.

router.delete(
  '/:id',
  requireRole('owner'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await withTransaction(async (client) => {
        const appRes = await client.query<{ id: string; candidate_id: string; resume_id: string }>(
          `SELECT id, candidate_id, resume_id FROM applications WHERE id = $1`,
          [req.params.id]
        );
        const app = appRes.rows[0];
        if (!app) return null;

        // No ON DELETE clause from role_history_snapshots -> applications.
        await client.query('DELETE FROM role_history_snapshots WHERE application_id = $1', [app.id]);
        await client.query('DELETE FROM applications WHERE id = $1', [app.id]);

        let deletedResumePath: string | null = null;
        const stillUsed = await client.query('SELECT 1 FROM applications WHERE resume_id = $1', [
          app.resume_id,
        ]);
        if (!stillUsed.rows[0]) {
          const resumeRes = await client.query<{ storage_path: string }>(
            'DELETE FROM resumes WHERE id = $1 RETURNING storage_path',
            [app.resume_id]
          );
          deletedResumePath = resumeRes.rows[0]?.storage_path ?? null;
        }

        await client.query(
          `DELETE FROM candidates
           WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM applications WHERE candidate_id = $1)`,
          [app.candidate_id]
        );

        return { id: app.id, deletedResumePath };
      });

      if (!result) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
        return;
      }

      if (result.deletedResumePath) {
        fs.unlink(path.resolve(result.deletedResumePath), (err) => {
          if (err) console.error(`[Delete] Failed to remove resume file ${result.deletedResumePath}:`, err.message);
        });
      }

      res.json({ id: result.id, status: 'deleted' });
    } catch (err) {
      next(err);
    }
  }
);

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

    res.sendFile(path.resolve(result.storage_path), (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
