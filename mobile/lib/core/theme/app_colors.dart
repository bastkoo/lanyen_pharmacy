import 'package:flutter/material.dart';

// BẢNG MÀU DÙNG CHUNG — Green 1.0 và màu chức năng đã có của Website.
abstract final class AppColors {
  // Màu thương hiệu cho hành động chính.
  static const primary = Color(0xFF16865B);
  // Màu xanh đậm cho chữ, focus và trạng thái nhấn.
  static const primaryDark = Color(0xFF106B48);
  // Màu nền xanh nhẹ cho vùng nhấn.
  static const primaryLight = Color(0xFFE8F5EE);
  // Màu nền toàn ứng dụng.
  static const background = Color(0xFFF5F7F6);
  // Màu bề mặt và chữ trên nút chính.
  static const surface = Color(0xFFFFFFFF);
  // Màu nội dung chính, từ token Manager hiện có.
  static const textPrimary = Color(0xFF24362F);
  // Màu nội dung phụ trên nền trắng hoặc trung tính.
  static const textSecondary = Color(0xFF586860);
  // Màu đường phân cách nhẹ, không dùng thay viền input.
  static const border = Color(0xFFDDE5E0);
  // Màu xác nhận thành công.
  static const success = primaryDark;
  // Màu chữ cảnh báo.
  static const warning = Color(0xFF785313);
  // Màu nền cảnh báo.
  static const warningBackground = Color(0xFFFFF7E5);
  // Màu chữ lỗi.
  static const error = Color(0xFFA52D35);
  // Màu nền lỗi.
  static const errorBackground = Color(0xFFFFF1F1);
  // Màu thông tin trung tính dùng chung.
  static const information = textPrimary;
}
