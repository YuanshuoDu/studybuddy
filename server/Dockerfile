# =====================================================================
# Pairhub Server — multi-stage Dockerfile
# Target: < 500 MB final image, Node 20 LTS.
#
# Stages:
#   build     — installs all (dev + prod) deps with pnpm, runs prisma
#               generate + tsc -> dist/. The dev workflow uses pnpm
#               (see packageManager in package.json); the docker
#               build uses pnpm so the lockfile already in source
#               control is honoured.
#   runtime   — node:20-alpine + libc6-compat + openssl + tini. Uses
#               `npm install --omit=dev --omit=optional` to get a
#               flat prod-only node_modules without pnpm's virtual
#               store, then strips cross-arch native binaries from
#               @sentry/profiling-node and @prisma/engines.
#
# Why this is the lowest-size, lowest-friction layout:
#   * pnpm `prune --prod` doesn't drop the .pnpm virtual store, so
#     the runtime node_modules still has 100+ MB of devDep transitives.
#   * `pnpm deploy` requires a workspace (server isn't one).
#   * `npm install --omit=dev --omit=optional` is the cleanest way
#     to skip optionalDependencies (where @sentry/profiling-node +
#     @prisma/engines per-arch native binaries live) and devDeps.
#   * `pino-pretty` is in prod (one-line log formatting in dev). In
#     a strict prod image it could be devDep; the saving would be ~5 MB.
#
# distroless note:
#   We tried gcr.io/distroless/nodejs20-debian12:nonroot for the
#   runtime to shave base size, but distroless has no shell, so the
#   `RUN npm install ...` step can't execute. Workarounds (use
#   buildkit `RUN --mount=type=cache,target=/root/.npm` to install
#   in a sidecar) added enough complexity to not be worth the
#   ~10 MB additional saving. We stayed on node:20-alpine and rely
#   on the strip pass + the relaxed cap (500 MB) to keep the image
#   within budget.
#
# Migrations:
#   Run from a compose-level init container
#   (`infra/docker-compose.yml: pairhub-migrate`) so the server image
#   does not need the prisma CLI installed at runtime. To run
#   migrations out-of-band: `docker run --rm --network pairhub_pairhub \
#   <image> npx prisma migrate deploy`.
# =====================================================================

# ---- 1. build ----
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apk add --no-cache libc6-compat openssl

# Install ALL deps (dev + prod) so we can run prisma generate + tsc.
COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma generate \
 && pnpm build

# ---- 2. runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Runtime libs: libc6-compat (for Prisma engine), openssl (for sentry),
# tini (PID 1 to forward SIGTERM).
RUN apk add --no-cache libc6-compat openssl tini

# Run as non-root.
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# `npm install --omit=dev --omit=optional` produces a flat prod-only
# node_modules. We do NOT use `npm ci` (no package-lock.json in
# source) — the prod dep versions are pinned in package.json so npm
# resolves to the same tree every time.
COPY package.json ./
RUN npm install --omit=dev --omit=optional --no-audit --no-fund --ignore-scripts

# Strip the cross-platform native binaries that npm installs
# unconditionally. The runtime only needs linux-x64-musl; the rest
# are dead weight in the image.
RUN set -eux; \
  echo "=== node_modules size BEFORE strip ===" ; \
  du -sh /app/node_modules ; \
  echo "=== top-20 heaviest packages BEFORE strip ===" ; \
  du -sh /app/node_modules/* 2>/dev/null | sort -rh | head -20 ; \
  # @sentry/profiling-node ships per-arch .node binaries under lib/.
  # Keep only linux-x64-musl (our runtime target).
  find /app/node_modules -path '*/@sentry/profiling-node/lib/*' -type f ! -name '*linux-x64-musl*' -delete 2>/dev/null || true ; \
  # @prisma/engines ships query-engine + migration-engine per-arch
  # binaries. Keep only linux-musl; everything else is dead weight.
  find /app/node_modules -path '*/@prisma/engines/*' -type f ! -name '*linux-musl*' -delete 2>/dev/null || true ; \
  # Also drop the prisma engines per-arch subdirs.
  find /app/node_modules/@prisma/engines -mindepth 1 -type d ! -name 'engines' ! -name '*linux-musl*' -exec rm -rf {} + 2>/dev/null || true ; \
  # Strip dev-only .map files in the runtime image.
  find /app/node_modules -name '*.map' -delete 2>/dev/null || true ; \
  # Remove npm's caches that it sometimes leaves.
  rm -rf /app/node_modules/.cache /app/node_modules/.bin/.cache ; \
  echo "=== node_modules size AFTER strip ===" ; \
  du -sh /app/node_modules ; \
  echo "=== top-20 heaviest packages AFTER strip ===" ; \
  du -sh /app/node_modules/* 2>/dev/null | sort -rh | head -20 ; \
  echo "Image-prep: stripped cross-platform native binaries."

# Copy the compiled output + the Prisma schema (for any runtime
# introspection; no CLI to run migrations here).
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma

USER nodejs
EXPOSE 3000

# tini = proper PID 1, forwards SIGTERM to node for graceful shutdown.
ENTRYPOINT ["/sbin/tini", "--"]

# See header for the migrations story.
CMD ["node", "dist/server.js"]
