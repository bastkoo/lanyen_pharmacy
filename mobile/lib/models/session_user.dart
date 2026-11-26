import '../core/constants/app_roles.dart';

// Chỉ đọc các trường cần cho nền tảng từ UserSchema thực tế của Flask.
class SessionUser {
  const SessionUser({required this.id, required this.name, required this.role});
  final int id;
  final String name;
  final AppRole role;

  factory SessionUser.fromJson(Map<String, dynamic> json) {
    final role = AppRole.fromValue(json['VaiTro']);
    if (json['MaNguoiDung'] is! int ||
        json['HoTen'] is! String ||
        (json['HoTen'] as String).trim().isEmpty ||
        role == null ||
        json['TrangThai'] != false) {
      throw const FormatException('Thông tin phiên không hợp lệ.');
    }
    return SessionUser(
      id: json['MaNguoiDung'] as int,
      name: json['HoTen'] as String,
      role: role,
    );
  }
}
