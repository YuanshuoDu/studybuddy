# =====================================================================
# Pairhub Server — multi-stage Dockerfile
# Target: < 200 MB final image, Node 20 LTS.
#
# Stages:
#   build   — installs all (dev + prod) deps, runs prisma generate +
#             tsc -> dist/, then `pnpm deploy` flattens prod deps into
#             /app/deps/node_modules (drops .pnpm virtual store).
#   runtime — pulls the flattened prod node_modules + compiled output,
#             non-root user, no prisma CLI installed.
#
# Optimisations vs the previous 3-stage layout that produced 307 MB:
#   1. `pnpm deploy` flattens prod deps into /app/deps/node_modules
#      without the .pnpm virtual-store metadata, saving ~50 MB.
#   2. The runtime image installs only `node` + `tini` + `libc6-compat`
#      + `openssl`; no corepack / pnpm (we don't run `prisma migrate
#      deploy` from the server image anymore — it moved to a compose
#      init container; see infra/docker-compose.yml).
#   3. .dockerignore excludes tests, .git, .github, build outputs,
#      source maps, env files (so secrets can't be baked in).
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

# Flatten prod deps into a self-contained /app/deps that the runtime
# stage can COPY. `pnpm deploy` produces a normal node_modules without
# the .pnpm virtual-store, which is the main size win.
RUN pnpm deploy /app/deps \
 && rm -rf /app/deps/node_modules/.cache /app/deps/node_modules/.bin/.cache

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

# Copy the flattened prod node_modules (from `pnpm deploy`) — the
# Prisma generated client lives at node_modules/.prisma/client, so the
# runtime doesn't need `prisma generate`.
COPY --from=build --chown=nodejs:nodejs /app/deps/node_modules ./node_modules

# Copy the compiled output + the Prisma schema (for any runtime
# introspection; no CLI to run migrations here).
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs
EXPOSE 3000

# tini = proper PID 1, forwards SIGTERM to node for graceful shutdown.
ENTRYPOINT ["/sbin/tini", "--"]

# Migrations are run from the compose-level init container
# (`infra/docker-compose.yml: pairhub-migrate`) so the server image
# itself does not need the prisma CLI installed at runtime. To run
# migrations out-of-band: `docker run --rm --network pairhub_pairhub \
#   <image> node node_modules/@prisma/engines/migrate-deploy.cjs`.
CMD ["node", "dist/server.js"]
