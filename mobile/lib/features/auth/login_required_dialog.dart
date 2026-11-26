import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class LoginRequiredColors {
  LoginRequiredColors._();
  // Nền hộp thoại yêu cầu đăng nhập.
  static const background = AppColors.surface;
  // Chữ tiêu đề Thông báo.
  static const title = AppColors.textPrimary;
  // Đoạn giải thích dành cho khách chưa đăng nhập.
  static const description = AppColors.textSecondary;
  // Hình minh họa đăng nhập.
  static const illustration = AppColors.primaryDark;
  // Nền tròn phía sau hình minh họa.
  static const illustrationBackground = AppColors.background;
  // Icon các mục Điểm thưởng, Tư vấn, Đơn hàng phía dưới lời mời.
  static const featureIcon = AppColors.primaryDark;
  // Nhãn các mục dành cho tài khoản bên dưới từng icon.
  static const featureLabel = AppColors.textPrimary;
  // Biểu tượng đóng góc trên phải.
  static const closeIcon = AppColors.textPrimary;
  // Chữ nút Trở lại.
  static const backText = AppColors.primaryDark;
  // Nền nút Trở lại.
  static const backBackground = AppColors.background;
  // Chữ nút Đăng nhập.
  static const loginText = AppColors.surface;
  // Nền nút Đăng nhập.
  static const loginBackground = AppColors.primaryDark;
  // Lớp phủ phía sau hộp thoại; null giữ mặc định Theme.
  static const Color? barrier = null;
}

// Một hộp thoại dùng chung cho các chức năng cần tài khoản.
Future<bool> showLoginRequired(BuildContext context) async =>
    await showDialog<bool>(
      context: context,
      barrierColor: LoginRequiredColors.barrier,
      builder: (_) => const LoginRequiredDialog(),
    ) ??
    false;

class LoginRequiredDialog extends StatelessWidget {
  const LoginRequiredDialog({super.key});
  @override
  Widget build(BuildContext context) => Dialog(
    key: const ValueKey('login-required-dialog'),
    backgroundColor: LoginRequiredColors.background,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    insetPadding: const EdgeInsets.all(20),
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 440),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  tooltip: 'Đóng',
                  onPressed: () => Navigator.pop(context, false),
                  icon: const Icon(
                    Icons.close,
                    color: LoginRequiredColors.closeIcon,
                  ),
                ),
              ),
              const _LoginIllustration(),
              const SizedBox(height: 20),
              const Text(
                'Thông báo',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: LoginRequiredColors.title,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Đăng nhập để sử dụng điểm thưởng, tư vấn và quản lý tài khoản, đơn hàng của bạn.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: LoginRequiredColors.description,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              const _MemberFeatures(),
              const SizedBox(height: 24),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 12,
                runSpacing: 12,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    style: TextButton.styleFrom(
                      foregroundColor: LoginRequiredColors.backText,
                      backgroundColor: LoginRequiredColors.backBackground,
                      minimumSize: const Size(120, 48),
                    ),
                    child: const Text('Trở lại'),
                  ),
                  FilledButton(
                    key: const ValueKey('login-required-submit'),
                    onPressed: () => Navigator.pop(context, true),
                    style: FilledButton.styleFrom(
                      foregroundColor: LoginRequiredColors.loginText,
                      backgroundColor: LoginRequiredColors.loginBackground,
                      minimumSize: const Size(120, 48),
                    ),
                    child: const Text('Đăng nhập'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

// Ba nhóm chức năng dành cho thành viên, không đưa các cam kết thương mại chưa có.
class _MemberFeatures extends StatelessWidget {
  const _MemberFeatures();
  @override
  Widget build(BuildContext context) => Wrap(
    alignment: WrapAlignment.center,
    spacing: 8,
    runSpacing: 12,
    children: [
      for (final item in [
        (Icons.stars_outlined, 'Điểm thưởng'),
        (Icons.support_agent, 'Tư vấn'),
        (Icons.receipt_long_outlined, 'Đơn hàng'),
      ])
        SizedBox(
          width: 80,
          child: Column(
            children: [
              Icon(item.$1, color: LoginRequiredColors.featureIcon, size: 28),
              const SizedBox(height: 8),
              Text(
                item.$2,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: LoginRequiredColors.featureLabel,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
    ],
  );
}

// Minh họa đăng nhập bằng icon cục bộ, không phụ thuộc mạng.
class _LoginIllustration extends StatelessWidget {
  const _LoginIllustration();
  @override
  Widget build(BuildContext context) => Container(
    width: 128,
    height: 128,
    decoration: const BoxDecoration(
      shape: BoxShape.circle,
      color: LoginRequiredColors.illustrationBackground,
    ),
    child: const Icon(
      Icons.login_rounded,
      size: 72,
      color: LoginRequiredColors.illustration,
    ),
  );
}
