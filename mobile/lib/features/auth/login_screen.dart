import 'package:flutter/material.dart';

import '../../core/constants/app_roles.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import 'auth_controller.dart';

// BẢNG MÀU CỔNG VÀO — chỉnh màu riêng tại đây.
abstract final class LoginColors {
  // Màu nhấn tên thương hiệu.
  static const brand = AppColors.primaryDark;
  // Màu nền thông báo demo.
  static const notice = AppColors.primaryLight;
}

// Cổng vào dùng chung, hiện chỉ chọn tài khoản giả lập.
class LoginScreen extends StatelessWidget {
  const LoginScreen({
    super.key,
    required this.controller,
    this.denied = false,
    required this.onReset,
  });
  final AuthController controller;
  final bool denied;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'LAN YẾN / PHARMACY',
                  style: Theme.of(context).textTheme.labelLarge
                      ?.copyWith(color: LoginColors.brand),
                ),
                const SizedBox(height: AppSpacing.xl),
                Semantics(
                  header: true,
                  child: Text(
                    'Cùng một sự chăm sóc.\nBa không gian sử dụng.',
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                const _DemoNotice(),
                const SizedBox(height: AppSpacing.lg),
                if (denied) ...[
                  const Text(
                    'Đường dẫn không hợp lệ hoặc không phù hợp vai trò.',
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                if (controller.demoEnabled && !denied) ...[
                  Text(
                    'Chọn vai trò để xem nền tảng',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _RoleChoices(onSelected: controller.enterDemo),
                ] else ...[
                  const Text('Đăng nhập thật chưa được triển khai.'),
                  if (denied)
                    TextButton(
                      onPressed: () {
                        onReset();
                        Navigator.of(context)
                            .popUntil((route) => route.isFirst);
                      },
                      child: const Text('Về cổng demo'),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

// Thông báo luôn phân biệt preview với xác thực thật.
class _DemoNotice extends StatelessWidget {
  const _DemoNotice();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    color: LoginColors.notice,
    child: const Text(
      'DEMO LOCAL · Dữ liệu giả lập\n'
      'Chọn vai trò chỉ mở bản xem thử. Không đăng nhập Backend và không thực hiện giao dịch.',
    ),
  );
}

// Lựa chọn xếp dọc để giữ nhãn dễ đọc ở màn hình nhỏ.
class _RoleChoices extends StatelessWidget {
  const _RoleChoices({required this.onSelected});
  final ValueChanged<AppRole> onSelected;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      for (final role in AppRole.values)
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: OutlinedButton(
            key: ValueKey('demo-${role.name}'),
            onPressed: () => onSelected(role),
            child: Text('Xem thử · ${role.label}', textAlign: TextAlign.center),
          ),
        ),
    ],
  );
}
