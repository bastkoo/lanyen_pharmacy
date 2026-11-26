import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';

import 'auth_test_support.dart';

// Xuất ảnh các bước bằng Flutter renderer và font thực, không phải ảnh thiết bị.
void main() {
  testWidgets('Xuất ảnh đăng nhập, OTP, họ tên và đích sau xác thực', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1000);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final loader = FontLoader('BeVietnamPro');
    for (final weight in [400, 500, 600]) {
      loader.addFont(
        rootBundle.load('assets/fonts/be-vietnam-pro-$weight.ttf'),
      );
    }
    await loader.load();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
    final controller = testController(AuthStubTransport(newUser: true));
    addTearDown(controller.dispose);
    await controller.restoreSession();
    final boundaryKey = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundaryKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          home: AppRouter(controller: controller),
        ),
      ),
    );
    for (final step in ['phone', 'otp', 'profile', 'signed-in']) {
      await tester.runAsync(
        () => precacheImage(
          const AssetImage('assets/images/logo.png'),
          tester.element(find.byType(AppRouter)),
        ),
      );
      await tester.pumpAndSettle();
      final boundary =
          boundaryKey.currentContext!.findRenderObject()!
              as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage();
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        final file = File('build/login-preview/$step.png');
        await file.parent.create(recursive: true);
        await file.writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
      if (step == 'phone') await controller.requestOtp('0901234567');
      if (step == 'otp') await controller.verifyOtp('123456');
      if (step == 'profile') await controller.register('Nguyễn An');
      await tester.pumpAndSettle();
    }
  });
}
