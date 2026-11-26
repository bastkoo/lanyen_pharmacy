// Giá trị trùng VaiTro của Backend; không suy ra thứ bậc quyền.
enum AppRole {
  customer(0, 'Khách hàng'),
  employee(1, 'Nhân viên'),
  manager(2, 'Quản lý');

  const AppRole(this.value, this.label);
  final int value;
  final String label;

  static AppRole? fromValue(Object? value) {
    for (final role in values) {
      if (value is int && role.value == value) return role;
    }
    return null;
  }
}
