import { Router, Request, Response, NextFunction } from 'express';
import { withTransaction } from '../db/pool';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── GET / — List role history snapshots ─────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      job_id,
      department,
      milestone,
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['1=1'];
    const params: unknown[] = [];
    let idx = 1;

    if (job_id) {
      conditions.push(`rhs.job_id = $${idx++}`);
      params.push(job_id);
    }
    if (department) {
      conditions.push(`rhs.snapshot_data->>'department' ILIKE $${idx++}`);
      params.push(`%${department}%`);
    }
    if (milestone) {
      conditions.push(`rhs.milestone = $${idx++}`);
      params.push(milestone);
    }

    const where = conditions.join(' AND ');

    const result = await withTransaction(async (client) => {
      const countRes = await client.query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM role_history_snapshots rhs WHERE ${where}`,
        params
      );
      const total = parseInt(countRes.rows[0].total);

      const rows = await client.query(
        `SELECT
           rhs.id, rhs.job_id, rhs.application_id,
           rhs.snapshot_data->>'candidate_id' AS candidate_id,
           rhs.milestone,
           rhs.snapshot_data->>'job_title' AS role,
           rhs.snapshot_data->>'department' AS department,
           rhs.snapshot_data->>'candidate_name' AS candidate_name,
           rhs.snapshot_data->>'tier' AS tier,
           (rhs.snapshot_data->>'score')::numeric AS score,
           rhs.snapshot_data, rhs.captured_at AS accepted_at
         FROM role_history_snapshots rhs
         WHERE ${where}
         ORDER BY rhs.captured_at DESC
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

// ─── GET /similar — pgvector similarity search ────────────────────────────────

router.get('/similar', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { job_id, limit: limitStr = '10' } = req.query as Record<string, string>;

    if (!job_id) {
      res.status(400).json({
        error: { code: 'MISSING_PARAM', message: 'job_id query parameter is required' },
      });
      return;
    }

    const limitNum = Math.min(50, Math.max(1, parseInt(limitStr)));

    const result = await withTransaction(async (client) => {
      // Fetch the job embedding
      const embeddingRes = await client.query<{ embedding: string }>(
        `SELECT embedding FROM job_embeddings WHERE job_id = $1`,
        [job_id]
      );

      if (!embeddingRes.rows[0]) {
        return null;
      }

      const jobEmbedding = embeddingRes.rows[0].embedding;

      // Semantic search over *role history* — past candidates who actually reached a
      // screening/hired milestone on some other job — ranked by resume similarity to
      // this job's embedding. (Not a generic resume search: it deliberately excludes
      // resumes with no role-history milestone, and excludes this job's own pipeline.)
      const similarRes = await client.query(
        `SELECT
           application_id AS id,
           candidate_name,
           role,
           department,
           tier,
           score,
           milestone,
           accepted_at,
           similarity_score
         FROM (
           SELECT DISTINCT ON (rhs.application_id)
             rhs.application_id,
             rhs.snapshot_data->>'candidate_name' AS candidate_name,
             rhs.snapshot_data->>'job_title' AS role,
             rhs.snapshot_data->>'department' AS department,
             rhs.snapshot_data->>'tier' AS tier,
             (rhs.snapshot_data->>'score')::numeric AS score,
             rhs.milestone,
             rhs.captured_at AS accepted_at,
             1 - (re.embedding <=> $1::vector) AS similarity_score
           FROM role_history_snapshots rhs
           JOIN applications a ON a.id = rhs.application_id
           JOIN resume_embeddings re ON re.resume_id = a.resume_id
           WHERE rhs.job_id != $2
           ORDER BY rhs.application_id, rhs.captured_at DESC
         ) latest
         ORDER BY similarity_score DESC
         LIMIT $3`,
        [jobEmbedding, job_id, limitNum]
      );

      return similarRes.rows;
    });

    if (result === null) {
      res.status(404).json({
        error: { code: 'NO_EMBEDDING', message: 'No embedding found for the specified job. Ensure JD processing is complete.' },
      });
      return;
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
