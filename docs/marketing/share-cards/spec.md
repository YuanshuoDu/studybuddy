# Share cards — design + copy spec (issue #33)

> 3 share-card variants users send when they want to invite a friend
> to a Pairhub activity. Each has a different aspect ratio, copy
> length, and a different visual hook (because the audience is
> different: 朋友圈 is a polished "look at me", 微信群 is a quick
> "yo come", Twitter is a public post with hashtags).

All 3 cards share the Pairhub brand system (`docs/design/system-v1.md`).
Final visuals ship in a follow-up PR with `.png`/`.jpg` exports;
this spec is the design + copy contract that drives the export.

## 1. 朋友圈 (WeChat Moments) — `wechat-moments.png`

| | |
| --- | --- |
| Aspect | 1:1 (1080×1080 px, 300 dpi, RGB) |
| File size | ≤ 500 KB (WeChat image upload limit) |
| Format | PNG, sRGB, no transparency |
| Distribution | App 内「分享到朋友圈」按钮 → WeChat SDK `shareToMoments` |

### Visual layout

```
┌──────────────────────────────────┐
│ [bg: gradient, brand sky-blue →  │
│      lavender, 15% grain noise]  │
│                                  │
│  ┌─ 240×240 px avatar ─┐         │
│  │  发起人头像 (圆)   │         │
│  └─────────────────────┘         │
│                                  │
│  「周六晚 7 点 桌游夜 · 招 3 人」│
│                                  │
│  📍 离我 2.3 km · 🎲 BOARD_GAME   │
│  ⏰ Sat 19:00–22:00               │
│                                  │
│  ┌──────────────────────────┐    │
│  │ 「求一个会打狼人杀的搭子」│    │
│  │  —— 发起人昵称 · 28s   │    │
│  └──────────────────────────┘    │
│                                  │
│  [logo: Pairhub]               │
│  扫码加入 →                       │
│  ┌────── 200×200 px QR ──────┐  │
│  │  H5 详情页 URL            │  │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

### Copy (default; the App replaces the `{}` placeholders at share time)

```
title:   {发起人昵称}在 Pairhub 发起了一个活动
lead:    {活动标题} · 招 {剩余名额} 人
time:    {开始时间}–{结束时间}, {活动类型 emoji + label}
place:   离我 {距离} km · {活动地址前 12 字}
quote:   「{活动描述前 30 字}」 —— {发起人昵称} · {相对时间, e.g. 28s}
footer:  长按识别二维码 · 立即报名
```

### Design tokens (from `docs/design/system-v1.md`)

- background: `linear-gradient(135deg, #4A90E2 0%, #B07CE6 100%)`
  with 15% white grain noise
- title font: 32 px, `system-ui` (苹方 fallback), `font-weight: 700`,
  `color: #FFFFFF`
- body font: 18 px, `font-weight: 400`, `color: rgba(255,255,255,0.92)`
- quote box: `background: rgba(255,255,255,0.18)` +
  `backdrop-filter: blur(12px)` (liquid glass — `docs/design/admin-glass.md`)
- QR: 200×200, 4 px corner radius, 8 px white outer ring

---

## 2. 微信群 (WeChat group chat) — `wechat-group.png`

| | |
| --- | --- |
| Aspect | 1.5:1 (1200×800 px, 300 dpi, RGB) |
| File size | ≤ 200 KB (smaller than 朋友圈 — sent in group fast) |
| Format | PNG, sRGB, no transparency |
| Distribution | App 内「分享到微信群」 → WeChat SDK `shareToWechat` (timeline=group) |

### Visual layout

```
┌────────────────────────────────────────┐
│ [bg: 纯白底 + 顶部 80px brand 色条]  │
│                                        │
│ 🎲 桌游夜 · 招 3 人                     │
│                                        │
│ 周六 19:00–22:00 · 离我 2.3 km          │
│ 「求一个会打狼人杀的搭子」              │
│                                        │
│ 扫码报名 →                             │
│ ┌────────┐                              │
│ │  QR    │   发起人：@{昵称}              │
│ │ 200×200 │   截止：{开始前 12h}         │
│ └────────┘                              │
│                                        │
│ [logo] Pairhub · {tagline}           │
└────────────────────────────────────────┘
```

### Copy

```
title:    🎲 {活动类型 emoji} · {活动标题}
lead:     招 {剩余名额} 人 · 周{周数} {开始时间}–{结束时间}
place:    {距离} km · {地址前 8 字}
quote:    「{描述前 20 字}」
host:     发起人：@{发起人昵称}
deadline: 报名截止：{开始前 12h}
footer:   长按识别二维码报名 · Pairhub
```

### Design tokens

- background: `#FFFFFF`
- top brand bar: 80 px, `linear-gradient(90deg, #4A90E2, #B07CE6)`
- title font: 36 px, `font-weight: 800`, `color: #1A1A1A`
- body font: 20 px, `color: #4A4A4A`
- QR: 200×200, 0 corner radius, 4 px brand-color border

### Differences from 朋友圈

- Smaller file (faster to send in a busy group)
- Wider aspect (1.5:1 instead of 1:1 — group chat preview crops to 1:1
  but a 1.5:1 source is sharper on retina)
- Less decorative; no glass blur; no background gradient
- Adds a `报名截止` deadline for urgency

---

## 3. Twitter — `twitter-card.png`

| | |
| --- | --- |
| Aspect | 1.91:1 (1200×630 px, Open Graph / Twitter card spec) |
| File size | ≤ 1 MB (Twitter image upload limit) |
| Format | PNG or JPG, sRGB, no transparency |
| Distribution | App 内「Share to Twitter」 → `twitter_flutter` SDK (planned v1.1) |
| Meta | Also used as the Open Graph `og:image` for the activity's H5 page |

### Visual layout

```
┌─────────────────────────────────────────────┐
│ [bg: brand dark navy #0F1A2E + 4-blob mesh, │
│      glass card on top]                     │
│                                             │
│  ┌─ glass card 720×480 ─────────────────┐   │
│  │                                      │   │
│  │  Pairhub                          │   │
│  │  ════════════                         │   │
│  │  🎲 桌游夜 · Sat 19:00                │   │
│  │  San Francisco · 2.3 km away          │   │
│  │                                      │   │
│  │  「Looking for Werewolf players」    │   │
│  │                                      │   │
│  │  → Sign up via the link in bio       │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│ [logo bottom-left]    [Pairhub.app]      │
└─────────────────────────────────────────────┘
```

### Copy

```
title:     Pairhub · {活动类型 emoji} {活动标题}
subtitle:  {开始时间, e.g. Sat 19:00 PDT} · {城市} · {距离} km
body:      「{英文描述前 50 字}」
cta:       → Sign up via the link in bio
footer:    Pairhub.app · #Pairhub
```

### Design tokens

- background: `#0F1A2E` + 4-blob mesh (blob colors `#4A90E2`,
  `#B07CE6`, `#5BD9C9`, `#FFB347` at 18% opacity, blur 120 px)
- glass card: `background: rgba(255,255,255,0.08)` + `backdrop-filter:
  blur(20px)` + 1 px inner border `rgba(255,255,255,0.18)`
- title: 48 px, `font-weight: 800`, `color: #FFFFFF`
- body: 22 px, `color: rgba(255,255,255,0.85)`
- footer: 18 px, `color: rgba(255,255,255,0.6)`

### Differences from WeChat variants

- Bilingual (English-first) — the Twitter audience is international
- OG-spec 1.91:1 aspect — works on both Twitter card and LinkedIn
  preview without re-crop
- Branded dark glass (matches the app's `dark mode default` — see
  `docs/design/admin-glass.md`) — visually distinct from the white
  WeChat cards so it doesn't look like a lazy re-export

---

## Implementation flow

The Flutter `share_card_generator` (in `app/lib/features/share/`,
planned v1.1) renders these 3 PNGs at share time using the design
tokens above. Until that ships, the share buttons deep-link into the
H5 activity page (which itself has the OG fallback for Twitter).

## Asset versioning

Every PNG export gets a content-hash suffix in the S3 path:
`Pairhub-assets/share-cards/wechat-moments.{shortSha}.png`. The
Flutter `AssetManifest` is regenerated on every build, so a content
change never ships a stale card.

## A11y

- All cards include alt text in the metadata (used by screen-readers
  on Twitter; ignored by WeChat, but cheap to add).
- WCAG AA contrast on all body text against its background.
- No essential information is color-only (the QR + text carry the
  load).

## When to use which

- 朋友圈: user wants to show off what they're up to (status signal)
- 微信群: user wants a quick "come join" CTA in a busy chat
- Twitter: user wants to publicise Pairhub to non-Chinese
  international students (low-priority for v1.0 — the v1.0 share
  buttons are WeChat-only; Twitter ships with v1.1)
