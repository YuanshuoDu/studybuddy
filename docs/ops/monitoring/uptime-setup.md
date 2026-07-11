# Uptime monitoring (issue #34)

External HTTP ping service. The Pairhub API is considered "up"
when `GET /api/v1/monitoring/liveness` returns 200 within 3 seconds.
The endpoint is cheap (no DB query, no Redis lookup — just a
200 + a timestamp) so polling it every minute is fine.

## What we're using

**Better Uptime** (https://betteruptime.com) for M3 launch. The
Free tier covers 10 monitors with 3-min check interval; the $20/mo
Pro plan unlocks 1-min checks + multi-region. We start on the
free tier and upgrade when we cross 200 DAU.

Alternative services we considered but rejected for M3:
- **UptimeRobot** — same features, but the alert routing UX is
  worse than Better Uptime
- **Pingdom** — too expensive for the M3 launch volume
- **Self-hosted Healthchecks.io** — too much operational overhead
  for a launch

## One-time setup (10 minutes)

1. **Create a Better Uptime account** at https://betteruptime.com.
   - Pick the **AWS / Frankfurt (eu-central-1)** region for the
     probe — same region as the API to avoid noisy false positives
     from network hops.
2. **Create 3 monitors** — one per region so we catch regional
   outages:

   | Monitor | URL | Interval | Notes |
   | --- | --- | --- | --- |
   | `Pairhub-api-eu-west` | `https://api.Pairhub.app/api/v1/monitoring/liveness` | 1 min | Frankfurt probe |
   | `Pairhub-api-us-east` | same | 1 min | Virginia probe (catches EU-only outages) |
   | `Pairhub-api-ap-southeast` | same | 1 min | Singapore probe (catches EU + US-only outages) |

   All 3 should expect HTTP 200 within 3s. Anything else = down.

3. **Set up on-call schedules**:
   - **Free tier**: alert goes to a Feishu group + a DingTalk group
     + an SMS to the on-call phone
   - **Pro tier**: also gets phone call escalation after 5 min

4. **Status page** (optional, free): Better Uptime can host a
   `status.Pairhub.app` page that shows public uptime. Worth
   turning on after the M3 launch when we have paying users.

## What counts as "down"

| Response | Verdict |
| --- | --- |
| 200 in < 3s | up |
| 200 in > 3s | slow (warning) |
| 4xx | up (the liveness endpoint shouldn't return 4xx, but if it does, the process is still up) |
| 5xx | down |
| Connection refused / timeout | down |

A monitor must fail **3 consecutive checks** before Better Uptime
opens an incident. That's 3 minutes of "down" before the on-call
phone rings — enough buffer to absorb a 1-min blip, fast enough
to catch a real outage.

## What we DO NOT monitor at this layer

| Surface | Why not |
| --- | --- |
| DB queries | Better Uptime only does HTTP. Slow-query monitoring lives in Grafana. |
| Redis cache hit ratio | Same — internal metric, not a health signal |
| Push token TTL | Operational, not a health signal |
| Background jobs | Use the `Pairhub_background_job_last_run_timestamp` metric + R8 alert rule |

## When the alert fires (the playbook)

1. Check the **3 monitor regions** in Better Uptime. If all 3 are
   down → real outage. If only 1 is down → regional issue.
2. Check **Grafana** for the Pairhub API Overview dashboard. If
   `Pairhub_http_requests_in_flight` is climbing, the process
   is hung. Otherwise look at 5xx rate.
3. Check **Sentry** for the latest error events. The error is
   probably already there with a stack trace.
4. If it's a deploy, **roll back**. The rollback button is in
   the CI/CD dashboard.
5. If it's not a deploy, check the **K8s/ECS** console for
   pod health.
6. Post in the **#incidents** Feishu group with a one-liner
   timeline. The retro doc template is in
   `docs/ops/incidents/`.
7. When the monitors flip back to green, **close the incident**
   in Better Uptime. The system will write a public status update
   on the public page (if enabled).

## Cost

- Free tier: $0/mo, 10 monitors, 3-min interval, single region
- Pro tier: $20/mo, 50 monitors, 1-min interval, multi-region
- Business tier: $80/mo, unlimited monitors, status page custom
  domain, SLA reports

We upgrade to Pro at the M3 launch end of Week 2 (2 weeks in) so
the on-call has 1-min checks during the high-traffic launch window.
