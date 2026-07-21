import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { config } from '../config';

const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
};

export const redis = new IORedis(redisOptions);

redis.on('connect', () => console.info('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));

export const resumeQueue = new Queue(config.queue.name, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // keep completed jobs for 24h
      count: 500,
    },
    removeOnFail: {
      age: 7 * 86400, // keep failed jobs for 7d
    },
  },
});

resumeQueue.on('error', (err) => {
  console.error('[Queue] BullMQ Queue error:', err.message);
});
