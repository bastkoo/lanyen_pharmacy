import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/auth/auth_controller.dart';

import 'auth_test_support.dart';

Widget harness(
  AuthController controller, {
  double scale = 1,
  bool keyboard = false,
  String route = '/',
}) => MaterialApp(
  theme: AppTheme.light,
  home: MediaQuery(
    data: MediaQueryData(
      textScaler: TextScaler.linear(scale),
      padding: const EdgeInsets.only(top: 44, bottom: 34),
      viewInsets: EdgeInsets.only(bottom: keyboard ? 300 : 0),
    ),
    child: AppRouter(controller: controller, route: route),
  ),
);

Future<void> submit(WidgetTester tester, String key, String value) async {
  final input = find.byKey(ValueKey(key));
  await tester.ensureVisible(input);
  await tester.enterText(input, value);
  final button = find.byKey(const ValueKey('auth-submit'));
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pumpAndSettle();
}

void main() {
  for (final role in [0, 1, 2]) {
    testWidgets(
      'OTP tài khoản có sẵn điều hướng shell $role, logout trở lại nhập số',
      (tester) async {
        final transport = AuthStubTransport(role: role);
        final controller = testController(transport);
        addTearDown(controller.dispose);
        await tester.pumpWidget(PharmacyApp(controller: controller));
        await tester.pumpAndSettle();
        expect(find.text('Nhận mã xác thực'), findsOneWidget);
        expect(find.textContaining('Xem thử'), findsNothing);
        expect(find.textContaining('Môi trường thử nghiệm'), findsNothing);
        await submit(tester, 'phone-input', '0901234567');
        expect(find.byKey(const ValueKey('otp-input')), findsOneWidget);
        await submit(tester, 'otp-input', '123456');
        expect(controller.user!.role.value, role);
        expect(find.text('Xin chào, Nguyễn An'), findsOneWidget);
        await tester.ensureVisible(find.text('Đăng xuất'));
        await tester.tap(find.text('Đăng xuất'));
        await tester.pumpAndSettle();
        expect(find.byKey(const ValueKey('phone-input')), findsOneWidget);
        expect(find.text('Xin chào, Nguyễn An'), findsNothing);
      },
    );
  }

  testWidgets('Tài khoản mới bổ sung họ tên; không thể bỏ qua OTP', (
    tester,
  ) async {
    final controller = testController(AuthStubTransport(newUser: true));
    addTearDown(controller.dispose);
    await controller.restoreSession();
    await tester.pumpWidget(harness(controller));
    await submit(tester, 'phone-input', '123');
    expect(find.textContaining('Nhập số điện thoại Việt Nam'), findsOneWidget);
    await submit(tester, 'phone-input', '0901234567');
    await submit(tester, 'otp-input', '000000');
    expect(find.textContaining('Mã xác thực chưa đúng'), findsOneWidget);
    await submit(tester, 'otp-input', '123456');
    expect(find.byKey(const ValueKey('name-input')), findsOneWidget);
    await submit(tester, 'name-input', 'Nguyễn An');
    expect(find.text('Xin chào, Nguyễn An'), findsOneWidget);
  });

  testWidgets('Đổi số xóa OTP và gửi lại phải chờ cooldown', (tester) async {
    final controller = testController(AuthStubTransport());
    addTearDown(controller.dispose);
    await controller.restoreSession();
    await tester.pumpWidget(harness(controller));
    await submit(tester, 'phone-input', '0901234567');
    final resend = tester.widget<TextButton>(
      find.widgetWithText(TextButton, 'Gửi lại mã sau 60s'),
    );
    expect(resend.onPressed, isNull);
    await tester.ensureVisible(find.text('Đổi số điện thoại'));
    await tester.tap(find.text('Đổi số điện thoại'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('phone-input')), findsOneWidget);
    expect(controller.challenge, isNull);
    expect(find.byKey(const ValueKey('otp-input')), findsNothing);
  });

  for (final width in [320.0, 360.0, 390.0, 430.0, 600.0]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('Ba bước không overflow tại $width / chữ $scale', (
        tester,
      ) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 900);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final controller = testController(AuthStubTransport(newUser: true));
        addTearDown(controller.dispose);
        await controller.restoreSession();
        await tester.pumpWidget(harness(controller, scale: scale));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await submit(tester, 'phone-input', '0901234567');
        expect(tester.takeException(), isNull);
        await submit(tester, 'otp-input', '123456');
        expect(tester.takeException(), isNull);
        await submit(tester, 'name-input', 'Nguyễn An');
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets('Bàn phím và safe area ở màn nhỏ vẫn dùng được biểu mẫu', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 700);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = testController(AuthStubTransport(newUser: true));
    addTearDown(controller.dispose);
    await controller.restoreSession();
    await tester.pumpWidget(harness(controller, scale: 2, keyboard: true));
    await submit(tester, 'phone-input', '0901234567');
    await submit(tester, 'otp-input', '123456');
    await submit(tester, 'name-input', 'Nguyễn An');
    expect(controller.stage, AuthStage.authenticated);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Accessibility: labels, contrast, target ở cả ba bước', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(430, 1800);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final handle = tester.ensureSemantics();
    final controller = testController(AuthStubTransport(newUser: true));
    addTearDown(controller.dispose);
    try {
      await controller.restoreSession();
      await tester.pumpWidget(harness(controller));
      for (final stage in [AuthStage.phone, AuthStage.otp, AuthStage.profile]) {
        await tester.pumpAndSettle();
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        if (stage == AuthStage.phone) {
          await submit(tester, 'phone-input', '0901234567');
        }
        if (stage == AuthStage.otp) await submit(tester, 'otp-input', '123456');
      }
    } finally {
      handle.dispose();
    }
  });

  testWidgets('Route khác vai trò không mở được bằng tài khoản khách', (
    tester,
  ) async {
    final controller = testController(AuthStubTransport());
    addTearDown(controller.dispose);
    await loginFixture(controller);
    await tester.pumpWidget(harness(controller, route: '/manager'));
    expect(
      find.text('Bạn không có quyền truy cập khu vực này.'),
      findsOneWidget,
    );
    expect(find.text('Xin chào, Nguyễn An'), findsNothing);
  });
}
