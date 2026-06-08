/**
 * Health endpoint smoke tests.
 *
 * These tests exercise the Fastify instance in-process (no real DB
 * or Redis required) by injecting mock `pingPrisma` / `pingRedis`
 * implementations. The goal is to verify the route + error handler
 * contract, not the database driver.
 *
 * IMPORTANT: we must NOT use `vi.importActual` for the mocked modules,
 * because that would instantiate the real PrismaClient + ioredis and
 * block forever trying to reach localhost. Instead we provide a pure
 * factory that exports the same names as the real module but stub
 * values. The `prisma` and `redis` exports are also stubbed so that
 * `app.ts` decoration + plugins that hold a reference to them never
 * deref a real client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('@/lib/prisma.js', () => {
  const prismaStub = {} as never;
  return {
    prisma: prismaStub,
    pingPrisma: vi.fn(),
    closePrisma: vi.fn(),
  };
});

vi.mock('@/lib/redis.js', () => {
  // @fastify/rate-limit's RedisStore uses callback-style ioredis:
  //   redis.rateLimit(key, window, max, ban, continueExceeding, cb)
  // where cb is `(err, [current, ttl, ban])`. The plugin's request
  // hook calls `incr()` which awaits the callback — Promise-returning
  // stubs would hang the test forever. Provide the callback signature
  // so the hook completes immediately.
  const redisStub = {
    defineCommand: vi.fn(),
    // Always under the limit (current=1, ttl=60000, ban=false).
    rateLimit: vi.fn(
      (
        _key: unknown,
        _window: unknown,
        _max: unknown,
        _ban: unknown,
        _continue: unknown,
        cb: (err: null, result: [number, number, boolean]) => void,
      ) => cb(null, [1, 60_000, false]),
    ),
    quit: vi.fn(async () => 'OK'),
    disconnect: vi.fn(),
    on: vi.fn(),
    duplicate: vi.fn(),
  } as never;
  return {
    redis: redisStub,
    pingRedis: vi.fn(),
    closeRedis: vi.fn(async () => undefined),
  };
});

// Imports placed AFTER vi.mock so the stubs are in place when app.ts
// pulls in its dependency graph.
import { buildApp } from '@/lib/app.js';
import { pingPrisma } from '@/lib/prisma.js';
import { pingRedis } from '@/lib/redis.js';

const mockedPingPrisma = vi.mocked(pingPrisma);
const mockedPingRedis = vi.mocked(pingRedis);

describe('health endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockedPingPrisma.mockReset();
    mockedPingRedis.mockReset();
    app = await buildApp({ silent: true });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health (liveness)', () => {
    it.each(['/health', '/api/health'])('returns 200 at %s', async (path) => {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('studybuddy-server');
      expect(typeof body.timestamp).toBe('string');
    });

    it('does not touch Postgres or Redis', async () => {
      await app.inject({ method: 'GET', url: '/health' });
      expect(mockedPingPrisma).not.toHaveBeenCalled();
      expect(mockedPingRedis).not.toHaveBeenCalled();
    });
  });

  describe('GET /ready (readiness)', () => {
    it.each(['/ready', '/api/ready', '/api/health/ready'])(
      'returns 200 with both checks ok at %s',
      async (path) => {
        mockedPingPrisma.mockResolvedValue(undefined);
        mockedPingRedis.mockResolvedValue(undefined);

        const res = await app.inject({ method: 'GET', url: path });
        expect(res.statusCode).toBe(200);

        const body = res.json();
        expect(body.status).toBe('ready');
        expect(body.checks.postgres.status).toBe('ok');
        expect(body.checks.redis.status).toBe('ok');
        expect(typeof body.checks.postgres.latency_ms).toBe('number');
      },
    );

    it('returns 503 when Postgres is unreachable', async () => {
      mockedPingPrisma.mockRejectedValue(new Error('connection refused'));
      mockedPingRedis.mockResolvedValue(undefined);

      const res = await app.inject({ method: 'GET', url: '/ready' });
      expect(res.statusCode).toBe(503);

      const body = res.json();
      expect(body.status).toBe('degraded');
      expect(body.checks.postgres.status).toBe('fail');
      expect(body.checks.postgres.error).toBe('connection refused');
      expect(body.checks.redis.status).toBe('ok');
    });

    it('returns 503 when Redis is unreachable', async () => {
      mockedPingPrisma.mockResolvedValue(undefined);
      mockedPingRedis.mockRejectedValue(new Error('ETIMEDOUT'));

      const res = await app.inject({ method: 'GET', url: '/ready' });
      expect(res.statusCode).toBe(503);

      const body = res.json();
      expect(body.status).toBe('degraded');
      expect(body.checks.postgres.status).toBe('ok');
      expect(body.checks.redis.status).toBe('fail');
      expect(body.checks.redis.error).toBe('ETIMEDOUT');
    });
  });

  describe('404 handling', () => {
    it('returns a structured 404 for unknown routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
      expect(res.statusCode).toBe(404);
      // Fastify's default 404 has a code/message; we just want to make
      // sure the response is JSON (not HTML).
      const ct = res.headers['content-type'] ?? '';
      expect(ct).toContain('application/json');
    });
  });
});
