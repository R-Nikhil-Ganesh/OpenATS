import { Router, Request, Response, NextFunction } from 'express';
import { withTransaction } from '../db/pool';
import { resumeQueue } from '../db/redis';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── GET /summary ─────────────────────────────────────────────────────────────

router.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
         WHERE status IN ('queued', 'extracting', 'scoring')`
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

      const tierDistribution = [
        { tier: 'A', count: 0 },
        { tier: 'B', count: 0 },
        { tier: 'C', count: 0 },
      ];
      for (const row of tierRes.rows) {
        const item = tierDistribution.find((t) => t.tier === row.tier);
        if (item) item.count = parseInt(row.count);
      }

      return {
        active_jobs: parseInt(activeJobsRes.rows[0].count),
        total_applicants: parseInt(totalApplicantsRes.rows[0].count),
        queue_backlog: parseInt(queueBacklogRes.rows[0].count),
        failed_count: parseInt(failedCountRes.rows[0].count),
        tier_distribution: tierDistribution,
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

export default router;
