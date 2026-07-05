import { Router, Request, Response, NextFunction } from 'express';
import { withTenant } from '../db/pool';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── GET /:id — Candidate with all applications ───────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTenant(req.tenantId!, async (client) => {
      const candidateRes = await client.query(
        `SELECT id, full_name, email, phone, linkedin_url, location, created_at, updated_at
         FROM candidates
         WHERE id = $1 AND tenant_id = $2`,
        [req.params.id, req.tenantId]
      );

      if (!candidateRes.rows[0]) return null;

      const applicationsRes = await client.query(
        `SELECT
           a.id, a.status, a.applied_at, a.updated_at,
           a.job_id,
           jr.title AS job_title, jr.department, jr.status AS job_status,
           r.id AS resume_id, r.file_name, r.extraction_status, r.file_size_bytes,
           ae.tier, ae.score, ae.summary, ae.recommendation, ae.evaluated_at
         FROM applications a
         JOIN job_requisitions jr ON jr.id = a.job_id
         JOIN resumes r ON r.id = a.resume_id
         LEFT JOIN LATERAL (
           SELECT tier, score, recommendation, scored_at AS evaluated_at
           FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         WHERE a.candidate_id = $1 AND a.tenant_id = $2
         ORDER BY a.applied_at DESC`,
        [req.params.id, req.tenantId]
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
