// Design tokens — the authoritative source for Pairhub's visual system.
// Spec: docs/design/system-v1.md. All miniprogram + Flutter code MUST import
// from this file; do not introduce new color hex / spacing values inline.
//
// The legacy `app_colors.dart` typedefs `AppColors` / `AppSpacing` /
// `AppRadius` to these classes for one release cycle (removed in v1.1).

import 'package:flutter/material.dart';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

class DesignColors {
  DesignColors._();

  // Brand
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryContainer = Color(0xFFDBEAFE);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color primaryActive = Color(0xFF2563EB);

  // Semantic
  static const Color success = Color(0xFF22C55E);
  static const Color successBg = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFEF4444);
  static const Color errorBg = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF3B82F6);

  // Surface
  static const Color bg = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF1F5F9);
  static const Color divider = Color(0xFFE2E8F0);
  static const Color border = Color(0xFFCBD5E1);

  // Text
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textPlaceholder = Color(0xFF94A3B8);
  static const Color textInverse = Color(0xFFFFFFFF);
  static const Color onSurfaceVariant = Color(0xFF475569);

  // Activity type tints
  static const Color activityStudy = Color(0xFF3B82F6);
  static const Color activitySport = Color(0xFF22C55E);
  static const Color activityBoardgame = Color(0xFFA855F7);
  static const Color activityOnlineGame = Color(0xFFEF4444);
  static const Color activityOther = Color(0xFF64748B);
}

// ---------------------------------------------------------------------------
// Spacing — 4-pt base. Use only these values; do not introduce new spacing
// literals inline.
// ---------------------------------------------------------------------------

class DesignSpacing {
  DesignSpacing._();

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;
  static const double huge = 64;
}

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

class DesignRadius {
  DesignRadius._();

  static const double sm = 4;
  static const double md = 8;
  static const double lg = 12;
  static const double xl = 16;
  static const double pill = 999;
}

// ---------------------------------------------------------------------------
// Elevation — Flutter `BoxShadow` instances. WXSS equivalents in
// miniprogram/styles/tokens.wxss under `--elevation-*`.
// ---------------------------------------------------------------------------

class DesignElevation {
  DesignElevation._();

  static const List<BoxShadow> soft = [
    BoxShadow(
      color: Color.fromRGBO(0, 0, 0, 0.04),
      offset: Offset(0, 1),
      blurRadius: 2,
    ),
  ];

  static const List<BoxShadow> medium = [
    BoxShadow(
      color: Color.fromRGBO(0, 0, 0, 0.06),
      offset: Offset(0, 2),
      blurRadius: 8,
    ),
  ];

  static const List<BoxShadow> raised = [
    BoxShadow(
      color: Color.fromRGBO(0, 0, 0, 0.08),
      offset: Offset(0, 4),
      blurRadius: 16,
    ),
  ];
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

class DesignMotion {
  DesignMotion._();

  static const Duration fast = Duration(milliseconds: 120);
  static const Duration base = Duration(milliseconds: 200);
  static const Duration slow = Duration(milliseconds: 360);

  static const Curve easeStandard = Cubic(0.2, 0, 0, 1);
  static const Curve easeEmphasized = Cubic(0.3, 0, 0, 1);
}

// ---------------------------------------------------------------------------
// Text theme — Material 3 scale, CJK-tuned. Applied via
// `Theme.of(context).textTheme` after the app theme is wired in
// `lib/core/theme/app_theme.dart`.
// ---------------------------------------------------------------------------

class DesignText {
  DesignText._();

  // The actual `TextTheme` instance is built in app_theme.dart; these static
  // helpers are for ad-hoc styling outside a `BuildContext` (e.g. inside a
  // stateless utility class).
  static const TextStyle displayMedium = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    height: 1.25,
  );

  static const TextStyle headlineLarge = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    height: 1.30,
  );

  static const TextStyle titleLarge = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w600,
    height: 1.30,
  );

  static const TextStyle titleMedium = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 1.40,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    height: 1.50,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.55,
  );

  static const TextStyle bodySmall = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    height: 1.50,
  );

  static const TextStyle labelLarge = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    height: 1.20,
  );

  static const TextStyle labelMedium = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.20,
  );

  static const TextStyle labelSmall = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    height: 1.20,
  );
}
