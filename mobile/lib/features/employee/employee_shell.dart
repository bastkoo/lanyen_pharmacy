import 'package:flutter/material.dart';

import '../auth/auth_controller.dart';
import '../../shared/widgets/session_landing.dart';

// Điểm đến employee sau xác thực; chưa thêm nghiệp vụ.
class EmployeeShell extends StatelessWidget {
  const EmployeeShell({super.key, required this.controller});
  final AuthController controller;
  @override
  Widget build(BuildContext context) => SessionLanding(controller: controller);
}
