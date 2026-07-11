#!/usr/bin/env bash
# dev-up.sh — 本地开发环境一键启动
# 启动 PostgreSQL + Redis（docker），等待就绪，打印连接信息
# 注意：只启动数据依赖；后端 app 用 `cd server && pnpm dev` 启。
set -euo pipefail

cd "$(dirname "$0")/.."  # → repo root
REPO_ROOT="$(pwd)"

echo "🚀 Pairhub 本地环境启动..."

# --- 检查 docker ---
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker 未安装，请先安装 Docker"
  exit 1
fi

# --- 优先用 docker compose (一个命令起 PG + Redis) ---
if docker compose version >/dev/null 2>&1; then
  echo "📦 使用 docker compose 启动 postgres + redis ..."
  docker compose -f "${REPO_ROOT}/infra/docker-compose.yml" up -d postgres redis

  echo "⏳ 等待 PostgreSQL 就绪..."
  for i in {1..30}; do
    if docker exec Pairhub-pg pg_isready -U Pairhub >/dev/null 2>&1; then
      echo "✅ PostgreSQL 已就绪"
      break
    fi
    sleep 1
  done

  echo "⏳ 等待 Redis 就绪..."
  for i in {1..30}; do
    if docker exec Pairhub-redis redis-cli ping >/dev/null 2>&1; then
      echo "✅ Redis 已就绪"
      break
    fi
    sleep 1
  done
else
  # --- 退化路径：老版 docker-compose ---
  echo "📦 docker compose plugin 未找到，用 docker run 启动 ..."
  CONTAINER_PG=Pairhub-pg
  if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_PG}$"; then
    docker run -d \
      --name ${CONTAINER_PG} \
      -e POSTGRES_USER=Pairhub \
      -e POSTGRES_PASSWORD=Pairhub \
      -e POSTGRES_DB=Pairhub \
      -p 5432:5432 \
      -v Pairhub_pgdata:/var/lib/postgresql/data \
      postgres:16
  else
    docker start ${CONTAINER_PG}
  fi

  CONTAINER_REDIS=Pairhub-redis
  if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_REDIS}$"; then
    docker run -d \
      --name ${CONTAINER_REDIS} \
      -p 6379:6379 \
      redis:7
  else
    docker start ${CONTAINER_REDIS}
  fi

  echo "⏳ 等待 PostgreSQL 就绪..."
  for i in {1..30}; do
    if docker exec ${CONTAINER_PG} pg_isready -U Pairhub >/dev/null 2>&1; then
      echo "✅ PostgreSQL 已就绪"
      break
    fi
    sleep 1
  done

  echo "⏳ 等待 Redis 就绪..."
  for i in {1..30}; do
    if docker exec ${CONTAINER_REDIS} redis-cli ping >/dev/null 2>&1; then
      echo "✅ Redis 已就绪"
      break
    fi
    sleep 1
  done
fi

cat <<EOF

🎉 本地环境就绪：
  DATABASE_URL=postgresql://Pairhub:Pairhub@localhost:5432/Pairhub
  REDIS_URL=redis://localhost:6379

下一步：
  cd server
  pnpm install
  cp .env.example .env          # 记得改 JWT_SECRET
  pnpm prisma:generate
  pnpm prisma:migrate           # 首次需要给 migration 起名（如 init）
  pnpm prisma:seed              # 可选：demo 数据
  pnpm dev                      # http://localhost:3000

验证：
  curl http://localhost:3000/health
  curl http://localhost:3000/ready

EOF
