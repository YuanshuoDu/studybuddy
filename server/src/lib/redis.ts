/**
 * ioredis client singleton.
 *
 * Notes:
 * - `maxRetriesPerRequest: null` is required for @fastify/rate-limit
 *   to work correctly with ioredis (it issues blocking-style commands).
 * - `enableReadyCheck: true` waits for `INFO` to confirm Redis is up.
 * - We never throw from the `error` listener; the logger is enough.
 *   If we threw, Fastify's request lifecycle would 500 unrelated requests.
 */
import Redis from 'ioredis';

import { env } from './env.js';
import { logger } from './logger.js';

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function makeClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    // Don't crash on transient connection blips during local dev.
    retryStrategy: (times) => Math.min(times * 200, 2_000),
  });

  client.on('error', (err) => {
    logger.error({ err }, 'redis client error');
  });
  client.on('connect', () => {
    logger.info('redis client connected');
  });
  client.on('ready', () => {
    logger.info('redis client ready');
  });
  client.on('close', () => {
    logger.warn('redis client closed');
  });

  return client;
}

export const redis: Redis = globalThis.__redis ?? makeClient();

if (env.NODE_ENV !== 'production') {
  globalThis.__redis = redis;
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}

export async function pingRedis(): Promise<void> {
  const pong = await redis.ping();
  if (pong !== 'PONG') {
    throw new Error(`Unexpected Redis PING response: ${pong}`);
  }
}
