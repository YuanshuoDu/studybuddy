# Pairhub 后端 — API 风格指南

> 配套：[`../api/conventions.md`](../api/conventions.md)（v0.2 RFC 7807 契约）
>
> 本文是"如何在代码里落地"：命名、错误抛出、Zod schema 复用、分页形状。

## 1. 路由命名

- 路径前缀 `/api/`，**复数**资源。
- 子资源用嵌套（不是 query string）：`/api/activities/:id/signups`
- 不出现动词：`POST /api/activities` 优于 `POST /api/createActivity`
- 鉴权接口归到 `/api/auth/*`：`/api/auth/wx-login`、`/api/auth/refresh`

## 2. 路由注册模板

```ts
// src/modules/activity/activity.routes.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createActivityBody = z.object({
  type: z.enum(['STUDY', 'SPORTS', 'BOARD_GAME', 'ONLINE_GAME', 'OTHER']),
  title: z.string().min(5).max(100),
  description: z.string().min(10).max(2000),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  // ...
});

const idParams = z.object({ id: z.string().cuid() });

export async function registerActivityRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/activities',
    {
      // Zod schema via fastify-type-provider-zod (optional) OR use
      // .safeParse manually as below.
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const parsed = createActivityBody.safeParse(req.body);
      if (!parsed.success) {
        // error-handler plugin will translate Zod errors to 400
        throw new ValidationError(parsed.error.flatten().fieldErrors);
      }
      const userId = req.userId!; // preHandler guarantees this
      // ... persist + return
    },
  );
}
```

## 3. 错误抛出（永远用 `throw`，不要 `reply.send`）

| 场景 | 抛出 | HTTP | code |
|------|------|------|------|
| Zod / 入参不合法 | `new ValidationError(details)` | 400 | `VALIDATION_ERROR` |
| 缺 token / token 过期 | `new UnauthorizedError(msg)` | 401 | `UNAUTHORIZED` |
| 已登录但权限不够 | `new ForbiddenError(msg)` | 403 | `FORBIDDEN` |
| 资源不存在 | `new NotFoundError('ACTIVITY_NOT_FOUND', '活动不存在')` | 404 | 资源级 code |
| 重复报名 / 状态冲突 | `new ConflictError('ALREADY_SIGNED_UP', ...)` | 409 | 资源级 code |
| 业务规则违反 | `new BusinessRuleError('NOT_RECRUITING', ...)` | 422 | 资源级 code |
| 限流 | `@fastify/rate-limit` 自动返回 429 | 429 | `RATE_LIMIT_EXCEEDED` |
| 兜底 | 不抛 —— 走 error handler 的 500 分支 | 500 | `INTERNAL_ERROR` |

错误响应（自动由 `src/plugins/error-handler.ts` 产生）：

```json
{
  "type": "https://Pairhub.example.com/errors/activity-not-found",
  "title": "NotFoundError",
  "status": 404,
  "detail": "活动不存在",
  "instance": "/api/activities/abc123",
  "code": "ACTIVITY_NOT_FOUND"
}
```

## 4. 成功响应

### 4.1 单资源

```ts
return reply.code(200).send({ data: serializeActivity(activity) });
```

### 4.2 列表（强制分页）

```ts
return reply.send({
  data: items.map(serializeActivity),
  pagination: {
    page: q.page,
    page_size: q.pageSize,
    total,
    has_more: skip + items.length < total,
  },
});
```

分页参数约定：
- `?page=1&page_size=20`（**下划线** `page_size`，对齐 docs/api/conventions.md）
- `page_size` 上限 100，默认 20
- 响应中 `pagination.page_size` **回显**客户端传的值
- `has_more = page * page_size < total`

### 4.3 创建

```ts
return reply.code(201).send({ data: serializeActivity(created) });
```

**永远不返回 200 + data 的"伪 201"**——前端靠 status 区分更新 vs 创建。

## 5. Zod 校验复用

**业务模块内**的 schema 应该独立定义（不直接 import 路由文件的 zod 对象）。
**横切**校验（如 cuid、datetime、地理坐标）放 `src/lib/validators.ts`：

```ts
// src/lib/validators.ts
import { z } from 'zod';

export const cuidParam = z.object({ id: z.string().cuid() });

export const isoDatetime = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));

export const gcj02Coord = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
```

## 6. 鉴权

```ts
// 公开接口
app.get('/api/activities', async (req, reply) => { /* ... */ });

// 需要登录
app.post(
  '/api/activities',
  { preHandler: [app.authenticate] },
  async (req, reply) => {
    const userId = req.userId;     // 已被 authenticate 填充
    // ...
  },
);

// 需要登录 + 是资源创建者
app.delete(
  '/api/activities/:id',
  { preHandler: [app.authenticate, requireActivityOwner] },
  handler,
);
```

`requireActivityOwner` 这种二次校验放 `src/modules/<module>/<module>.guards.ts`，
避免把所有 guard 堆在一个 `guards.ts` 里。

## 7. 数据库访问

- 路由里**不直接写** Prisma——包到 `src/modules/<module>/<module>.service.ts`。
- 事务用 `app.prisma.$transaction(async (tx) => { ... })`，不要传字符串数组（Prisma 5 已不推荐）。
- 高频查询加 `@@index`——schema 改完跑 `pnpm prisma migrate dev` 才会真的建上。

## 8. 日志

- 路由 handler **不打印 info 级日志**（Fastify 已经打了请求行）。
- 错误一律 `throw`，让 `error-handler` 插件统一打 `error` 级别 + 响应。
- 业务关键事件用结构化字段：

```ts
req.log.info({ userId, activityId, currentCount }, 'signup succeeded');
```

避免 `req.log.info(\`user ${userId} signed up for ${activityId}\`)`——人话不可搜索。

## 9. 测试

- **每个新端点 = 1 个 happy path + 至少 2 个 error path 测试**。
- 用 `app.inject()` 跑路由（不需要真起 server）：

```ts
const res = await app.inject({
  method: 'POST',
  url: '/api/activities',
  headers: { authorization: `Bearer ${token}` },
  payload: { /* ... */ },
});
expect(res.statusCode).toBe(201);
```

- 涉及 DB 的测试用 **testcontainers** 或单独建一个 `Pairhub_test` 数据库。
  本期没集成测试，仅 `/health` `/ready` 路径——下一期引入。

## 10. 迁出 Scaffold 范围

本期 PR **不**包含：
- 真实 `auth.ts` 业务（保留 plugin 框架）
- 真实 `activities.ts` 业务（保留 plugin 框架）
- 用户注册 / 修改资料 / 头像上传
- 微信 AppID/Secret 集成
- 微信内容安全 API
- 订阅消息推送
- Cron worker

M1-W2 的 PR 会一次性把这些端点补齐。
