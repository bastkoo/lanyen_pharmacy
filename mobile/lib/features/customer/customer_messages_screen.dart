import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class CustomerMessagesColors {
  CustomerMessagesColors._();
  // Nền trang tư vấn/nhắn tin.
  static const background = AppColors.background;
  // Tên trang Tư vấn thuốc ở thanh trên.
  static const headerTitle = AppColors.appBarForeground;
  // Chữ Dược sĩ đồng hành cùng bạn trong khối giới thiệu.
  static const title = AppColors.textPrimary;
  // Biểu tượng dược sĩ hỗ trợ ở khối giới thiệu.
  static const pharmacistIcon = AppColors.primaryDark;
  // Chữ giải thích trạng thái kênh nhắn tin.
  static const description = AppColors.textSecondary;
  // Nền khối giới thiệu dược sĩ.
  static const introductionBackground = AppColors.primaryLight;
}

// Trang nhắn tin riêng; giữ trạng thái chờ kết nối, không giả lập cuộc trò chuyện.
class CustomerMessagesScreen extends StatelessWidget {
  const CustomerMessagesScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: CustomerMessagesColors.background,
    appBar: AppBar(
      title: const Text(
        'Tư vấn thuốc',
        style: TextStyle(color: CustomerMessagesColors.headerTitle),
      ),
    ),
    body: const _ConsultationIntroduction(),
  );
}

// Phần dược sĩ giới thiệu và thông báo khả năng nhắn tin hiện tại.
class _ConsultationIntroduction extends StatelessWidget {
  const _ConsultationIntroduction();
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: CustomerMessagesColors.introductionBackground,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Column(
          children: [
            Icon(
              Icons.support_agent,
              size: 56,
              color: CustomerMessagesColors.pharmacistIcon,
            ),
            SizedBox(height: 16),
            Text(
              'Dược sĩ đồng hành cùng bạn',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: CustomerMessagesColors.title,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      const Text(
        'Kênh nhắn tin tư vấn đang được chuẩn bị. Bạn sẽ có thể trò chuyện tại đây khi tính năng sẵn sàng.',
        style: TextStyle(color: CustomerMessagesColors.description),
      ),
    ],
  );
}
