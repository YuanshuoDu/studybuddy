// Mesh background — issue #32 admin UI.
//
// Renders the colorful gradient mesh that sits behind every admin
// screen. Mirrors `--mesh-{1..4}` in `docs/design/admin-glass.md` §2.
//
// Implementation choice: we use a [CustomPaint] (per the brief §2)
// with a [MeshPainter] that paints 4 large soft radial blobs in the
// corners, each one a different palette entry from
// `MeshColors.forBrightness(brightness)`. The blobs are static by
// default; passing `animated: true` enables a slow 60s loop where the
// blob centers drift a few percent of the canvas width around their
// rest position. Both modes honor
// `MediaQuery.of(context).disableAnimations` per the brief §7.
//
// The widget is intentionally lightweight — no [ShaderMask] (which
// would force a single pass) and no [BackdropFilter] (the mesh is the
// BACKGROUND, not a surface blur). The whole thing lives behind the
// rest of the page tree via a [Stack] in the page's root.

import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../../core/theme/design_tokens.dart';

class MeshBackground extends StatefulWidget {
  const MeshBackground({
    required this.child,
    this.animated = false,
    this.blurOverride,
    super.key,
  });

  /// Page content that sits on top of the mesh.
  final Widget child;

  /// When true, blob centers slowly drift in a 60s loop. Default
  /// false. If the user has `disableAnimations` set in
  /// [MediaQuery], the drift is suppressed even when this is true.
  final bool animated;

  /// Optional override for the blob blur radius. Defaults to
  /// `MeshColors.blurFor(brightness)`.
  final double? blurOverride;

  @override
  State<MeshBackground> createState() => _MeshBackgroundState();
}

class _MeshBackgroundState extends State<MeshBackground>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  Duration _t = Duration.zero;
  bool _isTicking = false;

  // Each entry is a fraction of the canvas (0..1) where the blob is
  // anchored. The painter multiplies by the canvas size at draw time.
  static const List<Offset> _restPositions = <Offset>[
    Offset(0.15, 0.20), // top-left
    Offset(0.85, 0.18), // top-right
    Offset(0.18, 0.82), // bottom-left
    Offset(0.82, 0.85), // bottom-right
  ];

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
  }

  @override
  void didUpdateWidget(covariant MeshBackground old) {
    super.didUpdateWidget(old);
    _syncTicker();
  }

  void _onTick(Duration elapsed) {
    if (!mounted) return;
    setState(() {
      _t = elapsed;
    });
  }

  void _syncTicker() {
    final bool shouldRun = widget.animated;
    final bool reducedMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final bool active = shouldRun && !reducedMotion;
    if (active && !_isTicking) {
      _ticker.start();
      _isTicking = true;
    } else if (!active && _isTicking) {
      _ticker.stop();
      _isTicking = false;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncTicker();
  }

  @override
  void dispose() {
    if (_isTicking) _ticker.stop();
    _ticker.dispose();
    super.dispose();
  }

  /// Computes the [List]<[Offset]> of blob centers for the current
  /// [_t] (in the static case this just returns the rest positions).
  List<Offset> _blobPositions(double drift) {
    if (!widget.animated) return _restPositions;
    // 60-second loop. Each blob oscillates on a different phase so
    // the composite never quite repeats visually.
    final double seconds = _t.inMicroseconds / Duration.microsecondsPerSecond;
    final double tau = 2 * math.pi;
    return <Offset>[
      Offset(
        _restPositions[0].dx + drift * math.sin(seconds * tau / 60.0),
        _restPositions[0].dy + drift * math.cos(seconds * tau / 75.0),
      ),
      Offset(
        _restPositions[1].dx + drift * math.cos(seconds * tau / 80.0 + 1.2),
        _restPositions[1].dy + drift * math.sin(seconds * tau / 65.0 + 0.6),
      ),
      Offset(
        _restPositions[2].dx + drift * math.sin(seconds * tau / 70.0 + 2.4),
        _restPositions[2].dy + drift * math.cos(seconds * tau / 90.0 + 1.7),
      ),
      Offset(
        _restPositions[3].dx + drift * math.cos(seconds * tau / 55.0 + 3.1),
        _restPositions[3].dy + drift * math.sin(seconds * tau / 85.0 + 2.9),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final Brightness brightness = Theme.of(context).brightness;
    final List<Color> palette = MeshColors.forBrightness(brightness);
    final double blur = widget.blurOverride ?? MeshColors.blurFor(brightness);
    final List<Offset> positions = _blobPositions(0.04);

    return Stack(
      children: <Widget>[
        Positioned.fill(
          child: RepaintBoundary(
            child: CustomPaint(
              painter: _MeshPainter(
                colors: palette,
                positions: positions,
                blur: blur,
                dark: brightness == Brightness.dark,
              ),
            ),
          ),
        ),
        Positioned.fill(child: widget.child),
      ],
    );
  }
}

class _MeshPainter extends CustomPainter {
  _MeshPainter({
    required this.colors,
    required this.positions,
    required this.blur,
    required this.dark,
  });

  final List<Color> colors;
  final List<Offset> positions;
  final double blur;
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    // Base wash. In dark mode a near-black indigo; in light mode a
    // pale neutral that lets the blobs tint through cleanly.
    final Rect fullRect = Offset.zero & size;
    final Paint base = Paint()
      ..color = dark ? const Color(0xFF0B1020) : const Color(0xFFF6F8FB);
    canvas.drawRect(fullRect, base);

    // Each blob is a 60-80% canvas-width radial gradient drawn
    // additively in dark mode (screened) and subtractively in light
    // mode (multiplied) to match the miniprogram's `mix-blend-mode`
    // behaviour in the brief §2.
    final ui.BlendMode blend = dark ? ui.BlendMode.screen : ui.BlendMode.multiply;
    final double maxDim = math.max(size.width, size.height);
    final double radius = maxDim * 0.85;

    for (int i = 0; i < colors.length; i++) {
      final Offset pos = positions[i];
      final Offset center = Offset(pos.dx * size.width, pos.dy * size.height);
      final Paint blob = Paint()
        ..blendMode = blend
        ..color = colors[i].withOpacity(dark ? 0.55 : 0.45)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, blur);
      canvas.drawCircle(center, radius, blob);
    }
  }

  @override
  bool shouldRepaint(covariant _MeshPainter old) {
    if (old.blur != blur) return true;
    if (old.dark != dark) return true;
    if (old.colors.length != colors.length) return true;
    for (int i = 0; i < colors.length; i++) {
      if (old.colors[i] != colors[i]) return true;
    }
    if (old.positions.length != positions.length) return true;
    for (int i = 0; i < positions.length; i++) {
      if (old.positions[i] != positions[i]) return true;
    }
    return false;
  }
}
