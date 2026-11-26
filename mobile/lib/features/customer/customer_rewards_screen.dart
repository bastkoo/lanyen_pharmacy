import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

// Bảng màu của trang điểm thưởng; chỉnh chữ thông báo và biểu tượng tại đây.
class CustomerRewardsColors {
  CustomerRewardsColors._();
  // Nền trang Điểm thưởng.
  static const background = AppColors.background;
  // Tên trang và nội dung thông báo chưa triển khai.
  static const text = AppColors.textPrimary;
  // Biểu tượng ngôi sao ở giữa trang.
  static const icon = AppColors.primaryDark;
}

// Trang Điểm thưởng riêng; không tạo số điểm hoặc hạng thành viên giả.
class CustomerRewardsScreen extends StatelessWidget {
  const CustomerRewardsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: CustomerRewardsColors.background,
    appBar: AppBar(
      title: const Text(
        'Điểm thưởng',
        style: TextStyle(color: CustomerRewardsColors.text),
      ),
    ),
    body: const _RewardsContent(),
  );
}

// Khối thông báo hiện trạng tính năng, tách khỏi khung điều hướng.
class _RewardsContent extends StatelessWidget {
  const _RewardsContent();
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(24),
    children: const [
      Icon(Icons.stars_outlined, size: 48, color: CustomerRewardsColors.icon),
      SizedBox(height: 16),
      Text(
        'Chức năng điểm thưởng đang được hoàn thiện.',
        textAlign: TextAlign.center,
        style: TextStyle(color: CustomerRewardsColors.text),
      ),
    ],
  );
}
