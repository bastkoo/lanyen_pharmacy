import 'package:flutter/material.dart';

import '../../core/constants/app_roles.dart';
import '../preview/foundation_preview.dart';

// Shell manager chuẩn bị điểm vào riêng; chưa thêm nghiệp vụ hoặc tab giả.
class ManagerShell extends StatelessWidget {
  const ManagerShell({super.key, required this.onExit});
  final VoidCallback onExit;
  @override
  Widget build(BuildContext context) => FoundationPreview(
    role: AppRole.manager,
    title: 'Thông tin có trật tự.',
    description: 'Không gian quản lý ưu tiên phân cấp thông tin. Báo cáo và dữ liệu nghiệp vụ chưa triển khai.',
    onExit: onExit,
  );
}
