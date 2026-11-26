import 'dart:async';
import 'dart:convert';

import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/network/api_client.dart';
import 'package:lan_yen_pharmacy/core/storage/session_storage.dart';
import 'package:lan_yen_pharmacy/features/auth/auth_controller.dart';

// Fixtures chỉ nằm trong test, không tồn tại đường bỏ qua xác thực trong app.
class AuthStubTransport implements ApiTransport {
  AuthStubTransport({this.role = 0, this.newUser = false});
  final int role;
  final bool newUser;
  final List<
    ({
      Uri uri,
      String method,
      Map<String, String> headers,
      Map<String, dynamic>? body,
    })
  >
  requests = [];
  bool loggedIn = false;
  bool expiredAccess = false;
  bool logoutFails = false;
  String? failureCode;
  int failureStatus = 503;
  Completer<void>? hold;
  int refreshCount = 0;
  final Map<String, Map<String, dynamic>> catalogData = {};
  bool catalogFails = false;
  Map<String, dynamic> get user => {
    'MaNguoiDung': 42,
    'HoTen': 'Nguyễn An',
    'VaiTro': role,
    'TrangThai': false,
  };
  Map<String, dynamic> get tokens => {
    'code': 'AUTHENTICATED',
    'user': user,
    'token_type': 'Bearer',
    'access_token': 'access-fixture-$role',
    'refresh_token': 'refresh-fixture-$role',
    'expires_in': 900,
  };

  @override
  Future<ApiResponse> send(
    Uri uri,
    String method,
    Map<String, String> headers, {
    Map<String, dynamic>? body,
  }) async {
    requests.add((
      uri: uri,
      method: method,
      headers: Map.of(headers),
      body: body,
    ));
    if (hold != null) await hold!.future;
    if (failureCode != null) {
      return ApiResponse(failureStatus, jsonEncode({'code': failureCode}));
    }
    final path = uri.path;
    if (path.contains('/mobile/catalog/')) {
      if (catalogFails) {
        return const ApiResponse(503, '{"code":"SERVICE_UNAVAILABLE"}');
      }
      final name = path.split('/mobile/catalog/').last;
      return ApiResponse(
        200,
        jsonEncode(
          catalogData['$name?page=${uri.queryParameters['page'] ?? '1'}'] ??
              catalogData[name] ??
              {
                'code': name == 'categories'
                    ? 'CATEGORIES_LISTED'
                    : name == 'promotions'
                    ? 'PROMOTIONS_LISTED'
                    : 'PRODUCTS_LISTED',
                'items': [],
                'page': int.parse(uri.queryParameters['page'] ?? '1'),
                'per_page': 100,
                'total': 0,
                'pages': 0,
              },
        ),
      );
    }
    if (path.endsWith('/otp/request')) {
      return ApiResponse(
        200,
        jsonEncode({
          'code': 'OTP_SENT',
          'challenge_token': 'challenge-fixture-${requests.length}',
          'expires_in': 300,
          'retry_after': 60,
        }),
      );
    }
    if (path.endsWith('/otp/verify')) {
      if (body?['otp'] != '123456') {
        return const ApiResponse(401, '{"code":"OTP_INVALID"}');
      }
      if (newUser) {
        return const ApiResponse(
          200,
          '{"code":"PROFILE_REQUIRED","registration_token":"profile-fixture"}',
        );
      }
      loggedIn = true;
      return ApiResponse(200, jsonEncode(tokens));
    }
    if (path.endsWith('/register')) {
      loggedIn = true;
      return ApiResponse(200, jsonEncode(tokens));
    }
    if (path.endsWith('/refresh')) {
      refreshCount++;
      expiredAccess = false;
      loggedIn = true;
      return ApiResponse(200, jsonEncode(tokens));
    }
    if (path.endsWith('/logout')) {
      if (logoutFails) {
        return const ApiResponse(503, '{"code":"AUTH_UNAVAILABLE"}');
      }
      loggedIn = false;
      return const ApiResponse(200, '{"code":"LOGGED_OUT"}');
    }
    if (path.endsWith('/me')) {
      if (expiredAccess) {
        return const ApiResponse(401, '{"code":"TOKEN_EXPIRED"}');
      }
      if (!loggedIn) {
        return const ApiResponse(401, '{"code":"UNAUTHENTICATED"}');
      }
      return ApiResponse(
        200,
        jsonEncode({'code': 'AUTHENTICATED', 'user': user}),
      );
    }
    return const ApiResponse(404, '{"code":"NOT_FOUND"}');
  }

  @override
  void close() {}
}

AuthController testController(
  AuthStubTransport transport, {
  TokenStore? store,
  DateTime Function()? now,
}) => AuthController(
  api: AuthApi(
    ApiClient(
      baseUrl: 'http://127.0.0.1:8123/api',
      session: SessionStorage(store: store),
      transport: transport,
    ),
  ),
  now: now,
);

Future<void> loginFixture(
  AuthController controller, {
  bool newUser = false,
}) async {
  await controller.restoreSession();
  await controller.requestOtp('0901234567');
  await controller.verifyOtp('123456');
  if (newUser) await controller.register('Nguyễn An');
}
