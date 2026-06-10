/**
 * Server entrypoint.
 *
 * Responsibilities:
 *   1. Build the Fastify app via buildApp() (separated for testability).
 *   2. Verify Postgres + Redis are reachable before opening the port.
 *   3. Listen on PORT/HOST from env.
 *   4. Handle SIGINT/SIGTERM with graceful shutdown: stop accepting new
 *      connections, drain in-flight requests, close Prisma + Redis.
 *   5. Crash on uncaught errors / unhandled rejections.
 */
import { buildApp } from '@/lib/app.js';
import { getEnv } from '@/lib/env.js';
import { closePrisma, pingPrisma } from '@/lib/prisma.js';
import { closeRedis, pingRedis } from '@/lib/redis.js';

async function verifyDependencies(): Promise<void> {
  try {
    await pingPrisma();
    // eslint-disable-next-line no-console
    console.info('✅ PostgreSQL connection ok');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('❌ PostgreSQL connection failed:', (e as Error).message);
    process.exit(1);
  }

  try {
    await pingRedis();
    // eslint-disable-next-line no-console
    console.info('✅ Redis connection ok');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('❌ Redis connection failed:', (e as Error).message);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  await verifyDependencies();

  const app = await buildApp();

  // Bind listeners that require `app.log`.
  const shutdown = async (signal: NodeJS.Signals | 'uncaughtException' | 'unhandledRejection') => {
    app.log.info({ signal }, 'received shutdown signal');
    try {
      await app.close();
      await closePrisma();
      await closeRedis();
      app.log.info('graceful shutdown complete');
      // Use exit code 0 for signals, 1 for crashes.
      process.exit(signal === 'uncaughtException' || signal === 'unhandledRejection' ? 1 : 0);
    } catch (e) {
      app.log.error({ err: e }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error('uncaughtException:', err);
    void shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error('unhandledRejection:', reason);
    void shutdown('unhandledRejection');
  });

  await app.listen({ port: getEnv().PORT, host: getEnv().HOST });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal startup error:', err);
  process.exit(1);
});
