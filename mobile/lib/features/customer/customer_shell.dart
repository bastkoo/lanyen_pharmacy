import 'package:flutter/material.dart';

import '../../core/constants/app_roles.dart';
import '../preview/foundation_preview.dart';

// Shell customer chuẩn bị điểm vào riêng; chưa thêm nghiệp vụ hoặc tab giả.
class CustomerShell extends StatelessWidget {
  const CustomerShell({super.key, required this.onExit});
  final VoidCallback onExit;
  @override
  Widget build(BuildContext context) => FoundationPreview(
    role: AppRole.customer,
    title: 'Chăm sóc từ điều giản dị.',
    description:
        'Không gian khách hàng ưu tiên nội dung dễ đọc và thao tác rõ ràng.',
    onExit: onExit,
  );
}
