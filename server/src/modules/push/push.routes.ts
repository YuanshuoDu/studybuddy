/**
 * Push notification module — issue #27.
 *
 * Endpoints (all under /api/v1/devices, auth required):
 *   - POST   /api/v1/devices          — register / refresh a push token
 *   - GET    /api/v1/devices          — list the current user's tokens
 *   - DELETE /api/v1/devices/:id      — unregister a token
 *
 * The M3 W2 followup wires TPNS / FCM / APNs dispatch in
 * `push.service.ts`. For M3 launch the dispatcher is a noop so
 * client apps can integrate the registration round-trip without a
 * provider credential dependency.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors.js';
import { prisma as defaultPrisma } from '@/lib/prisma.js';

import { sendPush } from './push.service.js';
import type { PrismaClient, PushChannel } from '@prisma/client';

const registerBodySchema = z
  .object({
    channel: z.enum(['WECHAT_TEMPLATE', 'TPNS', 'FCM', 'APNS']),
    token: z.string().min(1).max(500),
    deviceInfo: z.string().max(2000).optional().nullable(),
  })
  .strict();

// cuid / cuid2 / ulid / short hex are all 1-64 chars of [A-Za-z0-9_-].
// We allow underscore + hyphen so the route accepts the ID shape that
// prisma generates for the PushToken table.
const idParamSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, 'id 格式不合法'),
});

export async function registerPushModule(
  app: FastifyInstance,
  prisma: PrismaClient = defaultPrisma as PrismaClient,
): Promise<void> {
  /**
   * POST /api/v1/devices
   *
   * Idempotent upsert keyed on (userId, channel, token). The
   * `lastSeenAt` is bumped on every call so the GC job (M3 W2) can
   * prune stale rows.
   */
  app.post(
    '/api/v1/devices',
    { preHandler: [app.authenticate] },
    async (req) => {
      const userId = req.userId;
      if (!userId) throw new UnauthorizedError();
      const parsed = registerBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError({ issues: parsed.error.flatten() });
      }
      const { channel, token, deviceInfo } = parsed.data;

      // upsert via the unique compound key
      const row = await prisma.pushToken.upsert({
        where: { userId_channel_token: { userId, channel: channel as PushChannel, token } },
        create: {
          userId,
          channel: channel as PushChannel,
          token,
          deviceInfo: deviceInfo ?? null,
        },
        update: { lastSeenAt: new Date(), deviceInfo: deviceInfo ?? null },
      });

      // Fire-and-forget: best-effort test ping so the dispatcher
      // can verify the channel wiring without blocking the response.
      // For M3 launch this is a noop.
      void sendPush(channel as PushChannel, token, {
        kind: 'test',
        title: 'Pairhub 已连接',
        body: '推送通道测试成功（可忽略）',
        data: { deviceId: row.id },
      });

      return { data: { id: row.id, channel: row.channel, createdAt: row.createdAt } };
    },
  );

  /**
   * GET /api/v1/devices — list the current user's tokens.
   */
  app.get(
    '/api/v1/devices',
    { preHandler: [app.authenticate] },
    async (req) => {
      const userId = req.userId;
      if (!userId) throw new UnauthorizedError();
      const rows = await prisma.pushToken.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
        select: { id: true, channel: true, deviceInfo: true, createdAt: true, lastSeenAt: true },
      });
      return { data: rows };
    },
  );

  /**
   * DELETE /api/v1/devices/:id — unregister.
   */
  app.delete(
    '/api/v1/devices/:id',
    { preHandler: [app.authenticate] },
    async (req) => {
      const userId = req.userId;
      if (!userId) throw new UnauthorizedError();
      const params = idParamSchema.safeParse(req.params);
      if (!params.success) {
        throw new ValidationError({ issues: params.error.flatten() });
      }
      const existing = await prisma.pushToken.findUnique({ where: { id: params.data.id } });
      if (!existing) {
        throw new NotFoundError('device_not_found', '设备未注册');
      }
      if (existing.userId !== userId) {
        // Don't leak the existence of someone else's device.
        throw new NotFoundError('device_not_found', '设备未注册');
      }
      await prisma.pushToken.delete({ where: { id: params.data.id } });
      return { data: { id: params.data.id, deleted: true } };
    },
  );
}
