package com.studybuddy.app

import io.flutter.embedding.android.FlutterActivity

/**
 * StudyBuddy Android entry point.
 *
 * We extend the standard [FlutterActivity]. The Dart side owns the
 * dependency wiring (Riverpod) and the router (GoRouter), so this
 * activity stays a thin shell — no native plugins are registered
 * here; mapbox_gl and geolocator are auto-wired by the Flutter
 * Gradle plugin via the pubspec plugin declarations.
 *
 * If we later need to react to Android lifecycle events from
 * native code (e.g. to release the Mapbox GL surface on pause), add
 * `override fun onPause() { super.onPause(); … }` here.
 */
class MainActivity : FlutterActivity()
