# StudyBuddy Backend (Scaffold)

> Node.js 20 + TypeScript 5 + Fastify 4 + Prisma 5 + PostgreSQL 16 + Redis 7
> 配套文档：[docs/spec-v0.2.md](../../docs/spec-v0.2.md), [docs/api/conventions.md](../../docs/api/conventions.md), [docs/server/dev-setup.md](../../docs/server/dev-setup.md), [docs/server/api-style.md](../../docs/server/api-style.md)

## 快速开始

```bash
# 1) 启动 PostgreSQL + Redis（用 docker compose）
cd ..
docker compose -f infra/docker-compose.yml up -d postgres redis

# 2) 装依赖 + 准备环境
cd server
pnpm install
cp .env.example .env
# 编辑 .env：填 JWT_SECRET（必填，>= 32 字符）

# 3) 数据库迁移 + 种子
pnpm prisma:generate
pnpm prisma:migrate        # 首次会要求命名 migration（建议 init）
pnpm prisma:seed           # 可选：插入 demo 数据

# 4) 启动 dev server
pnpm dev                   # http://localhost:3000
```

## 端点（Scaffold 阶段）

| Method | Path | 用途 | 鉴权 |
|--------|------|------|------|
| GET    | `/health` `/api/health` | Liveness（进程存活） | 无 |
| GET    | `/ready`  `/api/ready`  `/api/health/ready` | Readiness（DB+Redis 可达） | 无 |

> 业务端点（auth、activities、users）在 M1-W2 加入。`src/plugins/auth.ts`
> 已就绪，业务模块可调用 `app.authenticate` 进行 JWT 校验。

## 常用命令

```bash
pnpm dev                   # 开发模式（tsx watch）
pnpm build                 # 编译 TypeScript → dist/
pnpm start                 # 运行 dist/server.js
pnpm typecheck             # tsc --noEmit
pnpm lint                  # eslint
pnpm lint:fix              # eslint --fix
pnpm format                # prettier --write
pnpm test                  # vitest run
pnpm test:watch            # vitest
pnpm prisma:studio         # 打开 Prisma Studio (http://localhost:5555)
pnpm verify                # typecheck + lint + test（CI 等价）
```

## 目录结构

```
server/
├── src/
│   ├── server.ts                  # 启动入口 + 优雅关闭
│   ├── lib/
│   │   ├── app.ts                 # buildApp() 工厂（测试用）
│   │   ├── env.ts                 # zod 校验的环境变量
│   │   ├── logger.ts              # pino 结构化日志
│   │   ├── prisma.ts              # PrismaClient 单例
│   │   ├── redis.ts               # ioredis 单例
│   │   ├── errors.ts              # AppError + 子类
│   │   └── fastify.d.ts           # Fastify 类型扩展
│   ├── plugins/
│   │   ├── auth.ts                # JWT 校验 + authenticate hook
│   │   ├── cors.ts                # CORS
│   │   ├── error-handler.ts       # 全局错误处理 (RFC 7807)
│   │   └── rate-limit.ts          # Redis 限流
│   └── modules/
│       └── health/                # /health, /ready
├── prisma/
│   ├── schema.prisma              # User/Activity/Signup/Review
│   ├── seed.ts                    # 演示数据
│   └── migrations/
├── tests/                         # 单元测试
├── Dockerfile                     # 多阶段构建
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc
├── .nvmrc
├── .env.example
└── README.md
```

## 部署

```bash
# 多阶段镜像（runtime 镜像 < 200MB）
docker build -t studybuddy-server:latest .

docker run -p 3000:3000 --env-file .env studybuddy-server:latest
```

或用根目录的 `docker compose`：

```bash
docker compose -f infra/docker-compose.yml up -d
```

## 待办（Scaffold 不实现，留给 M1-W2+）

- [ ] 微信登录（POST /api/auth/wx-login）
- [ ] 创建/查询活动（POST/GET /api/activities）
- [ ] 报名/取消报名（POST/DELETE /api/activities/:id/signup）
- [ ] 当前用户（GET /api/users/me）
- [ ] 接入微信内容安全 API（异步过滤）
- [ ] Cron Worker：活动状态机自动迁移
- [ ] OpenAPI spec 自动生成
- [ ] PostGIS 升级（地理筛选优化）
