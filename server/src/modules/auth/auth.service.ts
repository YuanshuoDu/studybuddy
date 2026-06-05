/**
 * Auth service — multi-platform user identity + JWT issuance.
 *
 * The single non-trivial piece of business logic in this module is the
 * **merge rule** (docs/architecture-v1.0.md §5.1 + ADR-0003): when a login
 * request comes in, we may already know the user under a *different*
 * identity (e.g. an existing User with a matching `phone`, or a WeChat
 * user that just signed in via Apple for the first time).  We must:
 *
 *   1. Find an existing User — phone first, then per-provider id
 *      (openid / appleSub / googleSub).
 *   2. If a User exists, **link** the new provider id onto it (idempotent
 *      if the same provider is already linked).
 *   3. If not, create a new User with the provider id as `primaryProvider`.
 *
 * Once we have a User, the route handler signs a fresh access + refresh
 * token pair via `lib/jwt.ts` and returns the user object.
 */
import type { PrismaClient, User } from '@prisma/client';
import type { Redis } from 'ioredis';

import { env } from '@/lib/env.js';
import { signAccessToken, signRefreshToken, ttlToSeconds } from '@/lib/jwt.js';

import type { UserPublic } from './auth.schema.js';

export type ProviderKind = 'WECHAT' | 'APPLE' | 'GOOGLE' | 'PHONE';

export interface IdentityHint {
  /** Stable per-provider opaque id.  Required. */
  providerId: string;
  /** E.164-ish phone number.  Optional but takes precedence in merging. */
  phone?: string | undefined;
  /** Provider id type for this login event. */
  provider: ProviderKind;
  /** Optional nickname / avatar hints from the client SDK. */
  nickname?: string | undefined;
  avatar?: string | undefined;
  /** Optional email (Apple / Google). */
  email?: string | undefined;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access-token seconds
}

/**
 * Public projection of the User row — what we return to the client.
 * Hides email / phone / openid / etc.
 */
export function toUserPublic(user: User): UserPublic {
  const providers: ProviderKind[] = [];
  if (user.openid) providers.push('WECHAT');
  if (user.appleSub) providers.push('APPLE');
  if (user.googleSub) providers.push('GOOGLE');
  if (user.phone) providers.push('PHONE');
  if (providers.length === 0) providers.push(user.primaryProvider);
  return {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    school: user.school,
    primaryProvider: user.primaryProvider,
    providers,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Multi-platform findOrCreate.
 *
 * Order of resolution (first hit wins):
 *   1. `phone` (if supplied) — most reliable cross-platform handle
 *   2. per-provider id (openid / appleSub / googleSub)
 *
 * On hit, we **link** the new provider id onto the row (no-op if already
 * linked).  On miss, we create a new User with the provider id set.
 *
 * The function is intentionally pure-data — it does NOT issue tokens. The
 * route layer owns the JWT minting step so this service stays testable
 * and free of ioredis side-effects.
 */
export async function findOrCreateUser(
  prisma: PrismaClient,
  hint: IdentityHint,
): Promise<User> {
  // ---- 1. Phone-first merge ----
  if (hint.phone) {
    const byPhone = await prisma.user.findUnique({ where: { phone: hint.phone } });
    if (byPhone) {
      return await linkProvider(prisma, byPhone, hint);
    }
  }

  // ---- 2. Per-provider id lookup ----
  const existing = await findByProviderId(prisma, hint);
  if (existing) {
    // We may ALSO want to fold a phone onto this user if the client just
    // supplied one and the row doesn't have it.
    if (hint.phone && !existing.phone) {
      return await prisma.user.update({
        where: { id: existing.id },
        data: { phone: hint.phone },
      });
    }
    return existing;
  }

  // ---- 3. Create new user ----
  return await prisma.user.create({
    data: buildCreateData(hint),
  });
}

/**
 * Link a provider id onto an existing user; idempotent.
 *
 * Also updates `primaryProvider` if the row doesn't have a primary yet,
 * and folds the supplied nickname / avatar / phone onto the row.
 */
async function linkProvider(
  prisma: PrismaClient,
  user: User,
  hint: IdentityHint,
): Promise<User> {
  const data: Record<string, unknown> = {};
  switch (hint.provider) {
    case 'WECHAT':
      if (!user.openid) data['openid'] = hint.providerId;
      break;
    case 'APPLE':
      if (!user.appleSub) data['appleSub'] = hint.providerId;
      break;
    case 'GOOGLE':
      if (!user.googleSub) data['googleSub'] = hint.providerId;
      break;
    case 'PHONE':
      // Phone is already the lookup key in this branch.
      break;
  }
  if (user.primaryProvider === 'WECHAT' && user.openid == null && hint.provider !== 'WECHAT') {
    // The placeholder primary was never backed by a real openid; switch it.
    data['primaryProvider'] = hint.provider;
  }
  if (hint.nickname && (!user.nickname || user.nickname.startsWith('用户'))) {
    data['nickname'] = hint.nickname;
  }
  if (hint.avatar && !user.avatar) {
    data['avatar'] = hint.avatar;
  }
  if (Object.keys(data).length === 0) return user;
  return await prisma.user.update({ where: { id: user.id }, data });
}

async function findByProviderId(
  prisma: PrismaClient,
  hint: IdentityHint,
): Promise<User | null> {
  switch (hint.provider) {
    case 'WECHAT': {
      const row = await prisma.user.findUnique({ where: { openid: hint.providerId } });
      return row;
    }
    case 'APPLE': {
      const row = await prisma.user.findUnique({ where: { appleSub: hint.providerId } });
      return row;
    }
    case 'GOOGLE': {
      const row = await prisma.user.findUnique({ where: { googleSub: hint.providerId } });
      return row;
    }
    case 'PHONE':
      // Phone-only logins are handled via the phone branch above.
      return null;
  }
}

function buildCreateData(hint: IdentityHint): {
  openid?: string;
  appleSub?: string;
  googleSub?: string;
  primaryProvider: ProviderKind;
  phone?: string;
  nickname: string;
  avatar: string | null;
} {
  const data: ReturnType<typeof buildCreateData> = {
    primaryProvider: hint.provider,
    nickname: hint.nickname ?? defaultNickname(hint),
    avatar: hint.avatar ?? null,
  };
  if (hint.phone) data.phone = hint.phone;
  switch (hint.provider) {
    case 'WECHAT': data.openid = hint.providerId; break;
    case 'APPLE': data.appleSub = hint.providerId; break;
    case 'GOOGLE': data.googleSub = hint.providerId; break;
    case 'PHONE': break;
  }
  return data;
}

function defaultNickname(hint: IdentityHint): string {
  const tail = hint.providerId.slice(-6);
  return `用户${tail}`;
}

/**
 * Issue a fresh access + refresh token pair for the given user.
 * Thin wrapper that bakes the `prisma` / `redis` clients into the call
 * site the route handler already has access to.
 */
export async function issueTokens(
  userId: string,
  redis: Redis,
): Promise<IssuedTokens> {
  const accessToken = await signAccessToken(userId);
  const { token: refreshToken } = await signRefreshToken(userId, redis);
  // `expiresIn` is the access token's lifetime in seconds (the time the
  // client has until it must refresh).  We do NOT expose the refresh
  // token's longer lifetime — the client should refresh proactively.
  const expiresIn = ttlToSeconds(env.JWT_ACCESS_TTL);
  return { accessToken, refreshToken, expiresIn };
}
