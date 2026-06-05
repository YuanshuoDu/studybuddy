/**
 * Test helpers — fake Prisma + Redis implementations.
 *
 * Why we need this: the new scaffold instantiates `prisma` and `redis` as
 * module-level singletons (lib/prisma.ts, lib/redis.ts) that try to connect
 * to real services on import.  In a unit-test environment without live
 * Postgres / Redis we want to substitute in-memory fakes.
 *
 * Usage:
 *   vi.mock('@/lib/prisma.js', () => makePrismaMock());
 *   vi.mock('@/lib/redis.js',  () => makeRedisMock());
 *
 * The mocks implement only the surface used by the auth module:
 *   - prisma.user.{findUnique, create, update}
 *   - redis.{set, get, del, exists}
 *
 * If you need more methods, extend the fake here.
 */
import { vi } from 'vitest';
import type { PrismaClient, User, UserStatus, AuthProvider } from '@prisma/client';
import type { Redis } from 'ioredis';

export interface FakeUserStore {
  byId: Map<string, FakeUserRow>;
  byOpenid: Map<string, string>;
  byAppleSub: Map<string, string>;
  byGoogleSub: Map<string, string>;
  byPhone: Map<string, string>;
  reset(): void;
}

export interface FakeUserRow {
  id: string;
  openid: string | null;
  unionid: string | null;
  appleSub: string | null;
  googleSub: string | null;
  primaryProvider: AuthProvider;
  nickname: string;
  avatar: string | null;
  school: string | null;
  major: string | null;
  grade: string | null;
  wechatId: string | null;
  phone: string | null;
  bio: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function makeFakeUserStore(): FakeUserStore {
  const byId = new Map<string, FakeUserRow>();
  const byOpenid = new Map<string, string>();
  const byAppleSub = new Map<string, string>();
  const byGoogleSub = new Map<string, string>();
  const byPhone = new Map<string, string>();
  return {
    byId,
    byOpenid,
    byAppleSub,
    byGoogleSub,
    byPhone,
    reset() {
      byId.clear();
      byOpenid.clear();
      byAppleSub.clear();
      byGoogleSub.clear();
      byPhone.clear();
    },
  };
}

/**
 * Build a mock for `@/lib/prisma.js` exporting a singleton `prisma` plus
 * the `pingPrisma` / `closePrisma` helpers the rest of the code uses.
 */
export function makePrismaMock(opts: {
  store: FakeUserStore;
}): {
  prisma: PrismaClient;
  pingPrisma: () => Promise<void>;
  closePrisma: () => Promise<void>;
} {
  const userApi = {
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      let id: string | undefined;
      if ('id' in where) id = where.id as string;
      else if ('openid' in where) id = opts.store.byOpenid.get(where.openid as string);
      else if ('appleSub' in where) id = opts.store.byAppleSub.get(where.appleSub as string);
      else if ('googleSub' in where) id = opts.store.byGoogleSub.get(where.googleSub as string);
      else if ('phone' in where) id = opts.store.byPhone.get(where.phone as string);
      if (!id) return null;
      const row = opts.store.byId.get(id);
      if (!row) return null;
      return cloneUser(row) as User;
    }),
    create: vi.fn(async ({ data }: { data: Partial<FakeUserRow> }) => {
      const id = data.id ?? `usr_${(opts.store.byId.size + 1).toString().padStart(8, '0')}`;
      const now = new Date();
      const row: FakeUserRow = {
        id,
        openid: data.openid ?? null,
        unionid: data.unionid ?? null,
        appleSub: data.appleSub ?? null,
        googleSub: data.googleSub ?? null,
        primaryProvider: data.primaryProvider ?? 'WECHAT',
        nickname: data.nickname ?? '用户',
        avatar: data.avatar ?? null,
        school: data.school ?? null,
        major: data.major ?? null,
        grade: data.grade ?? null,
        wechatId: data.wechatId ?? null,
        phone: data.phone ?? null,
        bio: data.bio ?? null,
        status: data.status ?? 'ACTIVE',
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
      };
      opts.store.byId.set(id, row);
      if (row.openid) opts.store.byOpenid.set(row.openid, id);
      if (row.appleSub) opts.store.byAppleSub.set(row.appleSub, id);
      if (row.googleSub) opts.store.byGoogleSub.set(row.googleSub, id);
      if (row.phone) opts.store.byPhone.set(row.phone, id);
      return cloneUser(row) as User;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUserRow> }) => {
      const existing = opts.store.byId.get(where.id);
      if (!existing) throw new Error('User not found');
      // Remove old index entries
      if (data.openid !== undefined && existing.openid && existing.openid !== data.openid) {
        opts.store.byOpenid.delete(existing.openid);
      }
      if (data.appleSub !== undefined && existing.appleSub && existing.appleSub !== data.appleSub) {
        opts.store.byAppleSub.delete(existing.appleSub);
      }
      if (data.googleSub !== undefined && existing.googleSub && existing.googleSub !== data.googleSub) {
        opts.store.byGoogleSub.delete(existing.googleSub);
      }
      if (data.phone !== undefined && existing.phone && existing.phone !== data.phone) {
        opts.store.byPhone.delete(existing.phone);
      }
      const updated: FakeUserRow = {
        ...existing,
        ...data,
        updatedAt: new Date(),
      };
      opts.store.byId.set(updated.id, updated);
      if (updated.openid) opts.store.byOpenid.set(updated.openid, updated.id);
      if (updated.appleSub) opts.store.byAppleSub.set(updated.appleSub, updated.id);
      if (updated.googleSub) opts.store.byGoogleSub.set(updated.googleSub, updated.id);
      if (updated.phone) opts.store.byPhone.set(updated.phone, updated.id);
      return cloneUser(updated) as User;
    }),
    upsert: vi.fn(),
    findMany: vi.fn(async () => []),
  };

  const prisma = {
    user: userApi,
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }]),
    $transaction: vi.fn(async (fnOrOps: unknown) => {
      if (typeof fnOrOps === 'function') {
        return await (fnOrOps as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return fnOrOps;
    }),
    $disconnect: vi.fn(async () => {}),
  } as unknown as PrismaClient;

  return {
    prisma,
    pingPrisma: vi.fn(async () => undefined),
    closePrisma: vi.fn(async () => undefined),
  };
}

/**
 * Build a mock for `@/lib/redis.js` — implements only the `set` / `get` /
 * `del` / `exists` / `ping` / `quit` surface used by the auth code, plus
 * the ioredis `status` getter that @fastify/rate-limit touches.
 */
export function makeRedisMock(): {
  redis: Redis;
  pingRedis: () => Promise<void>;
  closeRedis: () => Promise<void>;
  store: { kv: Map<string, { value: string; expiresAt: number | null }> };
} {
  const kv = new Map<string, { value: string; expiresAt: number | null }>();

  const isExpired = (key: string): boolean => {
    const entry = kv.get(key);
    if (!entry) return true;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      kv.delete(key);
      return true;
    }
    return false;
  };

  const api = {
    set: vi.fn(async (
      key: string,
      value: string,
      ...rest: unknown[]
    ) => {
      let expiresAt: number | null = null;
      if (rest.length >= 2) {
        const flag = String(rest[0]).toUpperCase();
        if (flag === 'EX' || flag === 'PX') {
          const ttl = Number(rest[1]);
          expiresAt = flag === 'EX'
            ? Date.now() + ttl * 1000
            : Date.now() + ttl;
        }
      }
      kv.set(key, { value: String(value), expiresAt });
      return 'OK';
    }),
    get: vi.fn(async (key: string) => {
      if (isExpired(key)) return null;
      return kv.get(key)?.value ?? null;
    }),
    del: vi.fn(async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) {
        if (kv.delete(k)) n++;
      }
      return n;
    }),
    exists: vi.fn(async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) {
        if (!isExpired(k)) n++;
      }
      return n;
    }),
    ping: vi.fn(async () => 'PONG'),
    quit: vi.fn(async () => 'OK'),
    // Lua script support — used by @fastify/rate-limit's RedisStore.
    // Register a no-op script that returns { current, ttl, ban } so the
    // rate limiter is happy without actually tracking.
    defineCommand: vi.fn((name: string, _options?: unknown) => {
      // Register a callback-style function on `this` (the api object).
      // The rate limiter calls: redis.rateLimit(key, timeWindow, max, ban, continueExceeding, cb)
      (api as unknown as Record<string, (...args: unknown[]) => void>)[name] = (
        ...args: unknown[]
      ) => {
        const [key, timeWindow, max, ban, , cb] = args as [
          string, number, number, number, unknown,
          (err: Error | null, result: [number, number, boolean]) => void,
        ];
        // Count by IP in our in-memory kv
        const cur = Number(kv.get(key)?.value ?? '0') + 1;
        kv.set(key, { value: String(cur), expiresAt: Date.now() + Number(timeWindow) });
        const exceeded = cur - max > ban;
        cb(null, [cur, Number(timeWindow), exceeded]);
      };
    }),
    // Multi/exec/eval shims (rate limiter uses pipeline + custom commands)
    multi: vi.fn(() => ({
      zadd: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zrange: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      pttl: vi.fn().mockReturnThis(),
      incr: vi.fn().mockReturnThis(),
      decr: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 1]]),
    })),
    eval: vi.fn(async () => 1),
    zadd: vi.fn(async () => 1),
    zremrangebyscore: vi.fn(async () => 0),
    zcard: vi.fn(async () => 0),
    zrange: vi.fn(async () => []),
    expire: vi.fn(async () => 1),
    pttl: vi.fn(async () => 60_000),
    pexpire: vi.fn(async () => 1),
    pipeline: vi.fn(() => ({
      zadd: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zrange: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      pttl: vi.fn().mockReturnThis(),
      incr: vi.fn().mockReturnThis(),
      decr: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [[null, 1]]),
    })),
    status: 'ready',
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as Redis;

  return {
    redis: api,
    pingRedis: vi.fn(async () => undefined),
    closeRedis: vi.fn(async () => undefined),
    store: { kv },
  };
}

// =====================================================================
// Internals
// =====================================================================

function cloneUser(row: FakeUserRow): FakeUserRow {
  return { ...row };
}
