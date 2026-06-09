// Vitest setup file — runs before each test file is loaded.
//
// We need DATABASE_URL, REDIS_URL, JWT_SECRET set BEFORE server/src/lib/env.ts
// is imported (env.ts calls process.exit(1) if any of them is missing at
// import time). Setting them here is the cleanest way to keep the test
// files themselves free of repeated boilerplate.
//
// Values are inert — the actual unit tests under tests/content-safety/
// tests/health.mock the prisma + redis clients so they never touch a
// real database.
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] ??= 'postgresql://x:y@localhost:5432/x';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';
process.env['JWT_SECRET'] ??= 'test-secret-that-is-at-least-32-characters-long';
// Issue #34: monitoring defaults so individual monitoring tests don't
// have to stub. Open metrics (no token) + open webhook receiver (no
// HMAC). Individual tests that need the closed behavior override via
// vi.stubEnv *before* re-importing the env module (or, more simply,
// we read env vars at request time in the monitoring module so
// `vi.stubEnv` + a fresh import works).
process.env['METRICS_TOKEN'] = '';
process.env['ALERT_WEBHOOK_FEISHU'] = '';
process.env['ALERT_WEBHOOK_DINGTALK'] = '';
process.env['ALERT_WEBHOOK_GENERIC'] = '';
process.env['ALERT_RECEIVER_HMAC_SECRET'] = '';

import { beforeEach, vi } from 'vitest';

// -----------------------------------------------------------------------------
// Global mock isolation (Item 2 of feat/optimization-server).
// -----------------------------------------------------------------------------
// `vi.clearAllMocks()` clears mock *call history* but DOES NOT clear the
// `mockResolvedValueOnce` queue. The once-queue leaks across tests, which is
// how the analytics.routes test originally surfaced a 50-user phantom count
// in its retention assertion (see fix #28 / analytics.routes.test.ts:193).
//
// `vi.resetAllMocks()` resets BOTH the call history AND every mock
// implementation (including the once-queue). It is the documented Vitest
// helper for the leak bug.
//
// We run this as a *global* beforeEach so every test file gets the protection
// without having to remember to call it in its own `beforeEach`. File-local
// `beforeEach` blocks (which re-set per-resource `mockResolvedValue([])` /
// `mockResolvedValue(0)` defaults after each reset) still run, in the
// expected outside-in order.
//
// Per-resource defaults stay in the test file itself — they require access
// to the file-local `prismaStub` / `mockPrismaState`, which is not reachable
// from this global setup file.
// -----------------------------------------------------------------------------
beforeEach(() => {
  vi.resetAllMocks();
});