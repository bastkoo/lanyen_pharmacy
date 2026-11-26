import 'dart:async';
import 'dart:convert';

import '../config/app_config.dart';
import '../storage/session_storage.dart';
import 'api_exception.dart';

// Điểm gắn transport thật sau khi kiểm chứng cookie/CSRF trên mỗi nền tảng.
abstract interface class ApiTransport {
  Future<ApiResponse> get(Uri uri, Map<String, String> headers);
}

class ApiResponse {
  const ApiResponse(this.status, this.body);
  final int status;
  final String body;
}

class UnconfiguredTransport implements ApiTransport {
  const UnconfiguredTransport();
  @override
  Future<ApiResponse> get(Uri uri, Map<String, String> headers) async =>
      throw const ApiException(ApiFailure.transportUnavailable);
}

// Client chỉ xử lý kết nối đọc; chưa cho phép request ghi nghiệp vụ.
class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.session,
    this.transport = const UnconfiguredTransport(),
    this.timeout = AppConfig.requestTimeout,
  });
  final String baseUrl;
  final SessionStorage session;
  final ApiTransport transport;
  final Duration timeout;

  // Chỉ dùng khi tích hợp transport thật đã được kiểm chứng.
  factory ApiClient.fromEnvironment({
    required SessionStorage session,
    ApiTransport transport = const UnconfiguredTransport(),
  }) => ApiClient(
    baseUrl: AppConfig.apiBaseUrl,
    session: session,
    transport: transport,
  );

  Future<Map<String, dynamic>> get(String path) async {
    late final Uri base;
    try {
      base = AppConfig.parseApiBaseUrl(baseUrl);
    } on FormatException {
      throw const ApiException(ApiFailure.configuration);
    }
    final relative = Uri.tryParse(path);
    if (relative == null ||
        relative.hasScheme ||
        relative.hasAuthority ||
        path.startsWith('/') ||
        relative.pathSegments.any((s) => s == '..' || s == '.')) {
      throw const ApiException(ApiFailure.configuration);
    }
    try {
      final response = await transport
          .get(base.resolveUri(relative), const {'Accept': 'application/json'})
          .timeout(timeout);
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        throw const ApiException(ApiFailure.response);
      }
      final token = decoded['csrf_token'];
      if (decoded['code'] == 'ACCOUNT_LOCKED' || response.status == 401) {
        session.clear();
      }
      if (token is String && token.isNotEmpty) session.updateCsrf(token);
      if (response.status < 200 || response.status >= 300) {
        throw ApiException(
          switch (response.status) {
            401 => ApiFailure.authentication,
            403 => ApiFailure.forbidden,
            >= 500 => ApiFailure.server,
            _ => ApiFailure.response,
          },
          status: response.status,
          code: decoded['code'] is String ? decoded['code'] as String : null,
        );
      }
      return decoded;
    } on ApiException {
      rethrow;
    } on TimeoutException {
      throw const ApiException(ApiFailure.timeout);
    } on FormatException {
      throw const ApiException(ApiFailure.response);
    } on Exception {
      throw const ApiException(ApiFailure.connection);
    }
  }
}
