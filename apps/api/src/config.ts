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
    maxTokens: parseInt(process.env.VLLM_MAX_TOKENS || '800'),
    temperature: parseFloat(process.env.VLLM_TEMPERATURE || '0.2'),
    timeoutSeconds: parseFloat(process.env.VLLM_TIMEOUT_SECONDS || '90'),
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
} as const;
