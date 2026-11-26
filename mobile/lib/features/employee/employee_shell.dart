import 'package:flutter/material.dart';

import '../../core/constants/app_roles.dart';
import '../preview/foundation_preview.dart';

// Shell employee chuẩn bị điểm vào riêng; chưa thêm nghiệp vụ hoặc tab giả.
class EmployeeShell extends StatelessWidget {
  const EmployeeShell({super.key, required this.onExit});
  final VoidCallback onExit;
  @override
  Widget build(BuildContext context) => FoundationPreview(
    role: AppRole.employee,
    title: 'Rõ việc, thuận thao tác.',
    description: 'Không gian nhân viên dành cho quy trình tác nghiệp. Phạm vi tính năng sẽ được xác định ở giai đoạn tiếp theo.',
    onExit: onExit,
  );
}
