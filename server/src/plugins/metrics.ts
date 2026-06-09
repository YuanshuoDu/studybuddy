/**
 * Fastify metrics plugin — issue #34.
 *
 * Wires the prom-client metrics declared in `lib/metrics.ts` to every
 * request. For each request we record:
 *   - duration histogram (per route + status class)
 *   - request counter (per route + status class)
 *   - in-flight gauge
 *
 * Route normalization is delegated to `lib/metrics.ts:routeLabel` so
 * cardinality stays bounded.
 *
 * The plugin does NOT expose `/metrics` itself — that's `modules/monitoring`.
 * This separation lets us add a separate auth gate (Bearer token) on
 * the metrics endpoint without affecting every request.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import {
  httpRequestDuration,
  httpRequestsInFlight,
  httpRequestsTotal,
  routeLabel,
  statusClass,
} from '@/lib/metrics.js';

const metricsPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (req) => {
    httpRequestsInFlight.inc();
    // Stash a per-request start time on the request object so we can
    // measure the FULL request lifecycle (including body parse +
    // preHandler) in the onResponse hook.
    (req as unknown as { _metricsStartHrTime: bigint })._metricsStartHrTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    const start = (req as unknown as { _metricsStartHrTime?: bigint })._metricsStartHrTime;
    const seconds = start ? Number(process.hrtime.bigint() - start) / 1e9 : 0;
    const route = routeLabel(req.url, (req.routeOptions as { url?: string } | undefined)?.url);
    const cls = statusClass(reply.statusCode);
    const method = req.method;
    httpRequestDuration.observe({ method, route, status_class: cls }, seconds);
    httpRequestsTotal.inc({ method, route, status_class: cls });
    httpRequestsInFlight.dec();
  });

  // onRequest abort (e.g. client disconnect) — still need to decrement
  // the in-flight gauge so it doesn't drift.
  app.addHook('onRequestAbort', async (req) => {
    httpRequestsInFlight.dec({ method: req.method });
  });
};

export default fp(metricsPlugin, { name: 'metrics-plugin', dependencies: [] });
