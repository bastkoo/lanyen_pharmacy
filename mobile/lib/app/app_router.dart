import 'package:flutter/material.dart';

import '../core/constants/app_roles.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/login_screen.dart';
import '../features/customer/customer_shell.dart';
import '../features/employee/employee_shell.dart';
import '../features/manager/manager_shell.dart';

// Vai trò chỉ đến từ user API đã xác thực; không còn cổng chọn vai trò demo.
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
      final user = controller.user;
      if (controller.stage != AuthStage.authenticated || user == null) {
        return LoginScreen(controller: controller);
      }
      if (!canAccess(route, user.role)) {
        return Scaffold(
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Bạn không có quyền truy cập khu vực này.'),
                    TextButton(
                      onPressed: () =>
                          Navigator.of(context).popUntil((r) => r.isFirst),
                      child: const Text('Về trang chính'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }
      return switch (user.role) {
        AppRole.customer => CustomerShell(controller: controller),
        AppRole.employee => EmployeeShell(controller: controller),
        AppRole.manager => ManagerShell(controller: controller),
      };
    },
  );
}
