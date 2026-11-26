import 'dart:async';
import 'dart:convert';
import 'dart:io';

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

import 'auth_test_support.dart';

// Mô phỏng lỗi Keychain/Keystore để không mắc kẹt ở màn kiểm tra phiên.
class FailingTokenStore implements TokenStore {
  FailingTokenStore({this.failRead = false});
  final bool failRead;
  @override
  Future<String?> read() async {
    if (failRead) throw Exception('synthetic storage error');
    return '{"access_token":"invalid","refresh_token":"invalid"}';
  }

  @override
  Future<void> write(String value) async => throw Exception('synthetic');
  @override
  Future<void> clear() async => throw Exception('synthetic');
}

void main() {
  for (final failRead in [true, false]) {
    test(
      'Lỗi kho token khi đọc/xóa không để màn kiểm tra phiên treo ($failRead)',
      () async {
        final transport = AuthStubTransport();
        final controller = testController(
          transport,
          store: FailingTokenStore(failRead: failRead),
        );
        addTearDown(controller.dispose);
        await controller.restoreSession();
        expect(controller.stage, AuthStage.sessionError);
        expect(controller.busy, isFalse);
        expect(controller.error, contains('an toàn'));
      },
    );
  }
  test('Mapping vai trò và mọi cặp route bảo vệ', () {
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

  test('Base URL và validation khớp Backend', () {
    expect(AppConfig.parseApiBaseUrl('http://127.0.0.1:8123/api').port, 8123);
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
    for (final phone in ['0901234567', '+84901234567', '090 123 4567']) {
      expect(AuthController.validatePhone(phone), isNull);
    }
    for (final phone in ['123456', '0201234567', '+12025550123']) {
      expect(AuthController.validatePhone(phone), isNotNull);
    }
    expect(AuthController.validateOtp('012345'), isNull);
    expect(AuthController.validateOtp('12345'), isNotNull);
    expect(AuthController.validateName(' '), isNotNull);
  });

  for (final role in [0, 1, 2]) {
    test('Đăng nhập tài khoản có sẵn dùng vai trò $role từ Backend', () async {
      final transport = AuthStubTransport(role: role);
      final controller = testController(transport);
      addTearDown(controller.dispose);
      await loginFixture(controller);
      expect(controller.stage, AuthStage.authenticated);
      expect(controller.user!.role.value, role);
      expect(controller.api.client.session.tokens, isNotNull);
      expect(transport.requests.first.uri.path, '/api/mobile/auth/otp/request');
      expect(
        transport.requests.every(
          (r) =>
              !r.headers.containsKey('Cookie') &&
              !r.headers.containsKey('X-CSRF-Token'),
        ),
        isTrue,
      );
      await controller.api.readSession();
      expect(
        transport.requests.last.headers['Authorization'],
        'Bearer access-fixture-$role',
      );
    });
  }

  test(
    'Tài khoản mới phải bổ sung tên, gửi registration token thay vai trò',
    () async {
      final transport = AuthStubTransport(newUser: true);
      final controller = testController(transport);
      addTearDown(controller.dispose);
      await controller.restoreSession();
      await controller.requestOtp('0901234567');
      await controller.verifyOtp('123456');
      expect(controller.stage, AuthStage.profile);
      expect(controller.user, isNull);
      await controller.register(' ');
      expect(controller.stage, AuthStage.profile);
      await controller.register('  Nguyễn An  ');
      expect(controller.stage, AuthStage.authenticated);
      expect(transport.requests.last.body, {
        'ho_ten': 'Nguyễn An',
        'registration_token': 'profile-fixture',
      });
    },
  );

  test(
    'OTP sai không tạo phiên; hết hạn và cooldown theo response server',
    () async {
      var now = DateTime(2026, 1, 1);
      final transport = AuthStubTransport();
      final controller = testController(transport, now: () => now);
      addTearDown(controller.dispose);
      await controller.restoreSession();
      await controller.requestOtp('0901234567');
      expect(controller.otpRemaining, 300);
      final count = transport.requests.length;
      await controller.requestOtp('0901234567');
      expect(transport.requests.length, count);
      await controller.verifyOtp('000000');
      expect(controller.stage, AuthStage.otp);
      expect(controller.user, isNull);
      expect(controller.error, contains('chưa đúng'));
      now = now.add(const Duration(seconds: 301));
      await controller.verifyOtp('123456');
      expect(controller.user, isNull);
      expect(controller.error, contains('hết hạn'));
      await controller.requestOtp('0901234567');
      expect(controller.otpRemaining, 300);
    },
  );

  test('Chống submit trùng và phản hồi sau dispose', () async {
    final transport = AuthStubTransport()..hold = Completer<void>();
    final controller = testController(transport);
    await controller.restoreSession();
    final pending = controller.requestOtp('0901234567');
    await controller.requestOtp('0901234567');
    expect(transport.requests.length, 1);
    controller.dispose();
    transport.hold!.complete();
    await pending;
  });

  test(
    'Khôi phục phiên và refresh access token hết hạn đúng một lần',
    () async {
      final store = MemoryTokenStore();
      final transport = AuthStubTransport()
        ..loggedIn = true
        ..expiredAccess = true;
      await store.write(jsonEncode(transport.tokens));
      final controller = testController(transport, store: store);
      addTearDown(controller.dispose);
      await controller.restoreSession();
      expect(controller.stage, AuthStage.authenticated);
      expect(transport.refreshCount, 1);
      expect(
        transport.requests.where((r) => r.uri.path.endsWith('/me')).length,
        2,
      );
    },
  );

  test('Lỗi mạng không coi là anonymous; token sai/locked bị xóa', () async {
    for (final status in [401, 403, 503]) {
      final transport = AuthStubTransport()
        ..failureStatus = status
        ..failureCode = status == 403 ? 'ACCOUNT_LOCKED' : 'UNAUTHENTICATED';
      final store = MemoryTokenStore();
      await store.write(jsonEncode(transport.tokens));
      final controller = testController(transport, store: store);
      await controller.restoreSession();
      expect(
        controller.stage,
        status == 503 ? AuthStage.sessionError : AuthStage.phone,
      );
      expect(controller.api.client.session.tokens == null, status != 503);
      controller.dispose();
    }
  });

  test(
    'Đăng xuất thất bại không giả báo thành công; thành công xóa token',
    () async {
      final transport = AuthStubTransport();
      final controller = testController(transport);
      addTearDown(controller.dispose);
      await loginFixture(controller);
      transport.logoutFails = true;
      await controller.logout();
      expect(controller.user, isNotNull);
      expect(controller.api.client.session.tokens, isNotNull);
      transport.logoutFails = false;
      await controller.logout();
      expect(controller.user, isNull);
      expect(controller.stage, AuthStage.phone);
      expect(controller.api.client.session.tokens, isNull);
    },
  );

  test('Data model loại role lạ/locked; JWT storage lỗi JSON bị xóa', () async {
    for (final role in [99, '0']) {
      expect(
        () => SessionUser.fromJson({
          'MaNguoiDung': 42,
          'HoTen': 'An',
          'VaiTro': role,
          'TrangThai': false,
        }),
        throwsFormatException,
      );
    }
    final store = MemoryTokenStore();
    await store.write('not-json');
    final session = SessionStorage(store: store);
    await session.load();
    expect(session.tokens, isNull);
    expect(await store.read(), isNull);
  });

  test('Client chặn URL khác host/traversal trước khi gửi token', () async {
    final transport = AuthStubTransport();
    final client = ApiClient(
      baseUrl: 'http://127.0.0.1:8123/api',
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
    expect(transport.requests, isEmpty);
  });

  test(
    'Dio transport gửi JSON/headers tới HTTP server kiểm thử cục bộ',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      addTearDown(() => server.close(force: true));
      final observed = Completer<void>();
      server.listen((request) async {
        expect(request.method, 'POST');
        expect(request.headers.contentType!.mimeType, 'application/json');
        expect(request.headers['cookie'], isNull);
        final body = jsonDecode(await utf8.decoder.bind(request).join());
        expect(body, {'phone': '0901234567'});
        request.response.headers.contentType = ContentType.json;
        request.response.write(
          '{"code":"OTP_SENT","challenge_token":"fixture","expires_in":300,"retry_after":60}',
        );
        await request.response.close();
        observed.complete();
      });
      final client = ApiClient(
        baseUrl: 'http://127.0.0.1:${server.port}/api',
        session: SessionStorage(),
      );
      addTearDown(client.close);
      final result = await AuthApi(client).requestOtp('0901234567');
      expect(result.challengeToken, 'fixture');
      await observed.future;
    },
  );
}
