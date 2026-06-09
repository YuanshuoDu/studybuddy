# Posters — design + print spec (issue #33)

> 3 poster sizes for offline + online use. Each has a different role:
> A2 = "study hall" poster (most students see this for 5+ seconds at a
> time), A4 = "info session" handout (snatched, glanced, pocketed), 1080×1920
> = "WeChat / Instagram Story" (4-second visual hit).

> The actual `.pdf` / `.png` exports ship in a follow-up PR. This spec
> is the design + copy contract.

## Common spec

| | |
| --- | --- |
| Color | Brand palette (`docs/design/system-v1.md`): ink `#0F1A2E`, paper `#FAF7F2`, accent `#E5664E`, gold `#D4A864` |
| Type | Display: `Söhne Breit` 800 / `思源宋体` 800 (CJK fallback). Body: `Inter` 400 / `思源黑体` 400 |
| QR | bottom-right, 240×240 px (A2) / 140×140 px (A4) / 200×200 px (Story) |
| Tagline | "找搭子 · 找同好 · 找组织" (the 3-step ladder, mirrors the FAQ) |
| CTA | "扫码下载 Pairhub" (consistent across all 3 sizes) |
| Brand mark | bottom-left, opposite the QR |

## A2 — "study hall" poster (offline)

| | |
| --- | --- |
| Aspect | A2 portrait (420×594 mm @ 300 dpi = 4961×7016 px) |
| File size | ≤ 30 MB PDF (print), ≤ 2 MB PNG (online preview) |
| Format | PDF/X-1a:2001 for print, PNG for online |
| Bleed | 3 mm on each side |
| Color mode | CMYK for print (FOGRA39), sRGB for online |
| Distribution | 校园公告栏 / 学生会海报墙 / 留学生服务中心 / 中超 / 留学中介 |

### Visual layout (A2)

```
┌────────────────────────────────────────┐
│                                        │
│  [巨大渐变色 hero，4-blob mesh 风格]    │
│                                        │
│  找搭子                                 │
│  找同好                                 │
│  找组织                                 │
│                                        │
│  ── 大字号 sans-serif 副标题 ──         │
│  Pairhub · 海外留学生同好匹配        │
│                                        │
│  [插画：3 个剪影围坐桌游]                │
│                                        │
│  6 种活动 · 50 km 半径 · 3 端通用        │
│                                        │
│  [logo]                      [QR]      │
│  Pairhub                扫码下载    │
│                                        │
└────────────────────────────────────────┘
```

### Copy (A2)

```
headline:   找搭子
            找同好
            找组织
subtitle:   Pairhub · 海外留学生同好匹配 App
pitch:      6 种活动 · 50 km 半径 · 3 端通用
cta:        扫码下载 Pairhub
fine:       pairhub.app · 微信小程序搜「Pairhub」
```

## A4 — "info session" handout (offline)

| | |
| --- | --- |
| Aspect | A4 portrait (210×297 mm @ 300 dpi = 2480×3508 px) |
| File size | ≤ 10 MB PDF, ≤ 1 MB PNG |
| Format | PDF/X-1a:2001, sRGB PNG |
| Bleed | 3 mm |
| Distribution | 新生 orientation 资料袋 / 留学生活动入场券附带 / 校园摊位传单 |

### Visual layout (A4)

```
┌──────────────────────────────┐
│ Pairhub                   │
│                              │
│ 找搭子 · 找同好 · 找组织       │
│                              │
│ ── 你附近的活动 ──            │
│ • 本周六 19:00 桌游夜（5/8）│
│ • 本周日 14:00 篮球 3v3    │
│ • 下周三 18:00 期末复习局   │
│                              │
│ [3 个圆形 icon]              │
│ 📍 50km  | 📅 6类 | 💬 中文 │
│                              │
│ [logo]           [QR]       │
│                  扫码下载     │
└──────────────────────────────┘
```

### Copy (A4)

```
header:   Pairhub
subhead:  找搭子 · 找同好 · 找组织
body:
  你附近的活动：
  • 本周六 19:00 桌游夜（5/8 已报名）
  • 本周日 14:00 篮球 3v3
  • 下周三 18:00 期末复习局

stats:   50 km 半径 · 6 类活动 · 端到端中文
cta:     扫码下载 Pairhub
fine:    pairhub.app · 完全免费 · 无广告
```

## 1080×1920 — "WeChat / Instagram Story" (online)

| | |
| --- | --- |
| Aspect | 9:16 (1080×1920 px, 300 dpi) |
| File size | ≤ 500 KB (WeChat Story upload limit) / ≤ 4 MB (IG Story) |
| Format | PNG, sRGB, no alpha |
| Distribution | WeChat 朋友圈 / Instagram Story / 抖音竖屏 / 小红书 / TikTok 配图 |
| Length | 3-4 seconds at a glance — must read on first paint |

### Visual layout (Story)

```
┌──────────────────────┐
│ [bg: brand 渐变色 + 4-blob mesh] │
│                              │
│  Pairhub                  │
│                              │
│  找搭子                       │
│  找同好                       │
│  找组织                       │
│                              │
│  [动画：3 个 emoji 旋转]      │
│  🎲  🏀  📚                  │
│                              │
│  6 类活动 · 50 km 半径         │
│                              │
│  ↑ 上滑查看附近活动            │
│                              │
│  [logo]   [QR]                │
└──────────────────────┘
```

### Copy (Story)

```
brand:    Pairhub
headline: 找搭子
          找同好
          找组织
emojis:   🎲 🏀 📚 🍜 ✈️ 🎵
pitch:    6 类活动 · 50 km 半径
cue:      ↑ 上滑查看附近活动
cta:      扫码下载 · 完全免费
```

## Generation pipeline (v1.1)

A2 + A4 posters are print-grade so the canonical asset is a `.pdf`
generated via a headless browser (Playwright) loading the `index.html`
landing page at the right CSS @page size, with custom print stylesheet
rules (already half-built into `index.html`'s `@media print` block).

Story posters are PNG exports of the same template, captured at 1080×1920
via Playwright's `page.screenshot({ clip: { width: 1080, height: 1920 }})`.

```
pnpm exec playwright install chromium
pnpm exec tsx scripts/poster-export.ts --size A2 --lang zh
pnpm exec tsx scripts/poster-export.ts --size A4 --lang zh
pnpm exec tsx scripts/poster-export.ts --size story --lang zh
```

## Asset versioning

`{size}-{lang}.{shortSha}.{pdf|png}` in
`pairhub-assets/posters/v{version}/`.

## When to regenerate

- Each minor version (1.0, 1.1, 1.2 ...)
- Each new activity type added (replace the emoji row)
- Each brand refresh (rare)

## Print vendor checklist

- A2: 200gsm matte coated, no lamination, folded into 4-panel A4 mailer
- A4: 150gsm silk coated, double-sided
- A2 + A4: CMYK conversion done by the vendor (send RGB PDF + brand
  Pantone codes)
- Story: PNG only; no print version

## Cost budget (offline, A2 + A4 combined)

- 100 A2 + 500 A4 ≈ $400 USD (Beijing print shop quote, 2026-Q2)
- 500 A2 + 2500 A4 ≈ $1,200 USD
- 1000 A2 + 5000 A4 ≈ $2,000 USD (rate breaks)

Ship 200 A2 + 1000 A4 to start; re-order based on `cta_url` UTM scan
rate.
