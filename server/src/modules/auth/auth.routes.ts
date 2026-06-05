/**
 * Auth routes — five endpoints for multi-platform login + JWT lifecycle.
 *
 *   POST /api/v1/auth/wechat-login
 *   POST /api/v1/auth/apple-login
 *   POST /api/v1/auth/google-login
 *   POST /api/v1/auth/refresh
 *   POST /api/v1/auth/logout
 *
 * Spec: docs/api/v1.md §1.1 + §8.1
 * Architecture: docs/architecture-v1.0.md §5.1
 *
 * Conventions:
 *   - All request bodies are validated with zod (see auth.schema.ts).
 *   - All errors thrown are domain errors from `lib/errors.ts`; the
 *     global error-handler plugin turns them into RFC 7807 responses.
 *   - Successful responses are wrapped in the standard envelope
 *     `{ data, meta: { requestId, timestamp } }`.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

import { env } from '@/lib/env.js';
import { isJtiLive, revokeJti, verifyRefreshToken } from '@/lib/jwt.js';
import { AppError, UnauthorizedError } from '@/lib/errors.js';
import { code2Session, WxApiError, WxNotConfiguredError } from '@/lib/wechat.js';
import { verifyAppleIdToken, AppleNotConfiguredError, AppleTokenError } from '@/lib/apple.js';
import { verifyGoogleIdToken, GoogleNotConfiguredError, GoogleTokenError } from '@/lib/google.js';

import {
  appleLoginBodySchema,
  googleLoginBodySchema,
  logoutBodySchema,
  refreshBodySchema,
  wechatLoginBodySchema,
  type LoginResponse,
} from './auth.schema.js';
import {
  findOrCreateUser,
  issueTokens,
  toUserPublic,
  type ProviderKind,
} from './auth.service.js';

// =====================================================================
// Helpers
// =====================================================================

function meta(req: FastifyRequest): { requestId: string; timestamp: string } {
  return {
    requestId: req.id,
    timestamp: new Date().toISOString(),
  };
}

function redis(app: FastifyInstance): Redis {
  return app.redis;
}

/** Lookup or merge a User for a verified identity, then mint tokens. */
async function loginFlow(
  app: FastifyInstance,
  hint: {
    provider: ProviderKind;
    providerId: string;
    phone?: string | undefined;
    nickname?: string | undefined;
    avatar?: string | undefined;
    email?: string | undefined;
  },
): Promise<LoginResponse> {
  const user = await findOrCreateUser(app.prisma, hint);
  const tokens = await issueTokens(user.id, redis(app));
  return {
    ...tokens,
    user: toUserPublic(user),
  };
}

// =====================================================================
// Route registration
// =====================================================================

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------
  // POST /api/v1/auth/wechat-login
  // -----------------------------------------------------------------
  app.post('/api/v1/auth/wechat-login', async (req, reply) => {
    const parsed = wechatLoginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', '请求参数校验失败', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const { code, phone } = parsed.data;

    let session: Awaited<ReturnType<typeof code2Session>>;
    try {
      session = await code2Session(code);
    } catch (e) {
      if (e instanceof WxNotConfiguredError) {
        throw new AppError(500, 'WX_CONFIG_MISSING', '服务端未配置微信 AppID/Secret');
      }
      if (e instanceof WxApiError) {
        throw new AppError(401, 'INVALID_CODE', `微信登录失败: ${e.errmsg}`, {
          wxErrcode: e.errcode,
        });
      }
      throw new AppError(502, 'WX_UNAVAILABLE', '调用微信登录接口失败', {
        reason: (e as Error).message,
      });
    }

    const result = await loginFlow(app, {
      provider: 'WECHAT',
      providerId: session.openid,
      phone,
      nickname: req.body && typeof (req.body as { nickname?: unknown }).nickname === 'string'
        ? ((req.body as { nickname?: string }).nickname as string)
        : undefined,
      avatar: req.body && typeof (req.body as { avatar?: unknown }).avatar === 'string'
        ? ((req.body as { avatar?: string }).avatar as string)
        : undefined,
    });

    return reply.code(200).send({ data: result, meta: meta(req) });
  });

  // -----------------------------------------------------------------
  // POST /api/v1/auth/apple-login
  // -----------------------------------------------------------------
  app.post('/api/v1/auth/apple-login', async (req, reply) => {
    const parsed = appleLoginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', '请求参数校验失败', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const { idToken, fullName, email, phone } = parsed.data;

    let verified: Awaited<ReturnType<typeof verifyAppleIdToken>>;
    try {
      verified = await verifyAppleIdToken(idToken);
    } catch (e) {
      if (e instanceof AppleNotConfiguredError) {
        throw new AppError(500, 'APPLE_CONFIG_MISSING', '服务端未配置 Apple client id');
      }
      if (e instanceof AppleTokenError) {
        throw new AppError(401, e.code, e.message);
      }
      throw new AppError(502, 'APPLE_UNAVAILABLE', '调用 Apple 验证失败', {
        reason: (e as Error).message,
      });
    }

    const composedNickname = fullName
      ? [fullName.firstName, fullName.lastName].filter(Boolean).join(' ').trim() || undefined
      : undefined;

    const result = await loginFlow(app, {
      provider: 'APPLE',
      providerId: verified.sub,
      phone,
      nickname: composedNickname,
      email: email ?? verified.email,
    });

    return reply.code(200).send({ data: result, meta: meta(req) });
  });

  // -----------------------------------------------------------------
  // POST /api/v1/auth/google-login
  // -----------------------------------------------------------------
  app.post('/api/v1/auth/google-login', async (req, reply) => {
    const parsed = googleLoginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', '请求参数校验失败', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const { idToken, phone, nickname, avatar } = parsed.data;

    let verified: Awaited<ReturnType<typeof verifyGoogleIdToken>>;
    try {
      verified = await verifyGoogleIdToken(idToken);
    } catch (e) {
      if (e instanceof GoogleNotConfiguredError) {
        throw new AppError(500, 'GOOGLE_CONFIG_MISSING', '服务端未配置 Google client id');
      }
      if (e instanceof GoogleTokenError) {
        throw new AppError(401, e.code, e.message);
      }
      throw new AppError(502, 'GOOGLE_UNAVAILABLE', '调用 Google 验证失败', {
        reason: (e as Error).message,
      });
    }

    const result = await loginFlow(app, {
      provider: 'GOOGLE',
      providerId: verified.sub,
      phone,
      nickname: nickname ?? verified.name,
      avatar: avatar ?? verified.picture,
      email: verified.email,
    });

    return reply.code(200).send({ data: result, meta: meta(req) });
  });

  // -----------------------------------------------------------------
  // POST /api/v1/auth/refresh
  // -----------------------------------------------------------------
  app.post('/api/v1/auth/refresh', async (req, reply) => {
    const parsed = refreshBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', '请求参数校验失败', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const { refreshToken } = parsed.data;

    const verified = await verifyRefreshToken(refreshToken);
    if (!verified.ok) {
      const code = verified.reason === 'EXPIRED' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      throw new UnauthorizedError(verified.message, code);
    }
    const { sub: userId, jti } = verified.payload;
    if (!jti) {
      throw new UnauthorizedError('refresh token missing jti', 'INVALID_TOKEN');
    }

    // jti MUST be live in Redis — otherwise it has been revoked.
    const live = await isJtiLive(redis(app), jti);
    if (!live) {
      throw new UnauthorizedError('refresh token has been revoked', 'TOKEN_REVOKED');
    }

    // Confirm the user still exists and is active.
    const user = await app.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(401, 'USER_NOT_FOUND', 'user no longer exists');
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(403, 'USER_BANNED', 'user is banned');
    }

    // Rotate: revoke the old jti BEFORE minting a new pair to prevent a
    // race where a duplicate request both succeed.
    await revokeJti(redis(app), jti);

    const tokens = await issueTokens(user.id, redis(app));
    return reply.code(200).send({
      data: { ...tokens, user: toUserPublic(user) },
      meta: meta(req),
    });
  });

  // -----------------------------------------------------------------
  // POST /api/v1/auth/logout
  // -----------------------------------------------------------------
  app.post('/api/v1/auth/logout', async (req, reply) => {
    const parsed = logoutBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', '请求参数校验失败', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const { refreshToken } = parsed.data;

    // We deliberately do NOT require the refresh-token signature to be
    // valid — a logout must work even if the secret was rotated, etc.
    // We try to extract the jti from a *best-effort* decode and then
    // delete it from Redis.
    const bestEffort = await verifyRefreshToken(refreshToken);
    if (bestEffort.ok && bestEffort.payload.jti) {
      await revokeJti(redis(app), bestEffort.payload.jti);
    } else {
      // Fallback: try to parse the payload anyway (no verify) and grab
      // any `jti` claim we can find, then revoke it.
      const parts = refreshToken.split('.');
      const payloadPart = parts[1];
      if (parts.length === 3 && payloadPart) {
        try {
          const json = Buffer.from(payloadPart, 'base64url').toString('utf8');
          const claims = JSON.parse(json) as { jti?: string };
          if (claims.jti) await revokeJti(redis(app), claims.jti);
        } catch {
          // Swallow — logout is best-effort.
        }
      }
    }

    return reply.code(200).send({
      data: { ok: true },
      meta: meta(req),
    });
  });
}

// Eagerly reference env so it doesn't get tree-shaken in dev (handy for
// diagnostics if a test imports a default value and wants to see the
// current settings).
export const _authEnv = env;
