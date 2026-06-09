# Sentry setup (issue #34)

Error tracking + slow transaction capture for the StudyBuddy backend.
The server integration code lives in `server/src/lib/sentry.ts`; this
doc is the operator-side runbook.

## What Sentry gives us

1. **Error grouping** — every unhandled exception + 5xx response is
   captured with full stack trace, request context, and the
   originating userId (from the JWT).
2. **Performance monitoring** — 10% of transactions are sampled for
   p50 / p95 / p99 latency + slow database query traces.
3. **Profiling** — 10% of transactions are sampled for continuous
   CPU profiling (cheap when off; the rate is env-tunable).

The server emits zero network traffic to Sentry if `SENTRY_DSN` is
empty. This is the default in dev / CI and what you want locally.

## One-time setup (5 minutes)

1. **Create a Sentry project** at https://sentry.io (the org
   already exists — ask the CTO for the invite).
   - Platform: **Node.js / Express** (we use Fastify, but the
     Node.js preset is the right starting point)
   - Project name: `studybuddy-server` (one project per env: `…-prod`,
     `…-staging`)
2. **Copy the DSN** from Project Settings → Client Keys (DSN).
   It looks like `https://abc123@o987654.ingest.sentry.io/123456`.
3. **Set the env var** in the deployment target:
   - `SENTRY_DSN=<the-dsn>`
   - `SENTRY_TRACES_SAMPLE_RATE=0.1` (10% — increase for staging)
   - `SENTRY_PROFILES_SAMPLE_RATE=0.1` (10%)
   - `NODE_ENV=production` (otherwise the SDK no-ops — see the
     `initSentry` guard in `lib/sentry.ts`)

That is the entire config. Restart the server. After 30 seconds
you should see the first Sentry ping on the project's "Activity" tab.

## Verifying it works

After deploy, in any environment that has Sentry enabled:

```bash
# 1. Confirm the SDK loaded
curl -s -H "Authorization: Bearer <token>" https://api.studybuddy.app/metrics \
  | grep studybuddy_

# 2. Trigger a 5xx (e.g. POST a malformed activity without auth)
curl -X POST -H "Content-Type: application/json" \
     -d '{"title":"x"}' \
     https://api.studybuddy.app/api/v1/activities
# → 401 (NOT 5xx, since 401 is handled by the auth preHandler).
# To get a 5xx into Sentry, throw a deliberate error in a test
# route handler in a non-prod env.

# 3. Check Sentry — the event should land within 30s.
```

## What's redacted

The Sentry `beforeSend` hook scrubs:

- `Authorization`, `Cookie`, `X-Api-Key` request headers
- Any field in the request body whose name matches
  `/password|token|secret|openid|unionid|wechatid|phone/i` (case-insensitive)

This is enough to prevent the Sentry event from leaking a Bearer
token or a phone number. It does NOT cover request body
free-form text fields like `title` or `description` — those are
intentional (we need the content to debug a 5xx). If you need to
scrub more, add a path under `lib/sentry.ts:scrubStringifiedJson`.

## Source maps (pro / team plan only)

The Sentry source-map upload is automatic via the
`@sentry/profiling-node` release tag. To enable:

1. Set the release in your CI: `SENTRY_RELEASE=$(git rev-parse --short HEAD)`
2. Pass it to Sentry via `release:` in the Sentry.init options
   (already in `lib/sentry.ts` via `process.env['npm_package_version']`)
3. Upload the source map: `npx sentry-cli releases files <release> upload-sourcemaps ./dist`

For the M3 launch we're shipping without source maps (cost / benefit
isn't there yet). Turn them on once the M3 traffic starts and we
get our first batch of "minified stack" complaints.

## M3 launch decisions

- **Profiling**: enabled at 10% sample rate. CPU cost is < 2% per
  the Sentry pricing page; can be turned down to 1% if needed.
- **Performance sampling**: 10% is enough for the M3 launch volume
  (≤ 200 signups × 5 actions/day = ≤ 1k events/day). Scale to
  100% in production once we cross 1k DAU.
- **Session replay**: NOT enabled for M3. We don't ship a browser
  app; the miniprogram doesn't have a Sentry SDK. Revisit when we
  add a Web admin UI.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Sentry dashboard shows no events | `SENTRY_DSN` not set in env | Check `kubectl get deploy` env vars |
| Events land but missing user context | JWT not parsed | Check `auth.ts:authenticate` populates `req.userId` |
| Stack traces are minified | Source maps not uploaded | See "Source maps" above |
| "CORS / network" warnings in server logs | DSN wrong or Sentry SDK can't reach the endpoint | Test `curl -X POST $SENTRY_DSN` — should get 400 (expected) |
