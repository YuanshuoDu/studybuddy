# StudyBuddy 后端 — 本地开发手册

> 配套：[`../spec-v0.2.md`](../spec-v0.2.md), [`../api/conventions.md`](../api/conventions.md), [`api-style.md`](./api-style.md)
>
> 目标读者：第一次接触 StudyBuddy 后端的工程师。按本文档从 0 到跑通 curl /health 约 10 分钟。

## 0. 准备工具

| 工具 | 版本 | 验证命令 |
|------|------|----------|
| Node.js | **20 LTS**（`.nvmrc` 锁定） | `node -v` |
| pnpm   | **9.x**（`package.json` 锁定） | `pnpm -v` |
| Docker | 24+（含 compose v2） | `docker --version`、`docker compose version` |
| Git   | 2.30+ | `git --version` |
| PostgreSQL 客户端 | 16（可选，调试用） | `psql --version` |
| Redis 客户端 | 7（可选，调试用） | `redis-cli --version` |

> **不要用 npm 或 yarn。** 项目锁定 pnpm 9（`packageManager` 字段）。混用包管理器会导致 `pnpm-lock.yaml` 漂移。

## 1. 拉代码

```bash
git clone https://github.com/YuanshuoDu/studybuddy.git
cd studybuddy
git checkout feat/issue-3-server-scaffold   # 或 main
```

## 2. 启动数据依赖

```bash
./infra/dev-up.sh
```

会启动：
- `studybuddy-pg`  — PostgreSQL 16，端口 5432，账号 `studybuddy/studybuddy`
- `studybuddy-redis` — Redis 7，端口 6379，无密码

数据落在 docker volume `studybuddy_pgdata` / `studybuddy_redisdata`，删除容器不会丢数据。

**停止**：`./infra/dev-down.sh`（保留数据）；要彻底清理追加 `docker volume rm studybuddy_pgdata studybuddy_redisdata`。

## 3. 装依赖 + 准备环境

```bash
cd server
pnpm install
cp .env.example .env
```

编辑 `.env`，**至少改这两个值**：

```dotenv
JWT_SECRET=$(openssl rand -base64 48)        # 至少 32 字符
DATABASE_URL=postgresql://studybuddy:studybuddy@localhost:5432/studybuddy
REDIS_URL=redis://localhost:6379
```

> 启动时 `src/lib/env.ts` 会用 zod 校验，缺 / 错 / 短于 32 字符的 `JWT_SECRET` 会**直接退出**——这是故意的，比启动后报 500 强。

## 4. 初始化数据库

```bash
pnpm prisma:generate       # 生成 Prisma client（首次必跑）
pnpm prisma:migrate        # 首次会要求输入 migration 名字，建议填 init
pnpm prisma:seed           # 可选：插入 Alice / Bob / Carol + 2 个 demo 活动
```

`pnpm prisma:studio` 打开 Prisma Studio（默认 http://localhost:5555），可以 GUI 看三张表（User / Activity / Signup，Review 暂空）。

## 5. 启动 dev server

```bash
pnpm dev
```

预期输出（节选）：

```
✅ PostgreSQL connection ok
✅ Redis connection ok
{"level":30,"time":"...","service":"studybuddy-server","env":"development","msg":"Server listening at http://0.0.0.0:3000"}
```

## 6. 验证

```bash
# Liveness：只验证进程存活，不查依赖
curl -i http://localhost:3000/health

# Readiness：查 Postgres + Redis
curl -i http://localhost:3000/ready
```

预期：
- `/health` → `200 OK`，body `{"status":"ok","service":"studybuddy-server",...}`
- `/ready`  → `200 OK`，body `{"status":"ready","checks":{"postgres":{"status":"ok",...},"redis":{"status":"ok",...}}}`

**故意制造失败**：

```bash
docker stop studybuddy-pg
curl -i http://localhost:3000/ready   # 应返回 503，postgres check = fail
docker start studybuddy-pg
```

停掉 Redis 同样会触发 `/ready` 503 —— 这是 readiness 探针的本意。

## 7. 常用命令速查

| 类别 | 命令 | 作用 |
|------|------|------|
| 启动 | `pnpm dev` | 开发模式（tsx watch，文件变更自动重启） |
| 启动 | `pnpm build && pnpm start` | 生产模式（先编译再跑 dist/） |
| 质量 | `pnpm typecheck` | TS 严格模式（无 emit） |
| 质量 | `pnpm lint` | ESLint 9 flat config |
| 质量 | `pnpm format` | Prettier 写入 |
| 质量 | `pnpm test` | Vitest 单测（无 DB 也能跑：health test mock 了 ping） |
| 质量 | `pnpm verify` | typecheck + lint + test（CI 等价） |
| 数据库 | `pnpm prisma:generate` | 生成 client |
| 数据库 | `pnpm prisma:migrate` | 开发期迁移（交互） |
| 数据库 | `pnpm prisma:migrate:deploy` | 生产期迁移（CI/CD） |
| 数据库 | `pnpm prisma:studio` | GUI 浏览器（http://localhost:5555） |
| 数据库 | `pnpm prisma:seed` | 插入 demo 数据 |
| Docker | `docker compose -f infra/docker-compose.yml up -d` | 全栈本地 |
| Docker | `docker compose -f infra/docker-compose.yml logs -f app` | 看 app 日志 |
| Docker | `docker compose -f infra/docker-compose.yml down` | 停 |

## 8. 调试技巧

### 8.1 单元测试 watch

```bash
pnpm test:watch
```

`tests/health.test.ts` 已经覆盖了 `/health` 和 `/ready` 的全部分支。改 `src/lib/` 后这条测试会失败——这是好事。

### 8.2 单独跑某个测试

```bash
pnpm test -- tests/health.test.ts
pnpm test -- -t "returns 503 when Postgres is unreachable"
```

### 8.3 调试 TS

VSCode 装 "JavaScript Debugger" 扩展，然后在 `src/server.ts` 打红点 → `pnpm dev` 即可命中。

或者用 `tsx --inspect`:

```json
// .vscode/launch.json（可选，提交进 .gitignore）
{
  "configurations": [
    { "type": "node", "request": "attach", "name": "Attach", "port": 9229 }
  ]
}
```

```bash
# 改 package.json: "dev:debug": "tsx watch --inspect=0.0.0.0:9229 src/server.ts"
```

### 8.4 跟踪 Prisma SQL

```bash
# 临时把 prisma 日志开到 query
DEBUG="prisma:query" pnpm dev
```

### 8.5 跟踪 Redis

```bash
# 在另一个终端看所有 redis 命令
docker exec studybuddy-redis redis-cli MONITOR
```

### 8.6 看 fastify 路由

dev 模式启动时会自动 `fastify-print-routes` 打印所有路由到 stdout，便于确认新加的 route 确实注册了。

## 9. 常见问题

### `pnpm install` 报 `ERR_PNPM_PEER_DEP_ISSUES`
一般是因为混用了 `npm i` 装过依赖。先 `rm -rf node_modules pnpm-lock.yaml`，再 `pnpm install`。

### `prisma migrate dev` 报 `Can't reach database server`
PostgreSQL 没起。跑 `./infra/dev-up.sh` 或 `docker compose -f infra/docker-compose.yml up -d postgres`。

### `/ready` 一致返回 503
看 app 日志里 `redis client error` / `PostgreSQL connection failed` 的具体报错。多半是 `REDIS_URL` / `DATABASE_URL` 不对，或依赖容器没起。

### `JWT_SECRET must be at least 32 characters`
`.env` 里 `JWT_SECRET` 太短或没设。`openssl rand -base64 48` 重新生成。

### `fastify-plugin` 类型缺失
我们用了 fp() 包装自定义 plugin——确保 `fastify-plugin` 在 dependencies（不是 devDependencies），本项目已正确放置。

## 10. 提交代码前 checklist

- [ ] `pnpm verify`（typecheck + lint + test）全绿
- [ ] 新增表 → 提交 `prisma/migrations/<ts>_<name>/migration.sql`
- [ ] 新增 env var → 同步 `.env.example` 并更新 `src/lib/env.ts` 的 zod schema
- [ ] 业务逻辑（CRUD 等）不在这期 PR 范围——放给 M1-W2 的 [server] 业务模块 PR
- [ ] PR body 第一行 `Closes #3`
- [ ] PR 描述贴：`pnpm verify` 截图 + `curl /health` 截图 + `curl /ready` 截图 + `pnpm prisma studio` 三张表截图
