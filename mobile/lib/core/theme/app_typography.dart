import 'package:flutter/material.dart';

import 'app_colors.dart';

// Font được đóng gói cục bộ, hỗ trợ dấu tiếng Việt.
abstract final class AppTypography {
  static const textTheme = TextTheme(
    headlineLarge: TextStyle(
      fontSize: 30,
      height: 1.3,
      fontWeight: FontWeight.w600,
    ),
    headlineSmall: TextStyle(
      fontSize: 24,
      height: 1.35,
      fontWeight: FontWeight.w600,
    ),
    titleLarge: TextStyle(
      fontSize: 20,
      height: 1.4,
      fontWeight: FontWeight.w600,
    ),
    bodyLarge: TextStyle(fontSize: 16, height: 1.6),
    bodyMedium: TextStyle(fontSize: 16, height: 1.6),
    bodySmall: TextStyle(
      fontSize: 14,
      height: 1.5,
      color: AppColors.textSecondary,
    ),
    labelLarge: TextStyle(
      fontSize: 16,
      height: 1.5,
      fontWeight: FontWeight.w500,
    ),
  );
}
