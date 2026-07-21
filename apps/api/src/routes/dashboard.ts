import { Router, Request, Response, NextFunction } from 'express';
import { withTransaction } from '../db/pool';
import { resumeQueue } from '../db/redis';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── GET /summary ─────────────────────────────────────────────────────────────

router.get('/summary', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await withTransaction(async (client) => {
      // Active jobs
      const activeJobsRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM job_requisitions
         WHERE status = 'active'`
      );

      // Total applicants
      const totalApplicantsRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM applications`
      );

      // Queue backlog
      const queueBacklogRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM resume_processing_jobs
         WHERE status IN ('queued', 'extracting', 'extracted', 'scoring', 'needs_review')`
      );

      // Failed count
      const failedCountRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM resume_processing_jobs
         WHERE status = 'failed'`
      );

      // Tier distribution
      const tierRes = await client.query<{ tier: string; count: string }>(
        `SELECT ae.tier, COUNT(*) AS count
         FROM applications a
         JOIN LATERAL (
           SELECT tier FROM application_ai_evaluations
           WHERE application_id = a.id
           ORDER BY created_at DESC LIMIT 1
         ) ae ON true
         GROUP BY ae.tier`
      );

      // Recent jobs (last 5)
      const recentJobsRes = await client.query(
        `SELECT id, title, department, location, employment_type, status,
                experience_years_min, experience_years_max, created_at, updated_at
         FROM job_requisitions
         ORDER BY created_at DESC
         LIMIT 5`
      );

      // Awaiting review count (status = 'reviewable')
      const awaitingReviewRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM applications
         WHERE status = 'reviewable'`
      );

      // New resumes count (status = 'uploaded')
      const newResumesRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM applications
         WHERE status = 'uploaded'`
      );

      // Status distribution
      const statusRes = await client.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count
         FROM applications
         GROUP BY status`
      );

      const tierDistribution = [
        { tier: 'A', count: 0 },
        { tier: 'B', count: 0 },
        { tier: 'C', count: 0 },
      ];
      for (const row of tierRes.rows) {
        const item = tierDistribution.find((t) => t.tier === row.tier);
        if (item) item.count = parseInt(row.count);
      }

      const statusMap = statusRes.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      return {
        active_jobs: parseInt(activeJobsRes.rows[0].count),
        total_applicants: parseInt(totalApplicantsRes.rows[0].count),
        queue_backlog: parseInt(queueBacklogRes.rows[0].count),
        failed_count: parseInt(failedCountRes.rows[0].count),
        awaiting_review: parseInt(awaitingReviewRes.rows[0].count),
        new_resumes: parseInt(newResumesRes.rows[0].count),
        tier_distribution: tierDistribution,
        status_distribution: statusMap,
        recent_jobs: recentJobsRes.rows,
      };
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── GET /queue-status — BullMQ queue stats ──────────────────────────────────

router.get('/queue-status', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const counts = await resumeQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused'
    );

    res.json({
      queued: counts.waiting + counts.delayed + counts.paused,
      processing: counts.active,
      failed: counts.failed,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /analysis — Analytics metrics from DB ────────────────────────────────

router.get('/analysis', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await withTransaction(async (client) => {
      // Skill gaps
      const gapsRes = await client.query<{ skill: string; count: number }>(
        `SELECT elem.value::text AS skill, COUNT(*)::int AS count
         FROM application_ai_evaluations,
         LATERAL jsonb_array_elements_text(missing_requirements) elem
         GROUP BY skill
         ORDER BY count DESC
         LIMIT 6`
      );

      // Score distribution
      const scoreRes = await client.query<{ bucket: string; count: number }>(
        `SELECT
           CASE
             WHEN score < 40 THEN '0–39'
             WHEN score < 55 THEN '40–54'
             WHEN score < 65 THEN '55–64'
             WHEN score < 75 THEN '65–74'
             WHEN score < 85 THEN '75–84'
             WHEN score < 95 THEN '85–94'
             ELSE '95–100'
           END AS bucket,
           COUNT(*)::int AS count
         FROM (
           SELECT DISTINCT ON (application_id) score
           FROM application_ai_evaluations
           ORDER BY application_id, created_at DESC
         ) latest_scores
         GROUP BY bucket`
      );

      return {
        skill_gaps: gapsRes.rows,
        score_distribution: scoreRes.rows,
      };
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
