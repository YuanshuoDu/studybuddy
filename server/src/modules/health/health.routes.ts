/**
 * Health check module.
 *
 * Two endpoints with distinct semantics:
 *   - GET /health   — liveness. Always 200 if the process is running.
 *                     Used by orchestrators (k8s livenessProbe).
 *   - GET /ready    — readiness. Pings Postgres + Redis. 503 if any
 *                     dependency is unreachable. Used by load balancers
 *                     and k8s readinessProbe.
 *
 * For convenience we also bind /api/health and /api/ready, matching the
 * canonical API path prefix used by the rest of the routes (see
 * docs/api/conventions.md).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { pingPrisma } from '@/lib/prisma.js';
import { pingRedis } from '@/lib/redis.js';

interface CheckResult {
  status: 'ok' | 'fail';
  latency_ms?: number;
  error?: string;
}

interface ReadinessBody {
  status: 'ready' | 'degraded';
  checks: Record<string, CheckResult>;
  timestamp: string;
}

async function checkPostgres(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await pingPrisma();
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (e) {
    return { status: 'fail', error: (e as Error).message };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await pingRedis();
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (e) {
    return { status: 'fail', error: (e as Error).message };
  }
}

export async function registerHealthModule(app: FastifyInstance): Promise<void> {
  // ---- Liveness ----
  const liveness = async () => ({
    status: 'ok',
    service: 'studybuddy-server',
    version: process.env['npm_package_version'] ?? '0.1.0',
    timestamp: new Date().toISOString(),
  });

  // /health and /api/health
  app.get('/health', liveness);
  app.get('/api/health', liveness);

  // ---- Readiness ----
  const readiness = async (_req: FastifyRequest, reply: FastifyReply) => {
    const [postgres, redisCheck] = await Promise.all([checkPostgres(), checkRedis()]);
    const checks: Record<string, CheckResult> = { postgres, redis: redisCheck };
    const allOk = Object.values(checks).every((c) => c.status === 'ok');
    const body: ReadinessBody = {
      status: allOk ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
    return reply.code(allOk ? 200 : 503).send(body);
  };

  // /ready and /api/ready (and the longer /api/health/ready alias for
  // backwards-compat with earlier specs).
  app.get('/ready', readiness);
  app.get('/api/ready', readiness);
  app.get('/api/health/ready', readiness);
}
