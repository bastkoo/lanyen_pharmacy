import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/constants/app_roles.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/core/theme/app_motion.dart';
import 'package:lan_yen_pharmacy/features/auth/auth_controller.dart';

Widget harness(
  AuthController controller, {
  String route = '/',
  double scale = 1,
  bool reducedMotion = false,
  bool keyboardVisible = false,
}) => MaterialApp(
  theme: AppTheme.light,
  home: MediaQuery(
    data: MediaQueryData(
      textScaler: TextScaler.linear(scale),
      disableAnimations: reducedMotion,
      viewInsets: EdgeInsets.only(bottom: keyboardVisible ? 300 : 0),
      padding: const EdgeInsets.only(top: 44, bottom: 34),
    ),
    child: AppRouter(controller: controller, route: route),
  ),
);

void main() {
  testWidgets('Màn hình nhỏ, chữ lớn và bàn phím vẫn cuộn tới hành động', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 700);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = AuthController()..enterDemo(AppRole.employee);
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      harness(controller, scale: 2, keyboardVisible: true),
    );
    await tester.pumpAndSettle();
    final input = find.byType(TextField);
    await tester.ensureVisible(input);
    await tester.enterText(input, 'Ghi chú giả lập');
    await tester.pumpAndSettle();
    final action = find.text('Trở về chọn vai trò');
    await tester.ensureVisible(action);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(action);
    await tester.pumpAndSettle();
    expect(controller.demoRole, isNull);
  });

  testWidgets('Cổng demo và ba tài khoản giả lập, thoát không giữ vai trò cũ', (
    tester,
  ) async {
    await tester.pumpWidget(const PharmacyApp());
    for (final role in AppRole.values) {
      await tester.ensureVisible(find.byKey(ValueKey('demo-${role.name}')));
      await tester.tap(find.byKey(ValueKey('demo-${role.name}')));
      await tester.pumpAndSettle();
      expect(find.byKey(ValueKey('shell-${role.name}')), findsOneWidget);
      for (final other in AppRole.values.where((value) => value != role)) {
        expect(find.byKey(ValueKey('shell-${other.name}')), findsNothing);
      }
      await tester.tap(find.byTooltip('Thoát bản xem thử'));
      await tester.pumpAndSettle();
      expect(find.byKey(ValueKey('demo-${role.name}')), findsOneWidget);
    }
  });

  for (final width in [320.0, 360.0, 390.0, 430.0, 600.0, 900.0]) {
    for (final scale in [1.0, 1.25, 1.5, 2.0]) {
      testWidgets('Không overflow ở $width, chữ $scale, mọi vai trò', (
        tester,
      ) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 900);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final controller = AuthController();
        addTearDown(controller.dispose);
        await tester.pumpWidget(harness(controller, scale: scale));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        for (final role in AppRole.values) {
          controller.enterDemo(role);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          await tester.ensureVisible(find.text('Trở về chọn vai trò'));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          controller.leaveDemo();
          await tester.pumpAndSettle();
        }
      });
    }
  }

  testWidgets('Từ chối route khác vai trò và route không tồn tại', (
    tester,
  ) async {
    final controller = AuthController()..enterDemo(AppRole.customer);
    addTearDown(controller.dispose);
    for (final route in ['/employee', '/manager', '/unknown']) {
      await tester.pumpWidget(harness(controller, route: route));
      await tester.pumpAndSettle();
      expect(
        find.text('Đường dẫn không hợp lệ hoặc không phù hợp vai trò.'),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('shell-employee')), findsNothing);
      expect(find.byKey(const ValueKey('shell-manager')), findsNothing);
    }
  });

  testWidgets('DEMO_MODE=false không mở được mock account', (tester) async {
    final controller = AuthController(demoEnabled: false);
    addTearDown(controller.dispose);
    await tester.pumpWidget(harness(controller));
    expect(controller.enterDemo(AppRole.manager), isFalse);
    expect(find.byKey(const ValueKey('demo-manager')), findsNothing);
    expect(find.text('Đăng nhập thật chưa được triển khai.'), findsOneWidget);
  });

  testWidgets('Hướng dẫn accessibility cho cổng vào và ba shell', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(430, 1600);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final semantics = tester.ensureSemantics();
    final controller = AuthController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(harness(controller));
    for (final role in [null, ...AppRole.values]) {
      if (role != null) controller.enterDemo(role);
      await tester.pumpAndSettle();
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      await expectLater(tester, meetsGuideline(textContrastGuideline));
      if (role != null) controller.leaveDemo();
      await tester.pumpAndSettle();
    }
    semantics.dispose();
  });

  testWidgets('Bàn phím mở demo, input nhận chữ, reduced motion có phản hồi', (
    tester,
  ) async {
    final controller = AuthController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(harness(controller, reducedMotion: true));
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(controller.demoRole, AppRole.customer);
    await tester.ensureVisible(find.byType(TextField));
    await tester.enterText(find.byType(TextField), 'Nội dung giả lập');
    expect(find.text('Nội dung giả lập'), findsOneWidget);
    final button = find.text('Thử nút chính');
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pumpAndSettle();
    expect(find.text('Đã thử tương tác cục bộ.'), findsOneWidget);
    expect(
      AppMotion.duration(tester.element(find.byType(TextField))),
      Duration.zero,
    );
  });
}
