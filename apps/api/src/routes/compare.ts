import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withTransaction } from '../db/pool';
import { redis } from '../db/redis';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { chatCompletion, chatCompletionJson, type ChatMessage } from '../services/llm';
import { getModel } from '../services/settings';

// Cached comparisons are self-invalidating (see fingerprint below), so a long
// TTL is just a safety net against unbounded growth, not a correctness knob.
const COMPARE_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

function compareCacheKey(idA: string, idB: string, model: string): string {
  return `compare:${idA}:${idB}:${model}`;
}

/**
 * Fingerprints everything that could change a comparison's outcome: each
 * candidate's current resume + latest scoring evaluation, the job's most
 * recent edit, and which model produced the comparison. If any of these
 * differ from what's cached, the cache is treated as stale.
 */
function compareFingerprint(ctx: CompareContext, model: string): string {
  const payload = JSON.stringify({
    model,
    jobUpdatedAt: ctx.jobUpdatedAt,
    a: [ctx.a.resumeId, ctx.a.evalId],
    b: [ctx.b.resumeId, ctx.b.evalId],
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const router = Router();
router.use(authenticate);

// ─── Schemas ────────────────────────────────────────────────────────────────

const applicationIds = z
  .array(z.string().uuid())
  .length(2, 'Provide exactly two application ids to compare');

const compareSchema = z.object({
  applicationIds,
});

const askSchema = z.object({
  applicationIds,
  question: z.string().trim().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

type LoadedCandidate = {
  applicationId: string;
  resumeId: string;
  evalId: string | null;
  fullName: string;
  tier: string | null;
  score: number | null;
  strengths: string[];
  weaknesses: string[];
  recommendation: string | null;
  resumeText: string;
  profile: unknown;
};

type CompareContext = {
  jobTitle: string;
  jobDescription: string;
  jobUpdatedAt: string;
  a: LoadedCandidate;
  b: LoadedCandidate;
};

// Keep the two resumes + JD within a small local model's context window.
const JD_CHARS = 2_500;
const RESUME_CHARS = 3_500;

// ─── Shared loader ────────────────────────────────────────────────────────────

/**
 * Load both applications and their shared job. Enforces that the two
 * applications exist and belong to the same job — comparison is only
 * meaningful against a common job description.
 */
async function loadContext(ids: string[]): Promise<CompareContext | { error: string; status: number }> {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT
         a.id AS application_id,
         a.job_id,
         a.resume_id,
         jr.title AS job_title,
         jr.raw_jd,
         jr.updated_at AS job_updated_at,
         c.full_name,
         r.extracted_markdown,
         r.profile_json,
         ae.id AS eval_id,
         ae.tier, ae.score, ae.recommendation,
         ae.reasons->'strengths' AS strengths,
         ae.reasons->'weaknesses' AS weaknesses
       FROM applications a
       JOIN job_requisitions jr ON jr.id = a.job_id
       JOIN candidates c ON c.id = a.candidate_id
       JOIN resumes r ON r.id = a.resume_id
       LEFT JOIN LATERAL (
         SELECT id, tier, score, recommendation, reasons
         FROM application_ai_evaluations
         WHERE application_id = a.id
         ORDER BY created_at DESC LIMIT 1
       ) ae ON true
       WHERE a.id = ANY($1::uuid[])`,
      [ids]
    );

    if (rows.length < 2) {
      return { error: 'One or both applications were not found', status: 404 };
    }
    if (rows[0].job_id !== rows[1].job_id) {
      return {
        error: 'Both candidates must belong to the same job to compare',
        status: 422,
      };
    }

    const toCandidate = (row: (typeof rows)[number]): LoadedCandidate => ({
      applicationId: row.application_id,
      resumeId: row.resume_id,
      evalId: row.eval_id ?? null,
      fullName: row.full_name ?? 'Unknown',
      tier: row.tier ?? null,
      score: row.score !== null && row.score !== undefined ? Number(row.score) : null,
      strengths: Array.isArray(row.strengths) ? row.strengths : [],
      weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses : [],
      recommendation: row.recommendation ?? null,
      resumeText: (row.extracted_markdown ?? '').slice(0, RESUME_CHARS),
      profile: row.profile_json ?? null,
    });

    // Preserve the caller's ordering (a = ids[0], b = ids[1]).
    const byId = new Map(rows.map((r) => [r.application_id, r]));
    const rowA = byId.get(ids[0]);
    const rowB = byId.get(ids[1]);
    if (!rowA || !rowB) {
      return { error: 'One or both applications were not found', status: 404 };
    }

    return {
      jobTitle: rowA.job_title ?? '',
      jobDescription: (rowA.raw_jd ?? '').slice(0, JD_CHARS),
      jobUpdatedAt: rowA.job_updated_at ? new Date(rowA.job_updated_at).toISOString() : '',
      a: toCandidate(rowA),
      b: toCandidate(rowB),
    };
  });
}

function candidateBlock(label: string, c: LoadedCandidate): string {
  const evalLine =
    c.tier || c.score !== null
      ? `Prior AI screen: tier ${c.tier ?? '?'}, score ${c.score ?? '?'}/100.`
      : 'No prior AI screen available.';
  return [
    `=== Candidate ${label}: ${c.fullName} ===`,
    evalLine,
    c.strengths.length ? `Noted strengths: ${c.strengths.join('; ')}` : '',
    c.weaknesses.length ? `Noted gaps: ${c.weaknesses.join('; ')}` : '',
    '',
    `Resume:`,
    c.resumeText || '(no resume text extracted)',
  ]
    .filter(Boolean)
    .join('\n');
}

function baseContextPrompt(ctx: CompareContext): string {
  return [
    `You are helping a recruiter compare two candidates for the role: ${ctx.jobTitle}.`,
    '',
    `Job description:`,
    ctx.jobDescription || '(no job description provided)',
    '',
    candidateBlock('A', ctx.a),
    '',
    candidateBlock('B', ctx.b),
  ].join('\n');
}

function isError(x: unknown): x is { error: string; status: number } {
  return typeof x === 'object' && x !== null && 'error' in x;
}

type Comparison = {
  dimensions: { name: string; a_assessment: string; b_assessment: string; edge: 'a' | 'b' | 'tie' }[];
  winner: 'a' | 'b' | 'tie';
  summary: string;
};

const EDGES = new Set(['a', 'b', 'tie']);

/**
 * Coerce whatever the model returned into a clean, well-shaped Comparison.
 * Small local models occasionally nest keys, drop fields, or echo the schema
 * placeholder — normalize defensively so the client always gets valid data.
 */
function normalizeComparison(raw: unknown): Comparison {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawDims = Array.isArray(obj.dimensions) ? obj.dimensions : [];
  const dimensions = rawDims
    .map((d) => (d ?? {}) as Record<string, unknown>)
    .filter((d) => typeof d.name === 'string' && (d.name as string).trim().length > 0)
    .map((d) => {
      const edge = typeof d.edge === 'string' && EDGES.has(d.edge) ? (d.edge as 'a' | 'b' | 'tie') : 'tie';
      return {
        name: String(d.name).slice(0, 120),
        a_assessment: typeof d.a_assessment === 'string' ? d.a_assessment : '',
        b_assessment: typeof d.b_assessment === 'string' ? d.b_assessment : '',
        edge,
      };
    })
    .slice(0, 6);

  const winner =
    typeof obj.winner === 'string' && EDGES.has(obj.winner) ? (obj.winner as 'a' | 'b' | 'tie') : 'tie';
  const summary = typeof obj.summary === 'string' ? obj.summary : '';
  return { dimensions, winner, summary };
}

/** A comparison is usable if it has at least one dimension with both sides filled. */
function isUsable(c: Comparison): boolean {
  return c.dimensions.some((d) => d.a_assessment.trim() && d.b_assessment.trim());
}

// ─── POST /compare — structured head-to-head ─────────────────────────────────

const COMPARE_SYSTEM = `You are an expert technical recruiter comparing two candidates, A and B, for the same role.
Weigh them directly against each other on the dimensions that matter for this job.

Respond with ONE JSON object and NOTHING else — no markdown fences, no prose outside it.

The JSON has exactly three top-level keys: "dimensions", "winner", "summary".
"dimensions" is a FLAT array. Never put a "dimensions" key inside a dimension item.
Each dimension item has exactly these four keys: "name", "a_assessment", "b_assessment", "edge".
- name: the factor being compared, e.g. "Relevant experience".
- a_assessment: one short sentence about Candidate A on this factor. Always fill it.
- b_assessment: one short sentence about Candidate B on this factor. Always fill it.
- edge: the single letter "a" if A is stronger here, "b" if B is stronger, or "tie". Never write the text "a|b|tie".
"winner": "a", "b", or "tie" — the overall stronger candidate for this role.
"summary": at most two sentences explaining the overall call for a recruiter.

Copy the STRUCTURE of this example exactly (its content is for a different, unrelated role):
{"dimensions":[{"name":"Relevant experience","a_assessment":"Six years in backend Python roles directly on point.","b_assessment":"Three years, mostly frontend, less directly relevant.","edge":"a"},{"name":"Cloud skills","a_assessment":"No cloud platform experience shown on the resume.","b_assessment":"Strong AWS background across several shipped projects.","edge":"b"},{"name":"Communication","a_assessment":"Clear writing, led standups.","b_assessment":"Also strong; mentored juniors.","edge":"tie"}],"winner":"a","summary":"Candidate A is the stronger overall fit for a backend role given deeper Python experience. Candidate B brings cloud strengths worth weighing if the team needs AWS."}

Rules:
- Use 3 to 5 dimensions, each a concrete factor for THIS job.
- Base every judgment only on the provided resumes and prior screens. Do not invent experience.`;

router.post(
  '/',
  validate(compareSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { applicationIds: ids } = req.body as z.infer<typeof compareSchema>;
    try {
      const ctx = await loadContext(ids);
      if (isError(ctx)) {
        res.status(ctx.status).json({ error: { code: 'COMPARE_ERROR', message: ctx.error } });
        return;
      }

      const model = await getModel('compare_model');
      const fingerprint = compareFingerprint(ctx, model);
      const cacheKey = compareCacheKey(ids[0], ids[1], model);

      const cachedRaw = await redis.get(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { fingerprint: string; candidates: unknown; comparison: unknown };
        if (cached.fingerprint === fingerprint) {
          res.json({ candidates: cached.candidates, comparison: cached.comparison, cached: true });
          return;
        }
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: COMPARE_SYSTEM },
        {
          role: 'user',
          content: `${baseContextPrompt(ctx)}\n\nNow output the JSON comparison:`,
        },
      ];

      // Small models sometimes return a malformed shape that still parses as
      // JSON; retry once if the first result isn't usable before giving up.
      let result = normalizeComparison(await chatCompletionJson(messages, { model }));
      if (!isUsable(result)) {
        result = normalizeComparison(await chatCompletionJson(messages, { model, temperature: 0.1 }));
      }

      const candidates = {
        a: { applicationId: ctx.a.applicationId, fullName: ctx.a.fullName, tier: ctx.a.tier, score: ctx.a.score, profile: ctx.a.profile },
        b: { applicationId: ctx.b.applicationId, fullName: ctx.b.fullName, tier: ctx.b.tier, score: ctx.b.score, profile: ctx.b.profile },
      };

      await redis.set(
        cacheKey,
        JSON.stringify({ fingerprint, candidates, comparison: result }),
        'EX',
        COMPARE_CACHE_TTL_SECONDS
      );

      res.json({ candidates, comparison: result, cached: false });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /compare/ask — grounded follow-up Q&A ──────────────────────────────

const ASK_SYSTEM = `You are an expert technical recruiter answering a hiring manager's questions about two candidates being compared for the same role.
Answer only from the job description, resumes, and prior AI screens provided in the first message.
If the answer isn't supported by that material, say so plainly rather than guessing.
Refer to the candidates by name. Keep answers concise and concrete — a few sentences at most unless asked for detail.`;

router.post(
  '/ask',
  validate(askSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { applicationIds: ids, question, history } = req.body as z.infer<typeof askSchema>;
    try {
      const ctx = await loadContext(ids);
      if (isError(ctx)) {
        res.status(ctx.status).json({ error: { code: 'COMPARE_ERROR', message: ctx.error } });
        return;
      }

      const messages: ChatMessage[] = [
        { role: 'system', content: ASK_SYSTEM },
        {
          role: 'user',
          content: `Here is the material for the two candidates you'll answer questions about.\n\n${baseContextPrompt(
            ctx
          )}`,
        },
        {
          role: 'assistant',
          content: `Understood. I've reviewed both candidates for ${ctx.jobTitle}. What would you like to know?`,
        },
        ...(history ?? []).map((m) => ({ role: m.role, content: m.content } as ChatMessage)),
        { role: 'user', content: question },
      ];

      const answer = await chatCompletion(messages, {
        model: await getModel('chat_model'),
        maxTokens: 500,
        temperature: 0.3,
      });
      res.json({ answer: answer.trim() });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
