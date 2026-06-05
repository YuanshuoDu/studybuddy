/**
 * JWT signing & verification helpers.
 *
 * Two token types are issued:
 *   - **access**: short-lived (default 15m), used as `Authorization: Bearer`.
 *   - **refresh**: long-lived (default 30d), exchanged at /api/v1/auth/refresh.
 *     A `jti` (JWT ID) is stored in Redis under `auth:refresh:<jti>` so we can
 *     revoke individual tokens (logout / rotation).
 *
 * We use `jose` directly (not @fastify/jwt) so that:
 *   1. We can issue refresh tokens that are NOT signed by the @fastify/jwt
 *      instance (which has a 7d default and a single secret).
 *   2. The refresh-token flow can mint a fresh access token without re-running
 *      the full Fastify request lifecycle.
 *   3. The verify path is symmetric to the sign path — no surprises when
 *      swapping algorithms or adding rotation.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';

import { env } from './env.js';

export type TokenType = 'access' | 'refresh';

export interface AccessTokenClaims extends JWTPayload {
  sub: string;          // userId
  type: 'access';
  iat: number;
  exp: number;
}

export interface RefreshTokenClaims extends JWTPayload {
  sub: string;          // userId
  type: 'refresh';
  jti: string;          // unique id, also the Redis key suffix
  iat: number;
  exp: number;
}

const ISSUER = 'studybuddy-api';
const AUDIENCE = 'studybuddy-client';

/** Build a Uint8Array secret from the env-stored string. */
function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

/** Format `15m` / `30d` / `7h` style TTL into seconds. */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl} (expected e.g. 15m, 30d, 1h)`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3_600;
    case 'd': return value * 86_400;
    default: throw new Error(`Unknown TTL unit: ${unit}`);
  }
}

// =====================================================================
// Sign
// =====================================================================

/**
 * Sign a short-lived access token.
 *
 * @param userId  The internal User.id (cuid) to embed as `sub`.
 * @param opts.ttl  Optional override; defaults to `env.JWT_ACCESS_TTL` (15m).
 */
export async function signAccessToken(
  userId: string,
  opts: { ttl?: string } = {},
): Promise<string> {
  const ttl = opts.ttl ?? env.JWT_ACCESS_TTL;
  return new SignJWT({ type: 'access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(secretKey());
}

/**
 * Sign a long-lived refresh token with a fresh jti, and register it in
 * Redis so subsequent /refresh or /logout can locate / revoke it.
 *
 * @param userId  The internal User.id (cuid).
 * @param redis   ioredis client for jti bookkeeping.
 * @param opts.ttl  Optional override; defaults to `env.JWT_REFRESH_TTL` (30d).
 *
 * Returns the signed JWT plus its `jti` so callers can stash them.
 */
export async function signRefreshToken(
  userId: string,
  redis: Redis,
  opts: { ttl?: string; jti?: string } = {},
): Promise<{ token: string; jti: string; expiresIn: number }> {
  const ttl = opts.ttl ?? env.JWT_REFRESH_TTL;
  const ttlSeconds = ttlToSeconds(ttl);
  const jti = opts.jti ?? randomUUID();

  const token = await new SignJWT({ type: 'refresh', jti })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(secretKey());

  // Register jti in Redis.  The TTL on the Redis key MUST match the JWT
  // exp so we never accept a "valid" JWT whose jti has already been
  // garbage-collected.
  await redis.set(redisKeys.refreshJti(jti), userId, 'EX', ttlSeconds);

  return { token, jti, expiresIn: ttlSeconds };
}

// =====================================================================
// Verify
// =====================================================================

export interface VerifyOk<T> {
  ok: true;
  payload: T;
}

export interface VerifyErr {
  ok: false;
  reason: 'EXPIRED' | 'INVALID_SIGNATURE' | 'INVALID_TYPE' | 'MALFORMED' | 'UNKNOWN';
  message: string;
}

/** Discriminated result — never throws. */
export type VerifyResult<T> = VerifyOk<T> | VerifyErr;

const verify = async <T extends JWTPayload>(token: string, expectedType: TokenType): Promise<VerifyResult<T>> => {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (payload.type !== expectedType) {
      return {
        ok: false,
        reason: 'INVALID_TYPE',
        message: `Expected type=${expectedType}, got type=${String(payload.type)}`,
      };
    }
    return { ok: true, payload: payload as T };
  } catch (e) {
    const err = e as Error & { name?: string; code?: string };
    if (err.name === 'JWTExpired' || err.code === 'ERR_JWT_EXPIRED') {
      return { ok: false, reason: 'EXPIRED', message: 'Token expired' };
    }
    if (err.name === 'JWSSignatureVerificationFailed' || err.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      return { ok: false, reason: 'INVALID_SIGNATURE', message: 'Invalid signature' };
    }
    if (err.name === 'JWSInvalid' || err.name === 'JWTInvalid' || err.name === 'JWTMalformed') {
      return { ok: false, reason: 'MALFORMED', message: err.message };
    }
    return { ok: false, reason: 'UNKNOWN', message: err.message };
  }
};

/** Verify an access token. Never throws; returns a discriminated result. */
export function verifyAccessToken(token: string): Promise<VerifyResult<AccessTokenClaims>> {
  return verify<AccessTokenClaims>(token, 'access');
}

/** Verify a refresh token's signature + type. Does NOT touch Redis. */
export function verifyRefreshToken(token: string): Promise<VerifyResult<RefreshTokenClaims>> {
  return verify<RefreshTokenClaims>(token, 'refresh');
}

// =====================================================================
// jti / Redis helpers
// =====================================================================

/** Redis key namespace for refresh-token jti bookkeeping. */
export const redisKeys = {
  refreshJti: (jti: string): string => `auth:refresh:${jti}`,
} as const;

/**
 * Check whether a refresh-token jti is still registered (and therefore
 * considered "live"). Returns `false` if the key is absent.
 */
export async function isJtiLive(redis: Redis, jti: string): Promise<boolean> {
  const exists = await redis.exists(redisKeys.refreshJti(jti));
  return exists === 1;
}

/** Revoke a refresh-token jti (logout / rotation). Idempotent. */
export async function revokeJti(redis: Redis, jti: string): Promise<void> {
  await redis.del(redisKeys.refreshJti(jti));
}
