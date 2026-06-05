#!/usr/bin/env bash
# dev-down.sh — 停止本地数据依赖（保留数据卷）
# 不删除数据卷，下次 dev-up 还能用。
set -euo pipefail

cd "$(dirname "$0")/.."  # → repo root
REPO_ROOT="$(pwd)"

echo "🛑 Pairhub 本地环境停止..."

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker 未安装"
  exit 1
fi

# 优先用 docker compose
if docker compose version >/dev/null 2>&1; then
  docker compose -f "${REPO_ROOT}/infra/docker-compose.yml" stop postgres redis server 2>/dev/null || true
  docker compose -f "${REPO_ROOT}/infra/docker-compose.yml" rm -f -v postgres redis server 2>/dev/null || true
fi

# 兜底：直接用 docker stop
for name in pairhub-pg pairhub-redis pairhub-server; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
    echo "🛑 停止 ${name}..."
    docker rm -f "${name}" >/dev/null 2>&1 || true
  fi
done

echo "✅ 本地环境已停止（数据卷已保留：pairhub_pgdata）"
echo "   如需彻底清理数据：  docker volume rm pairhub_pgdata"
