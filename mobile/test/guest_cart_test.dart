import 'dart:io';
import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/storage/guest_cart_storage.dart';
import 'package:lan_yen_pharmacy/core/storage/session_storage.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_home_controller.dart';
import 'package:lan_yen_pharmacy/features/auth/login_required_dialog.dart';
import 'package:lan_yen_pharmacy/models/catalog.dart';

import 'auth_test_support.dart';
import 'customer_home_test.dart' show catalogFixture, productFixture;

// Giả lập kho thiết bị ghi chậm để kiểm tra đổi tài khoản trong lúc đóng băng batch.
class DelayedGuestStore extends MemoryTokenStore {
  bool delay = false;
  final started = Completer<void>();
  final release = Completer<void>();
  @override
  Future<void> write(String value) async {
    if (delay && value.contains('"pending":')) {
      if (!started.isCompleted) started.complete();
      await release.future;
    }
    await super.write(value);
  }
}

void main() {
  test(
    'Đổi tài khoản khi đang lưu batch không gửi giỏ bằng token tài khoản mới',
    () async {
      final transport = catalogFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      final store = DelayedGuestStore();
      final storage = GuestCartStorage(store);
      final home = CustomerHomeController(
        CatalogApi(auth.api.client),
        cartApi: CartApi(auth.api),
        guestCart: storage,
      );
      addTearDown(home.dispose);
      final product = CatalogProduct.fromJson(productFixture(1));
      await home.addToCart(product, product.displayPrice!);
      await loginFixture(auth);
      store.delay = true;
      final first = home.changeCustomer(auth.user!.id);
      await store.started.future;
      final second = home.changeCustomer(999);
      store.release.complete();
      await Future.wait([first, second]);
      expect(
        transport.requests.where((r) => r.uri.path.endsWith('/cart/merge')),
        isEmpty,
      );
      expect(home.cartError, contains('tài khoản trước'));
      expect((await storage.read())['pending']['owner'], auth.user!.id);
    },
  );
  test('Giỏ khách lưu qua controller mới, không gọi API ghi; đăng nhập cộng đúng lượng', () async {
    final transport = catalogFixture();
    final auth = testController(transport);
    addTearDown(auth.dispose);
    final storage = GuestCartStorage(MemoryTokenStore());
    final home = CustomerHomeController(
      CatalogApi(auth.api.client),
      cartApi: CartApi(auth.api),
      guestCart: storage,
    );
    addTearDown(home.dispose);
    final product = CatalogProduct.fromJson(productFixture(1));
    await home.loadCart();
    expect(await home.addToCart(product, product.displayPrice!), isTrue);
    expect(await home.addToCart(product, product.displayPrice!), isTrue);
    expect(home.cart!.items.single.quantity, 2);
    expect(
      transport.requests.where(
        (r) => r.uri.path.startsWith('/api/mobile/cart'),
      ),
      isEmpty,
    );
    final restored = CustomerHomeController(
      CatalogApi(auth.api.client),
      cartApi: CartApi(auth.api),
      guestCart: storage,
    );
    addTearDown(restored.dispose);
    await restored.loadCart();
    expect(restored.cart!.productCount, 1);
    expect(restored.cart!.items.single.quantity, 2);
    await loginFixture(auth);
    transport.cartItems.add({
      'MaThuoc': 1,
      'MaDonGia': 101,
      'SoLuong': 3,
      'TenThuoc': 'A',
    });
    await restored.changeCustomer(auth.user!.id);
    expect(restored.cart!.items.single.quantity, 5);
    expect((await storage.read())['items'], isEmpty);
    expect((await storage.read())['pending'], isNull);
    await restored.changeCustomer(null);
    expect(restored.cart!.items, isEmpty);
    expect(transport.cartItems.single['SoLuong'], 5);
  });

  test(
    'Mất phản hồi sau commit giữ giỏ, retry cùng mã không cộng trùng',
    () async {
      final transport = catalogFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      final home = CustomerHomeController(
        CatalogApi(auth.api.client),
        cartApi: CartApi(auth.api),
        guestCart: auth.guestCart,
      );
      addTearDown(home.dispose);
      final product = CatalogProduct.fromJson(productFixture(1));
      await home.addToCart(product, product.displayPrice!);
      await loginFixture(auth);
      transport.loseMergeResponse = true;
      await home.changeCustomer(auth.user!.id);
      expect(home.cartError, isNotNull);
      final pending = (await auth.guestCart.read())['pending'];
      expect(pending['items'].single['SoLuong'], 1);
      expect(transport.cartItems.single['SoLuong'], 1);
      transport.loseMergeResponse = false;
      await home.loadCart();
      expect(home.cartError, isNull);
      expect(home.cart!.items.single.quantity, 1);
      expect(transport.mergedGuestBatches.length, 1);
      expect((await auth.guestCart.read())['pending'], isNull);
    },
  );

  test(
    'Lỗi hết hàng giữ nguyên giỏ chờ, không gộp sang tài khoản khác',
    () async {
      final transport = catalogFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      final home = CustomerHomeController(
        CatalogApi(auth.api.client),
        cartApi: CartApi(auth.api),
        guestCart: auth.guestCart,
      );
      addTearDown(home.dispose);
      final product = CatalogProduct.fromJson(productFixture(1));
      await home.addToCart(product, product.displayPrice!);
      await loginFixture(auth);
      transport.cartFailure = 'OUT_OF_STOCK';
      await home.changeCustomer(auth.user!.id);
      expect(home.cartError, isNotNull);
      expect((await auth.guestCart.read())['pending'], isNotNull);
      final requests = transport.requests.length;
      await home.changeCustomer(999);
      expect(home.cart, isNull);
      expect(transport.requests.length, requests);
    },
  );

  testWidgets(
    'Khách vào trang chủ, chặn mục thành viên bằng modal và đăng nhập gộp giỏ',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 1000);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final transport = catalogFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      await auth.restoreSession();
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: AppRouter(controller: auth),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Chào mừng bạn đến với Lan Yến Pharmacy'),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('phone-input')), findsNothing);
      final consult = find.byKey(const ValueKey('customer-tab-2'));
      expect(
        tester.getCenter(
          find.descendant(of: consult, matching: find.byType(Icon)).first,
        ),
        tester.getCenter(consult),
      );
      for (final tab in [1, 2, 4]) {
        await tester.tap(find.byKey(ValueKey('customer-tab-$tab')));
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('login-required-dialog')),
          findsOneWidget,
        );
        await tester.tap(find.text('Trở lại'));
        await tester.pumpAndSettle();
      }
      await tester.tap(find.text('Đơn của tôi'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Đóng'));
      await tester.pumpAndSettle();
      // Xem chi tiết vẫn là công khai.
      await tester.enterText(
        find.byKey(const ValueKey('home-search')),
        'vitamin',
      );
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chọn mua').first);
      await tester.pumpAndSettle();
      expect((await auth.guestCart.read())['items'].length, 1);
      await tester.tap(find.byKey(const ValueKey('products-cart')));
      await tester.pumpAndSettle();
      expect(find.text('1 sản phẩm'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('customer-tab-4')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('login-required-submit')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('phone-input')), findsOneWidget);
      await auth.requestOtp('0901234567');
      await auth.verifyOtp('123456');
      await tester.pumpAndSettle();
      expect(find.text('Xin chào, Nguyễn An'), findsOneWidget);
      expect(transport.cartItems.single['SoLuong'], 1);
      expect((await auth.guestCart.read())['pending'], isNull);
      expect(tester.takeException(), isNull);
    },
  );

  for (final size in [const Size(320, 640), const Size(390, 1000)]) {
    testWidgets('Hộp thoại đăng nhập không tràn ở $size, chữ lớn', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = size;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Builder(
            builder: (context) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: const TextScaler.linear(2)),
              child: const Scaffold(body: LoginRequiredDialog()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(
        find.byKey(const ValueKey('login-required-submit')),
      );
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('Xuất ảnh hộp thoại đăng nhập bằng font thật', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1000);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final font = FontLoader('BeVietnamPro');
    for (final weight in [400, 500, 600]) {
      font.addFont(rootBundle.load('assets/fonts/be-vietnam-pro-$weight.ttf'));
    }
    await font.load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    final auth = testController(catalogFixture());
    addTearDown(auth.dispose);
    await auth.restoreSession();
    final boundaryKey = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundaryKey,
        child: MaterialApp(
          theme: AppTheme.light,
          debugShowCheckedModeBanner: false,
          home: AppRouter(controller: auth),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('customer-tab-4')));
    await tester.pumpAndSettle();
    final boundary =
        boundaryKey.currentContext!.findRenderObject()!
            as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final rendered = await boundary.toImage();
      final data = await rendered.toByteData(format: ui.ImageByteFormat.png);
      final file = File('build/home-preview/login-required.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(data!.buffer.asUint8List());
      rendered.dispose();
    });
    expect(tester.takeException(), isNull);
  });
}
