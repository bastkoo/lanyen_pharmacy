import 'dart:async';

import 'package:flutter/material.dart';

import '../core/config/app_config.dart';
import '../core/network/api.dart';
import '../core/network/api_client.dart';
import '../core/storage/session_storage.dart';
import '../core/theme/app_theme.dart';
import '../features/auth/auth_controller.dart';
import 'app_router.dart';

// Một nguồn state xác thực; khôi phục JWT khi mở và kiểm tra lại khi quay về app.
class PharmacyApp extends StatefulWidget {
  const PharmacyApp({super.key, this.controller});
  final AuthController? controller;
  @override
  State<PharmacyApp> createState() => _PharmacyAppState();
}

class _PharmacyAppState extends State<PharmacyApp> with WidgetsBindingObserver {
  late final AuthController _auth;
  @override
  void initState() {
    super.initState();
    _auth =
        widget.controller ??
        AuthController(
          api: AuthApi(
            ApiClient.fromEnvironment(
              session: SessionStorage.forPlatform(AppConfig.apiBaseUrl),
            ),
          ),
        );
    WidgetsBinding.instance.addObserver(this);
    unawaited(_auth.restoreSession());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _auth.stage == AuthStage.authenticated &&
        !_auth.busy) {
      unawaited(_auth.restoreSession());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (widget.controller == null) {
      _auth.api.client.close();
      _auth.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Lan Yến Pharmacy',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    onGenerateRoute: (settings) => MaterialPageRoute<void>(
      settings: settings,
      builder: (_) => AppRouter(controller: _auth, route: settings.name ?? '/'),
    ),
  );
}
