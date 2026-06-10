/**
 * Centralized, validated environment configuration.
 *
 * Use `getEnv()` instead of reading `process.env` directly so that:
 * - Missing / malformed values fail fast on first access (boot or first test
 *   that needs them).
 * - The rest of the codebase gets typed config.
 * - Sensitive values never get logged in plaintext.
 *
 * # Why lazy (Item 8 of feat/optimization-server)
 *
 * The previous version eagerly parsed `process.env` at import time and
 * `Object.freeze`-d the result. That made `vi.stubEnv('X', 'Y')` in tests
 * useless: env.ts had already captured the pre-stub value at module load,
 * so the stub never propagated to `env.X`.
 *
 * With lazy init, `getEnv()` parses + freezes on first call, then caches
 * the frozen object. Callers that need to react to `vi.stubEnv(...)`
 * changes in tests can call `setEnvForTesting()` to invalidate the cache
 * before their next `getEnv()`. Production code never calls
 * `setEnvForTesting()` — env values are set once at process start and
 * stay constant.
 */
import { z } from 'zod';

// Treat the test env as `test` so Prisma logging is silent. Read this
// eagerly (it's used as a zod default hint) but the real validation
// happens on the first `getEnv()` call.
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default(NODE_ENV === 'production' ? 'info' : 'debug'),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z
    .string()
    .min(1, 'REDIS_URL is required')
    .url('REDIS_URL must be a valid URL'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters (use openssl rand -base64 48)'),

  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(100),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(1).max(1_000).default(10),
  // Per-route rate limits (issue #26). Tighter than the global
  // because these endpoints are write paths and abuse vectors.
  RATE_LIMIT_SIGNUP_MAX: z.coerce.number().int().min(1).max(1_000).default(20),
  RATE_LIMIT_CREATE_ACTIVITY_MAX: z.coerce.number().int().min(1).max(1_000).default(10),
  RATE_LIMIT_REVIEW_MAX: z.coerce.number().int().min(1).max(1_000).default(10),
  // 微信内容安全 API (issue #26). Used to screen user-generated text
  // (activity title/description, review comment) before it lands in
  // our DB. Empty values disable the integration (the helper short-
  // circuits to "passes" in that case — useful for dev + CI).
  WECHAT_MP_APPID: z.string().default(''),
  WECHAT_MP_SECRET: z.string().default(''),
  WECHAT_MSG_SEC_CHECK_URL: z
    .string()
    .url()
    .default('https://api.weixin.qq.com/wxa/msg_sec_check'),

  // ---- Monitoring (issue #34) ----
  // Sentry DSN — leave empty to disable Sentry in dev / CI.
  SENTRY_DSN: z.string().default(''),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  // Prometheus /metrics endpoint. When set, requires this token via
  // `Authorization: Bearer <token>`. When empty, /metrics is open (only
  // safe on dev / staging). Production MUST set a token.
  METRICS_TOKEN: z.string().default(''),
  // Feishu (Lark) incoming webhook for alert routing. Empty disables.
  ALERT_WEBHOOK_FEISHU: z.string().default(''),
  // DingTalk incoming webhook. Empty disables.
  ALERT_WEBHOOK_DINGTALK: z.string().default(''),
  // Generic webhook (Grafana / Alertmanager / custom). Empty disables.
  ALERT_WEBHOOK_GENERIC: z.string().default(''),
  // HMAC secret for the inbound alert receiver (validates X-Signature
  // header on POST /api/v1/monitoring/alerts). Empty disables (dev only).
  ALERT_RECEIVER_HMAC_SECRET: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Frozen snapshot of `process.env`, validated against {@link envSchema}.
 *
 * The first call parses + validates + freezes + caches. Subsequent calls
 * return the same cached object. Call {@link setEnvForTesting} to drop
 * the cache (used by tests that mutate `process.env` between cases).
 */
let cached: Readonly<Env> | null = null;

export function getEnv(): Readonly<Env> {
  if (cached === null) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      // Print all the issues with their path so users can fix the env quickly.
      // We deliberately skip a logger here to keep the import order trivial.
      // eslint-disable-next-line no-console
      console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
      process.exit(1);
    }
    cached = Object.freeze(parsed.data);
  }
  return cached;
}

/**
 * Drop the cached env snapshot so the next {@link getEnv} call re-parses
 * `process.env`. Tests that mutate `process.env` (via `vi.stubEnv` or
 * direct assignment) and then re-import or otherwise invalidate module
 * caches should call this *before* the next `getEnv()` to pick up the
 * new values.
 *
 * Production code MUST NOT call this — env values are fixed at process
 * start.
 */
export function setEnvForTesting(): void {
  cached = null;
}