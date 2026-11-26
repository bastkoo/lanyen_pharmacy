import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../features/auth/auth_controller.dart';
import 'app_router.dart';

// Sở hữu và giải phóng controller duy nhất của nền tảng demo.
class PharmacyApp extends StatefulWidget {
  const PharmacyApp({super.key});
  @override
  State<PharmacyApp> createState() => _PharmacyAppState();
}

class _PharmacyAppState extends State<PharmacyApp> {
  final _auth = AuthController();
  @override
  void dispose() {
    _auth.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Lan Yến Pharmacy · Demo',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    onGenerateRoute: (settings) => MaterialPageRoute<void>(
      settings: settings,
      builder: (_) => AppRouter(controller: _auth, route: settings.name ?? '/'),
    ),
  );
}
