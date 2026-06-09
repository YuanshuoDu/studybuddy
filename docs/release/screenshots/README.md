# App store screenshots — spec (issue #33)

> 5-8 screenshots per platform (iOS / Android / WeChat Mini Program) for
> the M3 launch. Every screenshot has: a fixed safe area, copy slots,
> the brand system tokens, and a designated "hero" role on the store
> page (first 3 are the most important; 4-5 are secondary; 6-8 are
> "deep cut" feature highlights).

> The actual `.png` exports ship in a follow-up PR (requires running
> the Flutter `screenshot_orchestrator` on a real device farm — see
> `app/lib/release/screenshot_orchestrator.dart`, planned v1.1). This
> spec is the design + copy contract for the export.

## Platform matrix

| Platform | Store | Count | Aspect (px) | Format | File size |
| --- | --- | --- | --- | --- | --- |
| iOS iPhone 6.7" | App Store | 6 | 1290×2796 (3x) | PNG, sRGB, no alpha | ≤ 8 MB each |
| iOS iPad 12.9" | App Store | 4 | 2048×2732 (2x) | PNG, P3 if possible | ≤ 12 MB each |
| Android phone | Google Play | 8 | 1080×1920 (xxhdpi) | PNG, sRGB | ≤ 8 MB each |
| Android tablet | Google Play | 2 | 1600×2560 | PNG, sRGB | ≤ 8 MB each |
| 国内 Android | 华为/小米/oppo/vivo/应用宝 | 5 | 1080×1920 | PNG, sRGB | ≤ 4 MB each |
| WeChat Mini Program | 微信小程序后台 | 5 | 750×1334 (iPhone 6 baseline) | PNG, sRGB | ≤ 2 MB each |

Total: 30 distinct PNGs across 6 platform/store combinations.

## Common spec

| | |
| --- | --- |
| Safe area (status bar) | 132 px top, 102 px bottom (iOS 6.7"); 84 px top, 48 px bottom (Android xxhdpi) |
| Brand mark | bottom-left, 24 px from edge, 80×80 px, `--ink` background |
| Headline | top 1/3, 56-72 px, serif, `--ink` on cream, white on dark |
| Body copy | top 2/3, 28-36 px, sans, `--ink-soft` on cream, `rgba(255,255,255,0.8)` on dark |
| Status bar | always the system status bar (clock + battery), never cropped |
| "Get the app" CTA | only on the LAST screenshot per platform (the "view all" final frame) |
| Frame | device frame is the actual OS (no fake device chrome) — captures are made on real devices via the Flutter screenshot orchestrator |

## The 8 universal frames (picked from for each platform)

### Frame 1 — Hero: "Find your people, on campus and beyond."

- Map view, 25 km radius, "本周" filter
- 8 pins visible, mixed types (study / sports / food)
- 1 pin is selected, callout shows: title, host, time, distance, "5/8 已报名"
- Top: title (Chinese + English subtitle)
- Bottom: brand mark + small "StudyBuddy" text

### Frame 2 — Activity detail

- Activity title + cover image (full bleed)
- Time + location (mini map)
- "12 已报名 / 15" with avatar stack
- "报名" CTA, prominent
- Subtitle: "一键报名，对发起人说句话"

### Frame 3 — Sign up confirmation

- "✓ 报名成功" headline
- Activity card collapsed below
- "添加到日历" + "查看路线" secondary CTAs
- Subtitle: "活动前 2 小时可取消"

### Frame 4 — Discover (list mode)

- Filter chips: "全部" "学习" "运动" "桌游" "美食" "旅行"
- Card per activity (title, time, distance, host avatar, type icon)
- "📍 离我 2.3 km" badge on each card
- Subtitle: "列表 + 地图切换，发现同好"

### Frame 5 — Create activity form

- Multi-step indicator at top (4/4)
- "补充" step: tag picker, notes
- Big primary CTA "提交审核"
- Subtitle: "15 分钟内出审核结果"

### Frame 6 — Review flow

- 5 stars selected, 2 tags chosen, comment field
- "提交评价" CTA
- Subtitle: "活动结束后 7 天内可评"

### Frame 7 — Profile (post-event)

- User avatar, nickname, school
- "⭐ 4.9" + tag cloud
- 3 most recent reviews (private comments locked)
- Subtitle: "你的信用 = 你的活动力"

### Frame 8 — Onboarding / sign up

- 1-tap WeChat login button (the "magic" moment)
- School / major / year 3-step picker collapsed below
- Subtitle: "1 键登录，30 秒开始"

## Per-platform selection

| Platform | Picks (frame #s) |
| --- | --- |
| iOS iPhone 6.7" | 1, 2, 4, 7, 5, 8 (the "magic moment" frames; ends on onboarding for the funnel pitch) |
| iOS iPad 12.9" | 1, 2, 4, 7 (the "showcase" frames; bigger screen = fewer screenshots) |
| Android phone | 1, 2, 3, 4, 5, 6, 7, 8 (full coverage; Play Store is the highest-traffic store) |
| Android tablet | 1, 2, 4 (Google Play tablets are minor) |
| 国内 Android | 1, 2, 4, 5, 8 (skip review flow — 国内 store审核不喜欢出现"评价"关键词) |
| WeChat Mini Program | 1, 2, 3, 4, 7 (Mini Program is a single-task tool, not a full app showcase) |

## Localization

- Primary: 中文 (zh) for all 6 platforms
- Secondary: English (en) for iOS iPhone + iPad + Android phone (the
  international student audience reads English)
- 国内 Android + WeChat Mini Program: zh only

Total PNG count: 30 (zh) + 14 (en) = **44 PNG exports**.

## Generation pipeline (v1.1, planned)

1. Flutter `screenshot_orchestrator` boots a real device farm (or
   Bitrise / GitHub Actions iOS sim + Android emulator)
2. Pre-seeds the DB with the `prisma/seed-large.ts` data (50 users,
   12 activities, etc.)
3. Runs the app, navigates to each Frame, takes the screenshot
4. Post-processes: applies the brand mark + headline overlay via
   ImageMagick (script lives at `app/scripts/screenshot-overlay.sh`)
5. Outputs to `app/release/screenshots/{platform}/{frame}.png`
6. CI uploads to App Store Connect / Google Play Console / 微信小程序
   background via fastlane (see `app/fastlane/`)

## When to regenerate

- Every minor version bump (e.g. 1.0 → 1.1): regenerate all 44
- Major copy / visual refresh: regenerate all 44
- Bug fix in a single frame: regenerate that one frame (other 43 stay)
- A new feature ships: add a 9th frame to the universal set, re-pick
  per platform, regenerate

## File-naming convention

`{platform}-{frame}-{lang}.png`

Examples:
- `ios-iphone-67-frame-1-zh.png`
- `android-phone-frame-4-en.png`
- `mp-wechat-frame-3-zh.png`

S3 path: `s3://studybuddy-release-assets/screenshots/v{version}/{filename}`

## Style guardrails (do NOT do these in any screenshot)

- No emoji-only headlines (use real text)
- No fake user data ("张三" / "abc@example.com" / "+1 555-1234" —
  use the seed users `seed-user-01` etc.)
- No mockup of competitor apps in the same frame
- No "lifestyle stock photo" backgrounds (use the actual app screens)
- No "before/after" split that implies the old version was broken
- No device chrome / 3D rotation (the OS frame is the real one)
- No "Made with Flutter" or framework credits in the screenshot

## Approval flow

- Design review by 1 product designer + 1 marketing designer
- A/B test 2 of the 8 frames for 1 week on the landing page; pick
  the higher CTR for the store listing
- Final sign-off from product owner; upload via fastlane
