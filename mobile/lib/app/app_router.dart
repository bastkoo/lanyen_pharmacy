import 'package:flutter/material.dart';

import '../core/constants/app_roles.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/customer/customer_shell.dart';
import '../features/employee/employee_shell.dart';
import '../features/manager/manager_shell.dart';

// Kiểm tra lại khi state thay đổi, kể cả route đã có trên stack.
class AppRouter extends StatelessWidget {
  const AppRouter({super.key, required this.controller, this.route = '/'});
  final AuthController controller;
  final String route;
  static String pathFor(AppRole role) => '/${role.name}';
  static bool canAccess(String route, AppRole? role) =>
      role != null && (route == '/' || route == pathFor(role));

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      final role = controller.demoRole;
      if (!canAccess(route, role)) {
        return LoginScreen(
          controller: controller,
          denied: route != '/',
          onReset: controller.leaveDemo,
        );
      }
      return switch (role!) {
        AppRole.customer => CustomerShell(onExit: controller.leaveDemo),
        AppRole.employee => EmployeeShell(onExit: controller.leaveDemo),
        AppRole.manager => ManagerShell(onExit: controller.leaveDemo),
      };
    },
  );
}
