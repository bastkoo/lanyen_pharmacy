import 'package:flutter/material.dart';

import '../../core/constants/app_roles.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';

// BẢNG MÀU PREVIEW — chỉnh các khu vực giao diện tại đây.
abstract final class PreviewColors {
  // Màu vùng nhấn thương hiệu.
  static const brandSurface = AppColors.primaryLight;
  // Màu chữ trên vùng nhấn.
  static const brandText = AppColors.primaryDark;
  // Màu thông báo trạng thái thành công.
  static const success = AppColors.success;
  // Màu thông báo trạng thái cảnh báo.
  static const warning = AppColors.warning;
  // Màu thông báo trạng thái lỗi.
  static const error = AppColors.error;
  // Màu thông tin thường.
  static const information = AppColors.information;
}

// Khung preview tái sử dụng, các shell chỉ cung cấp mục đích riêng.
class FoundationPreview extends StatefulWidget {
  const FoundationPreview({
    super.key,
    required this.role,
    required this.title,
    required this.description,
    required this.onExit,
  });
  final AppRole role;
  final String title;
  final String description;
  final VoidCallback onExit;
  @override
  State<FoundationPreview> createState() => _FoundationPreviewState();
}

class _FoundationPreviewState extends State<FoundationPreview> {
  bool _confirmed = false;
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop) widget.onExit();
    },
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Lan Yến'),
        actions: [
          IconButton(
            tooltip: 'Thoát bản xem thử',
            onPressed: widget.onExit,
            icon: const Icon(Icons.logout_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: AppSpacing.contentWidth,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _RoleIntroduction(
                    role: widget.role,
                    title: widget.title,
                    description: widget.description,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  const _BrandSpecimen(),
                  const SizedBox(height: AppSpacing.xl),
                  _ControlSpecimen(
                    confirmed: _confirmed,
                    onConfirm: () => setState(() => _confirmed = !_confirmed),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  const _StatusSpecimen(),
                  const SizedBox(height: AppSpacing.lg),
                  OutlinedButton(
                    onPressed: widget.onExit,
                    child: const Text('Trở về chọn vai trò'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

// Phần giới thiệu khác nhau theo vai trò; không dựng dashboard nghiệp vụ giả.
class _RoleIntroduction extends StatelessWidget {
  const _RoleIntroduction({
    required this.role,
    required this.title,
    required this.description,
  });
  final AppRole role;
  final String title;
  final String description;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'DEMO LOCAL / ${role.label}',
        style: Theme.of(context).textTheme.labelLarge
            ?.copyWith(color: PreviewColors.brandText),
      ),
      const SizedBox(height: AppSpacing.sm),
      Semantics(
        header: true,
        child: Text(
          title,
          key: ValueKey('shell-${role.name}'),
          style: Theme.of(context).textTheme.headlineLarge,
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      Text(description),
      const SizedBox(height: AppSpacing.sm),
      const Text(
        'Bản xem thử nền tảng · Chưa xác thực Backend · Không có giao dịch.',
      ),
    ],
  );
}

// Mẫu màu, typography, spacing và radius dùng chung.
class _BrandSpecimen extends StatelessWidget {
  const _BrandSpecimen();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpacing.lg),
    decoration: BoxDecoration(
      color: PreviewColors.brandSurface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Green 1.0',
          style: Theme.of(context).textTheme.headlineSmall
              ?.copyWith(color: PreviewColors.brandText),
        ),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Xanh thương hiệu · Trắng bề mặt\n'
          'Be Vietnam Pro · Nội dung 16 / 1.6\n'
          'Khoảng cách 8 · 16 · 24 · Bo góc 12',
        ),
      ],
    ),
  );
}

// Input chỉ là mẫu tương tác cục bộ, không thu thập thông tin cá nhân.
class _ControlSpecimen extends StatelessWidget {
  const _ControlSpecimen({required this.confirmed, required this.onConfirm});
  final bool confirmed;
  final VoidCallback onConfirm;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Semantics(
        header: true,
        child: Text(
          'Thử thành phần giao diện',
          style: Theme.of(context).textTheme.titleLarge,
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      const TextField(
        decoration: InputDecoration(
          labelText: 'Ghi chú mẫu',
          helperMaxLines: 6,
          helperText: 'Chỉ nhập nội dung giả lập; không gửi máy chủ.',
        ),
        textInputAction: TextInputAction.done,
      ),
      const SizedBox(height: AppSpacing.md),
      FilledButton(
        onPressed: onConfirm,
        child: Text(confirmed ? 'Đặt lại mẫu tương tác' : 'Thử nút chính'),
      ),
      const SizedBox(height: AppSpacing.sm),
      Semantics(
        liveRegion: true,
        child: AnimatedSwitcher(
          duration: AppMotion.duration(context),
          child: Text(
            confirmed ? 'Đã thử tương tác cục bộ.' : 'Sẵn sàng thử giao diện.',
            key: ValueKey(confirmed),
          ),
        ),
      ),
    ],
  );
}

// Có cả biểu tượng và văn bản; trạng thái mẫu không đại diện response API.
class _StatusSpecimen extends StatelessWidget {
  const _StatusSpecimen();
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Semantics(
        header: true,
        child: Text(
          'Ngôn ngữ trạng thái',
          style: Theme.of(context).textTheme.titleLarge,
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      const _StatusLine(
        icon: Icons.check_circle_outline,
        color: PreviewColors.success,
        text: 'Thành công · Mẫu phản hồi cục bộ',
      ),
      const _StatusLine(
        icon: Icons.info_outline,
        color: PreviewColors.information,
        text: 'Thông tin · Chế độ trình diễn',
      ),
      const _StatusLine(
        icon: Icons.warning_amber_outlined,
        color: PreviewColors.warning,
        text: 'Chưa triển khai · Kết nối Backend',
      ),
      const _StatusLine(
        icon: Icons.error_outline,
        color: PreviewColors.error,
        text: 'Lỗi mẫu · Có hướng dẫn thử lại',
      ),
      const Divider(height: AppSpacing.xl),
      const Text('Trống · Chưa có dữ liệu nghiệp vụ trong bản xem thử.'),
    ],
  );
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.icon,
    required this.color,
    required this.text,
  });
  final IconData icon;
  final Color color;
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(child: Icon(icon, color: color)),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(text, style: TextStyle(color: color)),
        ),
      ],
    ),
  );
}
