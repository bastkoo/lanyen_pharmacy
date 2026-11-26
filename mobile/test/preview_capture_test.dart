import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/constants/app_roles.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/auth/auth_controller.dart';

// Xuất ảnh từ Flutter renderer để review trực quan, không phải ảnh Chrome/native.
void main() {
  testWidgets('Xuất mẫu giao diện với font tiếng Việt thực', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1600);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final loader = FontLoader('BeVietnamPro');
    for (final weight in [400, 500, 600]) {
      loader.addFont(
        rootBundle.load('assets/fonts/be-vietnam-pro-$weight.ttf'),
      );
    }
    await loader.load();
    final iconLoader = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await iconLoader.load();
    final controller = AuthController();
    addTearDown(controller.dispose);
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
    for (final role in [null, ...AppRole.values]) {
      if (role != null) controller.enterDemo(role);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      final boundary =
          boundaryKey.currentContext!.findRenderObject()!
              as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage();
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        final file = File('build/preview/${role?.name ?? 'entry'}.png');
        await file.parent.create(recursive: true);
        await file.writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
      if (role != null) controller.leaveDemo();
      await tester.pumpAndSettle();
    }
  });
}
