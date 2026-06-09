/**
 * Monitoring module — issue #34.
 *
 * Three endpoints, all under the un-prefixed /metrics + /api/v1/monitoring
 * paths. None require auth (they're meant for Prometheus + alert
 * receivers to scrape from a private network).
 *
 *   GET  /metrics                     — Prometheus exposition format
 *   GET  /api/v1/monitoring/liveness  — cheap liveness ping for Uptime
 *   POST /api/v1/monitoring/alerts    — inbound alert receiver (HMAC
 *                                       verified), fans out to Feishu /
 *                                       DingTalk / generic webhooks
 *
 * Auth on /metrics:
 *   - When env.METRICS_TOKEN is set, requires `Authorization: Bearer <token>`
 *   - When empty, endpoint is open (dev / staging only — production
 *     deployments MUST set the token)
 *
 * Auth on /api/v1/monitoring/alerts:
 *   - When env.ALERT_RECEIVER_HMAC_SECRET is set, validates the
 *     `X-Signature: sha256=<hex>` header (HMAC-SHA256 of the raw body)
 *   - When empty, endpoint is open (dev only)
 */
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { z } from 'zod';

import { UnauthorizedError, ValidationError } from '@/lib/errors.js';
import { getMetricsRegistry } from '@/lib/metrics.js';
import { logger } from '@/lib/logger.js';

// Read these env vars at REQUEST time, not from the frozen `env`
// object — vi.stubEnv('METRICS_TOKEN', ...) only mutates process.env
// at runtime, and tests need the request-time read to see the
// stubbed value. Production behaviour is identical because the env
// is set at process start.
const getEnv = (key: string): string => process.env[key] ?? '';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const severitySchema = z.enum(['info', 'warning', 'error', 'critical']);

const alertReceiverSchema = z
  .object({
    /** Source label — "grafana", "alertmanager", "uptime", etc. */
    source: z.string().min(1).max(64).default('unknown'),
    /** Alert title. */
    title: z.string().min(1).max(200),
    /** Free-form body / description. Markdown OK. */
    body: z.string().max(4000).default(''),
    severity: severitySchema.default('warning'),
    /** Optional labels (e.g. { route: "/api/v1/auth/..." }). */
    labels: z.record(z.string(), z.string()).optional(),
    /** Optional dedupe key — same key within 60s is throttled. */
    fingerprint: z.string().min(1).max(128).optional(),
  })
  .strict();

export type AlertReceiverPayload = z.infer<typeof alertReceiverSchema>;

// ---------------------------------------------------------------------------
// Dedupe (in-memory; fine for a single instance)
// ---------------------------------------------------------------------------

const RECENT_FINGERPRINTS = new Map<string, number>();
const FINGERPRINT_TTL_MS = 60_000;

function isDuplicate(fingerprint: string | undefined): boolean {
  if (!fingerprint) return false;
  const now = Date.now();
  // Lazy GC: sweep expired entries on every check.
  for (const [k, t] of RECENT_FINGERPRINTS) {
    if (now - t > FINGERPRINT_TTL_MS) RECENT_FINGERPRINTS.delete(k);
  }
  if (RECENT_FINGERPRINTS.has(fingerprint)) return true;
  RECENT_FINGERPRINTS.set(fingerprint, now);
  return false;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function registerMonitoringModule(app: FastifyInstance): Promise<void> {
  /**
   * GET /metrics — Prometheus exposition.
   */
  app.get('/metrics', async (req, reply) => {
    const token = getEnv('METRICS_TOKEN');
    if (token) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${token}`) {
        throw new UnauthorizedError('Metrics endpoint requires Bearer token');
      }
    }
    const registry = getMetricsRegistry();
    const text = await registry.metrics();
    reply
      .header('Content-Type', registry.contentType)
      .send(text);
  });

  /**
   * GET /api/v1/monitoring/liveness — always-200 ping for Uptime
   * services. Distinct from /health (which exercises the live
   * app) — this is the "process is up" signal.
   */
  app.get('/api/v1/monitoring/liveness', async () => ({
    data: { status: 'ok', timestamp: new Date().toISOString() },
  }));

  /**
   * POST /api/v1/monitoring/alerts — inbound alert receiver.
   *
   * Auth: optional HMAC. Body is verified with the shared secret.
   * On valid input, fan out to all configured outbound webhooks.
   */
  app.post('/api/v1/monitoring/alerts', async (req) => {
    // 1. HMAC check (when secret configured).
    const hmacSecret = getEnv('ALERT_RECEIVER_HMAC_SECRET');
    if (hmacSecret) {
      const sig = req.headers['x-signature'];
      if (typeof sig !== 'string' || !sig.startsWith('sha256=')) {
        throw new UnauthorizedError('Missing or malformed X-Signature header');
      }
      const rawBody =
        typeof (req as { rawBody?: unknown }).rawBody === 'string'
          ? ((req as { rawBody?: unknown }).rawBody as string)
          : JSON.stringify(req.body ?? {});
      const expected = crypto
        .createHmac('sha256', hmacSecret)
        .update(rawBody)
        .digest('hex');
      const provided = sig.slice('sha256='.length);
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(provided, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new UnauthorizedError('HMAC signature mismatch');
      }
    }

    // 2. Validate body.
    const parsed = alertReceiverSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError({ issues: parsed.error.flatten() });
    }
    const alert = parsed.data;

    // 3. Dedupe.
    if (isDuplicate(alert.fingerprint)) {
      return { data: { status: 'deduped', fingerprint: alert.fingerprint } };
    }

    // 4. Fan out (best-effort — failures are logged, not raised).
    type WebhookName = 'feishu' | 'dingtalk' | 'generic';
    const targets: Array<{ name: WebhookName; url: string }> = (
      [
        { name: 'feishu', url: getEnv('ALERT_WEBHOOK_FEISHU') },
        { name: 'dingtalk', url: getEnv('ALERT_WEBHOOK_DINGTALK') },
        { name: 'generic', url: getEnv('ALERT_WEBHOOK_GENERIC') },
      ] as Array<{ name: WebhookName; url: string }>
    ).filter((t) => t.url.length > 0);

    const results = await Promise.allSettled(
      targets.map((t) => sendToOutboundWebhook(t.name, t.url, alert)),
    );

    const delivered = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - delivered;
    if (failed > 0) {
      logger.warn(
        { alert, failed, delivered },
        'monitoring alert fanout had partial failures',
      );
    }

    return {
      data: {
        status: 'accepted',
        source: alert.source,
        severity: alert.severity,
        delivered,
        failed,
        targets: targets.map((t) => t.name),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Outbound webhook
// ---------------------------------------------------------------------------

/**
 * Format the alert for each outbound platform.
 *
 * Feishu / Lark incoming webhook: send a JSON body with
 * `msg_type: "interactive" + a card`. Reference: https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
 * DingTalk incoming webhook: send a JSON body with `msgtype: "markdown"` and a `text` field.
 * Generic: send the canonical payload (Grafana / Alertmanager JSON).
 */
async function sendToOutboundWebhook(
  name: 'feishu' | 'dingtalk' | 'generic',
  url: string,
  alert: AlertReceiverPayload,
): Promise<void> {
  const fetchFn = (globalThis as { fetch: typeof fetch }).fetch.bind(globalThis);
  let body: string;
  let headers: Record<string, string>;
  if (name === 'feishu') {
    body = JSON.stringify({
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: `[${alert.severity.toUpperCase()}] ${alert.title}` },
          template: alert.severity === 'critical' ? 'red' : alert.severity === 'error' ? 'orange' : 'blue',
        },
        elements: [
          {
            tag: 'markdown',
            content: alert.body || '_no description_',
          },
          {
            tag: 'note',
            elements: [
              { tag: 'plain_text', content: `source: ${alert.source}` },
              ...(alert.labels
                ? Object.entries(alert.labels).map(([k, v]) => ({
                    tag: 'plain_text',
                    content: `${k}: ${v}`,
                  }))
                : []),
            ],
          },
        ],
      },
    });
    headers = { 'Content-Type': 'application/json' };
  } else if (name === 'dingtalk') {
    body = JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        title: `[${alert.severity.toUpperCase()}] ${alert.title}`,
        text: `### [${alert.severity.toUpperCase()}] ${alert.title}\n\n${alert.body || '_no description_'}\n\n> source: ${alert.source}${alert.labels ? '\n> ' + Object.entries(alert.labels).map(([k, v]) => `${k}=${v}`).join(' ') : ''}`,
      },
    });
    headers = { 'Content-Type': 'application/json' };
  } else {
    // Generic: forward the raw payload. Most platforms (Grafana webhook,
    // Alertmanager generic_template, PagerDuty Events API v2) accept
    // arbitrary JSON.
    body = JSON.stringify(alert);
    headers = { 'Content-Type': 'application/json' };
  }
  const res = await fetchFn(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    throw new Error(`${name} webhook responded ${res.status}`);
  }
}
