import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  getModelSettings,
  setModelSettings,
  listAvailableModels,
  MODEL_KEYS,
} from '../services/settings';

const router = Router();
router.use(authenticate);

// ─── GET /settings/models — current selections + available models ────────────

router.get('/models', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [selected, available] = await Promise.all([getModelSettings(), listAvailableModels()]);
    res.json({ selected, available });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /settings/models — update selections (owner only) ───────────────────

const modelName = z.string().trim().min(1).max(200);

const putModelsSchema = z
  .object({
    scoring_model: modelName.optional(),
    compare_model: modelName.optional(),
    chat_model: modelName.optional(),
    profile_model: modelName.optional(),
  })
  .refine((obj) => MODEL_KEYS.some((k) => obj[k] !== undefined), {
    message: 'Provide at least one model setting to update',
  });

router.put(
  '/models',
  requireRole('owner'),
  validate(putModelsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const updates = req.body as z.infer<typeof putModelsSchema>;
      await setModelSettings(updates, req.user?.userId ?? null);
      const selected = await getModelSettings();
      res.json({ selected });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
