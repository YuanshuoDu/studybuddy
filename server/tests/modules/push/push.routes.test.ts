/**
 * Tests for the push-token module (issue #27).
 *
 * The M3 launch ships an idempotent register / list / unregister
 * round-trip with a noop dispatcher. M3 W2 wires TPNS / FCM / APNs
 * — that lands behind `push.service.ts` and these tests don't
 * need to change.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.REDIS_URL ??= 'redis://localhost:6379/0';
process.env.JWT_SECRET ??= 'a'.repeat(48);

const { prismaStub, redisStub } = vi.hoisted(() => {
  const prismaStub = {
    pushToken: {
      upsert: vi.fn(),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
  const redisStub = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    scan: vi.fn(async () => ['0', []] as [string, string[]]),
  };
  return { prismaStub, redisStub };
});

vi.mock('@/lib/prisma.js', () => ({ prisma: prismaStub }));
vi.mock('@/lib/redis.js', () => ({ redis: redisStub }));

import { registerPushModule } from '@/modules/push/push.routes.js';

let app: FastifyInstance;

const FAKE_USER_ID = 'usr_test0001';

function makeToken(over: Partial<{ id: string; userId: string; channel: string; token: string }> = {}) {
  return {
    id: 'cktokaaaa',
    userId: FAKE_USER_ID,
    channel: 'APNS',
    token: 'apns-fake-token',
    deviceInfo: null,
    createdAt: new Date('2026-06-08T12:00:00Z'),
    lastSeenAt: new Date('2026-06-08T12:00:00Z'),
    ...over,
  };
}

beforeAll(async () => {
  const Fastify = (await import('fastify')).default;
  app = Fastify({ logger: false });
  app.decorate('prisma', prismaStub as never);
  app.decorate('redis', redisStub as never);
  app.decorate('authenticate', (async (req: { userId?: string }) => {
    req.userId = FAKE_USER_ID;
  }) as never);
  await registerPushModule(app, prismaStub as never);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/v1/devices (issue #27)', () => {
  it('upserts a new push token', async () => {
    prismaStub.pushToken.upsert.mockResolvedValueOnce(makeToken({ id: 'cktoknew1' }));
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/devices',
      payload: { channel: 'APNS', token: 'apns-abc' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.id).toBe('cktoknew1');
    expect(body.data.channel).toBe('APNS');
    // upsert was called with the compound unique key
    expect(prismaStub.pushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_channel_token: { userId: FAKE_USER_ID, channel: 'APNS', token: 'apns-abc' } },
      }),
    );
  });

  it('rejects unknown channels', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/devices',
      payload: { channel: 'WEBHOOK', token: 'whatever' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/devices',
      payload: { channel: 'FCM', token: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/v1/devices (issue #27)', () => {
  it('lists the current user\'s tokens, newest first', async () => {
    prismaStub.pushToken.findMany.mockResolvedValueOnce([
      makeToken({ id: 'a', lastSeenAt: new Date('2026-06-09') }),
      makeToken({ id: 'b', lastSeenAt: new Date('2026-06-08') }),
    ]);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/devices',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('a');
    expect(body.data[1].id).toBe('b');
    expect(prismaStub.pushToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: FAKE_USER_ID } }),
    );
  });
});

describe('DELETE /api/v1/devices/:id (issue #27)', () => {
  it('deletes the user\'s own token', async () => {
    prismaStub.pushToken.findUnique.mockResolvedValueOnce(makeToken());
    prismaStub.pushToken.delete.mockResolvedValueOnce(makeToken());
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/devices/cktokaaaa',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({ id: 'cktokaaaa', deleted: true });
  });

  it('returns 404 for someone else\'s token (no leak)', async () => {
    prismaStub.pushToken.findUnique.mockResolvedValueOnce(
      makeToken({ userId: 'usr_someone_else' }),
    );
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/devices/cktokaaaa',
    });
    expect(res.statusCode).toBe(404);
    // We MUST NOT have actually deleted anything.
    expect(prismaStub.pushToken.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when the id is unknown', async () => {
    prismaStub.pushToken.findUnique.mockResolvedValueOnce(null);
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/devices/cktok_unknown',
    });
    expect(res.statusCode).toBe(404);
  });
});
