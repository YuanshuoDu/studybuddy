# MVP 验证报告 — Issue: Verify & Bug-fix pass

> 触发：用户"主要功能开发完成了嘛，验证主要功能，修改 bug"
> 范围：M0 + M1 + M2 + M3 W1-W3（auth/user/activity/signup/review + 限流 + 内容安全 + 设计系统 + 性能）
> 不在范围：M3 W4+（#27 推送 / #28 内测 / #32 admin / #34 监控 / #31 Android）
> 时间：2026-06-08

## 0. 完成度结论

| 模块 | 状态 | 来源 |
|---|---|---|
| 后端 5 模块（auth/user/activity/signup/review） | ✅ | PR #42 |
| 限流 6 端点 + 微信内容安全 | ✅ | PR #49 |
| miniprogram 活动流 | ⚠️ 路径未对齐 | PR #43 + 本 PR #51 |
| Flutter 活动流 | ⚠️ refresh 路径错 | PR #44 + 本 PR #51 |
| 设计系统 + 性能 + iOS config | ✅ | PR #45 #46 #47 |

**主要功能**（CRUD 闭环 + 安全 + 性能）**代码完成**。但静态审视发现**两端登录不可用**（P0），本 PR 修；另有 4 个 P1/P2 server bug 留 hotfix-2。

## 1. 验证策略（3 层）

| 层 | 方法 | 工具 | 状态 |
|---|---|---|---|
| L1 静态审视 | 读关键源文件标红可疑代码 | Read tool | ✅ 完成 |
| L2 CI 全跑 | lint + typecheck + test + build | GitHub Actions | 🔄 等 PR 触发 |
| L3 e2e | docker-compose 起 stack 跑 curl | docker + curl | ⏳ 待下个 tick |

> L3 需要起 docker-compose（postgres + redis + server），30min tick 装不下，留下一轮。

## 2. Bug 清单（按严重性）

### P0: 致命 — 端到端不可用

| # | 文件 | 行 | 描述 |
|---|------|---|------|
| P0.1 | `miniprogram/api/auth.ts` | 18, 25, 32, 37, 42 | 5 个端点路径全错：<br>`/auth/wx-login` `/auth/phone-login` `/user/me`（单数）`/auth/sms-code` `/user/bind-phone`<br>后端只有 `/auth/social-login` + `/users/me`（复数）<br>**影响：miniprogram 端 100% 不能登录，所有写操作全挂** |
| P0.2 | `app/lib/core/network/dio_client.dart` | 149 | `_doRefresh` 调 `/auth/refresh`，漏 `/api/v1/` 前缀<br>所有 `/api/v1/activities` 都用正确前缀 → **唯独 refresh 漏** → token 永不能 refresh → 用户 15min 后被强制登出 |

### P1: 严重 — 核心功能 bug

| # | 文件 | 行 | 描述 |
|---|------|---|------|
| P1.1 | `server/src/modules/signup/index.ts` | 89-91, 140-143 | `@@unique([activityId, userId])` + 软删（CANCELED status）+ `tx.signup.create` 重新报名会触发 P2002<br>**影响：用户取消报名后无法再报名同一活动** |
| P1.2 | `server/src/modules/activity/index.ts` | 172-201 | Redis cache 写后永不失效（5min TTL 内 stale）<br>POST/PATCH/DELETE activity + signup/cancelSignup 全部不 invalidate<br>**影响：自己刚发的活动 5 分钟内列表看不到 / 报名人数 5 分钟不更新** |

### P2: 中等 — 代码质量

| # | 文件 | 行 | 描述 |
|---|------|---|------|
| P2.1 | `server/src/modules/auth/index.ts` | 258 | `openid: phone ? compositeOpenid : compositeOpenid` 两支完全等价，code smell |
| P2.2 | `server/src/modules/activity/index.ts` | 97-100 | PATCH 只传 endTime 不传 startTime 时，refine 短路掉 → 不验证新 endTime vs existing startTime，可能 endTime < existing startTime 被写入 |

### P3: 低 — 文档过期

| # | 文件 | 描述 |
|---|------|------|
| P3.1 | `server/src/modules/auth/index.ts` 注释 | 多处说"M2-W6 (issue #26) lands real provider verification" — #26 实际只做限流 + 内容安全，没做 token 真实性校验。注释与现实不符 |

## 3. 已修（PR #51）

### P0.1 miniprogram 路径修复

- 改 `miniprogram/api/auth.ts`：
  - 5 个 URL 路径对齐后端
  - **adapter 模式**保留 `wxLogin / phoneLogin / getUserInfo / logout` 方法名 + 签名
  - 把后端 `{ accessToken, refreshToken, user }` 适配成前端 `LoginResult` 形状
  - 调用方 `pages/login.ts` / `app.ts` / `pages/profile.ts` 零改动
  - `sendSmsCode` / `bindPhone` 暂时保留为 no-op / throw，M3 #27 接入短信后替换

### P0.2 Flutter refresh 路径修复

- 改 `app/lib/core/network/dio_client.dart:149`：
  - `/auth/refresh` → `/api/v1/auth/refresh`
  - 加 4 行注释说明"PR #51 hotfix"和 PR #44 的回归来源

## 4. 未修 → **hotfix-2 已修(2026-07-11)** ✅

| Bug | 状态 | 修在哪 | 备注 |
|---|------|--------|------|
| P1.1 signup 重新报名 | ✅ 已修 | `server/src/modules/signup/index.ts:99-117` | service 层先 `findUnique({ activityId_userId })`，找到 CANCELED 则 `update({ status: APPROVED, canceledAt: null, signedAt: now })`；找不到则原 create；APPROVED 则幂等返回 |
| P1.2 cache invalidate | ✅ 已修 | `server/src/modules/activity/index.ts:198-216` + 5 个写路径调用 | `invalidateActivityListCache` 用 `SCAN MATCH activity:list:*` + 分批 DEL，避开了 `KEYS *` 阻塞。POST/PATCH/DELETE activity + POST/DELETE signup 5 个写路径都调用 |
| P2.1 ternary | ✅ 已修 | `server/src/modules/auth/index.ts:300` | 简化为 `openid: compositeOpenid`（单表达式），注释明确说"之前是 `phone ? compositeOpenid : compositeOpenid`" |
| P2.2 PATCH refine 短路 | ✅ 已修 | `server/src/modules/activity/index.ts:512-527` | route handler 先 fetch existing，再算 `mergedStart = body.startTime ?? existing.startTime` + `mergedEnd = body.endTime ?? existing.endTime`，然后校验 `mergedEnd > mergedStart` |
| P3.1 注释 | ⏳ 未动 | — | 保留待 M3 末或 M4 接真实 OAuth 时清理 |

完整 hotfix-2 验证报告见 [docs/verification/hotfix-2.md](./hotfix-2.md)。

## 5. CI 验证 — rebrand 后(2026-07-11 21:08 UTC 起)

CI 在 Pairhub rebrand (commit `fa04366`) 后由 6 个 workflow 跑了首次验证，结果:

| Workflow | 状态 | 备注 |
|----------|------|------|
| miniprogram-ci | ✅ success | rebrand 改字符串后 1 个 JSON 文件 BOM 导致 fail（commit `20cffca` 修）|
| miniprogram-stylelint | ✅ success | 同上，BOM 修后绿 |
| docs-verification | ✅ success | 一次过 |
| backend-ci | ⏳ 待验证 | prisma/schema.prisma BOM 导致 P1012（commit `1e6ec3a` 修，待新一轮 push 验证）|
| flutter-ci | ⏳ 待验证 | rebrand 改动 flutter 代码少，预期跟之前一样 |
| android-release | 🟡 tag-only | rebrand 没新增 tag，本周不跑 |

## 6. Rebrand 副作用的 BOM 污染(已修)

rebrand 脚本用 `[System.IO.File]::WriteAllText(..., [System.Text.Encoding]::UTF8)` 写文件，PowerShell 的 UTF8 encoder 默认带 BOM（EF BB BF）。被污染的文件：

- 9 个 JSON（`miniprogram/{app,package,project.config,.stylelintrc}.json` 等）—— Node `JSON.parse` 严格不接受 BOM，导致 miniprogram-ci 失败
- 1 个 Prisma schema —— Prisma 5 wasm validator 严格不接受 BOM，导致 backend-ci 失败（P1012）

修复：commit `20cffca` + `1e6ec3a`，通用脚本 `scripts/rebrand/strip-bom.ps1` 和 `strip-bom-prisma.ps1`。

## 7. 验证总结(更新于 2026-07-11)

- ✅ **MVP 代码完成**：M0-M2-M3 W1-W3 主要功能已上线
- ✅ **P0 已修**：miniprogram 路径 bug + Flutter refresh 路径 bug（PR #51）
- ✅ **P1.1 / P1.2 / P2.1 / P2.2 已修**：hotfix-2 见 [./hotfix-2.md](./hotfix-2.md)
- ⏳ **CI 待最终验证**：backend-ci / flutter-ci 在 rebrand 后待重新跑一遍确认全绿
- ⏳ **未跑**：L3 e2e docker-compose + curl（见 hotfix-3 计划）
- ⏳ **P3.1 注释清理**：留 M3 末或 M4 接真实 OAuth 时

下一步：
1. 等 commit `1e6ec3a` 触发的 backend-ci / flutter-ci 跑完
2. 起 hotfix-3 跑 L3 e2e（docker-compose + curl 全链路）
3. 清理 P3.1 注释
4. 写 v1.1 roadmap kickoff doc
