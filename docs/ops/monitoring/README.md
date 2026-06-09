# Monitoring runbook (issue #34)

This is the operator-facing entry point for the Pairhub monitoring
stack. The split is intentional: each external service gets its own
page so the deep setup (Sentry DSN, Grafana dashboards, Better Uptime
monitors) stays out of this overview.

| Page | What it covers |
| --- | --- |
| [Sentry setup](./sentry-setup.md) | Error tracking, stack-trace grouping, sensitive-data scrubbing |
| [Grafana setup](./grafana-setup.md) | Dashboards + alert rules + 90-day retention policy |
| [Uptime setup](./uptime-setup.md) | HTTP health checks, 1-min interval, multi-region |

## What's in the monitoring stack (M3 launch)

| Component | Purpose | How it's wired |
| --- | --- | --- |
| **Prometheus** (via Grafana Cloud) | Pulls `/metrics` from the server every 15s | `server/src/modules/monitoring` |
| **Grafana** | Dashboards + alert rules | [alert-rules.yaml](./alert-rules.yaml) |
| **Sentry** | Unhandled exceptions, slow transactions, profiling | `server/src/lib/sentry.ts` |
| **Better Uptime** | 1-min HTTP ping on `/api/v1/monitoring/liveness` | This page |

## The 8 alert rules (M3 launch SLA)

All 8 are defined as Grafana managed rules in
[`alert-rules.yaml`](./alert-rules.yaml). Summary:

| # | Name | Severity | What it means |
| --- | --- | --- | --- |
| R1 | `PairhubHigh5xxRate` | critical | 5xx > 1% over 5m — real bug shipping errors |
| R2 | `PairhubHighLatencyP99` | warning | p99 > 1s for 10m on any route |
| R3 | `PairhubAuthFailureStorm` | warning | > 50 auth failures in 5m |
| R4 | `PairhubRateLimitedHotRoute` | warning | > 1000 rate-limited req/5m on one route |
| R5 | `PairhubRedisOutage` | critical | Redis error > 50% for 2m |
| R6 | `PairhubContentSafetyDisabled` | warning | WeChat content-safety not configured |
| R7 | `PairhubContentSafetyFailOpen` | warning | WeChat API fail-open > 5% for 10m |
| R8 | `PairhubBackgroundJobStalled` | warning | A cron / worker has not run in 2h |

The SLO is "no critical alert in production during business hours
without an open incident within 5 minutes". The M3 launch plan
is to staff this only on weekdays 9-18 EU for the first 2 weeks,
then 24×7 from Week 3.

## Endpoints (the server side)

| Path | Purpose | Auth |
| --- | --- | --- |
| `GET /metrics` | Prometheus exposition | Bearer `METRICS_TOKEN` (when set) |
| `GET /api/v1/monitoring/liveness` | Cheap ping for Better Uptime | None (process-up only) |
| `POST /api/v1/monitoring/alerts` | Inbound alert receiver from Grafana / Alertmanager | HMAC `X-Signature: sha256=...` (when set) |

The existing `/health` and `/ready` endpoints (in `server/src/modules/health`)
serve the K8s / ECS liveness + readiness probes — distinct from the
`/api/v1/monitoring/liveness` ping, which is "process is up" only.

## Metrics catalogue (what `/metrics` exposes)

All metrics are prefixed with `pairhub_` and live in
`server/src/lib/metrics.ts`. The curated set is:

| Metric | Type | Labels | Use |
| --- | --- | --- | --- |
| `pairhub_http_requests_total` | counter | method, route, status_class | Throughput + error rate |
| `pairhub_http_request_duration_seconds` | histogram | method, route, status_class | p50 / p95 / p99 latency |
| `pairhub_http_requests_in_flight` | gauge | — | Concurrency / saturation |
| `pairhub_auth_failures_total` | counter | route, reason | Brute force / token expiry detection |
| `pairhub_rate_limited_total` | counter | route | Abuse detection |
| `pairhub_module_events_total` | counter | module, event | Business KPIs (signups, activities) |
| `pairhub_db_query_duration_seconds` | histogram | model, action | Slow query detection |
| `pairhub_cache_ops_total` | counter | op, result | Redis cache hit ratio |
| `pairhub_content_check_total` | counter | result | WeChat content-safety effectiveness |
| `pairhub_background_job_last_run_timestamp` | gauge | job | Stalled-job detection |

Plus the `prom-client` default Node.js metrics (CPU, memory, GC, etc.)
with the same `pairhub_` prefix.

## Cardinality discipline

Three rules we enforce so the metrics stay cheap:

1. **No high-cardinality labels.** Never `userId`, `activityId`,
   `phone`, etc. as a label. The route label is normalised to a
   pattern (e.g. `/api/v1/activities/:id`) so `/api/v1/activities/ckactabc`
   and `/api/v1/activities/ckactdef` collapse to the same time series.
2. **Bounded histograms.** Latency histograms use a fixed bucket set
   (5ms to 10s) — never custom per-route buckets. If you need
   per-route p99 detail, add a separate `*_bucket_seconds` metric.
3. **No name collisions.** Every metric has the `pairhub_`
   prefix. Sentry and the alert rules use the same names — search
   for `pairhub_` in this repo and you'll see every metric.

## On-call rotation

| Week | Primary | Secondary |
| --- | --- | --- |
| M3 Week 1 | TBD (CTO) | TBD |
| M3 Week 2 | TBD | TBD |
| M3 Week 3+ | hires + CTO | rotates weekly |

The on-call phone gets all PagerDuty / Feishu / DingTalk critical
alerts. The "warning" severity goes to a Feishu group chat only.

## M3 retrospective checkpoint

We run a 30-min retro on the Monday after each M3 launch milestone
(Week 8, Week 10, Week 12). Output: [`/docs/m3-retrospective.md`](../../m3-retrospective.md).
The retro looks at: alert volume, false-positive rate, MTTR per
alert class, gaps in observability, on-call load.

## Change log

- 2026-06-09: Initial M3 launch stack (Prometheus + Sentry + Better
  Uptime, 8 alert rules).
