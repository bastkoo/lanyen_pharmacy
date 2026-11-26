// CSRF chỉ ở RAM; không coi dữ liệu cục bộ là bằng chứng đăng nhập.
class SessionStorage {
  String? _csrfToken;
  String? get csrfToken => _csrfToken;
  void updateCsrf(String token) => _csrfToken = token;
  void clear() => _csrfToken = null;
}
