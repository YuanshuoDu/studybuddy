# Push notification provider — selection (issue #27)

> **Status**: Decision recorded 2026-06-08. M3 W2 ships the live
> integration once tenant credentials land.
>
> See ADR-0001 (already in main, `docs/architecture/adr-0001-…
> *.md`) for the cross-cutting context.

---

## 1. Constraints

StudyBuddy is a **multi-platform** social app with an unusually mixed
audience:

| Platform | Share (est., M3) | Note |
| --- | --- | --- |
| 微信小程序 | ~70% | StudyBuddy's primary client (PR #15) |
| iOS (App Store) | ~20% | M3 W1 (TestFlight, PR #45) |
| Android (Play Store) | ~10% | M3 W1 (Android scaffold, PR #57) |

Plus the **user** profile is heavily mainland-China-resident on the
**miniprogram** side (WeChat-native, mainland network), and
international on the iOS/Android side (App Store / Play Store,
non-mainland network).

That makes the choice painful: any provider that works well in
mainland China is weak internationally, and vice versa.

---

## 2. Options

### 2.1 WeChat 模板消息 (miniprogram only)

- ✅ Free (within monthly quota per service-account tier)
- ✅ Best mainland-China delivery rate; no extra SDK on miniprogram side
- ❌ WeChat-only — no iOS, no Android, no FCM-bridged fallback
- ❌ 模板审核 (template-id) gates every new message category; slow
- ❌ 一次性订阅消息 (subscribe-message) only fires after explicit user consent; **not** a true push channel

**Verdict**: Use as a **secondary** channel for miniprogram-only
announcements (e.g. "你的活动被审核通过"). Not the primary push.

### 2.2 Tencent Push Notification Service (TPNS)

- ✅ Native miniprogram SDK (`wx.requestSubscribeMessage` + TPNS-HTTP)
- ✅ Native iOS + Android SDKs (covers all 3 client types)
- ✅ Reasonable mainland + international delivery
- ❌ Tencent account, KYC gate for international push (separate
  certificate)
- ❌ Vendor lock-in; per-message pricing at scale

**Verdict**: Strong fit for the **miniprogram**. Acceptable for
iOS/Android but we can do better with APNs/FCM for international.

### 2.3 Firebase Cloud Messaging (FCM) — Android + iOS

- ✅ Free up to unlimited messages
- ✅ Best international delivery rate (Google infrastructure)
- ✅ First-class Flutter support via `firebase_messaging`
- ❌ Mainland China: requires Google Play Services (banned on
  mainland-sold Android phones; works on overseas-sold ones)
- ❌ Mainland China: no direct delivery; FCM messages need to be
  relayed through a mainland-accessible proxy (e.g. TPNS's
  international relay) — adds a hop and 100-300ms latency

**Verdict**: Primary for iOS + overseas-Android. Skip for mainland
Android (covered by TPNS instead).

### 2.4 Apple Push Notification service (APNs)

- ✅ Required for iOS production push; the only real option on the
  platform
- ✅ Free
- ❌ Apple Developer account, provisioning profile
- ❌ iOS-only

**Verdict**: Mandatory for iOS. We use it via `firebase_messaging`'s
APNs bridge (the Flutter plugin handles APNs automatically) — no
extra integration work.

### 2.5 Mi Push / Huawei Push / vivo Push (mainland Android)

- ❌ Three separate SDKs to integrate + test
- ❌ Each requires a manufacturer developer account + signing
- ❌ Each has different payload limits, different registration flows

**Verdict**: Defer to M3 W2+ **only** if TPNS+FCM coverage proves
insufficient on mainland-Android. For M3 launch, TPNS covers
mainland Android adequately.

---

## 3. Decision

| Channel | Miniprogram | iOS | Mainland Android | Overseas Android |
| --- | --- | --- | --- | --- |
| **WeChat 模板消息** | ✅ (announcements) | ❌ | ❌ | ❌ |
| **TPNS** | ✅ (transnational) | ✅ (fallback) | ✅ (primary) | ⚠️ (works but slow) |
| **FCM → APNs** | ❌ | ✅ (primary) | ❌ (blocked) | ✅ (primary) |
| **FCM → FCM** | ❌ | (covered above) | ❌ | (covered above) |

So the final stack is:

1. **iOS push**: APNs (bridged via `firebase_messaging`)
2. **Mainland-Android push**: TPNS
3. **Overseas-Android push**: FCM (direct)
4. **Miniprogram push** (wechat-exclusive): WeChat 模板消息 for
   one-off announcements; nothing for everyday push (miniprogram
   users see the activity stream directly, push is mostly for
   "你报名的活动 1 小时后开始" reminders — that's the
   notification, not the message)

The **server-side** abstraction in PR #61 covers all four with
a single `PushToken` table + a thin `PushService` that dispatches
based on the channel stored at registration time. The provider
implementations are swappable; M3 launch ships a noop
implementation, M3 W2 wires TPNS+FCM+APNs.

---

## 4. What ships in this PR (#61)

- `prisma/schema.prisma`: new `PushToken` model (id, userId, token,
  channel enum, createdAt, lastSeenAt, device info)
- `server/src/modules/push/`: module skeleton
  - `POST /api/v1/devices` — register / refresh a token
  - `GET /api/v1/devices` — list current user's tokens
  - `DELETE /api/v1/devices/:id` — unregister
  - `push.service.ts` — abstract dispatcher (noop impl for now)
  - `push.schema.ts` — zod schemas
- `server/tests/modules/push/push.routes.test.ts` — 4 cases
- **No provider credentials** in this PR; M3 W2 wires TPNS / FCM

## 5. What does NOT ship in this PR

- TPNS / FCM / APNs **credentials** (awaiting ops)
- **Client-side** push registration (Flutter + miniprogram followups)
- **Background message handlers** (Flutter `onMessage` / onBackgroundMessage)
- **Notification icon / sound** assets

These are M3 W2+ work, tracked under issues #27 (this one) and a
followup "M3 W2 push wire-up" issue once provider tenants are live.
