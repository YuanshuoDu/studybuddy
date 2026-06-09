/**
 * Prometheus metrics registry — issue #34.
 *
 * The server exports a curated set of metrics over `/metrics` (see
 * `modules/monitoring/index.ts`). The goal is operationally useful
 * signal, not exhaustive coverage — these are the dashboards / alert
 * rules in `docs/ops/monitoring/alert-rules.yaml` will pivot on.
 *
 * Cardinality discipline:
 *   - All histograms use fixed buckets that match the latency profile
 *     of the Pairhub API (p50 ~30ms, p99 ~400ms). Do not change
 *     without updating the alert rules.
 *   - Counters / gauges never carry a high-cardinality label (no
 *     `userId`, no `activityId` — only the pre-aggregated buckets
 *     like `route`, `status_class`, `module`).
 *   - The registry is a singleton; tests can replace it via the
 *     `resetMetricsForTests()` helper below.
 */
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({
  register: registry,
  prefix: 'pairhub_',
});

/** HTTP request duration in seconds, labelled by route + status class. */
export const httpRequestDuration = new Histogram({
  name: 'pairhub_http_request_duration_seconds',
  help: 'HTTP request latency in seconds, sliced by Fastify route + status class.',
  labelNames: ['method', 'route', 'status_class'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/** HTTP request counter, same labels as the duration histogram. */
export const httpRequestsTotal = new Counter({
  name: 'pairhub_http_requests_total',
  help: 'Total HTTP requests, sliced by Fastify route + status class.',
  labelNames: ['method', 'route', 'status_class'] as const,
  registers: [registry],
});

/** In-flight HTTP requests. */
export const httpRequestsInFlight = new Gauge({
  name: 'pairhub_http_requests_in_flight',
  help: 'HTTP requests currently being processed.',
  registers: [registry],
});

/** Auth: 401 / 403 events, sliced by route + reason. */
export const authFailuresTotal = new Counter({
  name: 'pairhub_auth_failures_total',
  help: 'Auth preHandler rejections, sliced by route + reason.',
  labelNames: ['route', 'reason'] as const,
  registers: [registry],
});

/** Rate-limit events. */
export const rateLimitedTotal = new Counter({
  name: 'pairhub_rate_limited_total',
  help: 'Requests rejected by rate-limit, sliced by route.',
  labelNames: ['route'] as const,
  registers: [registry],
});

/** Per-business-module counters. */
export const moduleEventsTotal = new Counter({
  name: 'pairhub_module_events_total',
  help: 'Per-module business events (signup, activity create, review, etc.).',
  labelNames: ['module', 'event'] as const,
  registers: [registry],
});

/** DB pool stats (Prisma reports these via $on('query')). */
export const dbQueryDuration = new Histogram({
  name: 'studybudby_db_query_duration_seconds',
  help: 'Prisma query latency in seconds, sliced by model + action.',
  labelNames: ['model', 'action'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

/** Redis cache hit / miss for the activity list. */
export const cacheOpsTotal = new Counter({
  name: 'pairhub_cache_ops_total',
  help: 'Redis cache operations on the activity list cache.',
  labelNames: ['op', 'result'] as const,
  registers: [registry],
});

/** Content-safety (WeChat msg_sec_check) outcomes. */
export const contentCheckTotal = new Counter({
  name: 'pairhub_content_check_total',
  help: 'WeChat content-safety check outcomes.',
  labelNames: ['result'] as const, // 'pass' | 'block' | 'fail_open' | 'fail_closed' | 'disabled'
  registers: [registry],
});

/** Background job heartbeat — set by the GC / scheduled jobs. */
export const lastBackgroundJobTimestamp = new Gauge({
  name: 'pairhub_background_job_last_run_timestamp',
  help: 'Unix timestamp of the most recent successful run per background job.',
  labelNames: ['job'] as const,
  registers: [registry],
});

/** Expose the registry to the route handler. */
export function getMetricsRegistry(): Registry {
  return registry;
}

/** Test helper: clear all metric values. Do NOT call from prod code. */
export function resetMetricsForTests(): void {
  registry.resetMetrics();
}

/**
 * Bucket a status code into the 4 alert-friendly classes
 * (2xx / 3xx / 4xx / 5xx). Returns the literal string so it
 * can be used as a Prometheus label value.
 */
export function statusClass(statusCode: number): '2xx' | '3xx' | '4xx' | '5xx' {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  return '5xx';
}

/**
 * Normalize a Fastify URL to a stable, low-cardinality route label.
 *   /api/v1/activities/ckactabc123  → /api/v1/activities/:id
 *   /api/v1/users/usrabc123/me      → /api/v1/users/:id/me
 *
 * Reads the matching route from `request.routeOptions.url` when
 * available (Fastify ≥ 4) so the placeholder is correct.
 */
export function routeLabel(rawUrl: string, routeUrl?: string): string {
  if (routeUrl && routeUrl.length > 0) return routeUrl;
  // Fallback: collapse everything after the first numeric or cuid-
  // looking token. Cheap, never perfect, low-cardinality guarantee.
  return rawUrl
    .split('?')[0]!
    .replace(/\/c[a-z0-9]{8,}/g, '/:cuid')
    .replace(/\/usr_[a-z0-9]{4,}/g, '/:userId')
    .replace(/\/[0-9a-f-]{16,}/gi, '/:id')
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    || '/';
}
