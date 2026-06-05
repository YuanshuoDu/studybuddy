/**
 * CORS configuration.
 *
 * - In development we accept any origin (default for the miniprogram dev
 *   tools and the Flutter iOS simulator).
 * - In production we expect `CORS_ORIGIN` to be a comma-separated
 *   allowlist. Empty / `*` is rejected in non-dev to avoid accidentally
 *   shipping a wide-open CORS policy.
 */
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '@/lib/env.js';

async function corsPlugin(app: FastifyInstance): Promise<void> {
  const isDev = env.NODE_ENV !== 'production';

  const origin = (() => {
    if (isDev) return true;
    const raw = env.CORS_ORIGIN.trim();
    if (raw === '' || raw === '*') {
      // eslint-disable-next-line no-console
      console.warn(
        '[cors] CORS_ORIGIN is empty or * in production; defaulting to deny cross-origin.',
      );
      return false;
    }
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  })();

  await app.register(cors, {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
}

export default fp(corsPlugin, { name: 'cors-plugin' });
