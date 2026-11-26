import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../features/auth/auth_controller.dart';

// BẢNG MÀU TRANG SAU ĐĂNG NHẬP.
abstract final class SessionLandingColors {
  // Màu nhấn thông tin vai trò của tài khoản đã xác thực.
  static const role = AppColors.primaryDark;
}

// Điểm đến tối thiểu, chưa triển khai trang chủ hoặc nghiệp vụ theo vai trò.
class SessionLanding extends StatelessWidget {
  const SessionLanding({super.key, required this.controller});
  final AuthController controller;
  @override
  Widget build(BuildContext context) {
    final user = controller.user!;
    return Scaffold(
      appBar: AppBar(title: const Text('Lan Yến Pharmacy')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                user.role.label,
                key: ValueKey('shell-${user.role.name}'),
                style: Theme.of(context).textTheme.labelLarge
                    ?.copyWith(color: SessionLandingColors.role),
              ),
              const SizedBox(height: AppSpacing.md),
              Semantics(
                header: true,
                child: Text(
                  'Xin chào, ${user.name}',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const Text(
                'Bạn đã đăng nhập thành công. Trang chủ dành cho tài khoản của bạn đang được chuẩn bị.',
              ),
              const SizedBox(height: AppSpacing.lg),
              if (controller.error != null) ...[
                Semantics(liveRegion: true, child: Text(controller.error!)),
                const SizedBox(height: AppSpacing.md),
              ],
              OutlinedButton(
                onPressed: controller.busy ? null : controller.logout,
                child: Text(controller.busy ? 'Đang đăng xuất…' : 'Đăng xuất'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
