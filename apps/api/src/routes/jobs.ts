import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withTenant } from '../db/pool';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  department: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  employment_type: z
    .enum(['full_time', 'part_time', 'contract', 'internship', 'freelance'])
    .optional(),
  raw_jd: z.string().min(10),
  experience_years_min: z.number().int().min(0).optional(),
  experience_years_max: z.number().int().min(0).optional(),
});

const updateJobSchema = createJobSchema.partial().extend({
  status: z.enum(['draft', 'open', 'paused', 'closed', 'archived']).optional(),
});

// ─── GET / — List jobs with aggregated counts ─────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ['jr.tenant_id = $1'];
    const params: unknown[] = [req.tenantId];
    let idx = 2;

    if (status) {
      conditions.push(`jr.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.join(' AND ');

    const result = await withTenant(req.tenantId!, async (client) => {
      const countRes = await client.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM job_requisitions jr WHERE ${where}`,
        params
      );
      const total = parseInt(countRes.rows[0].total);

      const dataParams = [...params, limitNum, offset];
      const rows = await client.query(
        `SELECT
           jr.id, jr.title, jr.department, jr.location, jr.employment_type,
           jr.status, jr.experience_years_min, jr.experience_years_max,
           jr.created_at, jr.updated_at,
           COUNT(a.id) AS total_applicants,
           COUNT(a.id) FILTER (WHERE ae.tier = 'A') AS tier_a_count,
           COUNT(a.id) FILTER (WHERE ae.tier = 'B') AS tier_b_count,
           COUNT(a.id) FILTER (WHERE ae.tier = 'C') AS tier_c_count,
           COUNT(a.id) FILTER (WHERE a.status IN ('queued', 'extracting', 'scoring')) AS processing_count
         FROM job_requisitions jr
         LEFT JOIN applications a ON a.job_id = jr.id AND a.tenant_id = jr.tenant_id
         LEFT JOIN LATERAL (
           SELECT tier FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         WHERE ${where}
         GROUP BY jr.id
         ORDER BY jr.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        dataParams
      );

      return { total, rows: rows.rows };
    });

    res.json({
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST / — Create job ──────────────────────────────────────────────────────

router.post(
  '/',
  requireRole('owner', 'hiring_manager', 'recruiter'),
  validate(createJobSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createJobSchema>;
      const id = uuidv4();

      const result = await withTenant(req.tenantId!, async (client) => {
        return client.query(
          `INSERT INTO job_requisitions
             (id, tenant_id, title, department, location, employment_type,
              raw_jd, status, experience_years_min, experience_years_max, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10)
           RETURNING *`,
          [
            id,
            req.tenantId,
            body.title,
            body.department ?? null,
            body.location ?? null,
            body.employment_type ?? null,
            body.raw_jd,
            body.experience_years_min ?? null,
            body.experience_years_max ?? null,
            req.user!.userId,
          ]
        );
      });

      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /:id — Get single job ────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTenant(req.tenantId!, async (client) => {
      return client.query(
        `SELECT
           jr.*,
           u.full_name AS created_by_name,
           COUNT(a.id) AS total_applicants,
           COUNT(a.id) FILTER (WHERE ae.tier = 'A') AS tier_a_count,
           COUNT(a.id) FILTER (WHERE ae.tier = 'B') AS tier_b_count,
           COUNT(a.id) FILTER (WHERE ae.tier = 'C') AS tier_c_count,
           COUNT(a.id) FILTER (WHERE a.status IN ('queued', 'extracting', 'scoring')) AS processing_count
         FROM job_requisitions jr
         LEFT JOIN users u ON u.id = jr.created_by
         LEFT JOIN applications a ON a.job_id = jr.id AND a.tenant_id = jr.tenant_id
         LEFT JOIN LATERAL (
           SELECT tier FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         WHERE jr.id = $1 AND jr.tenant_id = $2
         GROUP BY jr.id, u.full_name`,
        [req.params.id, req.tenantId]
      );
    });

    if (!result.rows[0]) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /:id — Update job ────────────────────────────────────────────────────

router.put(
  '/:id',
  requireRole('owner', 'hiring_manager'),
  validate(updateJobSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof updateJobSchema>;
      const fields = Object.entries(body)
        .filter(([, v]) => v !== undefined)
        .map(([k], i) => `${k} = $${i + 3}`);

      if (fields.length === 0) {
        res.status(400).json({ error: { code: 'NO_FIELDS', message: 'No fields to update' } });
        return;
      }

      const values = Object.values(body).filter((v) => v !== undefined);

      const result = await withTenant(req.tenantId!, async (client) => {
        return client.query(
          `UPDATE job_requisitions
           SET ${fields.join(', ')}, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2
           RETURNING *`,
          [req.params.id, req.tenantId, ...values]
        );
      });

      if (!result.rows[0]) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
        return;
      }
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ─── DELETE /:id — Soft delete (archive) ──────────────────────────────────────

router.delete(
  '/:id',
  requireRole('owner', 'hiring_manager'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await withTenant(req.tenantId!, async (client) => {
        return client.query(
          `UPDATE job_requisitions
           SET status = 'archived', updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2
           RETURNING id, status`,
          [req.params.id, req.tenantId]
        );
      });

      if (!result.rows[0]) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
        return;
      }
      res.json({ id: result.rows[0].id, status: result.rows[0].status });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /:id/stats ───────────────────────────────────────────────────────────

router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await withTenant(req.tenantId!, async (client) => {
      const statsRes = await client.query(
        `SELECT
           COUNT(a.id) AS total,
           COUNT(a.id) FILTER (WHERE rpj.status = 'queued') AS queued,
           COUNT(a.id) FILTER (WHERE rpj.status IN ('extracting', 'scoring')) AS processing,
           COUNT(a.id) FILTER (WHERE rpj.status = 'completed') AS done,
           COUNT(a.id) FILTER (WHERE rpj.status = 'failed') AS failed
         FROM applications a
         LEFT JOIN LATERAL (
           SELECT status FROM resume_processing_jobs
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) rpj ON true
         WHERE a.job_id = $1 AND a.tenant_id = $2`,
        [req.params.id, req.tenantId]
      );

      const row = statsRes.rows[0] || {};
      return {
        total: parseInt(row.total || '0'),
        queued: parseInt(row.queued || '0'),
        processing: parseInt(row.processing || '0'),
        done: parseInt(row.done || '0'),
        failed: parseInt(row.failed || '0'),
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id/applications ────────────────────────────────────────────────────

router.get('/:id/applications', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      tier,
      status,
      page = '1',
      limit = '20',
      sort = 'applied_at_desc',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['a.job_id = $1', 'a.tenant_id = $2'];
    const params: unknown[] = [req.params.id, req.tenantId];
    let idx = 3;

    if (status) {
      conditions.push(`a.status = $${idx++}`);
      params.push(status);
    }
    if (tier) {
      conditions.push(`ae.tier = $${idx++}`);
      params.push(tier);
    }

    const orderMap: Record<string, string> = {
      applied_at_desc: 'a.applied_at DESC',
      applied_at_asc: 'a.applied_at ASC',
      score_desc: 'ae.score DESC NULLS LAST',
      score_asc: 'ae.score ASC NULLS LAST',
    };
    const orderBy = orderMap[sort] || 'a.applied_at DESC';
    const where = conditions.join(' AND ');

    const result = await withTenant(req.tenantId!, async (client) => {
      const countRes = await client.query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM applications a
         LEFT JOIN LATERAL (
           SELECT tier, score FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         WHERE ${where}`,
        params
      );
      const total = parseInt(countRes.rows[0].total);

      const rows = await client.query(
        `SELECT
           a.id, a.status, a.applied_at, a.updated_at,
           c.id AS candidate_id, c.full_name, c.email, c.phone, c.location,
           r.id AS resume_id, r.file_name, r.extraction_status,
           ae.tier, ae.score, ae.recommendation,
           rpj.status AS processing_status
         FROM applications a
         JOIN candidates c ON c.id = a.candidate_id
         JOIN resumes r ON r.id = a.resume_id
         LEFT JOIN LATERAL (
           SELECT tier, score, recommendation FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         LEFT JOIN LATERAL (
           SELECT status FROM resume_processing_jobs
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) rpj ON true
         WHERE ${where}
         ORDER BY ${orderBy}
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limitNum, offset]
      );

      return { total, rows: rows.rows };
    });

    res.json({
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
