import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ApplicationStatus } from '../types';
import { config } from '../config';
import { resumeQueue, redis } from '../db/redis';
import { chatCompletionJson } from '../services/llm';
import { getModel } from '../services/settings';

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

      // ── Email notification when moved out of 'reviewable' ──────────────────
      // Fetch candidate + job info asynchronously so we don't block the response.
      if (updated.fromStatus === 'reviewable') {
        (async () => {
          try {
            const emailData = await withTransaction(async (client) => {
              const row = await client.query(
                `SELECT c.full_name, c.email, j.title AS job_title, j.department
                 FROM applications a
                 JOIN candidates c ON c.id = a.candidate_id
                 JOIN job_requisitions j ON j.id = a.job_id
                 WHERE a.id = $1`,
                [updated.id]
              );
              return row.rows[0] as { full_name: string; email: string; job_title: string; department: string } | undefined;
            });

            if (emailData) {
              const statusLabels: Record<string, string> = {
                screening: 'has been moved to Screening',
                interviewing: 'has been shortlisted for an Interview',
                hired: 'has been marked as Hired 🎉',
                rejected: 'has not been selected at this time',
                archived: 'has been archived',
              };
              const statusLabel = statusLabels[updated.toStatus] || `status changed to ${updated.toStatus}`;

              // [EMAIL] — Replace this block with your SMTP/SendGrid/SES call.
              console.log('─────────────────────────────────────────────────────────');
              console.log('[EMAIL] Status change notification');
              console.log(`  To      : ${emailData.email}`);
              console.log(`  Subject : Update on your application – ${emailData.job_title}`);
              console.log(`  Body    :`);
              console.log(`    Dear ${emailData.full_name},`);
              console.log(`    We wanted to keep you informed about your application`);
              console.log(`    for the ${emailData.job_title}${emailData.department ? ` (${emailData.department})` : ''} role.`);
              console.log(`    Your application ${statusLabel}.`);
              console.log(`    We appreciate your interest and will be in touch shortly.`);
              console.log(`    Best regards,`);
              console.log(`    The Hiring Team`);
              console.log('─────────────────────────────────────────────────────────');
            }
          } catch (emailErr) {
            console.error('[EMAIL] Failed to send status notification:', emailErr);
          }
        })();
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
          // Absolute path so the worker (different cwd/container) can find it.
          resumePath: result.resumePath ? path.resolve(result.resumePath) : result.resumePath,
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
          // Absolute path so the worker (different cwd/container) can find it.
          resumePath: resumePath ? path.resolve(resumePath) : resumePath,
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
      const appRes = await client.query<{ storage_path: string; job_id: string }>(
        `SELECT r.storage_path, a.job_id
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

    let filePath = path.resolve(result.storage_path);

    if (!fs.existsSync(filePath)) {
      filePath = path.resolve(config.upload.dir, '..', result.storage_path);
    }

    if (!fs.existsSync(filePath)) {
      const parts = result.storage_path.replace(/\\/g, '/').split('/');
      if (parts.length === 3 && parts[0] === 'uploads') {
        const [_, tenantId, filename] = parts;
        filePath = path.resolve(config.upload.dir, '..', 'uploads', tenantId, result.job_id, filename);
      }
    }

    if (!fs.existsSync(filePath)) {
      const filename = path.basename(result.storage_path);
      filePath = path.resolve(config.upload.dir, result.job_id, filename);
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: `Resume file not found at any resolved path` } });
      return;
    }

    res.sendFile(filePath, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/validate-links — Real link and skill verification ───────────

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
  const matches = text.match(re) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    let clean = m.replace(/[.,;)]+$/, "");
    if (clean.endsWith(')')) clean = clean.slice(0, -1);
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

// Rudimentary quality check for GitHub / LinkedIn profile links.
//
// We deliberately do NOT gate pass/fail on a server-side fetch: LinkedIn blocks
// automated requests (999/403 or a dropped connection) and the unauthenticated
// GitHub API rate-limits (403 after 60 req/hr). A failed request from our server
// reflects OUR limitations, not a broken candidate link — the old code turned
// every such failure into a misleading "broken (500)".
//
// Instead we validate the URL shape, and for GitHub only (it serves a clean 404
// for a missing user/repo) do a best-effort liveness ping where anything other
// than a definite 404 is treated as reachable.
const GITHUB_PROFILE_RE =
  /^https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:\/[^?#\s]*)?\/?(?:[?#].*)?$/i;
const LINKEDIN_PROFILE_RE =
  /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub|company)\/[^\s/?#]+\/?(?:[?#].*)?$/i;

const RESERVED_GITHUB_NAMES = new Set([
  'features', 'pulls', 'issues', 'marketplace', 'trending', 'orgs',
  'explore', 'notifications', 'settings', 'login', 'join', 'contact',
  'about', 'pricing', 'security', 'customer-stories', 'resources'
]);

function getTopLanguages(repos: any[]): string[] {
  const counts: Record<string, number> = {};
  for (const r of repos) {
    if (r.language) {
      counts[r.language] = (counts[r.language] || 0) + 1;
    }
  }
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
}

async function fetchGithubProfileAndRepos(username: string) {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  let userInfo: any = null;
  try {
    const userRes = await fetch(`https://api.github.com/users/${username}`, { headers, signal: AbortSignal.timeout(5000) });
    if (userRes.ok) {
      userInfo = await userRes.json() as any;
    } else {
      console.warn(`GitHub profile fetch returned status ${userRes.status} for ${username}`);
    }
  } catch (err) {
    console.error(`Error fetching GitHub user info for ${username}:`, err);
  }

  let repos: any[] = [];
  try {
    const reposRes = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=30`, { headers, signal: AbortSignal.timeout(5000) });
    if (reposRes.ok) {
      repos = await reposRes.json() as any[];
    } else {
      console.warn(`GitHub repos fetch returned status ${reposRes.status} for ${username}`);
    }
  } catch (err) {
    console.error(`Error fetching GitHub repos for ${username}:`, err);
  }

  return { userInfo, repos };
}

async function validateSocialProfile(url: string, platform: 'github' | 'linkedin', candidateName?: string): Promise<any> {
  const trimmed = url.trim();
  const type = `${platform}_profile`;
  const label = platform === 'github' ? 'GitHub' : 'LinkedIn';
  const re = platform === 'github' ? GITHUB_PROFILE_RE : LINKEDIN_PROFILE_RE;

  if (!re.test(trimmed)) {
    return {
      url,
      type,
      status: 'broken',
      statusCode: 400,
      verdict: 'malformed',
      reason: `Not a well-formed ${label} profile URL.`,
    };
  }

  // Best-effort liveness — GitHub only. A definite 404 is the one signal we
  // trust; rate-limits, timeouts, and network errors are swallowed so they
  // never masquerade as a broken link.
  if (platform === 'github') {
    let username: string | null = null;
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        username = pathParts[0];
      }
    } catch {
      // ignore
    }

    const isValidUsername = username && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(username) && !RESERVED_GITHUB_NAMES.has(username.toLowerCase());

    if (isValidUsername) {
      try {
        const checkRes = await fetch(trimmed, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          signal: AbortSignal.timeout(4000),
        });
        if (checkRes.status === 404) {
          return {
            url,
            type,
            status: 'broken',
            statusCode: 404,
            verdict: 'not_found',
            reason: 'GitHub returned 404 — this profile/repository does not exist.',
          };
        }
      } catch (err) {
        // network/timeout error check; we still proceed to call the API
      }

      const { userInfo, repos } = await fetchGithubProfileAndRepos(username!);

      if (repos && repos.length > 0) {
        let llmAnalysis = null;
        try {
          const sortedRepos = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
          const reposForLlm = sortedRepos.slice(0, 5).map(r => ({
            name: r.name,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            forks: r.forks_count,
            updated_at: r.updated_at,
          }));

          const promptMessages = [
            {
              role: 'system' as const,
              content: `You are an expert technical recruiter and code reviewer.
Analyze the candidate's GitHub public repositories and generate a neat, structured, and concise overview.
Include:
1. Summary: A 2-3 sentence high-level overview of their developer profile, primary focus (e.g. frontend, backend, AI, system programming), and activity based on these repositories.
2. Key Projects: Identify and briefly highlight 2-3 most significant projects (their tech stack, purpose, and significance/reasons).
3. Primary Skills & Tech Stack: Bullet points of the main languages, frameworks, and technologies demonstrated.
4. Overall Assessment: A brief 1-2 sentence assessment of their engineering level or strengths from an open-source perspective.

Respond with ONE JSON object and NOTHING else.
Format the JSON as follows:
{
  "summary": "...",
  "projects": [
    { "name": "...", "description": "...", "techStack": "...", "significance": "..." }
  ],
  "skills": ["...", "..."],
  "overallAssessment": "..."
}`,
            },
            {
              role: 'user' as const,
              content: `Candidate Name: ${candidateName || 'Candidate'}
GitHub Username: ${username}
User Bio: ${userInfo?.bio || 'N/A'}
Public Repos Count: ${userInfo?.public_repos || repos.length}
Followers: ${userInfo?.followers || 0}

Here are the candidate's top repositories:
${JSON.stringify(reposForLlm, null, 2)}

Now generate the structured JSON:`,
            },
          ];

          try {
            const selectedNimModel = await getModel('nvidia_link_model');
            llmAnalysis = await chatCompletionJson<{
              summary: string;
              projects: Array<{ name: string; description: string; techStack: string; significance: string }>;
              skills: string[];
              overallAssessment: string;
            }>(promptMessages, { forceNvidia: true, model: selectedNimModel });
          } catch (llmErr) {
            console.warn(`Cloud LLM GitHub analysis failed for ${username}, trying local fallback...`, llmErr);
            try {
              llmAnalysis = await chatCompletionJson<{
                summary: string;
                projects: Array<{ name: string; description: string; techStack: string; significance: string }>;
                skills: string[];
                overallAssessment: string;
              }>(promptMessages, { forceNvidia: false, maxTokens: 1200 });
            } catch (localErr) {
              console.error(`Local fallback LLM GitHub analysis also failed for ${username}:`, localErr);
            }
          }
        } catch (outerErr) {
          console.error(`Outer GitHub analysis error for ${username}:`, outerErr);
        }

        return {
          url,
          type,
          status: 'valid',
          statusCode: 200,
          verdict: 'analyzed',
          reason: `GitHub profile validated and repositories analyzed for ${username}.`,
          githubData: {
            username,
            avatarUrl: userInfo?.avatar_url,
            bio: userInfo?.bio || userInfo?.description,
            publicRepos: userInfo?.public_repos || repos.length,
            followers: userInfo?.followers || 0,
            totalStars: repos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0),
            totalForks: repos.reduce((acc, r) => acc + (r.forks_count || 0), 0),
            topLanguages: getTopLanguages(repos),
            analysis: llmAnalysis,
          }
        };
      }
    }
  }

  if (platform === 'github') {
    try {
      const res = await fetch(trimmed, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.status === 404) {
        return {
          url,
          type,
          status: 'broken',
          statusCode: 404,
          verdict: 'not_found',
          reason: 'GitHub returned 404 — this profile/repository does not exist.',
        };
      }
    } catch {
      // ignore
    }
  }

  return {
    url,
    type,
    status: 'valid',
    statusCode: 200,
    verdict: 'reachable',
    reason: `Well-formed ${label} profile URL.`,
  };
}

async function validateProfileName(url: string, candidateName: string, type: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    if (!res.ok) {
      return {
        url,
        type: type === 'Google Scholar' ? 'scholar_profile' : 'general',
        status: 'broken',
        statusCode: res.status,
        verdict: 'unreachable',
        reason: `Profile returned status ${res.status}: ${res.statusText}`,
      };
    }
    const html = await res.text();
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const normalizedName = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedHtml = html.toLowerCase().replace(/[^a-z0-9]/g, '');

    let matches = false;
    let foundName = '';

    if (normalizedHtml.includes(normalizedName)) {
      matches = true;
      foundName = candidateName;
    }

    if (!matches && title) {
      try {
        const promptMessages = [
          {
            role: 'system' as const,
            content: `Verify if the provided web page title/content belongs to a profile owned by the candidate.
Respond with ONE JSON object and NOTHING else.
{
  "matches": true or false,
  "ownerName": "the owner's name found on the profile page"
}`,
          },
          {
            role: 'user' as const,
            content: `Candidate Name: ${candidateName}
Page URL: ${url}
Page Title: ${title}
HTML Snippet: ${html.slice(0, 1000)}

Now output the JSON:`,
          },
        ];
        const verifyResult = await chatCompletionJson<{ matches: boolean; ownerName: string }>(promptMessages);
        matches = verifyResult.matches;
        foundName = verifyResult.ownerName;
      } catch (llmErr) {
        console.error('LLM name match error:', llmErr);
      }
    }

    return {
      url,
      type: type === 'Google Scholar' ? 'scholar_profile' : 'general',
      status: 'valid',
      statusCode: 200,
      verdict: matches ? 'matches' : 'mismatch',
      reason: matches
        ? `Profile owner name matches candidate '${candidateName}'.`
        : `Could not verify owner name. Page title: "${title}". Found: "${foundName || 'Unknown'}"`,
    };
  } catch (err: any) {
    return {
      url,
      type: type === 'Google Scholar' ? 'scholar_profile' : 'general',
      status: 'broken',
      statusCode: 500,
      verdict: 'unreachable',
      reason: `Failed to fetch profile: ${err.message}`,
    };
  }
}

async function validateGeneralUrl(url: string, candidateName: string): Promise<any> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    const isOk = res.ok;
    const statusCode = res.status;

    if (!isOk) {
      const getRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      const html = getRes.ok ? await getRes.text() : '';
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      const normalizedName = candidateName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedHtml = html.toLowerCase().replace(/[^a-z0-9]/g, '');
      const nameMatches = normalizedHtml.includes(normalizedName);

      return {
        url,
        type: 'general',
        status: getRes.ok ? 'valid' : 'broken',
        statusCode: getRes.status,
        verdict: nameMatches ? 'matches' : 'unknown',
        reason: getRes.ok
          ? (nameMatches ? `Name matches on page.` : `Site is reachable. Title: "${title}"`)
          : `Unreachable: HTTP ${getRes.status}`,
      };
    }

    return {
      url,
      type: 'general',
      status: 'valid',
      statusCode,
      verdict: 'unknown',
      reason: `Site is reachable.`,
    };
  } catch (err: any) {
    return {
      url,
      type: 'general',
      status: 'broken',
      statusCode: 500,
      verdict: 'unreachable',
      reason: `Connection failed: ${err.message}`,
    };
  }
}

async function validateSingleUrl(url: string, candidateName: string): Promise<any> {
  const lowercaseUrl = url.toLowerCase();

  // GitHub and LinkedIn get a rudimentary format/liveness check (see
  // validateSocialProfile) rather than the old fetch-everything approach that
  // reported working links as broken.
  if (lowercaseUrl.includes('github.com')) {
    return await validateSocialProfile(url, 'github', candidateName);
  }

  if (lowercaseUrl.includes('linkedin.com')) {
    return await validateSocialProfile(url, 'linkedin');
  }

  if (lowercaseUrl.includes('scholar.google.com') || lowercaseUrl.includes('scholar.google.co.in')) {
    return await validateProfileName(url, candidateName, 'Google Scholar');
  }

  if (lowercaseUrl.includes('researchgate.net/profile')) {
    return await validateProfileName(url, candidateName, 'ResearchGate');
  }

  return await validateGeneralUrl(url, candidateName);
}

router.post('/:id/validate-links', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const appData = await withTransaction(async (client) => {
      const appRes = await client.query<{ full_name: string; github_url: string; linkedin_url: string; extracted_markdown: string }>(
        `SELECT a.id, c.full_name, c.github_url, c.linkedin_url, r.extracted_markdown
         FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         JOIN resumes r ON r.id = a.resume_id
         WHERE a.id = $1`,
        [req.params.id]
      );
      return appRes.rows[0];
    });

    if (!appData) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return;
    }

    // candidates.github_url / linkedin_url come from LLM profile extraction and
    // occasionally hold the hyperlink's anchor text ("GitHub") rather than an
    // actual URL when no URL was visible near it at extraction time — validating
    // that literal string as a URL always throws and reports a false "broken".
    const isUrlLike = (v: string): boolean => /^https?:\/\//i.test(v) || /^[\w-]+\.[a-z]{2,}(\/|$)/i.test(v);

    const uniqueUrls = new Set<string>();
    if (appData.github_url && isUrlLike(appData.github_url)) uniqueUrls.add(appData.github_url.trim());
    if (appData.linkedin_url && isUrlLike(appData.linkedin_url)) uniqueUrls.add(appData.linkedin_url.trim());
    if (appData.extracted_markdown) {
      extractUrls(appData.extracted_markdown).forEach((l) => uniqueUrls.add(l));
    }

    // "Recheck" (?force=true) must actually re-run the checks — results are
    // cached for 24h below, so without this the button just replayed the
    // same stale cached result on every click.
    const force = req.query.force === 'true';

    const results = [];
    for (const url of uniqueUrls) {
      const cacheKey = `linkcheck:${url}`;
      if (!force) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            results.push(JSON.parse(cached));
            continue;
          }
        } catch (err) {
          console.error('Redis cache fetch error:', err);
        }
      }

      const checkResult = await validateSingleUrl(url, appData.full_name);

      try {
        await redis.set(cacheKey, JSON.stringify(checkResult), 'EX', 24 * 60 * 60);
      } catch (err) {
        console.error('Redis cache set error:', err);
      }

      results.push(checkResult);
    }

    res.json({ links: results });
  } catch (err) {
    next(err);
  }
});

export default router;
