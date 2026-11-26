import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../auth/auth_controller.dart';
import 'customer_components.dart';

class CustomerAccountColors {
  CustomerAccountColors._();
  // Nền toàn trang và thanh tiêu đề phía trên.
  static const pageBackground = AppColors.background;
  // Chữ tiêu đề trang và mũi tên quay lại ở AppBar.
  static const appBarForeground = AppColors.textPrimary;
  // Chữ tiêu đề của trang tài khoản.
  static const accountTitle = AppColors.textPrimary;

  // Chữ tên sản phẩm của trang tài khoản.
  static const accountName = AppColors.textPrimary;

  // Chữ mô tả của trang tài khoản.
  static const accountDescription = AppColors.textPrimary;

  // Chữ khi bị vô hiệu hóa của nút Đăng xuất. Null giữ nguyên màu Theme/SDK.
  static const Color? logoutDisabledText = null;

  // Nền khi bị vô hiệu hóa của nút Đăng xuất. Null giữ nguyên màu Theme/SDK.
  static const Color? logoutDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của nút Đăng xuất. Null giữ nguyên màu Theme/SDK.
  static const Color? logoutOverlay = null;

  // Màu bóng của nút Đăng xuất. Null giữ nguyên màu Theme/SDK.
  static const Color? logoutShadow = null;

  // Sắc phủ bề mặt của nút Đăng xuất. Null giữ nguyên màu Theme/SDK.
  static const Color? logoutSurfaceTint = null;

  // Chữ/biểu tượng của nút Đăng xuất. Null giữ nguyên màu Theme/SDK.
  static const Color? logoutForeground = null;

  // Màu nền của nút Đăng xuất. Null giữ nguyên màu Theme/SDK.
  static const Color? logoutBackground = null;

  // Màu hiển thị của thành phần thông báo trên màn hình.
  static ButtonStyle _effectiveStyle(
    ButtonStyle defaults,
    ButtonStyle? themed,
  ) => themed?.merge(defaults) ?? defaults;

  // Màu hiển thị của thành phần thông báo trên màn hình. Null giữ nguyên màu Theme/SDK.
  static ButtonStyle _colors(
    ButtonStyle base, {
    Color? foreground,
    Color? background,
    Color? disabledText,
    Color? disabledBackground,
    Color? overlay,
    Color? shadow,
    Color? tint,
  }) => base.copyWith(
    foregroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.disabled)
          ? disabledText ?? base.foregroundColor?.resolve(states)
          : foreground ?? base.foregroundColor?.resolve(states),
    ),
    backgroundColor: WidgetStateProperty.resolveWith(
      (states) => states.contains(WidgetState.disabled)
          ? disabledBackground ?? base.backgroundColor?.resolve(states)
          : background ?? base.backgroundColor?.resolve(states),
    ),
    overlayColor: overlay == null
        ? base.overlayColor
        : WidgetStatePropertyAll(overlay),
    shadowColor: shadow == null
        ? base.shadowColor
        : WidgetStatePropertyAll(shadow),
    surfaceTintColor: tint == null
        ? base.surfaceTintColor
        : WidgetStatePropertyAll(tint),
  );

  // Màu hiển thị của nút Đăng xuất.
  static ButtonStyle logoutStyle(BuildContext context) => _colors(
    _effectiveStyle(
      const OutlinedButton(
        onPressed: null,
        child: SizedBox(),
      ).defaultStyleOf(context),
      Theme.of(context).outlinedButtonTheme.style,
    ),
    foreground: logoutForeground,
    background: logoutBackground,
    disabledText: logoutDisabledText,
    disabledBackground: logoutDisabledBackground,
    overlay: logoutOverlay,
    shadow: logoutShadow,
    tint: logoutSurfaceTint,
  );
}

// Trang Tài khoản riêng, không chứa giao diện trang chủ.
class CustomerAccountScreen extends StatelessWidget {
  const CustomerAccountScreen({super.key, required this.controller});
  final AuthController controller;
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: CustomerAccountColors.pageBackground,
    appBar: AppBar(
      backgroundColor: CustomerAccountColors.pageBackground,
      foregroundColor: CustomerAccountColors.appBarForeground,
      title: const Text('Tài khoản'),
    ),
    body: _AccountContent(controller: controller),
  );
}

// Họ tên khách hàng và nút đăng xuất JWT.
class _AccountContent extends StatelessWidget {
  const _AccountContent({required this.controller});
  final AuthController controller;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => ListView(
      key: const ValueKey('customer-account'),
      padding: const EdgeInsets.all(24),
      children: [
        const CustomerHeading(
          'Tài khoản',
          color: CustomerAccountColors.accountTitle,
        ),
        const SizedBox(height: 16),
        Text(
          controller.user?.name ?? '',
          style: Theme.of(context).textTheme.titleLarge
              ?.copyWith(color: CustomerAccountColors.accountName),
        ),
        const Text(
          'Khách hàng Lan Yến Pharmacy',
          style: TextStyle(color: CustomerAccountColors.accountDescription),
        ),
        const SizedBox(height: 24),
        if (controller.error != null)
          CustomerStatus(message: controller.error!),
        OutlinedButton.icon(
          style: CustomerAccountColors.logoutStyle(context),
          onPressed: controller.busy ? null : controller.logout,
          icon: const Icon(Icons.logout),
          label: const Text('Đăng xuất'),
        ),
      ],
    ),
  );
}
