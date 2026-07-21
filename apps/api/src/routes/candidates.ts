import { Router, Request, Response, NextFunction } from 'express';
import { withTransaction } from '../db/pool';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── GET / — List candidates with their latest application & evaluation ───────

router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTransaction(async (client) => {
      const candidatesRes = await client.query(
        `SELECT c.id, c.full_name, c.email, c.phone, c.location, c.created_at, c.updated_at,
                a.id AS application_id, a.status AS application_status, a.job_id,
                jr.title AS job_title, jr.department AS job_department,
                ae.tier, ae.score
         FROM candidates c
         LEFT JOIN LATERAL (
           SELECT id, status, job_id, created_at FROM applications
           WHERE candidate_id = c.id
           ORDER BY created_at DESC LIMIT 1
         ) a ON true
         LEFT JOIN job_requisitions jr ON jr.id = a.job_id
         LEFT JOIN LATERAL (
           SELECT tier, score FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         ORDER BY c.created_at DESC`
      );
      return candidatesRes.rows;
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id — Candidate with all applications ───────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTransaction(async (client) => {
      const candidateRes = await client.query(
        `SELECT id, full_name, email, phone, linkedin_url, location, created_at, updated_at
         FROM candidates
         WHERE id = $1`,
        [req.params.id]
      );

      if (!candidateRes.rows[0]) return null;

      const applicationsRes = await client.query(
        `SELECT
           a.id, a.status, a.applied_at, a.updated_at,
           a.job_id,
           jr.title AS job_title, jr.department, jr.status AS job_status,
           r.id AS resume_id, r.original_filename AS file_name, r.file_size_bytes,
           ae.tier, ae.score, ae.recommendation, ae.evaluated_at
         FROM applications a
         JOIN job_requisitions jr ON jr.id = a.job_id
         JOIN resumes r ON r.id = a.resume_id
         LEFT JOIN LATERAL (
           SELECT tier, score, recommendation, scored_at AS evaluated_at
           FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         WHERE a.candidate_id = $1
         ORDER BY a.applied_at DESC`,
        [req.params.id]
      );

      return {
        candidate: candidateRes.rows[0],
        applications: applicationsRes.rows,
      };
    });

    if (!result) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Candidate not found' } });
      return;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
