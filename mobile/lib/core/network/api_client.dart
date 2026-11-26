import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/session_storage.dart';
import 'api_exception.dart';

// Chỉ transport có trách nhiệm gửi HTTP; không chứa endpoint nghiệp vụ.
abstract interface class ApiTransport {
  Future<ApiResponse> send(
    Uri uri,
    String method,
    Map<String, String> headers, {
    Map<String, dynamic>? body,
  });
  void close();
}

class ApiResponse {
  const ApiResponse(this.status, this.body);
  final int status;
  final String body;
}

class DioTransport implements ApiTransport {
  DioTransport()
    : _dio = Dio(
        BaseOptions(
          connectTimeout: AppConfig.requestTimeout,
          receiveTimeout: AppConfig.requestTimeout,
          sendTimeout: AppConfig.requestTimeout,
          responseType: ResponseType.plain,
          followRedirects: false,
          validateStatus: (_) => true,
        ),
      );
  final Dio _dio;

  @override
  Future<ApiResponse> send(
    Uri uri,
    String method,
    Map<String, String> headers, {
    Map<String, dynamic>? body,
  }) async {
    final cancel = CancelToken();
    try {
      final response = await _dio
          .requestUri<String>(
            uri,
            data: body,
            options: Options(method: method, headers: headers),
            cancelToken: cancel,
          )
          .timeout(
            AppConfig.requestTimeout,
            onTimeout: () {
              cancel.cancel();
              throw const ApiException(ApiFailure.timeout);
            },
          );
      return ApiResponse(response.statusCode ?? 0, response.data ?? '');
    } on DioException catch (error) {
      throw ApiException(switch (error.type) {
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout => ApiFailure.timeout,
        _ => ApiFailure.connection,
      });
    }
  }

  @override
  void close() => _dio.close(force: true);
}

// Một client dùng chung; JWT chỉ gửi tới origin/prefix đã cấu hình.
class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.session,
    ApiTransport? transport,
    this.timeout = AppConfig.requestTimeout,
  }) : transport = transport ?? DioTransport();
  factory ApiClient.fromEnvironment({required SessionStorage session}) =>
      ApiClient(baseUrl: AppConfig.apiBaseUrl, session: session);

  final String baseUrl;
  final SessionStorage session;
  final ApiTransport transport;
  final Duration timeout;

  Future<Map<String, dynamic>> get(String path, {bool authorized = false}) =>
      _request('GET', path, authorized: authorized);
  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body, {
    bool authorized = false,
  }) => _request('POST', path, body: body, authorized: authorized);

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool authorized = false,
  }) async {
    late final Uri base;
    try {
      base = AppConfig.parseApiBaseUrl(baseUrl);
    } on FormatException {
      throw const ApiException(ApiFailure.configuration);
    }
    if (!RegExp(r'^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$').hasMatch(path)) {
      throw const ApiException(ApiFailure.configuration);
    }
    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
    };
    if (authorized) {
      final token = session.tokens?.accessToken;
      if (token == null) {
        throw const ApiException(
          ApiFailure.authentication,
          code: 'UNAUTHENTICATED',
        );
      }
      headers['Authorization'] = 'Bearer $token';
    }
    try {
      final response = await transport
          .send(base.resolve(path), method, headers, body: body)
          .timeout(timeout);
      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        throw const ApiException(ApiFailure.response);
      }
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

  void close() => transport.close();
}
