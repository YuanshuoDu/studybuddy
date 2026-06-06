# Design System v1 — Pairhub

**Status:** Frozen as of M2 close. Authoritative for both miniprogram + Flutter.
**Source of truth:** `app/lib/core/theme/design_tokens.dart` (Dart) and `miniprogram/styles/tokens.wxss` (WXSS). This document is the spec; the two token files are the runtime truth.

---

## 1. Scope

The design system covers:

- Color tokens (semantic + activity-type tints)
- Typography scale (display / title / body / label)
- Spacing scale (4-pt base)
- Radius scale
- Elevation (shadows)
- Iconography guidance
- Motion durations + easings
- 7 shared components: ActivityCard, StatusBadge, FilterChip, SignupButton, EmptyState, ErrorState, LoadingSkeleton

Not in scope: data tables, charts, marketing pages, error logs, map widgets (handled in M3).

---

## 2. Color tokens

### 2.1 Brand & semantic

| Token                | Light value | Use                                            |
|----------------------|-------------|------------------------------------------------|
| `--color-primary`    | `#3B82F6`   | Primary action, focus ring, links              |
| `--color-primary-container` | `#DBEAFE` | Background for selected/active states        |
| `--color-on-primary` | `#FFFFFF`   | Text/icons on top of `--color-primary`        |
| `--color-primary-active` | `#2563EB` | Pressed state for primary actions            |
| `--color-success`    | `#22C55E`   | "RECRUITING" status, success toasts            |
| `--color-success-bg` | `#DCFCE7`   | Soft badge background                          |
| `--color-warning`    | `#F59E0B`   | "FULL" status, warnings                        |
| `--color-warning-bg` | `#FEF3C7`   | Soft badge background                          |
| `--color-error`      | `#EF4444`   | "CANCELED" status, error toasts                |
| `--color-error-bg`   | `#FEE2E2`   | Soft badge background                          |
| `--color-info`       | `#3B82F6`   | "STARTED" status, info banners                 |

### 2.2 Surface & text

| Token                          | Light value | Use                                       |
|--------------------------------|-------------|-------------------------------------------|
| `--color-bg`                   | `#F8FAFC`   | App/page background                       |
| `--color-surface`              | `#FFFFFF`   | Card / sheet surface                      |
| `--color-surface-variant`      | `#F1F5F9`   | Subtle elevation, hover background         |
| `--color-divider`              | `#E2E8F0`   | 1-px dividers                             |
| `--color-border`               | `#CBD5E1`   | Input borders, outlined buttons           |
| `--color-text-primary`         | `#0F172A`   | Body text                                 |
| `--color-text-secondary`       | `#475569`   | Subtitles, captions                       |
| `--color-text-placeholder`     | `#94A3B8`   | Form placeholders                         |
| `--color-text-inverse`         | `#FFFFFF`   | Text on dark backgrounds                  |
| `--color-on-surface-variant`    | `#475569`   | Icon on `--color-surface-variant`         |

### 2.3 Activity type tints

| Token                          | Value      | Type            |
|--------------------------------|------------|-----------------|
| `--color-activity-study`       | `#3B82F6`  | STUDY (自习)    |
| `--color-activity-sport`       | `#22C55E`  | SPORTS (运动)   |
| `--color-activity-boardgame`   | `#A855F7`  | BOARD_GAME (桌游) |
| `--color-activity-online-game` | `#EF4444`  | ONLINE_GAME (开黑) |
| `--color-activity-other`       | `#64748B`  | OTHER (其他)    |

### 2.4 Dark mode

Dark mode is deferred to M3 (issue #34 monitoring block). All tokens above are **light-only** for M2. Flutter's Material 3 ColorScheme will derive dark variants from the seed `--color-primary` at runtime; miniprogram dark mode is a follow-up.

---

## 3. Typography

CJK-first. 4-pt baseline. Flutter side follows Material 3 type scale; miniprogram side uses rpx with the same logical naming.

| Token (Flutter `TextTheme`)  | Miniprogram `--font-*` | Size   | Line-height | Weight | Use                            |
|------------------------------|------------------------|--------|-------------|--------|--------------------------------|
| `displayMedium`              | `--font-display-m`     | 32 sp  | 1.25        | 700    | Empty-state title (rare)        |
| `headlineLarge`              | `--font-headline-l`     | 28 sp  | 1.30        | 700    | Activity detail title          |
| `titleLarge`                 | `--font-title-l`        | 22 sp  | 1.30        | 600    | Card title                     |
| `titleMedium`                | `--font-title-m`        | 18 sp  | 1.40        | 600    | Section header, dialog title  |
| `bodyLarge`                  | `--font-body-l`         | 16 sp  | 1.50        | 400    | Detail body text              |
| `bodyMedium`                 | `--font-body-m`         | 14 sp  | 1.55        | 400    | Card subtitle, list item desc |
| `bodySmall`                  | `--font-body-s`         | 12 sp  | 1.50        | 400    | Timestamps, captions          |
| `labelLarge`                 | `--font-label-l`        | 14 sp  | 1.20        | 500    | Button label                   |
| `labelMedium`                | `--font-label-m`        | 12 sp  | 1.20        | 500    | Chip / status badge text      |
| `labelSmall`                 | `--font-label-s`        | 11 sp  | 1.20        | 500    | Caption, micro-label          |

**CJK line-height rule:** for CJK content, `line-height: 1.55-1.65` is required; 1.5 is acceptable for short labels. Flutter side uses `height: 1.55`; miniprogram side uses `--line-cjk-body: 1.55` for body text and `--line-snug: 1.30` for headlines.

**Font stack:**
- Flutter (via `AppTheme`): `PingFang SC` (iOS) / `Microsoft YaHei` (Windows/Android) / `Roboto` (fallback).
- Miniprogram (via `app.wxss` `body { font-family }`): `-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif`.

---

## 4. Spacing

4-pt base. Use only these values; no magic numbers.

| Token         | dp / rpx | Use                                |
|---------------|----------|------------------------------------|
| `--space-2xs` | 2        | Hairline gap (title → subtitle)    |
| `--space-xs`  | 4        | Inline element gap (badge → badge) |
| `--space-sm`  | 8        | Tight stack gap (title row → value) |
| `--space-md`  | 12       | Default card padding inner         |
| `--space-lg`  | 16       | Default section padding            |
| `--space-xl`  | 24       | Card outer padding                 |
| `--space-2xl` | 32       | Page horizontal margin            |
| `--space-3xl` | 48       | Section break                      |
| `--space-huge` | 64      | Hero / empty state vertical padding |

---

## 5. Radius

| Token             | dp / rpx | Use                            |
|-------------------|----------|--------------------------------|
| `--radius-sm`     | 4        | Tag, chip                      |
| `--radius-md`     | 8        | Input, small card              |
| `--radius-lg`     | 12       | Default card                   |
| `--radius-xl`     | 16       | Sheet, modal                   |
| `--radius-pill`   | 999      | Pill badge, primary button    |

---

## 6. Elevation

| Token                | Flutter (`BoxShadow`)                  | WXSS (`box-shadow`)                            |
|----------------------|------------------------------------------|------------------------------------------------|
| `--elevation-soft`   | 0 1 2 rgba(0,0,0,0.04)                    | 0 1rpx 2rpx rgba(0,0,0,0.04)                  |
| `--elevation-medium` | 0 2 8 rgba(0,0,0,0.06)                    | 0 2rpx 8rpx rgba(0,0,0,0.06)                  |
| `--elevation-raised` | 0 4 16 rgba(0,0,0,0.08)                    | 0 4rpx 16rpx rgba(0,0,0,0.08)                 |

---

## 7. Iconography

- Source: [lucide.dev](https://lucide.dev) — 24×24 viewport, `stroke-width: 2`, `stroke: currentColor`, `fill: none`.
- Flutter equivalent: `flutter_lucide` package (add in M3 if we use icons heavily; for M2 we ship 7 hand-coded SVG icons inline).
- Common sizes: 14 (inline-with-text), 18 (chip/badge), 24 (button), 32 (illustration).

---

## 8. Motion

| Token                     | Value          | Use                                    |
|---------------------------|----------------|----------------------------------------|
| `--motion-duration-fast`  | 120 ms         | Hover, pressed, focus                 |
| `--motion-duration-base`  | 200 ms         | Default transitions                   |
| `--motion-duration-slow`  | 360 ms         | Modal open, page transition           |
| `--motion-ease-standard`  | `cubic-bezier(0.2, 0, 0, 1)` | 90% of transitions      |
| `--motion-ease-emphasized` | `cubic-bezier(0.3, 0, 0, 1)` | Hero / important state changes |

**Reduced motion:** respect OS `prefers-reduced-motion: reduce` — collapse `--motion-duration-*` to 0 ms; keep easing.

---

## 9. Status badge color map

| Activity status  | Background token       | Text token             | Pinned-color (full saturation) |
|------------------|-------------------------|------------------------|--------------------------------|
| RECRUITING       | `--color-success-bg`    | `--color-success`      | `--color-success`               |
| FULL             | `--color-warning-bg`    | `--color-warning`      | `--color-warning`               |
| STARTED          | `--color-info`          | `--color-on-primary`   | `--color-info`                  |
| ENDED            | `--color-surface-variant` | `--color-on-surface-variant` | `--color-on-surface-variant` |
| CANCELED         | `--color-error-bg`      | `--color-error`        | `--color-error`                 |

**Two variants:**
- **Soft badge** (list cards): background = token, text = full saturation. Used where 5+ badges appear close together.
- **Hero badge** (detail page first badge): background = full saturation, text = `--color-on-primary`. Used to anchor the status visually.

---

## 10. How to apply

### Flutter

```dart
import 'package:pairhub/core/theme/design_tokens.dart';

final card = Container(
  padding: EdgeInsets.all(DesignSpacing.lg),
  decoration: BoxDecoration(
    color: DesignColors.surface,
    borderRadius: BorderRadius.circular(DesignRadius.lg),
    boxShadow: [DesignElevation.soft],
  ),
  child: Text('Hello', style: DesignText.bodyMedium),
);
```

The legacy `AppColors` / `AppSpacing` / `AppRadius` typedefs in `app_colors.dart` re-export these for one release cycle, then are removed in v1.1.

### Miniprogram

```xml
<view class="card">Hello</view>
```

```css
/* in pages/foo/foo.wxss */
.card {
  padding: var(--space-lg);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-soft);
  color: var(--color-text-primary);
  font-size: var(--font-body-m);
  line-height: var(--line-cjk-body);
}
```

`@import './styles/tokens.wxss';` in `app.wxss` makes the tokens globally available.

---

## 11. Versioning

This is **v1** — M2 frozen. Breaking changes require an ADR. Additive changes (new tokens for new components) can land in patch versions.

| Version | Date       | Notable changes                                  |
|---------|------------|--------------------------------------------------|
| v1.0    | 2026-06-06 | Initial M2 freeze                                |
