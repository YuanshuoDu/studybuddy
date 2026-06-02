# GitHub 互动规范

> 目的：让 GitHub 上的所有互动（评论、PR、issue）都能精准 **@ 通知到对应人**，触发 GitHub 邮件 / Web 通知。

## 1. @ 提及铁律

**所有需要某人执行的任务，必须在该位置 @ 该人。** 适用场景：
- Issue 创建/编辑 → @ 执行人
- Issue 评论 → @ 协作者
- PR 描述 → @ reviewer
- PR review comment → @ 提交者
- commit message → 不强制

**语法**：`@github-username`（**不是飞书用户名**！）

## 2. 各角色 GitHub 身份映射

| 飞书角色 | GitHub 身份（待确认） | 邮箱 |
|----------|----------------------|------|
| @杜元朔 | @YuanshuoDu | (已建仓) |
| @Oracle Hermes | @oracle-hermes-cto | cto@hermes.local |
| @美国hermes | TBD ⏳ @杜元朔 提供 | — |
| @爱马仕 | TBD ⏳ @杜元朔 提供 | — |
| @OpenClaw机器人-1896 | TBD ⏳ @杜元朔 提供 | — |

> **🚨 阻塞**：3 个飞书 AI 角色目前**没有 GitHub 账号**，无法被 @ 提及并接收 GitHub 通知。
> 需要 @杜元朔 为每个角色注册 GitHub 账号并把用户名发到群里。

## 3. 通知触发机制

GitHub 会在以下情况自动发邮件 / Web 通知给被 @ 的人：
- 在 issue / PR / commit 评论中被 @username 提及
- 被设置为 **assignee**（需要先成为 repo collaborator）
- 被设置为 **reviewer**（PR review）
- 在 CODEOWNERS 中被列为某目录 owner，PR 改到该目录时自动请求 review

## 4. 协作流程

### 4.1 Issue 分配
1. CTO 创建 issue，body 第一行：`@<执行人-github-username>`
2. 设置 label（`backend` / `frontend` / `wechat` / `docs` / `test`）
3. 设置 milestone（`M1-Week1` 等）
4. Project board 拖到 `Todo` 状态

### 4.2 PR 提交
1. 从 `develop` 拉分支：`feat/issue-N-描述`
2. commit 完成后 push 触发 CI
3. 创建 PR，body 第一行：`Closes #N` + `@<reviewer-username>`
4. CI 全绿 + reviewer 通过 → merge

### 4.3 Review
- Reviewer 必须**逐项核对 delivery-standards.md 的证据清单**
- 缺证据 → 打 `needs-evidence` label + 评论 `需要补：1) ... 2) ...`
- 证据齐全 → Approve
- 修复合并后 @ 提交者：`已合并，请关注 #M`

## 5. 每日进度同步到本群

每天 22:00 由 @Oracle Hermes 在飞书群 `oc_a046d180e9f8ef0274fe465239498649` 发进度汇报，包含：
- 当日完成 PR 链接
- 看板截图
- 阻塞项（带 issue 链接）
