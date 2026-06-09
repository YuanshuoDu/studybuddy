# Pairhub FAQ — English

> Activity-matching app for Chinese students studying abroad. The 10
> most-asked questions. Every answer maps to actual code under
> `docs/spec-v0.1.md` / `docs/admin/playbook.md` / `docs/modules/analytics.md`.

Last updated: 2026-06-09

---

## 1. What is Pairhub?

Pairhub is a **hobby + activity matching app for Chinese students
studying overseas**. You search for nearby activities by geo, interest
tags, school, or major — study groups, sports, board-game nights, food
runs, weekend trips — and sign up with one tap, check in at the event,
then rate each other afterwards.

**Available on**:

- iOS / Android (Flutter, on App Store / Google Play / domestic stores)
- WeChat Mini Program (search "Pairhub")

**Core features**:

- Map-based activity discovery (Mapbox + your live location)
- 6 activity types: STUDY / SPORTS / BOARD_GAME / FOOD / TRAVEL / OTHER
- 6-state machine: PENDING_REVIEW → RECRUITING → FULL → STARTED → ENDED / REJECTED / CANCELED
- 1-5 star post-event reviews
- Push: WeChat template + iOS APNs + Android FCM + mainland TPNS

---

## 2. How do I sign up?

3 options, pick whichever is easiest:

- **WeChat** (Mini Program, plus in-app SDK) — 1-tap login, no form
- **Phone number** (iOS / Android) — receive 1 SMS code (valid 120s)
- **Apple ID** (iOS) — privacy-first, you can hide the real email

After sign-up the app **forces** you to pick at least 1 school + 1 major
+ 1 enrollment year. These 3 are the basis for activity matching and
the "same school" filter — you can't reach the home screen without them.

**Phone number / WeChat unionid** are first-class identifiers: if either
is already registered, we treat it as the same account — switching login
method won't lose your data.

---

## 3. How do I find activities near me?

Open the app, the map mode (📍 Nearby) defaults to a 50 km radius
showing all `RECRUITING` / `FULL` activities around your current GPS.

**Radius slider**: bottom-right of the map — 5 / 10 / 25 / 50 km.

**Time filter**: top tab — `Today` / `This week` / `This weekend` /
`Custom` (date range).

**Filters**: 🎛️ top-left — activity type, school, women-only, free-only.

> **Heads-up**: the first launch asks for Location permission. If you
> decline, the map falls back to your school's lat/lng (from sign-up);
> you can search an address manually.

---

## 4. How do I create an activity?

Home → bottom tab `+` → pick activity type → fill 4 sections:

1. **Basics** (required): title, description (≤ 500 chars), cover image
   (jpg/png, ≤ 5 MB, max 3)
2. **Time + place** (required): start, end, location (map pin + text
   address), radius (5/10/25/50 km)
3. **Join policy** (required): capacity (2-50), needs approval, women-only,
   free
4. **Extras** (optional): tags (max 5), notes

After submit the activity enters `PENDING_REVIEW` (auto content-safety
+ manual moderation, decision in 15 min). Once approved it becomes
`RECRUITING` and shows on the map.

> **Got rejected?** You'll get a system message + the reason. Edit and
> re-submit; you don't have to refill the form.

---

## 5. What is content-safety moderation? Will my privacy leak?

Pairhub has 2 gates protecting you and the platform:

1. **Auto moderation** (WeChat / Aliyun content-safety API): title +
   description + cover image go through text + image checks. Matches
   on profanity, gore, politics → instant reject.
2. **Manual second-pass** (platform ops): a 1% random sample of
   auto-passed activities is human-reviewed. Usually < 2 hours.

**Your privacy**:

- Auto moderation only sends **title + description + cover** to the API.
  **None** of your personal data (phone, openid, IP, device ID) is sent.
- Moderation results are visible to you and platform ops only.
- 3 failed re-submits on the same activity triggers an automatic human
  review (no more bot-only verdict).

Technical details: `docs/ops/mp-audit-config.md`.

---

## 6. How do I sign up for / cancel / check in to an activity?

**Sign up**: activity detail → `Sign up` button → write 1 line "message
to the host" (≤ 100 chars, optional) → submit. If the activity needs
approval (`isAudited = true`), your sign-up is `PENDING` until the
host / platform approves it → `APPROVED`.

**Cancel**: Me → My sign-ups → find the activity → `Cancel`. You can
only cancel **up to 2 hours before start time** (no last-minute flake).
After 2h, contact the host manually.

**Check in**: at the venue the host shows a 6-digit code (rotates every
5 min). Participants enter the code → status becomes `ATTENDED`.
**No-shows** are auto-`CANCELED` when the activity ends and don't count
toward your credit score.

---

## 7. How do post-event reviews work? What can I review?

Within 7 days after the activity goes `ENDED`, you and all checked-in
participants can rate each other:

- Rating: 1-5 stars (required)
- Tags (optional): on-time / chatty / reliable / fun / attentive (≤ 3)
- Text comment: ≤ 500 chars, optional

**Visibility**:

- Your **aggregate rating** + **tag cloud** show on your public profile
  (visible to others)
- Text comments are **private by default** — only you + the reviewee see
  them. Both parties can flip a comment to public, then it appears on
  the profile.
- You can only review a person once per activity. Edits go through
  customer support.

> **Heads-up**: no self-reviews; no reviews of people who didn't check
> in; no reviews outside the 7-day window.

---

## 8. How do I report a user / a review / an activity?

Every user, review, and activity detail page has a 🚩 **Report** button.

**Report categories** (pick 1):

- Harassment / abuse
- Fraud / take-money-and-run
- Misinformation (activity / review)
- Politics / porn / violence
- Other (≤ 200 chars required)

You'll get 1 platform-ops response within 24 hours. **For emergencies**
(offline personal-safety threats) **call local emergency services
first** (911 / 999 etc) — the platform can't do first response.

The platform **strictly protects the reporter's identity** — the
reported user never sees who reported them.

---

## 9. Pricing, insurance, data security

**Pricing**: Pairhub v1.0 is **free**. No service fee, no commission.
Whether the activity itself charges is up to the host (the activity
detail page says so explicitly); we provide AA-split / WeChat-pay tools
but never touch the money.

**Insurance**: Pairhub the platform **does not** provide commercial
insurance to participants. **Strongly recommend** every participant
buy their own travel / outdoor / short-term accident insurance. If you
organise a high-risk activity (skiing, climbing, off-road, etc.) please
state "participants must have their own insurance" in the description.

**Data security**:

- Your account data lives in AWS Frankfurt (eu-central-1) with
  us-east-1 standby
- All HTTPS / TLS 1.3; sensitive fields (phone, openid) AES-256 at rest
- Backups retained 30 days rolling; 30+ day backups auto-destroyed
- We **don't sell** your data, **don't run** ad SDKs, **don't embed**
  any analytics / tracking scripts

Details: `docs/ops/legal/privacy-policy.en.md`.

---

## 10. How do I delete my account / data?

**In-app**: `Me` → `Settings` → `Account & security` → `Delete account` →
re-confirm (enter 6-digit SMS code) → **immediately frozen for 7 days**
(cooling-off) → **fully deleted** after 7 days (irrecoverable).

**What gets deleted**:

- The account itself
- Avatar / nickname / bio
- Activities you posted, sign-ups, reviews you wrote
- Your device push tokens
- Your location history (we never persisted it — **there is nothing to
  delete**)

**What we keep** (legal / compliance):

- Financial records (when we have paying features) for 7 years
- Suspected illegal activity / review records, until case resolution
- Your sign-up records (anonymized to activity-id + status) for 90 days
  after the activity ends

Before deletion you can one-click export all personal data (JSON, sent
to your registered email within 7 days).

---

## Still have questions?

- 📧 Email: [support@pairhub.app](mailto:support@pairhub.app)
- 💬 User group: see in-app `Me` → `Join user group`
- 🐛 Issues: [github.com/YuanshuoDu/pairhub/issues](https://github.com/YuanshuoDu/pairhub/issues)
- 📜 Terms: `docs/ops/legal/terms-of-service.en.md`
- 🔒 Privacy: `docs/ops/legal/privacy-policy.en.md`
