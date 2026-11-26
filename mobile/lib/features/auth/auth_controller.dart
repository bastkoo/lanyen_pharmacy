import 'package:flutter/foundation.dart';

import '../../core/config/app_config.dart';
import '../../core/constants/app_roles.dart';

// Trạng thái preview độc lập hoàn toàn với phiên Backend.
class AuthController extends ChangeNotifier {
  AuthController({this.demoEnabled = AppConfig.demoMode});
  final bool demoEnabled;
  AppRole? _demoRole;
  AppRole? get demoRole => _demoRole;

  bool enterDemo(AppRole role) {
    if (!demoEnabled || _demoRole != null) return false;
    _demoRole = role;
    notifyListeners();
    return true;
  }

  void leaveDemo() {
    _demoRole = null;
    notifyListeners();
  }
}
