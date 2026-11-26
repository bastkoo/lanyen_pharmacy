import 'package:flutter/widgets.dart';

// Giảm chuyển động theo cài đặt hệ thống, không thêm hiệu ứng trang trí.
abstract final class AppMotion {
  static const fast = Duration(milliseconds: 200);
  static const normal = Duration(milliseconds: 300);
  static Duration duration(BuildContext context) =>
      MediaQuery.disableAnimationsOf(context) ? Duration.zero : fast;
}
