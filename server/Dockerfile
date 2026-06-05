# =====================================================================
# StudyBuddy Server — multi-stage Dockerfile
# Target: < 200 MB final image, Node 20 LTS.
# Stages:
#   deps    — installs all (dev + prod) dependencies
#   build   — prisma generate + tsc → dist/
#   runtime — production-only deps + compiled output, non-root user
# =====================================================================

# ---- 1. deps ----
FROM node:20-alpine AS deps
WORKDIR /app

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# libc6-compat for Prisma's native engine on Alpine.
RUN apk add --no-cache libc6-compat

# Copy only manifests first to leverage layer caching.
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ---- 2. build ----
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and compile TypeScript
RUN pnpm prisma generate
RUN pnpm build

# Prune dev deps so the runtime image is small.
RUN pnpm prune --prod

# ---- 3. runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# pnpm is still useful for the `migrate:deploy` step in CMD.
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN apk add --no-cache libc6-compat openssl tini

# Run as non-root.
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy compiled output + production deps + Prisma client + schema.
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs
EXPOSE 3000

# tini = proper PID 1, forwards SIGTERM to node for graceful shutdown.
ENTRYPOINT ["/sbin/tini", "--"]

# Apply pending migrations, then start the server. Override CMD
# (`docker run --entrypoint ...`) to skip migrations if you ship a
# schema snapshot or run migrations from CI.
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/server.js"]
