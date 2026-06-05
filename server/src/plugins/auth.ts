/**
 * Auth plugin.
 *
 * What this plugin does:
 *   1. Registers @fastify/jwt with the secret from env.
 *   2. Decorates the Fastify instance with `authenticate` — a
 *      preHandler hook that verifies the Bearer token and exposes
 *      `req.userId` for downstream handlers.
 *
 * What this plugin deliberately does NOT do:
 *   - Look up the user in the database (no extra round-trip per request
 *     unless the route needs the full user).
 *   - Issue tokens (login routes do that).
 *   - Enforce role-based access control (RBAC) — that's a route-level
 *     concern and is added in M1-W2 once the User/role model lands.
 *
 * The auth scaffold is intentionally framework-only; concrete
 * WeChat / Apple / Google providers land in the auth module in M1-W2.
 */
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '@/lib/env.js';
import { UnauthorizedError } from '@/lib/errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '7d',
      // HS256 is the default; keep it explicit so audit logs are clear.
      algorithm: 'HS256',
    },
    verify: {
      algorithms: ['HS256'],
    },
  });

  app.decorate('authenticate', async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new UnauthorizedError('Token 无效或已过期');
    }
    const payload = req.user as { sub?: string } | undefined;
    if (!payload?.sub) {
      throw new UnauthorizedError('Token 缺少 sub 字段');
    }
    req.userId = payload.sub;
  });
}

export default fp(authPlugin, { name: 'auth-plugin', dependencies: [] });
