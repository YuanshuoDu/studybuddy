/**
 * Tests for the monitoring module (issue #34).
 *
 * Covers:
 *   - /metrics returns 200 + Prometheus exposition format
 *   - /metrics is bearer-gated when METRICS_TOKEN is set
 *   - /api/v1/monitoring/liveness is always 200
 *   - /api/v1/monitoring/alerts validates body, dedupes by fingerprint,
 *     HMAC-verifies when configured, and fan-outs to configured webhooks
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.REDIS_URL ??= 'redis://localhost:6379/0';
process.env.JWT_SECRET ??= 'a'.repeat(48);

import { registerMonitoringModule } from '@/modules/monitoring/index.js';
import { resetMetricsForTests } from '@/lib/metrics.js';

let app: FastifyInstance;

beforeAll(async () => {
  // env.ts parses process.env at import time and freezes the result.
  // Set the monitoring env vars BEFORE the monitoring module reads
  // them so the values are baked into the frozen `env` object. We use
  // vi.stubEnv so vitest also restores them after the suite.
  vi.stubEnv('METRICS_TOKEN', 'metrics-secret-token');
  vi.stubEnv('ALERT_WEBHOOK_FEISHU', '');
  vi.stubEnv('ALERT_WEBHOOK_DINGTALK', '');
  vi.stubEnv('ALERT_WEBHOOK_GENERIC', '');
  vi.stubEnv('ALERT_RECEIVER_HMAC_SECRET', 'alert-shared-secret');
  const Fastify = (await import('fastify')).default;
  app = Fastify({ logger: false });
  await registerMonitoringModule(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  resetMetricsForTests();
});

describe('GET /metrics (issue #34)', () => {
  it('rejects requests without the bearer token (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the Prometheus exposition with a valid token (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer metrics-secret-token' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    // Default metrics are registered with the `studybuddy_` prefix
    expect(res.body).toContain('# HELP');
    expect(res.body).toContain('# TYPE');
  });

  it('opens the endpoint when METRICS_TOKEN is unset (dev mode)', async () => {
    vi.stubEnv('METRICS_TOKEN', '');
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/v1/monitoring/liveness (issue #34)', () => {
  it('always returns 200 with a status + timestamp', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/monitoring/liveness' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('ok');
    expect(typeof body.data.timestamp).toBe('string');
  });
});

describe('POST /api/v1/monitoring/alerts (issue #34)', () => {
  it('rejects an unauthenticated request when HMAC is configured (401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/alerts',
      payload: { title: 'test', severity: 'warning' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an invalid body (400)', async () => {
    const body = { severity: 'not-a-real-level' };
    const sig = signBody(body, 'alert-shared-secret');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/alerts',
      headers: { 'x-signature': sig },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts a valid alert with correct HMAC (200, fanout count = 0)', async () => {
    const body = {
      source: 'test',
      title: 'Test alert',
      severity: 'warning' as const,
      body: 'hello',
    };
    const sig = signBody(body, 'alert-shared-secret');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/alerts',
      headers: { 'x-signature': sig },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const j = res.json();
    expect(j.data.status).toBe('accepted');
    expect(j.data.delivered).toBe(0); // no webhooks configured
    expect(j.data.failed).toBe(0);
  });

  it('dedupes by fingerprint within 60s', async () => {
    const body = {
      title: 'dedupe test',
      severity: 'info' as const,
      fingerprint: 'fp-abc-123',
    };
    const sig = signBody(body, 'alert-shared-secret');
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/alerts',
      headers: { 'x-signature': sig },
      payload: body,
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/alerts',
      headers: { 'x-signature': sig },
      payload: body,
    });
    expect(r1.json().data.status).toBe('accepted');
    expect(r2.json().data.status).toBe('deduped');
  });

  it('opens when ALERT_RECEIVER_HMAC_SECRET is unset (dev mode)', async () => {
    vi.stubEnv('ALERT_RECEIVER_HMAC_SECRET', '');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/monitoring/alerts',
      payload: { title: 'dev alert', severity: 'info' },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signBody(body: unknown, secret: string): string {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return `sha256=${sig}`;
}
