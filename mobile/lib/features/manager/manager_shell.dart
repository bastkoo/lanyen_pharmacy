import 'package:flutter/material.dart';

import '../auth/auth_controller.dart';
import '../../shared/widgets/session_landing.dart';

// Điểm đến manager sau xác thực; chưa thêm nghiệp vụ.
class ManagerShell extends StatelessWidget {
  const ManagerShell({super.key, required this.controller});
  final AuthController controller;
  @override
  Widget build(BuildContext context) => SessionLanding(controller: controller);
}
