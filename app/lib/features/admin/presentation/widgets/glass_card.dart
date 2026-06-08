// Glass card — issue #32 admin UI (Flutter half).
//
// The single primitive that every admin surface (cards, sheets,
// toolbars, modals) is built on. Per the brief §3:
//
//   "Use ClipRRect + BackdropFilter with ImageFilter.blur(sigmaX: 20,
//    sigmaY: 20). Wrap in a Stack so the inner highlight can be a
//    Positioned.fill with a DecoratedBox(decoration: BoxDecoration
//    (gradient: ...))."
//
// The result is a translucent panel that lets the [MeshBackground]
// underneath show through (the *translucency* is the visual
// signature, not the content inside the panel).
//
// Use:
//   - `GlassCard` for typical "card" surfaces (radius 20).
//   - `GlassSheet` for the bottom-sheet / modal container (radius 28,
//     level-2 shadow, `glass-bg-deep` tint).
//   - `Glass` for any other ad-hoc surface (custom blur sigma,
//     custom radius, custom border).

import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../../core/theme/design_tokens.dart';

enum GlassSize { sm, md, lg }

/// Reusable translucent surface. Defaults match the brief's `--glass-*`
/// tokens so the rest of the app only has to import this widget and
/// pick a [GlassSize].
class Glass extends StatelessWidget {
  const Glass({
    required this.child,
    this.size = GlassSize.md,
    this.sigma,
    this.radius,
    this.border,
    this.padding,
    this.margin,
    this.onTap,
    this.color,
    super.key,
  });

  final Widget child;
  final GlassSize size;

  /// Override the backdrop blur sigma. Defaults to
  /// [GlassBlur.md] (20) for md, [GlassBlur.lg] (32) for lg, and
  /// [GlassBlur.sm] (12) for sm.
  final double? sigma;

  /// Override the corner radius. Defaults to [GlassRadius.md] (20)
  /// for md, [GlassRadius.lg] (28) for lg, and [GlassRadius.sm]
  /// (12) for sm.
  final double? radius;

  /// Whether to draw the 1px glass border. Defaults to true.
  final bool? border;

  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  /// When non-null, the panel is wrapped in a [Material] +
  /// [InkWell] so it picks up the press feedback.
  final VoidCallback? onTap;

  /// Optional override for the surface tint. Defaults to
  /// `GlassColors.surface(brightness)`.
  final Color? color;

  double _resolveSigma() {
    if (sigma != null) return sigma!;
    switch (size) {
      case GlassSize.sm:
        return GlassBlur.sm;
      case GlassSize.md:
        return GlassBlur.md;
      case GlassSize.lg:
        return GlassBlur.lg;
    }
  }

  double _resolveRadius() {
    if (radius != null) return radius!;
    switch (size) {
      case GlassSize.sm:
        return GlassRadius.sm;
      case GlassSize.md:
        return GlassRadius.md;
      case GlassSize.lg:
        return GlassRadius.lg;
    }
  }

  bool _resolveBorder() => border ?? true;

  @override
  Widget build(BuildContext context) {
    final Brightness brightness = Theme.of(context).brightness;
    final double r = _resolveRadius();
    final double sigma = _resolveSigma();
    final bool drawBorder = _resolveBorder();
    final Color tint = color ?? GlassColors.surface(brightness);
    final Color borderColor = GlassColors.border(brightness);
    final List<BoxShadow> shadow = GlassShadow.level2(brightness);

    Widget panel = ClipRRect(
      borderRadius: BorderRadius.circular(r),
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
        child: Stack(
          children: <Widget>[
            // 1) Solid translucent fill (the tint that the user sees
            //    THROUGH the blurred mesh). Without this, the
            //    BackdropFilter passes the un-modified mesh through
            //    and the text would be unreadable.
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: tint,
                  borderRadius: BorderRadius.circular(r),
                ),
              ),
            ),
            // 2) Inner highlight gradient — a soft 1-stop linear
            //    gradient from the highlight color at the top to
            //    transparent at the bottom. Gives the panel the
            //    "lit from above" Apple-style edge.
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(r),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: <Color>[
                      GlassColors.highlight(brightness),
                      const Color(0x00000000),
                    ],
                    stops: const <double>[0.0, 0.5],
                  ),
                ),
              ),
            ),
            // 3) The actual content. Sits above both layers.
            if (padding != null)
              Padding(padding: padding!, child: child)
            else
              child,
            // 4) The 1px border is drawn last so it sits on top of
            //    the highlight gradient and stays crisp.
            if (drawBorder)
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(r),
                      border: Border.all(color: borderColor, width: 1),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );

    if (margin != null) {
      panel = Padding(padding: margin!, child: panel);
    }

    if (onTap != null) {
      panel = Material(
        color: const Color(0x00000000),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(r),
          child: panel,
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(r),
        boxShadow: shadow,
      ),
      child: panel,
    );
  }
}

/// Standard glass card (medium size, MD blur, MD radius). Use this for
/// list rows, the gate card, the dashboard metrics tiles, etc.
class GlassCard extends StatelessWidget {
  const GlassCard({
    required this.child,
    this.padding = const EdgeInsets.all(DesignSpacing.lg),
    this.margin,
    this.onTap,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Glass(
      size: GlassSize.md,
      padding: padding,
      margin: margin,
      onTap: onTap,
      child: child,
    );
  }
}

/// Bottom-sheet / modal container. Bigger blur, larger radius,
/// `glass-bg-deep` tint, no top-level tap target.
class GlassSheet extends StatelessWidget {
  const GlassSheet({required this.child, this.padding, super.key});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final Brightness brightness = Theme.of(context).brightness;
    return Glass(
      size: GlassSize.lg,
      padding: padding,
      color: GlassColors.deep(brightness),
      child: child,
    );
  }
}
