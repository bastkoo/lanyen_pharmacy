import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/config/app_config.dart';
import 'package:lan_yen_pharmacy/core/constants/app_roles.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/network/api_client.dart';
import 'package:lan_yen_pharmacy/core/network/api_exception.dart';
import 'package:lan_yen_pharmacy/core/storage/session_storage.dart';
import 'package:lan_yen_pharmacy/features/auth/auth_controller.dart';
import 'package:lan_yen_pharmacy/models/session_user.dart';

class StubTransport implements ApiTransport {
  StubTransport(this.response);
  final Future<ApiResponse> Function() response;
  Uri? requested;
  @override
  Future<ApiResponse> get(Uri uri, Map<String, String> headers) {
    requested = uri;
    return response();
  }
}

void main() {
  const base = 'http://127.0.0.1:8123/api';
  test('Mapping vai trò và chặn mọi cặp route khác vai trò', () {
    for (final role in AppRole.values) {
      expect(AppRole.fromValue(role.value), role);
      for (final other in AppRole.values) {
        expect(
          AppRouter.canAccess(AppRouter.pathFor(other), role),
          role == other,
        );
      }
    }
    for (final value in [null, -1, 3, '0', 1.0]) {
      expect(AppRole.fromValue(value), isNull);
    }
    expect(AppRouter.canAccess('/manager', null), isFalse);
  });

  test('State demo không đổi vai trò tại chỗ và tắt demo không cấp quyền', () {
    final controller = AuthController();
    addTearDown(controller.dispose);
    expect(controller.enterDemo(AppRole.customer), isTrue);
    expect(controller.enterDemo(AppRole.manager), isFalse);
    controller.leaveDemo();
    expect(controller.demoRole, isNull);
    final disabled = AuthController(demoEnabled: false);
    addTearDown(disabled.dispose);
    expect(disabled.enterDemo(AppRole.manager), isFalse);
  });

  test('Base URL kiểm tra prefix, scheme, secrets và không hardcode port', () {
    expect(AppConfig.parseApiBaseUrl(base).port, 8123);
    expect(AppConfig.parseApiBaseUrl('$base/').path, '/api/');
    for (final value in [
      '',
      'ftp://host/api',
      'http://host',
      'http://u:p@host/api',
      'http://host/api?q=1',
      'http://host/api#x',
      'http://host/api/api',
    ]) {
      expect(() => AppConfig.parseApiBaseUrl(value), throwsFormatException);
    }
  });

  test('Session model loại role lạ, tài khoản khóa và dữ liệu thiếu', () {
    final json = <String, dynamic>{
      'MaNguoiDung': 42,
      'HoTen': 'Tài khoản mẫu',
      'VaiTro': 0,
      'TrangThai': false,
    };
    expect(SessionUser.fromJson(json).role, AppRole.customer);
    for (final invalid in [
      {...json, 'VaiTro': 99},
      {...json, 'TrangThai': true},
      {...json, 'HoTen': ''},
      {...json, 'MaNguoiDung': '42'},
      {...json}..remove('TrangThai'),
    ]) {
      expect(() => SessionUser.fromJson(invalid), throwsFormatException);
    }
  });

  test('AuthApi dùng endpoint source thật qua client dùng chung; test hoàn toàn mock', () async {
    final session = SessionStorage();
    final transport = StubTransport(
      () async => const ApiResponse(
        200,
        '{"code":"AUTHENTICATED","csrf_token":"synthetic","user":'
        '{"MaNguoiDung":42,"HoTen":"Mẫu","VaiTro":1,"TrangThai":false}}',
      ),
    );
    final api = AuthApi(
      ApiClient(baseUrl: base, session: session, transport: transport),
    );
    expect((await api.readSession()).role, AppRole.employee);
    expect(transport.requested.toString(), '$base/auth/me');
    expect(session.csrfToken, 'synthetic');
    session.clear();
    expect(session.csrfToken, isNull);
  });

  for (final entry in {
    401: ApiFailure.authentication,
    403: ApiFailure.forbidden,
    500: ApiFailure.server,
  }.entries) {
    test('Chuẩn hóa HTTP ${entry.key}, giữ CSRF mới từ lỗi', () async {
      final session = SessionStorage()..updateCsrf('old-synthetic');
      final client = ApiClient(
        baseUrl: base,
        session: session,
        transport: StubTransport(
          () async => ApiResponse(
            entry.key,
            '{"code":"SYNTHETIC_ERROR","csrf_token":"new-synthetic"}',
          ),
        ),
      );
      await expectLater(
        client.get('auth/me'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.failure, 'failure', entry.value)
              .having((e) => e.code, 'code', 'SYNTHETIC_ERROR'),
        ),
      );
      expect(session.csrfToken, 'new-synthetic');
    });
  }

  test('Không có transport thật phải báo chưa triển khai', () async {
    await expectLater(
      ApiClient(baseUrl: base, session: SessionStorage()).get('auth/me'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.failure,
          'failure',
          ApiFailure.transportUnavailable,
        ),
      ),
    );
  });

  test(
    'Malformed JSON, body dạng list, model và mã success sai bị từ chối',
    () async {
      for (final body in [
        '<html>',
        '[]',
        '{"code":"OTHER"}',
        '{"code":"AUTHENTICATED","user":{"VaiTro":99}}',
      ]) {
        final api = AuthApi(
          ApiClient(
            baseUrl: base,
            session: SessionStorage(),
            transport: StubTransport(() async => ApiResponse(200, body)),
          ),
        );
        await expectLater(
          api.readSession(),
          throwsA(
            isA<ApiException>().having(
              (e) => e.failure,
              'failure',
              ApiFailure.response,
            ),
          ),
        );
      }
    },
  );

  test('Timeout và kết nối lỗi được phân biệt', () async {
    for (final failure in [ApiFailure.timeout, ApiFailure.connection]) {
      final client = ApiClient(
        baseUrl: base,
        session: SessionStorage(),
        timeout: const Duration(milliseconds: 1),
        transport: StubTransport(
          () => failure == ApiFailure.timeout
              ? Completer<ApiResponse>().future
              : Future.error(Exception('synthetic')),
        ),
      );
      await expectLater(
        client.get('auth/me'),
        throwsA(
          isA<ApiException>().having((e) => e.failure, 'failure', failure),
        ),
      );
    }
  });

  test('Chặn endpoint đổi host hoặc thoát prefix trước khi gửi', () async {
    final transport = StubTransport(() async => const ApiResponse(200, '{}'));
    final client = ApiClient(
      baseUrl: base,
      session: SessionStorage(),
      transport: transport,
    );
    for (final path in [
      'https://other/api',
      '//other/api',
      '/auth/me',
      '../secret',
    ]) {
      await expectLater(client.get(path), throwsA(isA<ApiException>()));
    }
    expect(transport.requested, isNull);
  });
}
