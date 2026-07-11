/**
 * Rate limiting plugin.
 *
 * - Global:   RATE_LIMIT_MAX req / minute / IP (default 100)
 * - Login:    RATE_LIMIT_LOGIN_MAX req / minute / IP (default 10)
 *
 * The buckets are backed by Redis so they survive multi-instance
 * deployments. ioredis client is provided by lib/redis.ts.
 *
 * @fastify/rate-limit only counts successful responses by default; we
 * also want to count 4xx so login brute-force attempts get throttled.
 * Hence `skipOnError: false` and counting all responses.
 */
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { getEnv } from '@/lib/env.js';

async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
  // Global rate limit — applies to every route by default.
  await app.register(rateLimit, {
    global: true,
    max: getEnv().RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    redis: app.redis,
    keyGenerator: (req) => req.ip,
    // Count all responses (including 4xx) so login brute-force gets caught.
    skipOnError: false,
    errorResponseBuilder: (req, ctx) => ({
      type: 'https://Pairhub.example.com/errors/rate-limit-exceeded',
      title: 'Too Many Requests',
      status: 429,
      detail: `请求过于频繁，请 ${Math.ceil(ctx.ttl / 1000)} 秒后再试`,
      instance: req.url,
      code: 'RATE_LIMIT_EXCEEDED',
    }),
  });

  // Tighter limit for login endpoints. Decorated so the auth module
  // (M1-W2) can opt-in via `config: { rateLimit: { max: ... } }` or
  // simply mount under this scope.
  await app.register(async (instance) => {
    await instance.register(rateLimit, {
      global: false,
      max: getEnv().RATE_LIMIT_LOGIN_MAX,
      timeWindow: '1 minute',
      redis: instance.redis,
      keyGenerator: (req) => req.ip,
      skipOnError: false,
    });
  });
}

export default fp(rateLimitPlugin, {
  name: 'rate-limit-plugin',
  dependencies: [],
});
