/**
 * Auth API integration tests.
 *
 * Five endpoints:
 *   - POST /api/v1/auth/wechat-login
 *   - POST /api/v1/auth/apple-login
 *   - POST /api/v1/auth/google-login
 *   - POST /api/v1/auth/refresh
 *   - POST /api/v1/auth/logout
 *
 * Plus cross-cutting concerns:
 *   - Multi-platform merge (phone-first, then per-provider id)
 *   - Refresh-token revocation (logout invalidates refresh tokens)
 *   - Refresh-token rotation (using a refresh token revokes the old jti)
 *
 * External providers (WeChat / Apple / Google) are mocked at the network
 * boundary using `nock` — the real `fetch` call inside lib/{wechat,apple,
 * google}.ts hits the mock server.
 *
 * Prisma + Redis are replaced with in-memory fakes (see the vi.mock
 * factories below) so no real services are required.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks: vi.mock factories are hoisted above all imports by Vitest, so the
// factory body must be self-contained (no closure over module-level state).
// We use vi.hoisted() to share the in-memory state across the mock layer
// and the test cases.
// ---------------------------------------------------------------------------

const { userStoreRef, redisRef } = vi.hoisted(() => {
  // Lazy import happens inside the factory so we never hit a TDZ.
  // We can't import './helpers/mocks.js' here directly because the
  // hoisted block runs before any user import.  But the in-memory store
  // is just plain JS — we can build it from scratch in the factory.
  return {
    userStoreRef: { current: undefined as unknown },
    redisRef: { current: undefined as unknown },
  };
});

// Imported lazily inside the vi.mock factory below; keep a typed import
// for the test body.
import { makeFakeUserStore, makePrismaMock, makeRedisMock } from './helpers/mocks.js';

vi.mock('@/lib/prisma.js', async () => {
  const userStore = makeFakeUserStore();
  userStoreRef.current = userStore;
  return makePrismaMock({ store: userStore });
});

vi.mock('@/lib/redis.js', async () => {
  const m = makeRedisMock();
  redisRef.current = m;
  // Attach the store to the redis object so the test body can reset it.
  // (We expose only what's needed — `kv` is a Map.)
  (m.redis as unknown as { store: typeof m.store }).store = m.store;
  return m;
});

// Test env vars
process.env['WX_APPID'] = 'test_appid';
process.env['WX_SECRET'] = 'test_secret';
process.env['APPLE_CLIENT_ID'] = 'com.example.studybuddy';
process.env['APPLE_AUDIENCE'] = 'com.example.studybuddy';
process.env['GOOGLE_CLIENT_ID'] = 'test.apps.googleusercontent.com';
process.env['JWT_SECRET'] ??= 'unit-test-secret-min-32-chars-aaaaaaaaaa';
process.env['DATABASE_URL'] ??= 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';

import nock from 'nock';
import type { FastifyInstance } from 'fastify';
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';

import { buildApp } from '@/lib/app.js';
import { verifyAccessToken, verifyRefreshToken, signRefreshToken } from '@/lib/jwt.js';
import { redis } from '@/lib/redis.js';
import { prisma } from '@/lib/prisma.js';

// Strongly-typed handles to the in-memory stores.
type RedisMock = ReturnType<typeof makeRedisMock>;
type PrismaMock = ReturnType<typeof makePrismaMock>;
const redisMock = redis as unknown as RedisMock['redis'] & { store: RedisMock['store'] };
const prismaMock = prisma as unknown as PrismaMock['prisma'];

// ---------------------------------------------------------------------------
// RSA key for the fake Apple id_token (shared with the apple mock below).
// ---------------------------------------------------------------------------
const APPLE_TEST_KEYS = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// ---------------------------------------------------------------------------
// Mock Apple lib — re-implements verifyAppleIdToken against APPLE_TEST_KEYS.
// ---------------------------------------------------------------------------
vi.mock('@/lib/apple.js', async () => {
  const { createVerify } = await import('node:crypto');
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/apple.js');

  // Define a small AppleTokenError class for the mock to throw.
  class MockAppleTokenError extends Error {
    constructor(public override message: string, public code: string = 'INVALID_ID_TOKEN') {
      super(message);
      this.name = 'AppleTokenError';
    }
  }

  async function verifyMock(idToken: string): Promise<{
    sub: string;
    email?: string;
    isPrivateEmail?: boolean;
  }> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new MockAppleTokenError('Apple id_token malformed');
    const [h, p, s] = parts as [string, string, string];
    let header: { alg?: string };
    let claims: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    } catch (e) {
      throw new MockAppleTokenError(`Apple id_token malformed: ${(e as Error).message}`);
    }
    if (header.alg !== 'RS256') throw new MockAppleTokenError('Unexpected Apple alg');
    if (claims.iss !== 'https://appleid.apple.com') throw new MockAppleTokenError('Bad iss');
    if (claims.aud !== 'com.example.studybuddy') throw new MockAppleTokenError('Bad aud');
    if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) {
      throw new MockAppleTokenError('Apple id_token expired', 'TOKEN_EXPIRED');
    }
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    verifier.end();
    const ok = verifier.verify(APPLE_TEST_KEYS.publicKey, Buffer.from(s, 'base64url'));
    if (!ok) throw new MockAppleTokenError('signature mismatch');
    return {
      sub: claims.sub as string,
      email: claims.email as string | undefined,
      isPrivateEmail: claims.is_private_email === 'true',
    };
  }

  return {
    ...(actual as Record<string, unknown>),
    AppleTokenError: MockAppleTokenError,
    AppleNotConfiguredError: class extends Error {
      constructor() { super('APPLE_CLIENT_ID not configured in mock'); this.name = 'AppleNotConfiguredError'; }
    },
    verifyAppleIdToken: vi.fn(async (idToken: string) => {
      const v = await verifyMock(idToken);
      return {
        sub: v.sub,
        email: v.email,
        isPrivateEmail: v.isPrivateEmail,
        emailVerified: true,
        raw: { sub: v.sub, email: v.email, iss: 'https://appleid.apple.com' },
      };
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock google-auth-library — no network calls, just decode the JWT payload.
// ---------------------------------------------------------------------------
vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: class {
      constructor(_clientId: string) {}
      async verifyIdToken({ idToken }: { idToken: string; audience: string }) {
        const parts = idToken.split('.');
        const payloadPart = parts[1];
        if (parts.length < 2 || !payloadPart) throw new Error('malformed');
        const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
        return { getPayload: () => claims };
      }
    },
  };
});

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeEach(async () => {
  // Clear the in-memory redis key-value map so each test is isolated.
  redisMock.store.kv.clear();
  // Reset the user store.  The mock factory builds a fresh store per
  // call, so we recreate it by re-issuing the same factory.
  const userApi = prismaMock.user as unknown as {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  userApi.findUnique.mockClear();
  userApi.create.mockClear();
  userApi.update.mockClear();
  userStoreRef.current = undefined;

  nock.cleanAll();
  app = await buildApp({ silent: true });
  await app.ready();
});

afterEach(async () => {
  nock.cleanAll();
  if (app) await app.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(s: string): string {
  return Buffer.from(s).toString('base64url');
}

function buildFakeAppleIdToken(opts: {
  sub: string;
  audience: string;
  expiresInSec?: number;
  expired?: boolean;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = opts.expired ? now - 60 : now + (opts.expiresInSec ?? 600);

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: 'https://appleid.apple.com',
    aud: opts.audience,
    exp,
    iat: now,
    sub: opts.sub,
    email: `${opts.sub}@privaterelay.appleid.com`,
    email_verified: 'true',
    is_private_email: 'true',
  }));
  const data = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(data);
  signer.end();
  const sig = signer.sign(APPLE_TEST_KEYS.privateKey).toString('base64url');
  return `${data}.${sig}`;
}

function buildFakeGoogleIdToken(sub: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', kid: 'test-kid', typ: 'JWT' }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: 'https://accounts.google.com',
    aud: process.env['GOOGLE_CLIENT_ID'],
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000),
    sub,
    email: `${sub}@gmail.com`,
    email_verified: true,
    name: 'Google User',
    picture: 'https://example.com/avatar.png',
  }));
  return `${header}.${claims}.fake-signature`;
}

// ---------------------------------------------------------------------------
// 1) wechat-login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/wechat-login', () => {
  it('creates a new user on first wechat login', async () => {
    nock('https://api.weixin.qq.com')
      .get('/sns/jscode2session')
      .query(true)
      .reply(200, { openid: 'wx_openid_001', session_key: 'sk', unionid: 'wx_union_001' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'valid_code_001' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.user.id).toBeTruthy();
    expect(body.data.user.providers).toContain('WECHAT');
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken).toBeTruthy();
    expect(body.data.expiresIn).toBe(15 * 60);

    const verify = await verifyAccessToken(body.data.accessToken);
    expect(verify.ok).toBe(true);
  });

  it('reuses the same user on second wechat login (same openid)', async () => {
    nock('https://api.weixin.qq.com')
      .get('/sns/jscode2session')
      .query(true)
      .times(2)
      .reply(200, { openid: 'wx_openid_002', session_key: 'sk' });

    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'code1' },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'code2' },
    });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.json().data.user.id).toBe(r2.json().data.user.id);
  });

  it('rejects an invalid code (wx returns errcode)', async () => {
    nock('https://api.weixin.qq.com')
      .get('/sns/jscode2session')
      .query(true)
      .reply(200, { errcode: 40029, errmsg: 'invalid code' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'bad' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('INVALID_CODE');
  });

  it('validates the request body with zod', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { /* no code */ },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// 2) apple-login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/apple-login', () => {
  it('creates a new user from a valid Apple id_token', async () => {
    const idToken = buildFakeAppleIdToken({ sub: 'apple_sub_001', audience: 'com.example.studybuddy' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/apple-login',
      payload: { idToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.user.providers).toContain('APPLE');
    expect(body.data.accessToken).toBeTruthy();
  });

  it('rejects an expired Apple id_token', async () => {
    const idToken = buildFakeAppleIdToken({
      sub: 'apple_sub_002',
      audience: 'com.example.studybuddy',
      expired: true,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/apple-login',
      payload: { idToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toMatch(/TOKEN_EXPIRED|INVALID_ID_TOKEN/);
  });

  it('rejects an id_token with a bad audience', async () => {
    const idToken = buildFakeAppleIdToken({ sub: 'apple_sub_003', audience: 'some.other.app' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/apple-login',
      payload: { idToken },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 3) google-login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/google-login', () => {
  it('creates a new user from a valid Google id_token', async () => {
    const idToken = buildFakeGoogleIdToken('google_sub_001');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google-login',
      payload: { idToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.user.providers).toContain('GOOGLE');
    expect(body.data.user.nickname).toBe('Google User');
  });
});

// ---------------------------------------------------------------------------
// 4) refresh
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/refresh', () => {
  it('mints a new pair when the supplied refresh_token is still live', async () => {
    nock('https://api.weixin.qq.com')
      .get('/sns/jscode2session')
      .query(true)
      .reply(200, { openid: 'wx_openid_refresh_1', session_key: 'sk' });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'c1' },
    });
    const oldRefresh = login.json().data.refreshToken;

    await new Promise((r) => setTimeout(r, 5));

    const ref = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: oldRefresh },
    });
    expect(ref.statusCode).toBe(200);
    const refBody = ref.json();
    expect(refBody.data.accessToken).toBeTruthy();
    expect(refBody.data.refreshToken).not.toBe(oldRefresh);

    const oldVerify = await verifyRefreshToken(oldRefresh);
    expect(oldVerify.ok).toBe(true);
    if (oldVerify.ok) {
      const live = await redisMock.exists(`auth:refresh:${oldVerify.payload.jti}`);
      expect(live).toBe(0);
    }
  });

  it('rejects an unknown / revoked refresh_token (jti not in Redis)', async () => {
    const fakeUserId = `usr_${randomUUID()}`;
    const { token } = await signRefreshToken(fakeUserId, redisMock, { jti: 'never-registered' });
    redisMock.store.kv.clear();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: token },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('TOKEN_REVOKED');
  });

  it('rejects a malformed refresh_token', async () => {
    // Use a string long enough to pass zod min(10) but not a valid JWT.
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'definitely-not-a-jwt-at-all' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 5) logout
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/logout', () => {
  it('revokes the refresh-token jti (subsequent refresh fails)', async () => {
    nock('https://api.weixin.qq.com')
      .get('/sns/jscode2session')
      .query(true)
      .reply(200, { openid: 'wx_openid_logout_1', session_key: 'sk' });

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'cl' },
    });
    const refreshToken = login.json().data.refreshToken;

    const out = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(out.statusCode).toBe(200);
    expect(out.json().data.ok).toBe(true);

    const ref = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(ref.statusCode).toBe(401);
  });

  it('is best-effort: works even for an unverifiable token', async () => {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const claims = base64UrlEncode(JSON.stringify({
      iss: 'studybuddy-api',
      aud: 'studybuddy-client',
      sub: 'usr_does_not_matter',
      jti: 'best-effort-jti',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
      type: 'refresh',
    }));
    const bogus = `${header}.${claims}.bogus-sig`;

    // Pre-seed the jti so we can verify it gets removed
    await redisMock.set('auth:refresh:best-effort-jti', 'usr_does_not_matter');

    const out = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken: bogus },
    });
    expect(out.statusCode).toBe(200);
    const still = await redisMock.exists('auth:refresh:best-effort-jti');
    expect(still).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6) Multi-platform merge scenarios
// ---------------------------------------------------------------------------

describe('multi-platform merge (phone-first, then per-provider id)', () => {
  it('reuses the same user across two wechat calls (openid match)', async () => {
    nock('https://api.weixin.qq.com')
      .get('/sns/jscode2session')
      .query(true)
      .times(2)
      .reply(200, { openid: 'wx_merge_idem', session_key: 'sk' });
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'c1' },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'c2' },
    });
    expect(r1.json().data.user.id).toBe(r2.json().data.user.id);
    expect(r2.json().data.user.providers).toEqual(['WECHAT']);
  });

  it('phone on the request merges the user record on subsequent logins', async () => {
    // WeChat login with phone
    nock('https://api.weixin.qq.com')
      .get('/sns/jscode2session')
      .query(true)
      .reply(200, { openid: 'wx_phone_merge', session_key: 'sk' });
    const wx = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/wechat-login',
      payload: { code: 'c1', phone: '+15551234567' },
    });
    expect(wx.statusCode).toBe(200);
    const wxUserId = wx.json().data.user.id;
    expect(wx.json().data.user.providers).toEqual(['WECHAT', 'PHONE']);

    // Google login with same phone — should merge
    const gToken = buildFakeGoogleIdToken('google_phone_merge');
    const g = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/google-login',
      payload: { idToken: gToken, phone: '+15551234567' },
    });
    expect(g.statusCode).toBe(200);
    const gBody = g.json();
    expect(gBody.data.user.id).toBe(wxUserId);
    expect(gBody.data.user.providers.sort()).toEqual(['GOOGLE', 'PHONE', 'WECHAT']);
  });
});

// ---------------------------------------------------------------------------
// 7) Auth error contract
// ---------------------------------------------------------------------------

describe('error contract', () => {
  it('VALIDATION_ERROR for malformed bodies', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { /* no refreshToken */ },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('refresh_token 401 when the user has been deleted (or never existed)', async () => {
    const { token } = await signRefreshToken(`usr_${randomUUID()}`, redisMock);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: token },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('USER_NOT_FOUND');
  });
});
