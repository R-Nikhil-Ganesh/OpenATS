import dotenv from 'dotenv';
import path from 'path';

// Docker Compose injects `.env` via `env_file`, but running the API directly
// (e.g. `npm run dev` from apps/api) never reads it otherwise — load it
// explicitly from the repo root so local/non-Docker runs match Docker's env.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.API_PORT || '3001'),
  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'openats',
    user: process.env.POSTGRES_USER || 'openats',
    password: process.env.POSTGRES_PASSWORD || 'changeme',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access_secret_dev',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret_dev',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '20'),
  },
  queue: {
    name: process.env.BULLMQ_QUEUE_NAME || 'resume-processing',
  },
  vllm: {
    baseUrl: process.env.VLLM_BASE_URL || 'http://localhost:8000',
    model: process.env.VLLM_MODEL || 'llama3.2:3b',
    // Interactive candidate comparison is low-volume, so it can afford a
    // stronger model than the high-throughput scoring path above.
    compareModel: process.env.VLLM_COMPARE_MODEL || 'qwen2.5-coder:7b',
    // MD→JSON profile extraction is a mechanical transformation, not a
    // judgment call, so it runs on a smaller model than scoring/compare.
    profileModel: process.env.VLLM_PROFILE_MODEL || 'qwen2.5-coder:1.5b',
    maxTokens: parseInt(process.env.VLLM_MAX_TOKENS || '800'),
    temperature: parseFloat(process.env.VLLM_TEMPERATURE || '0.2'),
    timeoutSeconds: parseFloat(process.env.VLLM_TIMEOUT_SECONDS || '90'),
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  nvidia: {
    // Cloud NVIDIA NIM is OFF by default — this deployment runs on local Ollama
    // (config.vllm) only. Set LLM_USE_NVIDIA=true AND provide a key to opt in.
    // Without the explicit flag, merely having a key present no longer diverts
    // interactive LLM calls (compare / ask) away from Ollama.
    enabled: process.env.LLM_USE_NVIDIA === 'true',
    apiKey: process.env.NVIDIA_API_KEY || '',
    baseUrl: process.env.NVIDIA_API_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    model: process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-r1',
  },
} as const;
