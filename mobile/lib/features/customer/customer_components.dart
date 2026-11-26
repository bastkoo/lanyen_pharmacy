import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class CustomerComponentColors {
  CustomerComponentColors._();
  // Màu chữ của khối Đang tải/Thông báo/Thử lại.
  static const statusText = AppColors.textPrimary;

  // Vòng tiến trình của khối Đang tải/Thông báo/Thử lại.
  static const statusProgress = AppColors.primary;

  // Chữ khi bị vô hiệu hóa của nút Thử lại. Null giữ nguyên màu Theme/SDK.
  static const Color? retryDisabledText = null;

  // Nền khi bị vô hiệu hóa của nút Thử lại. Null giữ nguyên màu Theme/SDK.
  static const Color? retryDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của nút Thử lại. Null giữ nguyên màu Theme/SDK.
  static const Color? retryOverlay = null;

  // Màu bóng của nút Thử lại. Null giữ nguyên màu Theme/SDK.
  static const Color? retryShadow = null;

  // Sắc phủ bề mặt của nút Thử lại. Null giữ nguyên màu Theme/SDK.
  static const Color? retrySurfaceTint = null;

  // Chữ khi bị vô hiệu hóa của cụm chuyển trang danh sách. Null giữ nguyên màu Theme/SDK.
  static const Color? paginationDisabledText = null;

  // Nền khi bị vô hiệu hóa của cụm chuyển trang danh sách. Null giữ nguyên màu Theme/SDK.
  static const Color? paginationDisabledBackground = null;

  // Lớp màu khi nhấn/focus/hover của cụm chuyển trang danh sách. Null giữ nguyên màu Theme/SDK.
  static const Color? paginationOverlay = null;

  // Màu bóng của cụm chuyển trang danh sách. Null giữ nguyên màu Theme/SDK.
  static const Color? paginationShadow = null;

  // Sắc phủ bề mặt của cụm chuyển trang danh sách. Null giữ nguyên màu Theme/SDK.
  static const Color? paginationSurfaceTint = null;

  // Chữ/biểu tượng của nút Thử lại. Null giữ nguyên màu Theme/SDK.
  static const Color? retryForeground = null;

  // Màu nền của nút Thử lại. Null giữ nguyên màu Theme/SDK.
  static const Color? retryBackground = null;

  // Chữ/biểu tượng của cụm chuyển trang danh sách. Null giữ nguyên màu Theme/SDK.
  static const Color? paginationForeground = null;

  // Màu nền của cụm chuyển trang danh sách. Null giữ nguyên màu Theme/SDK.
  static const Color? paginationBackground = null;

  // Màu chữ của cụm chuyển trang danh sách.
  static const paginationText = AppColors.textPrimary;

  // Nền vòng tiến trình của khối Đang tải/Thông báo/Thử lại. Null giữ nguyên màu Theme/SDK.
  static const Color? statusProgressTrack = null;

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

  // Màu hiển thị của nút Thử lại.
  static ButtonStyle retryStyle(BuildContext context) => _colors(
    _effectiveStyle(
      const TextButton(
        onPressed: null,
        child: SizedBox(),
      ).defaultStyleOf(context),
      Theme.of(context).textButtonTheme.style,
    ),
    foreground: retryForeground,
    background: retryBackground,
    disabledText: retryDisabledText,
    disabledBackground: retryDisabledBackground,
    overlay: retryOverlay,
    shadow: retryShadow,
    tint: retrySurfaceTint,
  );

  // Màu hiển thị của cụm chuyển trang danh sách.
  static ButtonStyle paginationStyle(BuildContext context) => _colors(
    const ButtonStyle().merge(Theme.of(context).iconButtonTheme.style),
    foreground: paginationForeground,
    background: paginationBackground,
    disabledText: paginationDisabledText,
    disabledBackground: paginationDisabledBackground,
    overlay: paginationOverlay,
    shadow: paginationShadow,
    tint: paginationSurfaceTint,
  );
}

// Tiêu đề có phân cấp cho từng khối giao diện.
class CustomerHeading extends StatelessWidget {
  const CustomerHeading(this.text, {super.key, required this.color});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Semantics(
    header: true,
    child: Text(
      text,
      style: Theme.of(context).textTheme.titleLarge?.copyWith(color: color),
    ),
  );
}

// Trạng thái tải, rỗng, lỗi và nút thử lại.
class CustomerStatus extends StatelessWidget {
  const CustomerStatus({
    super.key,
    this.message = 'Đang tải dữ liệu…',
    this.loading = false,
    this.onRetry,
  });
  final String message;
  final bool loading;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        children: [
          if (loading)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: CustomerComponentColors.statusProgress,
                  backgroundColor: CustomerComponentColors.statusProgressTrack,
                ),
              ),
            ),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: CustomerComponentColors.statusText),
          ),
          if (onRetry != null)
            TextButton(
              style: CustomerComponentColors.retryStyle(context),
              onPressed: onRetry,
              child: const Text('Thử lại'),
            ),
        ],
      ),
    ),
  );
}

// Điều khiển trang trước/sau của danh sách.
class CustomerPagination extends StatelessWidget {
  const CustomerPagination({
    super.key,
    required this.page,
    required this.pages,
    required this.onPage,
  });
  final int page, pages;
  final ValueChanged<int> onPage;
  @override
  Widget build(BuildContext context) => Wrap(
    alignment: WrapAlignment.center,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      IconButton(
        style: CustomerComponentColors.paginationStyle(context),
        tooltip: 'Trang trước',
        onPressed: page > 1 ? () => onPage(page - 1) : null,
        icon: const Icon(Icons.chevron_left),
      ),
      Text(
        'Trang $page / $pages',
        style: const TextStyle(color: CustomerComponentColors.paginationText),
      ),
      IconButton(
        style: CustomerComponentColors.paginationStyle(context),
        tooltip: 'Trang sau',
        onPressed: page < pages ? () => onPage(page + 1) : null,
        icon: const Icon(Icons.chevron_right),
      ),
    ],
  );
}
