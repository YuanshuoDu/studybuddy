# Grafana setup (issue #34)

Prometheus + Grafana Cloud is the metrics stack for M3. The server
side is automatic (`server/src/lib/metrics.ts` declares the metrics,
`server/src/plugins/metrics.ts` records them on every request, and
`server/src/modules/monitoring/index.ts` exposes `/metrics`). This
doc covers the Grafana-side configuration.

## One-time setup (15 minutes)

1. **Create a Grafana Cloud stack** at https://grafana.com/products/cloud/.
   - The "Free" tier is enough for M3 launch (10k metrics series,
     50GB logs, 14-day retention). Upgrade to Pro when we cross
     100 DAU.
   - Pick the **AWS / Frankfurt (eu-central-1)** region — same
     region as our Postgres + Redis for the lowest scrape latency.
2. **Note the Prometheus remote_write URL + auth header.** It looks
   like:
   - URL: `https://prometheus-prod-01-eu-west-0.grafana.net/api/prom/push`
   - Header: `Authorization: Basic <base64(instance_id:api_key)>`
3. **Wire a Prometheus agent** (or use Grafana Agent / Alloy) to
   scrape `https://api.Pairhub.app/metrics` every 15s and remote-
   write to Grafana. The config block (deploy on a sidecar in
   the same cluster as the API):

   ```yaml
   # /etc/prometheus/prometheus.yml
   global:
     scrape_interval: 15s
     evaluation_interval: 30s
   scrape_configs:
     - job_name: Pairhub-server
       scheme: https
       authorization:
         type: Bearer
         credentials: ${METRICS_TOKEN}     # from the same env as the server
       static_configs:
         - targets: ['api.Pairhub.app']
       metrics_path: /metrics
   remote_write:
     - url: ${GRAFANA_REMOTE_WRITE_URL}
       basic_auth:
         username: ${GRAFANA_INSTANCE_ID}
         password: ${GRAFANA_API_KEY}
   ```

4. **Verify** by visiting your Grafana → Explore → Prometheus →
   query `Pairhub_http_requests_total`. You should see a non-empty
   graph within 30s of the first scrape.

## Dashboards (import these)

Three dashboards, all exportable as JSON and importable via
Grafana → Dashboards → Import. The JSONs live in
`docs/ops/monitoring/dashboards/` once exported (M3 W10 deliverable,
the CTO is on the hook for that).

### 1. Pairhub API Overview

The "first screen on call" — single 12-cell grid, refresh every 30s.

| Cell | Query |
| --- | --- |
| 5xx rate (last 5m) | `sum(rate(Pairhub_http_requests_total{status_class="5xx"}[5m]))` |
| 4xx rate | `sum(rate(Pairhub_http_requests_total{status_class="4xx"}[5m]))` |
| 2xx rate | `sum(rate(Pairhub_http_requests_total{status_class="2xx"}[5m]))` |
| p50 / p95 / p99 latency | `histogram_quantile(0.50, ...)` × 3 |
| Requests in flight | `Pairhub_http_requests_in_flight` |
| Cache hit ratio | `rate(Pairhub_cache_ops_total{result="hit"}[5m]) / rate(Pairhub_cache_ops_total{op="get"}[5m])` |
| Top 10 routes by error rate | `topk(10, sum by (route) (rate(Pairhub_http_requests_total{status_class="5xx"}[5m])))` |
| Top 10 routes by p99 latency | `topk(10, histogram_quantile(0.99, sum by (route, le) (rate(Pairhub_http_request_duration_seconds_bucket[10m]))))` |

### 2. Pairhub Auth + Abuse

For the security on-call rotation. Shows auth failures + rate-limit
events.

| Cell | Query |
| --- | --- |
| 401 by reason | `sum by (reason) (rate(Pairhub_auth_failures_total{reason="unauthorized"}[5m]))` |
| 403 by reason | `sum by (reason) (rate(Pairhub_auth_failures_total{reason="forbidden"}[5m]))` |
| Rate-limited by route (top 10) | `topk(10, sum by (route) (rate(Pairhub_rate_limited_total[5m])))` |
| Refresh-token rotation | computed from `auth:refresh:*` Redis key TTL distribution |

### 3. Pairhub Business KPIs

What the PMs care about. Refresh every 5m.

| Cell | Query |
| --- | --- |
| Signups today / this week | `Pairhub_module_events_total{module="signup",event="created"}` |
| Activities created today | `Pairhub_module_events_total{module="activity",event="created"}` |
| Reviews created today | `Pairhub_module_events_total{module="review",event="created"}` |
| New users today / this week | (from `users` table — derived) |
| Banned users | (from `users` table — derived) |
| Open PENDING_REVIEW queue | (from `activities` table — derived) |

## Alert rules

See [`alert-rules.yaml`](./alert-rules.yaml) — 8 rules that map
directly to the 8 M3-launch SLA tickets. They are imported as
**Grafana managed alert rules** (not Prometheus alerting rules —
Grafana Cloud prefers the managed form for better routing + UI).

To import:

1. Grafana → Alerting → Alert rules → New alert rule
2. Pick "Grafana managed" + "Prometheus" data source
3. For each of the 8 rules in `alert-rules.yaml`:
   - Name: `Pairhub*` (matches the YAML)
   - Query: paste the `expr` block
   - Condition threshold + the `for` duration
   - Add label `severity: critical` / `warning`
   - Add the annotation `summary` + `description`
4. Notification policy: point the rule at the Feishu / DingTalk
   webhook configured in
   [`server/src/modules/monitoring/index.ts`](../../../server/src/modules/monitoring/index.ts).

## Retention

M3 launch retention policy:

- **Metrics**: 90 days (Grafana Cloud default for the Free tier is
  14 days; we'll upgrade before the 14-day cutoff if the M3 launch
  is still in the on-call window)
- **Logs**: 30 days
- **Traces (Sentry)**: 90 days, then archived (Sentry's default
  pricing tier covers this for ~1M events/month, well above our
  M3 launch projection of ~50k events/month)
- **Alert state history**: 90 days (Grafana default)

## What to do when the metrics cardinality grows

The free tier caps at 10k series. At M3 launch volume (≤ 200
signups × ~5 actions/day) we're at ~50 series — well under. If we
hit the cap:

1. Drop the histogram buckets (currently 5ms-10s) down to 50ms-2s
   to halve the bucket count.
2. Drop the auth-failure labels from `route, reason` to just
   `reason` (route is rarely useful for the 401/403 case at scale).
3. If still over, upgrade to Pro ($8/month for 100k series).
