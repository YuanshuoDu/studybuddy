# Pairhub — 项目文档(产品/功能/架构 全景)

> **目的**:让任何团队成员(产品/设计/前端/后端/QA/运营)用一份文档就能完整理解 Pairhub 这个产品在做什么、怎么做、做到哪一步、下一步往哪走。
>
> **配套文档**:
> - UIUX 重设计指南:[`UIUX-GUIDE.md`](./UIUX-GUIDE.md)
> - 需求规约:[`spec-v0.2.md`](./spec-v0.2.md)
> - 架构总览:[`architecture-v1.0.md`](./architecture-v1.0.md)
> - API 规范:[`api/v1.md`](./api/v1.md)
> - 设计系统:[`design/system-v1.md`](./design/system-v1.md)
> - 组件规范:[`design/components.md`](./design/components.md)
> - Admin 视觉规范:[`design/admin-glass.md`](./design/admin-glass.md)
> - 路线图:[`v1.1-roadmap.md`](./v1.1-roadmap.md)
>
> **当前状态**:v1.0.1 GA-ready(2026-06-10)

---

## 0. 一页概览(TL;DR)

| 维度 | 摘要 |
|------|------|
| **产品名** | Pairhub(学伴) |
| **一句话** | 30 分钟内找到一起去图书馆 / 打球 / 桌游 / 开黑的搭子 |
| **用户群体** | 海外留学生(学业 + 运动 + 桌游 + 社交 全覆盖) |
| **三端** | 微信小程序(原生)· Flutter App(iOS+Android)· Fastify 后端 |
| **5 类活动** | 学习(图书馆/咖啡厅)· 运动(羽毛球/篮球/跑步)· 桌游(UNO/狼人杀)· 开黑(王者/原神)· 其他 |
| **核心闭环** | 浏览活动 → 多维筛选 → 一键报名 → 私聊确认 |
| **状态机** | 5 态(RECRUITING → FULL → STARTED → ENDED,任一态 → CANCELED) |
| **版本** | v1.0.1(server + iOS + Android + 微信小程序 CI 全绿) |
| **下次发布** | 准备打 v1.0.1 tag;v1.1 路线图已规划 |

---

## 1. 产品定位与目标用户

### 1.1 一句话定位

**Pairhub = 留学生搭子活动平台。** 让留学生 30 秒内找到一个能一起去图书馆 / 打球 / 开黑的搭子。

### 1.2 4 类用户画像

| 画像 | 描述 | 主要场景 |
|------|------|----------|
| **A 学业型** | 硕士/博士新生 | 自习、讨论、找同专业同学 |
| **B 运动型** | 喜欢打球/跑步 | 周末约球、夜跑 |
| **C 娱乐型** | 想玩桌游/开黑 | 周中开黑、周末桌游局 |
| **D 社交型** | 想认识新朋友 | 主题局、城市探索 |

### 1.3 核心价值主张

- **30 秒内找到搭子**(对比"微信群问半天没人回")
- **垂直场景分类**(不与陌生人社交、纯兴趣驱动)
- **学校/同专业偏好**(信任感加成,M3 launch data:同校用户报名率 3.2×)
- **轻量 UGC**(创建活动的门槛极低)

### 1.4 不做的事(明确边界)

- ❌ **不**做陌生人社交(无 DM、无 Feed 推荐瀑布流)
- ❌ **不**做学生认证(MVP 自报学校/专业/年级,仅自报)
- ❌ **不**做支付(MVP 纯免费)
- ❌ **不**做评价体系(M3 才上,2026-07 计划)
- ❌ **不**做 Web 端(Out of scope by design)
- ❌ **不**做直播/短视频
- ❌ **不**做群聊 IM(M2 才上,目前只有消息中心入口)

---

## 2. 三端架构总览

### 2.1 仓库结构

```
pairhub/
├── miniprogram/      # 微信小程序(原生 WXML/TS/WXSS)
├── app/              # Flutter App(iOS + Android,共用代码库)
├── server/           # Fastify 后端(Node 20 + TS 5)
├── tools/            # codegen-dart.mjs(从 OpenAPI 生成 Dart 模型)
├── infra/            # Docker Compose + 启停脚本
├── docs/             # 全员可见的文档(本文件就在这里)
├── .harness/         # AI agent 协作配置 + CI 验证产物
└── .github/workflows # 5 个 CI workflow
```

### 2.2 三端技术栈对照

| 层 | 微信小程序 | Flutter App | 后端 |
|----|------------|-------------|------|
| **语言** | TypeScript + WXML/WXSS | Dart 3.x | TypeScript 5.4 |
| **框架** | 微信原生 + 手写 store | Flutter 3.24 + Riverpod 2 | Fastify 4 + Prisma 5 |
| **路由** | 微信原生 `Page` | GoRouter 14 | Fastify Router |
| **网络层** | `wx.request` 封装 | Dio 5 + Interceptor | — |
| **状态管理** | 手写 observable store | Riverpod 2 | — |
| **鉴权** | `wx.login` → JWT | Sign in with Apple / Google → JWT | JWT (HS256, 7d) |
| **地图** | 腾讯地图 JS SDK | 腾讯地图 Flutter Plugin | 腾讯地图 WebService API |
| **推送** | 微信订阅消息 | APNs(iOS)/ FCM(Android) | 统一推送网关 |
| **包管理** | pnpm 9 | `flutter pub` | pnpm 9 |
| **测试** | 微信开发者工具 | `flutter test` | vitest |
| **CI** | 微信开发者工具 + 自研脚本 | GitHub Actions + Flutter SDK | GitHub Actions |

### 2.3 三端边界原则

> **核心原则**:后端 100% 共用,客户端按平台特性独立实现。

- 业务规则:100% 在后端
- 数据结构:共享 TypeScript 类型(从 OpenAPI 自动生成)
- 鉴权:JWT (HS256, 7d),三端统一签发
- 坐标系统:统一 GCJ-02(腾讯坐标系) / 海外 WGS-84(Mapbox 链路)
- 错误响应:RFC 7807 Problem Details

### 2.4 客户端分布(目标)

| 端 | 用户占比目标 | 优势 |
|----|--------------|------|
| 微信小程序 | 70% | 零下载成本,微信生态无缝(社交分享、订阅消息推送) |
| iOS App | 15% | 体验最好,Apple ID 登录,海外推送 APNs |
| Android App | 15% | 覆盖海外 Android 群体,Google 登录,FCM 推送 |

---

## 3. 功能模块(完整盘点)

### 3.1 客户端功能(用户侧)

#### 3.1.1 登录 / 注册(模块:auth)

| 子功能 | 描述 | 三端 |
|--------|------|------|
| 微信一键登录 | `wx.login` → 后端 `jscode2session` → JWT | 小程序 ✅ |
| Apple ID 登录 | Sign in with Apple | iOS ✅ |
| Google 登录 | Google Sign-In | Android ✅ |
| 手机号 + 验证码登录 | P2(预留 UI,后端暂未接) | 全端 UI ✅,后端 ⏳ |
| 短信验证码倒计时 | 60s 倒计时 | 小程序 ✅ |
| 同意协议 | 隐私 + 用户协议 | 全端 ✅ |
| Token 持久化 | `wx.setStorageSync` / `flutter_secure_storage` | 全端 ✅ |
| 多端账号合并 | 同一 User 记录,多 provider openid | 后端 ✅ |

#### 3.1.2 活动列表与筛选(模块:activity)

| 子功能 | 描述 |
|--------|------|
| 默认列表 | `GET /api/v1/activities?sort=start_time_asc` 按开始时间升序 |
| 5 类筛选 | 全部 / 自习 / 运动 / 桌游 / 开黑 / 其他(横向 scroll 顶 chip) |
| 关键字搜索 | 标题/描述模糊匹配(≤ 50 字) |
| 地理筛选 | `lat + lng + radius_km`,Haversine 公式 |
| 时间筛选 | `start_after` / `start_before` |
| 标签筛选 | `tags[]` OR 匹配 |
| 排序选项 | 时间升序 / 时间降序 / 创建时间降序 / 距离升序 |
| 下拉刷新 | `onPullDownRefresh` |
| 触底加载更多 | `onReachBottom` + `has_more` |
| 列表卡片 | 5 行布局(类型 badge + 状态 badge + 标题 + 时间 + 地点) |
| 报名人数实时 | `currentCount / maxParticipants`(如 3/8) |
| 空状态 | 无数据时 EmptyState 组件 |
| 加载骨架 | LoadingSkeleton 1.2s shimmer |

#### 3.1.3 活动详情(模块:activity)

| 子功能 | 描述 |
|--------|------|
| 封面图 | `coverUrl` 可选 |
| 标题 + 描述 | 支持换行、富文本(预留) |
| 状态 badge | 5 态(RECRUITING / FULL / STARTED / ENDED / CANCELED) |
| 类型 badge | 5 类(STUDY / SPORTS / BOARD_GAME / ONLINE_GAME / OTHER) |
| 时间 | `startTime ~ endTime`,本地时区 |
| 地点 | 地点名 + 详细地址 + 地图入口 |
| 地图小图 | 显示活动位置(可点开) |
| 标签 | 0-10 个,自由文本 |
| 创建者信息 | 头像 + 昵称 + 学校 + 专业 |
| 参与者预览 | 最多 5 个,点开看完整列表 |
| 报名按钮 | 底部 SignupButton 6 态 |
| 取消活动 | 仅创建者,start_time - 1h 前可点 |
| 报名记录 | 报名后活动页显示「已报名」状态 |

#### 3.1.4 创建活动(模块:activity + signup + content-safety)

4 步表单:
1. **Step 0 类型**:5 类活动,emoji 图标
2. **Step 1 信息**:标题(5-100 字)+ 描述(10-2000 字)+ 人数(2-99)
3. **Step 2 时间地点**:start / end 时间 + 地图选点
4. **Step 3 确认**:预览 + 提交

- 选点:调用腾讯地图 `chooseLocation`
- 时间:微信原生 picker
- 内容安全:提交时后端 `msg_sec_check`,失败则 `contentCheck=BLOCKED` 隐藏
- 成功后:跳到详情页

#### 3.1.5 报名 / 取消报名(模块:signup)

| 子功能 | 描述 |
|--------|------|
| 报名 | `POST /api/v1/activities/:id/signup`,可选留言(≤ 200 字) |
| 取消报名 | `DELETE /api/v1/activities/:id/signup` |
| 容量校验 | 事务 + `FOR UPDATE` 行级锁(后端) |
| 满员提示 | ACTIVITY_FULL 错误码 → 按钮置灰 |
| 状态联动 | 报名后 currentCount+1,达 max → status 变 FULL |
| 二次报名 | 取消后想再报,P1.1 bug 修复中 |

#### 3.1.6 个人主页(模块:user)

| 子功能 | 描述 |
|--------|------|
| 头像 + 昵称 | 默认微信头像,可改 |
| 学校 / 专业 / 年级 | 自报(MVP 不做认证) |
| Bio | ≤ 500 字,过内容安全 |
| 微信号 | 展示用,需用户授权 |
| 手机号 | E.164 格式,可选 |
| 我创建的活动 | `?role=creator` |
| 我参加的活动 | `?role=participant`,分状态(RECRUITING / STARTED / ENDED) |
| 编辑资料 | PATCH /users/me |
| 注销账户 | 软删除 + 30 天后硬删除(预留 M2) |

#### 3.1.7 消息中心(模块:messages,M2 规划)

- 当前:空状态 + 「消息中心开发中」占位
- M2 计划:每个活动群聊 + @ 提及 + 未读数

#### 3.1.8 地图(模块:map)

| 子功能 | 描述 |
|--------|------|
| 地图选点 | 腾讯地图 `chooseLocation` |
| 附近活动 | 地图模式下,显示附近活动标记 |
| 活动详情地图 | 单点显示活动位置 |
| 路线规划 | 调起原生地图 App(M2) |

#### 3.1.9 评价(模块:review,M3 计划)

- 双向 1-5 星 + 评论(≤ 500 字)
- 仅参与者可评
- ENDED 后 7 天评价窗口

#### 3.1.10 推送通知(模块:push,M3 计划)

| 事件 | 通道 |
|------|------|
| 报名成功 | 微信订阅消息 |
| 活动开始前 1h | 微信订阅消息 + APNs / FCM |
| 活动取消 | 微信订阅消息 |
| 群消息 @ 提及 | 三通道 |

---

### 3.2 后台功能(运营 / Admin,M3 落地)

5 个 Glass 视觉页面(液态玻璃风格,见 `design/admin-glass.md`):

| # | 页面 | 路径 | 功能 |
|---|------|------|------|
| 1 | Admin Gate | `/pages/admin/gate/gate` | 「Sign in as admin」入口,非 ADMIN 显示 SQL 提示 |
| 2 | Activities Review Queue | `/pages/admin/activities/activities` | 待审活动列表 + Inline Approve / Reject |
| 3 | Activity Detail (Moderation) | `/pages/admin/activity-detail/activity-detail` | 活动详情 + Sticky 玻璃操作栏(Approve / Reject with reason) |
| 4 | Users Search | `/pages/admin/users/users` | 搜索 + 状态切换(ACTIVE / BANNED)+ 长按菜单 |
| 5 | Dashboard Metrics | `/pages/admin/dashboard/dashboard` | 2×2 玻璃网格,4 个 KPI(Users / Activities / Signups / PushTokens) |

权限:`adminOnly` preHandler,要求 `role: ADMIN` + `status: ACTIVE`。

后端管理接口(`/api/v1/admin/*`):

| Method | Path | 用途 |
|--------|------|------|
| GET | `/admin/activities` | 审稿队列(默认 PENDING) |
| POST | `/admin/activities/:id/approve` | 审核通过 |
| POST | `/admin/activities/:id/reject` | 审核拒绝(带原因) |
| GET | `/admin/users` | 搜索用户(至少 1 过滤条件) |
| PATCH | `/admin/users/:id/status` | 封禁 / 解封 |
| GET | `/admin/dashboard/metrics` | 概览指标 |
| GET | `/admin/analytics/funnel` | 5 阶段漏斗 |
| GET | `/admin/analytics/retention` | 月度 cohort 留存(D1/D7/D30) |
| GET | `/admin/analytics/activity-volume` | 每日活动量 |
| GET | `/admin/analytics/kpis` | 4 KPI 快照(30s 缓存) |

---

## 4. 信息架构(栏目结构)

### 4.1 小程序端 Tab 栏(5 Tab)

| Tab | 路径 | 角色 | 主要功能 |
|-----|------|------|----------|
| **首页** | `pages/index/index` | 入口 | 活动列表 + 分类筛选 + 搜索 |
| **活动** | `pages/activity/activity` | 入口 | 活动详情(mock,等 #22 合并) |
| **创建** | `pages/create/create` | 入口 | 4 步创建活动表单 |
| **消息** | `pages/messages/messages` | 入口 | 消息中心(M2) |
| **我的** | `pages/profile/profile` | 入口 | 个人资料 + 我创建 / 我参加 |

> 注:目前 `pages/activity/activity` 和 `pages/index/index` 都在首页,前者是 tab 入口占位,真实活动详情在 `pages/activities/detail`(深链跳转)。

### 4.2 小程序端所有页面(14 个)

| 路径 | 角色 | 状态 |
|------|------|------|
| `pages/index/index` | 首页(活动流) | ✅ |
| `pages/activity/activity` | 活动详情(tab 入口) | ⚠️ 占位 |
| `pages/activities/list` | 活动列表(带筛选) | ✅ |
| `pages/activities/detail` | 活动详情(真实) | ✅ |
| `pages/create/create` | 创建活动(4 步) | ✅ |
| `pages/messages/messages` | 消息中心 | ⏳ M2 |
| `pages/profile/profile` | 我的 | ✅ |
| `pages/login/login` | 登录 | ✅ |
| `pages/map/map` | 地图 | ✅ |
| `pages/admin/gate/gate` | Admin 入口 | ✅ |
| `pages/admin/activities/activities` | Admin 审稿 | ✅ |
| `pages/admin/activity-detail/activity-detail` | Admin 详情 | ✅ |
| `pages/admin/users/users` | Admin 用户 | ✅ |
| `pages/admin/dashboard/dashboard` | Admin 仪表盘 | ✅ |

### 4.3 Flutter 端页面(10 个)

**用户(5)**:
- `login_page.dart` — 登录
- `activity_list_screen.dart` — 活动列表
- `activity_detail_screen.dart` — 活动详情
- `profile_page.dart` — 我的
- `map_screen.dart` — 地图

**Admin(5)**:
- `gate_page.dart`
- `dashboard_page.dart`
- `activities_page.dart`
- `activity_detail_page.dart`
- `users_page.dart`

### 4.4 共享组件(7 + 5)

**通用组件(7)** — 客户端 + Admin 共用:
1. **ActivityCard** — 活动列表卡片
2. **StatusBadge** — 5 态状态 pill
3. **FilterChip** — 横向筛选条
4. **SignupButton** — 底部主 CTA 6 态
5. **EmptyState** — 空状态
6. **ErrorState** — 错误状态 + 重试
7. **LoadingSkeleton** — 加载骨架(1.2s shimmer)

**Admin 专属(5)** — Glass 视觉:
- GlassCard / MeshBackground / StatusPill / GlassButton / GlassSheet

---

## 5. 核心业务流程

### 5.1 登录流程(以微信小程序为例)

```
1. 用户打开小程序
2. 自动检查 isLoggedIn() → 已登录 → 跳首页;未登录 → 登录页
3. 登录页默认 Tab:微信登录
4. 用户点击「微信登录」按钮
5. wx.login() → 拿到 code
6. POST /api/v1/auth/wx-login { code, nickname, avatar }
7. 后端:jscode2session(code → openid)
8. 后端:SELECT users WHERE wechat_openid = openid
   - 存在:刷新 nickname/avatar,签 JWT
   - 不存在:INSERT,签 JWT
9. 返回 { token, user } → 写 store
10. wx.reLaunch(/pages/index/index)
```

**多端合并**:同一用户可在三端用不同账号登录,最终合并为同一 `User` 记录(通过 `link-provider` 接口手动合并)。

### 5.2 报名流程(防超卖)

```
1. 用户在活动详情页点击「立即报名」
2. POST /api/v1/activities/:id/signup { message }
3. 后端:JWT 鉴权 → userId
4. BEGIN TRANSACTION
5. SELECT activity WHERE id=? FOR UPDATE (行级锁)
6. 校验:
   - 活动存在?
   - status == RECRUITING | FULL?
   - current_count < max_participants?
   - (activityId, userId) 未报名?
7. INSERT signup
8. UPDATE activity SET current_count = current_count + 1
9. 达 max → status = FULL
10. COMMIT
11. 返回 201 { signup, activity }
12. 客户端:按钮变「已报名」+ currentCount+1
```

**关键点**:
- 🔒 `SELECT ... FOR UPDATE` 行级锁,杜绝超卖
- 🔒 容量判断和写入在**同一事务**里
- 🔒 `current_count` 与 `status` 一致性靠触发器或应用层约束

### 5.3 创建活动流程

```
1. 用户进创建页 → 4 步表单
2. Step 0:选类型 → Step 1 → Step 2 → Step 3
3. 提交时:
   a. 客户端 zod 校验
   b. POST /api/v1/activities
   c. 后端 zod 校验
   d. 后端调微信内容安全 API(title + description)
   e. 通过 → INSERT activity(contentCheck=PASS, status=RECRUITING)
      失败 → INSERT activity(contentCheck=BLOCKED),从列表隐藏
   f. 返回 201
4. 客户端跳到详情页
```

### 5.4 活动状态机

```
[create]
  ↓
[RECRUITING] ──人数满──→ [FULL]
    │                      │
    │ 时间到              │ 时间到
    ↓                      ↓
 [STARTED] ←──────────── [STARTED]
    │
    │ end_time 过
    ↓
 [ENDED] ──→ 自动触发评价窗口(M3)
    │
 任意时刻(仅 creator,start_time - 1h 前)
    ↓
 [CANCELED]
```

### 5.5 内容审核流程

```
用户提交 UGC(title / description / message / bio / 群消息)
  ↓
后端异步调 https://api.weixin.qq.com/wxa/msg_sec_check
  ↓
  PASS  → 正常入库 + 列表显示
  BLOCKED → contentCheck=BLOCKED, 列表隐藏(保留以备申诉)
  失败 → 同步重试 1 次,仍失败则 fail-open(MVP)
```

---

## 6. 数据模型

### 6.1 ER 概览

```
User ── creates ──→ Activity ←── signs up ── Signup
  │                                       │
  │                                       ↓
  └── reviews from/to ──→ Review ←────(activity + from + to)
  │
  └── sends ──→ Message ←── (activity)
  │
  └── owns ──→ PushToken
  │
  └── has role ──→ { USER | ADMIN }
```

### 6.2 表结构(v1 落地)

#### User

| 字段 | 类型 | 必填 | 索引 | 备注 |
|------|------|------|------|------|
| id | cuid | ✅ | PK | |
| wechatOpenid | String? | | unique | |
| appleSub | String? | | unique | |
| googleSub | String? | | unique | |
| primaryProvider | AuthProvider | | | WECHAT / APPLE / GOOGLE |
| nickname | String | ✅ | | |
| avatar | String? | | | |
| school | String? | | + 组合索引 | 自报 |
| major | String? | | + 组合索引 | |
| grade | String? | | + 组合索引 | 入学年份 |
| wechatId | String? | | | 展示用 |
| phone | String? | | unique | E.164 |
| bio | String? | | | ≤ 500, 过内容安全 |
| status | UserStatus | | | ACTIVE / BANNED |
| role | Role | | | USER / ADMIN(M3) |
| deletedAt | DateTime? | | | 软删除 |
| createdAt / updatedAt | DateTime | ✅ | | |

#### Activity

| 字段 | 类型 | 必填 | 索引 | 备注 |
|------|------|------|------|------|
| id | cuid | ✅ | PK | |
| creatorId | String | ✅ | FK | |
| type | ActivityType | ✅ | + 组合索引 | 5 类 |
| title | String | ✅ | | 5-100 字 |
| description | String | ✅ | | 10-2000 字 |
| coverUrl | String? | | | |
| locationName | String | ✅ | | ≤ 100 |
| locationAddr | String | ✅ | | ≤ 200 |
| locationLat / locationLng | Decimal(10,7) | ✅ | + 组合索引 | GCJ-02 |
| startTime / endTime | DateTime | ✅ | + 组合索引 | ISO 8601 |
| maxParticipants | Int | ✅ | | 2-100 |
| currentCount | Int | ✅ | | 含创建者 |
| tags | String[] | | | 0-10 |
| status | ActivityStatus | ✅ | + 组合索引 | 5 态 |
| contentCheck | ContentCheckStatus | ✅ | | PENDING / PASS / BLOCKED |
| blockedReason | String? | | | |
| createdAt / updatedAt | DateTime | ✅ | | |
| canceledAt | DateTime? | | | |

**索引策略**:
- `(status, start_time)` — 列表默认排序
- `(type, status, start_time)` — 类型 + 状态 + 时间
- `(location_lat, location_lng)` — 地理查询

#### Signup

| 字段 | 类型 | 必填 | 索引 | 备注 |
|------|------|------|------|------|
| id | cuid | ✅ | PK | |
| activityId | String | ✅ | FK + unique(联合) | onDelete: Cascade |
| userId | String | ✅ | FK | |
| status | SignupStatus | ✅ | + 组合索引 | 4 态 |
| message | String? | | | ≤ 200, 过内容安全 |
| signedAt | DateTime | ✅ | | |
| canceledAt | DateTime? | | | |
| cancelReason | String? | | | |

**唯一约束**:`(activityId, userId)` — 防止重复报名

#### Review(M3 预留)

- `rating: Int (1-5)` + `comment: String? (≤ 500)` + `unique(activityId, fromUserId, toUserId)`

#### Message(M2 预留)

- `content: VarChar(2000)` + `contentCheck` + `index(activityId, createdAt)`

#### PushToken(M3 预留)

- `provider: APNS | FCM | WX_SUBSCRIBE` + `token: String` + `userId`

### 6.3 枚举全集

```typescript
// AuthProvider
WECHAT | APPLE | GOOGLE

// UserStatus
ACTIVE | BANNED

// Role
USER | ADMIN

// ActivityType
STUDY | SPORTS | BOARD_GAME | ONLINE_GAME | OTHER

// ActivityStatus
RECRUITING | FULL | STARTED | ENDED | CANCELED

// SignupStatus
PENDING | APPROVED | REJECTED | CANCELED

// ContentCheckStatus
PENDING | PASS | BLOCKED
```

---

## 7. API 概览(18 个核心端点)

详细见 `docs/api/v1.md`。这里给一张鸟瞰图。

### 7.1 端点分组

| 分组 | 端点数 | 路径前缀 |
|------|--------|----------|
| Health | 1 | `/api/v1/health` |
| Auth | 5 | `/api/v1/auth/*` |
| User | 4 | `/api/v1/users/*` |
| Activity | 5 | `/api/v1/activities/*` |
| Signup | 3 | `/api/v1/activities/:id/signup` + participants |
| Admin(M3) | 6 | `/api/v1/admin/*` |
| Analytics(M3) | 4 | `/api/v1/admin/analytics/*` |
| Monitoring | 3 | `/api/v1/monitoring/*` |
| Push(M3) | 3 | `/api/v1/devices/*` |
| **合计** | **~30** | |

### 7.2 端点清单(精选 18 个核心)

| Method | Path | 用途 | 鉴权 |
|--------|------|------|------|
| GET | `/api/v1/health` | 健康检查 | ❌ |
| POST | `/api/v1/auth/wx-login` | 微信登录 | ❌ |
| POST | `/api/v1/auth/apple-login` | Apple 登录 | ❌ |
| POST | `/api/v1/auth/google-login` | Google 登录 | ❌ |
| POST | `/api/v1/auth/refresh` | 刷新 JWT | ✅ |
| POST | `/api/v1/auth/link-provider` | 手动绑定更多登录方式 | ✅ |
| GET | `/api/v1/users/me` | 当前用户信息 | ✅ |
| PATCH | `/api/v1/users/me` | 更新个人资料 | ✅ |
| GET | `/api/v1/users/me/activities` | 我的活动(创建/参加) | ✅ |
| DELETE | `/api/v1/users/me` | 注销账户(软删除) | ✅ |
| GET | `/api/v1/activities` | 活动列表 | ❌ |
| POST | `/api/v1/activities` | 创建活动 | ✅ |
| GET | `/api/v1/activities/:id` | 活动详情 | ❌ |
| PATCH | `/api/v1/activities/:id` | 修改活动 | ✅ + creator |
| DELETE | `/api/v1/activities/:id` | 取消活动 | ✅ + creator |
| POST | `/api/v1/activities/:id/signup` | 报名 | ✅ |
| DELETE | `/api/v1/activities/:id/signup` | 取消报名 | ✅ |
| GET | `/api/v1/activities/:id/participants` | 参与者列表 | ❌ |

### 7.3 鉴权

- JWT HS256, 7 天过期
- Header: `Authorization: Bearer <jwt>`
- Payload: `{ sub, providers, primary, region, iat, exp, iss, aud }`

### 7.4 通用约定

- **分页**:`?page=1&page_size=20`(最大 100),响应 `{ data: [], pagination: { page, page_size, total, has_more } }`
- **错误**:RFC 7807 Problem Details
- **时间**:ISO 8601(UTC),前端按本地时区展示
- **地理**:GCJ-02(腾讯坐标系),存储 Decimal(10,7)
- **限流**:Redis 滑动窗口,默认 100 req/min/IP,登录 10 req/min/IP

### 7.5 错误码全集(选高频)

| HTTP | code | 场景 |
|------|------|------|
| 400 | `VALIDATION_ERROR` | zod 校验失败 |
| 401 | `UNAUTHORIZED` / `TOKEN_EXPIRED` | 鉴权失败 |
| 403 | `USER_BANNED` | 被封禁 |
| 404 | `ACTIVITY_NOT_FOUND` | 活动不存在 |
| 409 | `ALREADY_SIGNED_UP` | 重复报名 |
| 422 | `ACTIVITY_NOT_OPEN` / `ACTIVITY_FULL` | 业务规则违反 |
| 422 | `CANCEL_TOO_LATE` | start_time - 1h 内不能取消 |
| 429 | `RATE_LIMIT_EXCEEDED` / `LOGIN_RATE_LIMITED` | 限流 |

---

## 8. 后端模块清单(10 个业务模块 + 6 个插件 + 7 个 lib)

### 8.1 业务模块(server/src/modules/)

| # | 模块 | 端点数 | 关键能力 |
|---|------|--------|----------|
| 1 | `health` | 2 | /health, /ready(liveness + readiness) |
| 2 | `auth` | 5 | 微信 / Apple / Google 登录 + JWT + 刷新 + link-provider |
| 3 | `user` | 4 | 用户 CRUD + 我的活动 + 软删除 |
| 4 | `activity` | 5 | 活动 CRUD + 5 态状态机 + 地理筛选 |
| 5 | `signup` | 3 | 报名 + 事务 + 满员校验 + 取消 |
| 6 | `review` | 2 | 评价(仅参与者,M3 启) |
| 7 | `push` | 3 | 设备注册 / 列表 / 注销 |
| 8 | `admin` | 6 | 6 端点 + RBAC + PENDING_REVIEW 队列 |
| 9 | `monitoring` | 3 | Prometheus + Sentry + 告警 |
| 10 | `analytics` | 4 | 漏斗 + 留存 + 活动量 + KPI 快照 |

### 8.2 插件(server/src/plugins/)

- `auth.ts` — JWT 鉴权 + RBAC
- `cors.ts` — 跨域白名单
- `error-handler.ts` — RFC 7807 统一错误
- `metrics.ts` — Prometheus 指标
- `rate-limit.ts` — Redis 滑动窗口
- (Fastify 内置)`@fastify/helmet`, `@fastify/multipart`, `@fastify/request-id`

### 8.3 基础设施(server/src/lib/)

- `prisma.ts` — Prisma client 单例
- `redis.ts` — Redis client + 健康检查
- `env.ts` — zod 校验的环境变量(懒初始化)
- `errors.ts` — ApiError 类 + 错误码映射
- `logger.ts` — Pino logger
- `metrics.ts` — 业务指标埋点
- `sentry.ts` — Sentry SDK
- `content-safety.ts` — 微信内容安全 API 封装
- `openapi-spec.ts` / `openapi.ts` — OpenAPI 类型 + JSON 序列化
- `app.ts` — Fastify 实例工厂
- `fastify.d.ts` — 类型扩展

### 8.4 后端依赖

- `fastify@4` + `@fastify/*` 全家桶
- `prisma@5` + `@prisma/client`
- `zod` — 运行时校验
- `ioredis` — Redis
- `pino` + `pino-pretty` — 日志
- `prom-client` — Prometheus
- `@sentry/node` — 错误监控
- 测试:`vitest` + `supertest`

### 8.5 测试

- 单元测试:`vitest`
- E2E:`scripts/e2e.sh` + docker-compose
- 当前覆盖率:核心模块 ≥ 70%
- 已知问题:`tests/health.test.ts` 8 个失败(Redis-env 依赖,CI excluded)

---

## 9. 设计系统 v1 概览

详见 [`design/system-v1.md`](./design/system-v1.md) 和 [`design/components.md`](./design/components.md)。

### 9.1 颜色

**Brand & Semantic**:
- Primary: `#3B82F6`(主操作 / 焦点 / 链接)
- Success: `#22C55E`(RECRUITING / 成功)
- Warning: `#F59E0B`(FULL / 警告)
- Error: `#EF4444`(CANCELED / 错误)
- Info: `#3B82F6`(STARTED)

**Surface & Text**:
- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Text Primary: `#0F172A` / Secondary: `#475569` / Placeholder: `#94A3B8`

**5 类活动主题色**:
- STUDY 自习: `#3B82F6`(蓝)
- SPORTS 运动: `#22C55E`(绿)
- BOARD_GAME 桌游: `#A855F7`(紫)
- ONLINE_GAME 开黑: `#EF4444`(红)
- OTHER 其他: `#64748B`(灰)

**Dark Mode**:M3 启用(从 primary seed 派生),小程序延后。

### 9.2 字体

CJK 优先,4-pt baseline:

| Token | Size | Weight | 用途 |
|-------|------|--------|------|
| `displayMedium` | 32 sp | 700 | 空状态标题 |
| `headlineLarge` | 28 sp | 700 | 活动详情标题 |
| `titleLarge` | 22 sp | 600 | 卡片标题 |
| `bodyLarge` | 16 sp | 400 | 详情正文 |
| `bodyMedium` | 14 sp | 400 | 卡片副标题 |
| `labelLarge` | 14 sp | 500 | 按钮文字 |
| `labelSmall` | 11 sp | 500 | 状态 badge |

### 9.3 间距(4-pt base)

`--space-2xs (2)` / `--space-xs (4)` / `--space-sm (8)` / `--space-md (12)` / `--space-lg (16)` / `--space-xl (24)` / `--space-2xl (32)` / `--space-3xl (48)` / `--space-huge (64)`

### 9.4 圆角

`--radius-sm (4)` / `--radius-md (8)` / `--radius-lg (12)` / `--radius-xl (16)` / `--radius-pill (999)`

### 9.5 阴影

3 级:`--elevation-soft / medium / raised`

### 9.6 动效

`--motion-duration-fast (120ms)` / `--motion-duration-base (200ms)` / `--motion-duration-slow (360ms)`
曲线:`cubic-bezier(0.2, 0, 0, 1)` (standard) / `cubic-bezier(0.3, 0, 0, 1)` (emphasized)

`prefers-reduced-motion`:时长全部归零,只保留 easing。

---

## 10. 运营后台(Admin)

### 10.1 后台架构

- **权限**:`User.role = 'ADMIN'`,前端登录后判断;首个 ADMIN 通过 SQL 授予
- **入口**:小程序 + Flutter 都有 admin 入口页(`pages/admin/gate/gate`),普通用户看到「联系开发者获取」提示
- **视觉风格**:**液态玻璃**(Glassmorphism) — 半透明面板 + 网格渐变背景 + 1px 细描边
- **深色模式默认**,浅色模式可选

### 10.2 5 个 Admin 页面

详见 [`design/admin-glass.md`](./design/admin-glass.md)。

1. **Admin Gate** — 入口判断
2. **Activities Review Queue** — PENDING_REVIEW 活动列表 + Inline Approve/Reject
3. **Activity Detail (Moderation)** — 活动详情 + Sticky 玻璃操作栏
4. **Users Search** — 搜索 + 状态切换
5. **Dashboard Metrics** — 2×2 玻璃网格 KPI

### 10.3 后台玻璃视觉关键参数

- 背景:4 色网格渐变(sky / pink / green / amber)+ 80px blur
- 玻璃面:`rgba(255,255,255,0.08)` 深色 / `0.55` 浅色
- 边框:`1px solid rgba(255,255,255,0.18)` 深色 / `0.65` 浅色
- 圆角:`20px` (普通) / `28px` (大)
- 阴影:`0 4px 16px rgba(0,0,0,0.18)` (浅) / `0 8px 32px rgba(0,0,0,0.30)` (深)
- 入场:320ms ease-out + translateY(8px → 0)
- 按下:scale 1.0 → 0.98 over 120ms

### 10.4 已知非功能

- 队列默认 FIFO;pending > 20 时 SLA 告警
- Dashboard KPI 30s Redis 缓存
- 401/403 一致语义(其他 admin 模块同)

---

## 11. 技术栈与依赖(完整)

### 11.1 后端

```
Runtime:    Node.js 20 LTS
Language:   TypeScript 5.4
Framework:  Fastify 4
ORM:        Prisma 5
Database:   PostgreSQL 16
Cache:      Redis 7
Package:    pnpm 9
Test:       vitest
Lint:       ESLint + Prettier
Log:        pino + pino-pretty
Monitor:    Sentry + Prometheus + Grafana Cloud
Container:  Docker (多阶段,镜像 < 300 MB)
Deploy:     Docker Compose (本地) → 腾讯云 TKE (国内) / AWS ECS (海外)
```

### 11.2 微信小程序

```
Runtime:    微信原生 2.13.0+
Language:   TypeScript
Framework:  微信原生 + 手写 observable store
Package:    pnpm 9
Lint:       stylelint + 自研 `no-rule-before-import` 插件
Test:       微信开发者工具 + miniprogram-automator
Compile:    微信开发者工具 + miniprogram-ci
```

### 11.3 Flutter App

```
SDK:        Dart >= 3.4.0, Flutter >= 3.24.0
State:      Riverpod 2.x
Router:     GoRouter 14
Network:    Dio 5 + Interceptor
Storage:    flutter_secure_storage (JWT) + shared_preferences (普通)
Map:        腾讯地图 Flutter Plugin(GCJ-02)
Codegen:    build_runner + freezed + json_serializable
Test:       flutter test + integration_test
Lint:       flutter analyze
```

### 11.4 第三方服务

| 用途 | 服务 |
|------|------|
| 微信登录 | jscode2session |
| 微信内容安全 | msg_sec_check |
| 微信订阅消息 | subscribe/send |
| Apple 登录 | apple-signin-auth |
| Google 登录 | google-auth-library |
| 地图 | 腾讯地图 WebService API |
| 推送 | APNs(`@parse/node-apn`)+ FCM(`firebase-admin`)+ 微信订阅 |
| 对象存储 | 腾讯云 COS / AWS S3 |
| 监控 | Sentry + Prometheus + Grafana |

---

## 12. CI / CD 与部署

### 12.1 5 个 CI workflow

| Workflow | 触发路径 | 检查内容 |
|----------|----------|----------|
| `backend-ci.yml` | `server/**` | Lint + Typecheck + Test + Build + Docker build + Size gate(< 300MB) |
| `flutter-ci.yml` | `app/**` | analyze + test + build apk debug |
| `miniprogram-ci.yml` | `miniprogram/**` | JSON / TS 结构校验 |
| `miniprogram-stylelint.yml` | `miniprogram/**/*.wxss` | stylelint 跑 |
| `docs-verification.yml` | `docs/**` | 报告结构 + verdict 关键词 + 已知 CI workflow 引用 |
| `android-release.yml` | tag 触发 | AAB + APK 构建(手动 sign) |

### 12.2 部署拓扑

```
Cloudflare / DNSPod (CDN + WAF + 限流)
  ↓ HTTPS
CLB / ALB 负载均衡
  ↓
┌────────┐  ┌────────┐  ┌────────┐
│ Node#1 │  │ Node#2 │  │ Cron   │
│ Fastify│  │ Fastify│  │ Worker │
└────────┘  └────────┘  └────────┘
  ↓
┌──────────────────────────────┐
│ PG Master  ◀──▶  PG Replica │
│ Redis Sentinel (3 节点)      │
└──────────────────────────────┘

对象存储 (COS / S3) · 监控 (Grafana) · 日志
```

### 12.3 部署 checklist

- 应用节点 ≥ 2(高可用)
- 独立 Cron 节点跑 `activity-state-cron`(每分钟)
- PG 主从 + 每日全量备份
- Redis 哨兵 3 节点

---

## 13. 安全与合规

### 13.1 传输安全

- 全程 HTTPS / WSS, TLS 1.3
- 客户端校验证书
- 后端 `helmet` + `cors` 严格白名单

### 13.2 鉴权

- JWT (HS256, 7d),payload 仅 `{ sub, providers, primary, region, iat, exp, iss, aud }`
- 敏感接口必须 JWT
- v0.3 计划 refresh token + 黑名单(Redis)

### 13.3 限流

| 维度 | 阈值 | 错误码 |
|------|------|--------|
| 全局 IP | 100 req/min | 429 RATE_LIMIT_EXCEEDED |
| 登录 IP | 10 req/min | 429 LOGIN_RATE_LIMITED |
| 创建活动用户 | 10/h | 429 CREATE_RATE_LIMITED |
| 报名活动用户 | 30/h | 429 SIGNUP_RATE_LIMITED |

实现:Redis 滑动窗口(ZSET 存时间戳)

### 13.4 数据加密

| 类别 | 措施 |
|------|------|
| 静态密码 | bcrypt (cost=12)— 预留,M1 暂未启用 |
| DB 密码 / AppSecret | 仅入 `.env`,gitignore |
| 客户端存储 | `flutter_secure_storage` / `wx.setStorageSync` |
| 传输 | TLS 1.3 |
| 字段级加密 | 手机号、wechatId(M2 评估 AES) |

### 13.5 UGC 安全

- 微信内容安全 API(异步)双层防护:客户端 zod + 后端 zod + 微信 API
- 创建活动 title / description:BLOCKED → 列表隐藏
- 报名留言:BLOCKED → 拒绝
- 用户 bio:BLOCKED → 拒绝更新

### 13.6 GDPR / 数据合规(预留)

- ✅ `User.deletedAt` 软删除字段已就位
- ✅ 导出个人数据接口(M2 计划)
- ✅ 删除账户(M2 计划)
- ⏳ 隐私政策 / 用户协议链接(M1 末由法务提供)

---

## 14. 当前状态与路线图

### 14.1 当前版本状态(v1.0.1,2026-06-10)

- ✅ 后端 10 模块 + 6 插件 + 7 lib 全部就位
- ✅ 微信小程序 14 个页面 + 7 组件 + 设计系统
- ✅ Flutter App 10 个页面(5 用户 + 5 admin)
- ✅ Admin 后台 5 个 Glass 页面
- ✅ 5 个 CI workflow 全 path-filtered,main 上全绿
- ✅ OpenAPI 3.0 + 客户端 codegen 流水线
- ✅ Sentry + Prometheus + Grafana 监控
- ⏳ P1.1 / P1.2 / P2 hotfix 留 hotfix-2

### 14.2 已知问题

| 优先级 | 描述 | 状态 |
|--------|------|------|
| P0.1 | miniprogram auth.ts 路径错(已修 PR #51) | ✅ |
| P0.2 | Flutter refresh 漏 `/api/v1/` 前缀(已修 PR #51) | ✅ |
| P1.1 | 取消报名后无法再报名同一活动(soft delete + unique 冲突) | ⏳ hotfix-2 |
| P1.2 | Redis cache 写后永不失效(5min stale) | ⏳ hotfix-2 |
| P2.1 | auth ternary code smell | ⏳ hotfix-3 |
| P2.2 | PATCH refine 短路 | ⏳ hotfix-3 |

### 14.3 路线图

| 阶段 | 时间 | 关键交付 |
|------|------|----------|
| **M1 基础设施** | W1-W4(已完) | 架构 v1.0 + 6 ADR + API 规范 + 后端脚手架 + 小程序/Flutter 脚手架 + 登录闭环 + 测试体系 + 设计系统 v1 + docs CI |
| **M2 业务闭环** | W5-W8(已完) | 10 业务模块 + 50 用户内部测试 + v1.0 GA |
| **M3 正式 + 运营** | W9-W12(已完) | 微信审核 + iOS/Android release pipeline + 运营后台 + 7×24 监控 + v1.0.1 code-quality sweep |
| **v1.0.1** | 当前 | code-quality sweep + 3 PRs merged(后端/小程序/Flutter) |
| **v1.1 W1** | TBD | 监控 M3 launch alerts + 修 top 5 P0 bug |
| **v1.1 W2** | TBD | 5 个最活跃 + 5 个流失用户深度访谈 |
| **v1.1 W3** | TBD | v1.1 backlog grooming |
| **v1.1 W4-W12** | TBD | 3 × 2 周 sprint 交付 6 个候选 feature |
| **v2.0** | 远期 | 推荐系统 + 微信支付 + 实时群聊 + 学生认证 |

### 14.4 v1.1 候选 feature(按优先级降序)

1. **基于兴趣匹配的推荐 feed** — 「推荐」tab,基于学校+专业+年级+好友活动+历史兴趣
2. **同学校/同专业优先展示** — 2× boost + 「同学都在」badge
3. **拼车出行** — 拼车座位 + 司机评分(2.5 sprint)
4. **多语言 i18n** — 中文 + 英文双语(~200 字符串,1 sprint)
5. **支付/押金** — Stripe + 微信 Pay + 退款(3 sprint,合规最重)
6. **Mini-game 破冰** — 「两真一假」「Would You Rather」(1 sprint,纯客户端)

### 14.5 v2.0+ 延后

- 直播(WebRTC 工程量不匹配当前体量)
- Stripe Connect / 微信支付商家入驻(合规+税务+KYC 需 1 个季度)
- AI/LLM(成本不可预测,等 v1.1+ 数据)
- 原生 iOS/Android 重写(Flutter 仍是正确选择,DAU > 50k 再议)

---

## 15. 团队 & 协作

### 15.1 角色分工

| 角色 | 职责 |
|------|------|
| CTO(@YuanshuoDu) | 拍板人,产品/技术决策 |
| Architect(@Oracle Hermes) | 架构 / ADR / API 规范 |
| Backend(@美国hermes) | 后端开发 + 部署 |
| Frontend(@爱马仕) | 微信小程序 |
| Flutter(@TBD) | Flutter App |
| UI/UX(@TBD) | 设计系统 + Mockup |
| QA(@OpenClaw) | 三端等价用例 |
| DevOps(@美国hermes 兼) | CI + 监控 |

### 15.2 协作规范

- 仓库**唯一**的代码改动路径:**PR + Review + 证据**
- PR 标题:`[<scope>] <description>`,scope = server / flutter / miniprogram / docs / devops / design
- PR body 第一行 `Closes #N`
- 每个 PR 必须附:改了啥 / 怎么验证的(截图/日志/链接) / 关联 issue
- 见 `docs/delivery-standards.md`

### 15.3 文档索引(按角色)

**新人必读(按顺序)**:
1. `docs/spec-v0.2.md` — 需求规约
2. `docs/architecture-v1.0.md` — 架构总览
3. `docs/adr/` — 6 篇关键决策(Flutter / 小程序原生 / 鉴权 / 状态机 / 存储 / Mapbox)

**按需查阅**:
- 后端:`docs/server/dev-setup.md` + `docs/api/v1.md`
- 小程序:`miniprogram/` + `docs/api/wechat.md`
- Flutter:`app/` + `docs/design/system-v1.md`
- API 端点:`docs/api/v1.md`
- 数据模型:`docs/architecture-v1.0.md §3` / `server/prisma/schema.prisma`
- 设计系统:`docs/design/system-v1.md` + `docs/design/components.md`
- Admin:`docs/design/admin-glass.md` + `docs/admin/playbook.md`
- 运营:`docs/admin/playbook.md` + `docs/modules/analytics.md`

**流程规范**:
- `docs/delivery-standards.md` — PR 交付规范
- `docs/test/test-plan-v1.0.md` — 测试计划
- `docs/github-interaction-rules.md` — Mavis Agent 协作元规则
- `docs/test/security-checklist.md` — 安全 checklist

---

## 16. 附录:术语表

| 术语 | 解释 |
|------|------|
| **搭子** | 中文俗语,「伙伴/陪同/同好」 |
| **开黑** | 多人联机打游戏(黑 = 一起) |
| **搭子活动** | 由 1 人发起,1+ 人报名,共同进行的活动 |
| **活动** | Activity(本平台核心实体) |
| **报名** | Signup(加入活动) |
| **招募中** | RECRUITING 状态,可报名 |
| **满员** | FULL 状态,currentCount == maxParticipants |
| **状态机** | Activity 5 态转换规则 |
| **内容安全** | 微信 UGC 审核 API,过滤违规内容 |
| **JWT** | JSON Web Token,7 天有效期 |
| **GCJ-02** | 火星坐标系,中国国测局加密,腾讯地图默认 |
| **WGS-84** | 国际标准坐标系,GPS / Mapbox |
| **soft delete** | 软删除,行保留 + `deletedAt` 时间戳 |
| **状态联动** | 报名后 currentCount+1,达 max → status = FULL |
| **FOR UPDATE** | PostgreSQL 行级锁,防并发超卖 |
| **RFC 7807** | HTTP API 错误响应标准 |
| **OpenAPI** | API 规范标准格式,3.0/3.1 |
| **P0/P1/P2/P3** | 严重性等级(P0 致命 → P3 文档) |
| **ADR** | Architecture Decision Record,架构决策记录 |
| **DoD** | Definition of Done,交付铁律 |

---

## 17. 附录:关键数字速查

| 数字 | 含义 |
|------|------|
| **30s** | 一句话产品目标:30 秒内找到搭子 |
| **5 类** | 活动类型:学习/运动/桌游/开黑/其他 |
| **5 态** | 活动状态机:RECRUITING/FULL/STARTED/ENDED/CANCELED |
| **7 个** | 客户端共享组件(ActivityCard 等) |
| **5 个** | Admin 页面 + Admin Flutter 页面 |
| **10 个** | 后端业务模块 |
| **18+** | API 核心端点(后续还会加 admin/analytics/messages) |
| **3 端** | 微信小程序 / Flutter / Web(future) |
| **4 类** | 用户画像:学业型/运动型/娱乐型/社交型 |
| **4 个** | Admin 4 KPI(Users/Activities/Signups/Reviews) |
| **2-100** | 活动人数限制(min/max) |
| **5-100 / 10-2000** | 标题/描述字数限制 |
| **60s** | 短信验证码倒计时 |
| **7d** | JWT 有效期 |
| **100 req/min** | 全局 IP 限流 |
| **10 req/min** | 登录限流 |
| **10/h** | 创建活动限流(用户维度) |
| **30/h** | 报名活动限流(用户维度) |
| **4-pt** | 设计系统基础间距单位 |
| **0.55 / 0.08** | Glass 面板透明度(浅/深) |
| **20px** | Glass 圆角 |
| **80px** | 背景 mesh blur |
| **320ms** | 页面入场动画时长 |
| **1.2s** | LoadingSkeleton 闪烁周期 |
| **v1.0.1** | 当前 GA-ready 版本号 |
| **M3 末** | 2026-07 计划完成评价 + 推送 + admin |
| **99%** | 系统可用性目标 |
| **P95 < 300ms** | 列表接口响应时间目标 |
| **< 300 MB** | Docker 镜像大小上限 |

---

> **最后更新**:2026-06-10(v1.0.1 验证后)
> **维护者**:@Oracle Hermes(架构)/ @YuanshuoDu(产品)/ @美国hermes(后端)
> **配套 UIUX 重设计文档**:[`UIUX-GUIDE.md`](./UIUX-GUIDE.md)
