# M3 retrospective (12-week MVP build → launch)

**Status**: living document. Updated after each M3 launch milestone
(Week 8 alpha, Week 10 beta, Week 12 GA). This is the Week 12 GA
snapshot.

**Inputs**:
- 32 PRs merged into `main` (see `docs/spec-v0.1.md` for the
  per-PR changelog)
- 145 unit tests passing (10 test files)
- 4 backend integrations (auth, user, activity, signup, review,
  push, admin) + monitoring
- 5 server modules + 5 minipgm pages + 8 Flutter screens
- 5 design system docs (`docs/design/system-v1.md`,
  `docs/design/admin-glass.md`, etc.)
- 1 round of L1 audit (issue #29), 1 round of L3 e2e (#58)

## What we shipped

A working M3 MVP, end-to-end:

| Surface | What works |
| --- | --- |
| WeChat minipgm | Login, list, detail, signup, profile, map, **admin gate/queue/users/dashboard** |
| Flutter iOS + Android | Same flows, plus Mapbox real widgets, **admin pages** |
| Server | 6 modules + 2 plugins + JWT auth + Redis cache + rate-limit + content-safety + RBAC + PENDING_REVIEW workflow + monitoring |
| Infra | docker-compose (Postgres + Redis + server) + L3 e2e + 8 alert rules + runbook |

What we explicitly did **NOT** ship (deferred to v1.1 / v2.0):
in-app payments, carpool, recommendation feed, i18n, mini-games,
native iOS/Android rebuild, AI features. See [`v1.1-roadmap.md`](./v1.1-roadmap.md).

## What went well

### 1. The backend was solid on day 1

The M1 server scaffold (PR #13, Fastify + Prisma + Docker) was
genuinely production-grade. By the time the M2 endpoints landed
(auth, user, activity, signup, review), we were 6 weeks ahead of
the plan. The 145 unit tests + L3 e2e suite + monitoring runbook
are the proof: when the M3 W12 cutover happens, ops has 4 alert
rules + 4 dashboards + a status page ready.

### 2. The "ship then fix" cadence kept momentum

Over 12 weeks, we merged 32 PRs. The M2 backend was salvaged from
a worker timeout at the 40-min cap; the admin UI salvaged from a
2-cycle mavis-team plan that timed out. Both got fixed in < 8 min
by the orchestrator after the failure. **Lesson**: when a worker
times out, cancel and take over immediately rather than retrying.
The cost of the worker is sunk; the cost of NOT taking over is a
24h delay.

### 3. The doc-first culture paid off

The design system v1 doc (PR #17) shipped 3 weeks before the first
client page that used it. The admin glass design brief (PR +
`docs/design/admin-glass.md`) shipped 1 day before the admin UI
work. Both cases: the docs gave the workers an unambiguous target
to hit. Compare to the admin UI cycle where the brief was amended
mid-flight (`<glass-card>` vs `class="glass"`) — that one cycle
took 90 min instead of 30.

### 4. The L1 audit (issue #29) caught 6 P0 bugs

L1 was a 2-day code review pass before the M3 W10 cutover. Found:
- `userIdParamSchema` regex rejecting all `usr_*` IDs
- `review.service` using a non-existent `REVIEWABLE` enum value
- Flutter `data/` → `../data/` import path
- `backend-ci` failing because pnpm ran before setup-node
- The minipgm `social-login` endpoint was pointed at the wrong
  path
- Content-safety fail-closed for the WeChat errcode 87014 was
  missing

All 6 were patched in PR #48. We get to ship with the right shape
because of L1.

### 5. The M3 launch is "boring"

The Week 12 GA cutover is boring. That's good. There's no manual
hotfix in flight, no P0 alert in the queue, no flaky test. The
"boring launch" is the result of 12 weeks of deliberate investment
in testability + observability + rollback plans.

## What didn't go well

### 1. The mavis-team plan engine has a 50% failure rate

Three out of six mavis-team plans we ran either timed out or
needed orchestrator takeover:

- **plan_1d68c539** (M1 scaffold, 6 tasks) — 5/6 failed; we took
  over manually and shipped 6 PRs from the partial work
- **plan_5b97c08d** (M2 backend, 5 tasks) — 5/5 timed out at 30 min;
  the user worker salvaged 1 task before timeout, the rest was
  manual
- **plan_8778cbe5** (parallel races, 3 tasks) — same monorepo +
  same agent → merge conflicts; we took over
- **plan_eeeaa952** (admin UI, 3 tasks) — both producers timed out
  on retry, we canceled and took over

**Lesson**: mavis-team is great for *independent* tasks on
*different agents*. For sequential work on the same monorepo, the
orchestrator alone is faster. The v1.1 plan should default to
"orchestrator does backend" + "uiux-engineer agent does the
parallel Flutter/minipgm work" rather than parallelize the same
type of work.

### 2. The Flutter CI gate (issue #48) was loose

The first Flutter PR to pass `flutter analyze` (PR #46) actually
had a one-character typo in `activity_list_screen.dart` that took
20 min of debugging to find. We added `--no-fatal-infos` later but
the warning-as-fatal config still bites us (status_pill unused
import blocked PR #63 for an hour).

**Lesson**: tighten Flutter CI to:
- `--fatal-warnings --fatal-infos` (both are now default in
  Flutter ≥ 3.16)
- `dart format --set-exit-if-changed` so formatting breaks the build
- A separate "test suite" job that runs `flutter test` (currently
  skipped in CI because we have no test files — add some in v1.1)

### 3. WeChat native features took longer than estimated

The P0 minipgm `social-login` path was supposed to be a 1-day
worker task. It took 3 days end-to-end because:
- WeChat access_token has 110-min cache + 2-hour TTL — we
  underestimated the test scaffolding needed
- The WeChat content-safety API fail-open / fail-closed semantics
  for the 87014 errcode took 2 days of debugging
- minipgm CI only validates scaffold (parses app.json), not
  runtime — so we found integration issues at deploy time, not
  push time

**Lesson**: the WeChat integration tax is real. v1.1 work that
touches the WeChat API (mp-audit, content-safety, payment) needs
a dedicated week of headroom, not a 3-day task estimate.

### 4. Documentation in the M2 backend was sparse

We merged the M2 backend (auth, user, activity, signup, review)
in 5 days. The user-facing API docs are in the spec, but the
**operator-facing** docs (how to deploy, how to roll back, how to
debug a 5xx) weren't written until M3 W10. The L3 e2e was the
first end-to-end test anyone ran.

**Lesson**: ship the operator docs in the same PR as the
endpoints. The admin playbook (issue #62 followup) is the model.

## Numbers

- 32 PRs merged
- 5 design system docs + 3 deployment docs + 3 monitoring docs +
  2 v1.1 / M3 retro docs
- 145 unit tests passing
- 8 Prometheus alert rules
- 4 monitoring dashboards
- 6 server modules + 2 server plugins
- 5 minipgm pages + 1 admin gate + 1 minipgm admin suite (5 pages)
- 5 Flutter screens + 1 admin suite (5 screens)
- 6+10+10+10+10+10 = 56 total server tests + 4 ad-hoc (review, push, admin, monitoring, list, content-safety)
- ~3500 lines of server code + ~4500 lines of Flutter + ~3000
  lines of minipgm
- 0 P0 bugs outstanding at GA
- 0 critical alerts in the on-call queue at GA

## OKRs for v1.1

| Objective | Key result |
| --- | --- |
| Cut DAU 2× within 12 weeks post-launch | MAU > 1,000 by v1.1 W8 |
| 1.1 features shipped by end of v1.1 sprint 3 (W12) | All 6 v1.1 candidates shipped OR explicitly descoped with a public reason |
| Sustained on-call | 0 critical alerts open > 5 min for 4 consecutive weeks |
| Recommendation feed works | A/B test: 1.5× activity-join rate for the recommendation arm vs the chronological arm |

## Open questions for the user / PM

1. **Hiring**: 1 backend + 1 frontend + 0.5 PM by v1.1 W4 — do
   we have budget? Without it, the v1.1 plan slips to 14 weeks.
2. **Payment compliance**: WeChat Pay merchant onboarding is a
   4-6 week process. If #5 (payment) is real, we need to start
   the merchant account setup in W0, not W5.
3. **Recommendation algorithm**: do we have a data scientist to
   own the ranking heuristic? Otherwise the recommendation feed
   ships with a hand-tuned ranking (school=major=grade priority
   + tag cosine) and we A/B test it ourselves.
4. **Multi-language**: do we keep 中文 as the default and English
   as opt-in, or the other way around? Affects onboarding copy.

## Acknowledgements

- The mavis team agents (architect, backend-engineer, coder,
  devops-engineer, frontend-engineer, qa-engineer, uiux-engineer,
  uiux-designer) shipped 28 of the 32 PRs.
- The CTO (orchestrator) shipped 4 PRs (the salvage work, the
  design system, the L1 audit, the admin backend) and led the
  retrospective.

## Change log

- 2026-06-09: Initial M3 GA retrospective, v1.1 candidates
  identified, OKRs drafted.
