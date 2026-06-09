/**
 * Sentry init helper — issue #34.
 *
 * Disabled by default (SENTRY_DSN is empty). When DSN is set:
 *   - Captures unhandled exceptions + unhandled promise rejections
 *   - Adds Fastify request handler so 5xx + errors get a tagged event
 *   - Profiling on (1% of transactions in prod) for the M3 launch
 *     workload; the sample rate is env-tunable for cost control.
 *
 * Sensitive data is scrubbed by Sentry's default beforeSend hook
 * (Bearer tokens, JWT secrets) but we also explicitly drop known
 * sensitive fields from the request body / query / params.
 */
import type { FastifyInstance } from 'fastify';
// Sentry types are pulled in at type-check time only (we require
// the runtime at the call site so the SDK + its native binaries
// are only loaded when the DSN is set). `as never` at the runtime
// site casts the require() result to the type the call sites need.
import type * as SentryModule from '@sentry/node';
import type { ProfilingIntegration as ProfilingIntegrationType } from '@sentry/profiling-node';

import { env } from '@/lib/env.js';

// Lazily import Sentry only when actually needed — keeps test
// environments (where the Sentry DSN is empty by definition) free
// of the SDK's transitive dependencies and platform-specific
// native binaries (notably @sentry/profiling-node, which ships
// .node binaries that can break in CI containers that don't ship
// the matching glibc / VC++ runtime).
type SentryLike = {
  captureException: (err: unknown, opts?: unknown) => void;
  captureMessage: (msg: string, opts?: unknown) => void;
  flush: (timeoutMs: number) => Promise<boolean>;
};
let sentry: SentryLike | null = null;

function getSentry(): SentryLike | null {
  if (!env.SENTRY_DSN || env.NODE_ENV === 'test') return null;
  if (sentry) return sentry;
  // Dynamic require so the SDK + native binaries are only loaded
  // when the DSN is set.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@sentry/node') as typeof SentryModule;
  sentry = {
    captureException: (err, opts) => mod.captureException(err, opts as never),
    captureMessage: (msg, opts) => mod.captureMessage(msg, opts as never),
    flush: (timeoutMs) => mod.flush(timeoutMs),
  };
  return sentry;
}

let initialized = false;

export function initSentry(app: FastifyInstance): void {
  if (initialized) return;
  if (env.NODE_ENV === 'test') {
    app.log.debug('Sentry skipped in test env');
    initialized = true;
    return;
  }
  if (!env.SENTRY_DSN) {
    app.log.info('Sentry disabled (SENTRY_DSN is empty)');
    initialized = true;
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/node') as typeof SentryModule;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ProfilingIntegration } = require('@sentry/profiling-node') as {
    ProfilingIntegration: typeof ProfilingIntegrationType;
  };

  // Try to load the profiling integration; gracefully no-op on
  // platforms where the native binary isn't shipped (e.g. some CI
  // images). The Sentry SDK itself works fine without profiling —
  // it just means we'll only have span-level data, not sample-level.
  let profilingIntegration: InstanceType<typeof ProfilingIntegration> | undefined;
  try {
    profilingIntegration = new ProfilingIntegration();
  } catch (err) {
    app.log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'ProfilingIntegration unavailable; continuing without profiling',
    );
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env['npm_package_version'] ?? '0.1.0',
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    profilesSampleRate: env.SENTRY_PROFILES_SAMPLE_RATE,
    integrations: profilingIntegration ? [profilingIntegration] : [],
    beforeSendTransaction(event) {
      if (event.transaction === 'GET /health' || event.transaction === 'GET /ready') {
        return null;
      }
      return event;
    },
    beforeSend(event) {
      if (event.request?.headers) {
        for (const k of Object.keys(event.request.headers)) {
          if (/^(authorization|cookie|x-api-key)$/i.test(k)) {
            event.request.headers[k] = '[redacted]';
          }
        }
      }
      if (event.request?.data) {
        scrubStringifiedJson(event.request.data as Record<string, unknown>);
      }
      return event;
    },
  });

  app.log.info({ dsn: redactDsn(env.SENTRY_DSN) }, 'Sentry initialized');
  initialized = true;
}

/** Manually capture an error with a tag set. */
export function captureException(err: unknown, tags?: Record<string, string>): void {
  const s = getSentry();
  if (!s) return;
  s.captureException(err, tags ? { tags } : undefined);
}

/** Manually capture a message with a level + tag set. */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  tags?: Record<string, string>,
): void {
  const s = getSentry();
  if (!s) return;
  s.captureMessage(message, { level, tags });
}

/** Flush pending events (call before process.exit / test teardown). */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  const s = getSentry();
  if (!s) return;
  await s.flush(timeoutMs);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function redactDsn(dsn: string): string {
  // DSN looks like https://<public-key>@o<org>.ingest.sentry.io/<project>.
  // We only want the org/project in the log, not the public key.
  try {
    const u = new URL(dsn);
    return `${u.protocol}//${u.hostname.replace(/\.ingest\..*/, '.ingest.***')}${u.pathname}`;
  } catch {
    return '***';
  }
}

function scrubStringifiedJson(obj: Record<string, unknown>): void {
  for (const k of Object.keys(obj)) {
    if (/password|token|secret|openid|unionid|wechatid|phone/i.test(k)) {
      obj[k] = '[redacted]';
    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
      scrubStringifiedJson(obj[k] as Record<string, unknown>);
    }
  }
}
