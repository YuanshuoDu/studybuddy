/**
 * Prisma Client singleton.
 *
 * Reuse a single client across the hot path (Fastify plugin) and tests
 * to avoid exhausting the database connection pool. The instance is
 * stored on `globalThis` in development to survive HMR reloads.
 */
import { PrismaClient } from '@prisma/client';

import { getEnv } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function makeClient(): PrismaClient {
  return new PrismaClient({
    log:
      getEnv().NODE_ENV === 'production'
        ? ['error']
        : ['warn', 'error'],
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? makeClient();

if (getEnv().NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export async function closePrisma(): Promise<void> {
  await prisma.$disconnect();
}

export async function pingPrisma(): Promise<void> {
  // Cheap liveness check; throws on connection failure.
  await prisma.$queryRaw`SELECT 1`;
}
