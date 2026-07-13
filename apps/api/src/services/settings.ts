import { pool } from '../db/pool';
import { config } from '../config';

// ---------------------------------------------------------------------------
// Global app settings backed by the app_settings key/value table.
//
// Currently holds the model chosen for each AI feature. Values are read live
// from the DB (with the code-level config defaults as a fallback) so that a
// change saved from the Settings page takes effect on the next request without
// a service restart.
// ---------------------------------------------------------------------------

export type ModelKey = 'scoring_model' | 'compare_model' | 'chat_model';

export const MODEL_KEYS: ModelKey[] = ['scoring_model', 'compare_model', 'chat_model'];

const MODEL_DEFAULTS: Record<ModelKey, string> = {
  scoring_model: config.vllm.model,
  compare_model: config.vllm.compareModel,
  chat_model: config.vllm.compareModel,
};

/** Fetch all model selections, falling back to config defaults for any missing key. */
export async function getModelSettings(): Promise<Record<ModelKey, string>> {
  const result = { ...MODEL_DEFAULTS };
  try {
    const { rows } = await pool.query<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key = ANY($1::varchar[])`,
      [MODEL_KEYS]
    );
    for (const row of rows) {
      if ((MODEL_KEYS as string[]).includes(row.key) && row.value) {
        result[row.key as ModelKey] = row.value;
      }
    }
  } catch {
    // Table missing or DB hiccup — defaults are a safe fallback.
  }
  return result;
}

/** Convenience: resolve a single model setting. */
export async function getModel(key: ModelKey): Promise<string> {
  return (await getModelSettings())[key];
}

/** Upsert the given model selections, recording who changed them. */
export async function setModelSettings(
  updates: Partial<Record<ModelKey, string>>,
  userId: string | null
): Promise<void> {
  const entries = Object.entries(updates).filter(([k]) => (MODEL_KEYS as string[]).includes(k));
  if (entries.length === 0) return;

  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, value, userId]
    );
  }
}

/**
 * List models available on the configured LLM server via the OpenAI-compatible
 * /v1/models endpoint (supported by both Ollama and vLLM). Best-effort: returns
 * an empty list if the server is unreachable so the UI can degrade gracefully.
 */
export async function listAvailableModels(): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${config.vllm.baseUrl}/v1/models`, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id?: string }[] };
    return (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
