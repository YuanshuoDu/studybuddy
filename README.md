# StudyBuddy 🎒

> 留学生搭子活动平台 — 找自习室、约球、组局、开黑

**主端**：微信小程序（手机优先）  
**后端**：Node.js + TypeScript + Fastify + Prisma + PostgreSQL  
**Repo 规约**：本仓库是**唯一**代码仓库，所有改动必须走 PR + Review

> ⚠️ **交付铁律**：每个 PR / 每条进度都必须附**证据**（截图 + 日志 + 链接）。详见 [docs/delivery-standards.md](./docs/delivery-standards.md)

---

## 🧑‍🤝‍🧑 团队

| 角色 | 人员 | 负责 |
|------|------|------|
| 乙方 / 决策人 | @杜元朔 | 需求拍板、资源协调 |
| CTO | @Oracle Hermes | 架构、任务分发、汇报 |
| 主力开发 | @美国hermes | 外网开发、GitHub 同步 |
| 腾讯生态 | @爱马仕 | 微信/腾讯云接入 |
| 文档/测试 | @OpenClaw机器人-1896 | 测试用例、文档、脚本 |

**沟通群**：`oc_a046d180e9f8ef0274fe465239498649`（所有进展发群里）  
**汇报节奏**：每日 22:00（北京时间）+ 阻塞即时 @

---

## 📂 目录

```
studybuddy/
├── docs/            # 需求、架构、API、会议纪要
│   ├── spec-v0.1.md
│   ├── architecture.md
│   ├── api/
│   │   ├── conventions.md
│   │   └── wechat.md
│   ├── research/
│   │   └── wechat-ecosystem.md
│   └── test/
│       └── test-plan-v0.1.md
├── miniprogram/     # 微信小程序
├── server/          # 后端 API
├── infra/           # 部署 & 本地脚本
│   └── dev-up.sh
└── .github/
    ├── ISSUE_TEMPLATE/
    ├── PULL_REQUEST_TEMPLATE.md
    ├── CODEOWNERS
    ├── workflows/
    │   └── ci.yml
    └── labels.yml
```

---

## 🚀 快速开始

```bash
# 拉代码
git clone https://github.com/douyuanshuo/studybuddy.git
cd studybuddy

# 启动本地依赖（PostgreSQL）
./infra/dev-up.sh

# 后端
cd server && pnpm install && pnpm dev
```

---

## 📌 状态

- **当前里程碑**：M1-Week1（立项 + 需求 + 脚手架）
- **看板**：[GitHub Project]（待建）
- **下次汇报**：明日 22:00
