// Cấu hình công khai khi biên dịch; tuyệt đối không chứa secret.
abstract final class AppConfig {
  static const demoMode = bool.fromEnvironment('DEMO_MODE', defaultValue: true);
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const requestTimeout = Duration(seconds: 20);

  static Uri parseApiBaseUrl(String value) {
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        !['http', 'https'].contains(uri.scheme) ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        uri.path.replaceAll(RegExp(r'/+$'), '') != '/api') {
      throw const FormatException(
        'API_BASE_URL phải là URL gốc có prefix /api.',
      );
    }
    return uri.replace(path: '/api/');
  }
}
