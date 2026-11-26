import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/network/api_client.dart';
import 'package:lan_yen_pharmacy/core/network/api_exception.dart';
import 'package:lan_yen_pharmacy/core/storage/session_storage.dart';

const fixtureUrl = String.fromEnvironment('AUTH_HTTP_FIXTURE');

void main() {
  test(
    'Flutter Dio ↔ Flask JWT: ba vai trò, tài khoản mới, refresh và logout',
    () async {
      final base = Uri.parse(fixtureUrl);
      expect(base.host, '127.0.0.1');
      final check = HttpClient();
      try {
        final request = await check.getUrl(
          base.resolve('/__mobile_auth_fixture'),
        );
        final response = await request.close();
        final data = jsonDecode(await utf8.decoder.bind(response).join());
        expect(data['fixture'], 'isolated-mobile-jwt-v1');
      } finally {
        check.close(force: true);
      }
      for (final (phone, role, newUser) in [
        ('0901234567', 0, false),
        ('0901234568', 1, false),
        ('0901234569', 2, false),
        ('0901234560', 0, true),
      ]) {
        final client = ApiClient(
          baseUrl: fixtureUrl,
          session: SessionStorage(),
        );
        try {
          final api = AuthApi(client);
          final delivery = await api.requestOtp(phone);
          final verified = await api.verifyOtp(
            delivery.challengeToken,
            '123456',
          );
          if (newUser) {
            expect(verified.user, isNull);
            await api.register(
              verified.registrationToken!,
              'Khách HTTP fixture',
            );
          }
          expect((await api.readSession()).role.value, role);
          final previous = client.session.tokens!.refreshToken;
          await api.refresh();
          expect(client.session.tokens!.refreshToken, isNot(previous));
          expect((await api.readSession()).role.value, role);
          await api.logout();
          expect(client.session.tokens, isNull);
          await expectLater(api.readSession(), throwsA(isA<ApiException>()));
        } finally {
          client.close();
        }
      }
    },
    skip: fixtureUrl.isEmpty
        ? 'Chỉ chạy với HTTP fixture cô lập, không dùng Backend/DB thật.'
        : false,
  );
}
