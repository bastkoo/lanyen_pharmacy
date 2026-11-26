import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_home_controller.dart';
import 'package:lan_yen_pharmacy/models/catalog.dart';
import 'package:lan_yen_pharmacy/models/customer_cart.dart';

import 'auth_test_support.dart';
import 'customer_home_test.dart' show productFixture, catalogFixture;

void main() {
  test('Đếm sản phẩm riêng biệt, không cộng số lượng hoặc đơn vị', () {
    final cart = CustomerCart.fromJson({
      'code': 'CART_LISTED',
      'authenticated': true,
      'items': [
        {
          'MaThuoc': 1,
          'MaDonGia': 11,
          'SoLuong': 8,
          'TenThuoc': 'A',
          'DonViTinh': 'Hộp',
        },
        {
          'MaThuoc': 1,
          'MaDonGia': 12,
          'SoLuong': 4,
          'TenThuoc': 'A',
          'DonViTinh': 'Vỉ',
        },
        {
          'MaThuoc': 2,
          'MaDonGia': 21,
          'SoLuong': 10,
          'TenThuoc': 'B',
          'DonViTinh': 'Hộp',
        },
      ],
    });
    expect(cart.productCount, 2);
  });

  test('Mốc ưu đãi đúng giờ Việt Nam, kết thúc hết ngày và không âm', () {
    final promotion = CatalogPromotion.fromJson({
      'MaChuongTrinh': 1,
      'TenChuongTrinh': 'Ưu đãi',
      'NgayBatDau': '2026-11-26',
      'NgayKetThuc': '2026-11-27',
      'TrangThai': 'UPCOMING',
    });
    expect(
      promotion.stateAt(DateTime.parse('2026-11-25T16:59:59Z')),
      'UPCOMING',
    );
    expect(
      promotion.remainingAt(DateTime.parse('2026-11-25T16:59:59Z')).inSeconds,
      1,
    );
    expect(promotion.stateAt(DateTime.parse('2026-11-25T17:00:00Z')), 'ACTIVE');
    expect(promotion.stateAt(DateTime.parse('2026-11-27T16:59:59Z')), 'ACTIVE');
    expect(promotion.stateAt(DateTime.parse('2026-11-27T17:00:00Z')), 'ENDED');
    expect(
      promotion.remainingAt(DateTime.parse('2026-11-28T00:00:00Z')),
      Duration.zero,
    );
  });

  test('Lưu giỏ JWT, đọc lại, cùng thuốc thêm hai lần vẫn đếm một', () async {
    final transport = catalogFixture();
    final auth = testController(transport);
    addTearDown(auth.dispose);
    await loginFixture(auth);
    final home = CustomerHomeController(
      CatalogApi(auth.api.client),
      cartApi: CartApi(auth.api),
    );
    addTearDown(home.dispose);
    final product = CatalogProduct.fromJson(productFixture(1));
    expect(await home.addToCart(product, product.displayPrice!), isTrue);
    expect(await home.addToCart(product, product.displayPrice!), isTrue);
    expect(transport.cartAdds, 2);
    expect(home.cart!.productCount, 1);
    expect(home.cart!.items.single.quantity, 2);
    final posts = transport.requests.where(
      (request) =>
          request.method == 'POST' && request.uri.path.endsWith('/cart/items'),
    );
    expect(posts.first.headers['Authorization'], startsWith('Bearer '));
    expect(posts.first.body!.keys, unorderedEquals(['MaThuoc', 'MaDonGia']));
    final restricted = CatalogProduct.fromJson({
      ...productFixture(2),
      'PhanLoai': true,
    });
    expect(await home.addToCart(restricted, restricted.displayPrice!), isFalse);
    expect(transport.cartAdds, 2);
  });

  test(
    'Chặn bấm trùng, hiển thị lỗi tồn kho và chỉ refresh token một lần',
    () async {
      final transport = catalogFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      await loginFixture(auth);
      final api = CartApi(auth.api);
      final home = CustomerHomeController(
        CatalogApi(auth.api.client),
        cartApi: api,
      );
      addTearDown(home.dispose);
      final product = CatalogProduct.fromJson(productFixture(1));
      transport.expiredAccess = true;
      await Future.wait([api.read(), api.read()]);
      expect(transport.refreshCount, 1);
      transport.hold = Completer<void>();
      final first = home.addToCart(product, product.displayPrice!);
      expect(await home.addToCart(product, product.displayPrice!), isFalse);
      transport.hold!.complete();
      await first;
      expect(transport.cartAdds, 1);
      transport.cartFailure = 'OUT_OF_STOCK';
      expect(await home.addToCart(product, product.displayPrice!), isFalse);
      expect(home.purchaseMessage, contains('vừa hết hàng'));
    },
  );

  testWidgets('Ẩn giá tư vấn, nút nhắn tin; nút mua cập nhật giỏ và huy hiệu', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1100);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final transport = catalogFixture();
    final restricted = {...productFixture(2), 'PhanLoai': true};
    restricted['DonViGia'] = [
      {'MaDonGia': 102, 'DonViTinh': 'Hộp', 'GiaBan': 876543, 'ConHang': true},
    ];
    transport.catalogData['promotions/7/products']!['items'] = [
      productFixture(1),
      restricted,
    ];
    final auth = testController(transport);
    addTearDown(auth.dispose);
    await loginFixture(auth);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: AppRouter(controller: auth),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('876.543'), findsNothing);
    expect(find.text('Nhắn tin'), findsOneWidget);
    final buy = find.widgetWithText(FilledButton, 'Chọn mua');
    await Scrollable.ensureVisible(tester.element(buy), alignment: .5);
    await tester.pumpAndSettle();
    await tester.tap(buy);
    await tester.pumpAndSettle();
    expect(transport.cartAdds, 1);
    expect(find.text('1'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('customer-tab-3')));
    await tester.pumpAndSettle();
    expect(find.text('1 sản phẩm'), findsOneWidget);
    expect(find.text('1 Hộp'), findsOneWidget);
  });

  testWidgets(
    'Cuộn ẩn logo giữ tìm kiếm; tư vấn đổi icon và tắt khi giảm chuyển động',
    (tester) async {
      final auth = testController(catalogFixture());
      addTearDown(auth.dispose);
      await loginFixture(auth);
      Future<void> mount(bool reduced) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: MediaQuery(
              data: MediaQueryData(disableAnimations: reduced),
              child: AppRouter(controller: auth),
            ),
          ),
        );
        await tester.pumpAndSettle();
      }

      await mount(false);
      final logo = find.byKey(const ValueKey('home-brand-logo'));
      expect(tester.getCenter(logo).dy, greaterThan(0));
      await tester.drag(find.byType(ListView).first, const Offset(0, -400));
      await tester.pumpAndSettle();
      expect(logo.hitTestable(), findsNothing);
      expect(
        find.byKey(const ValueKey('home-search-logo')).hitTestable(),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('home-search')).hitTestable(),
        findsOneWidget,
      );
      await tester.pump(const Duration(seconds: 2));
      await tester.pump(const Duration(milliseconds: 250));
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('customer-tab-2')),
          matching: find.byIcon(Icons.support_agent),
        ),
        findsOneWidget,
      );
      await mount(true);
      final before = tester
          .widget<Icon>(
            find.descendant(
              of: find.byKey(const ValueKey('customer-tab-2')),
              matching: find.byType(Icon),
            ),
          )
          .icon;
      await tester.pump(const Duration(seconds: 9));
      final after = tester
          .widget<Icon>(
            find.descendant(
              of: find.byKey(const ValueKey('customer-tab-2')),
              matching: find.byType(Icon),
            ),
          )
          .icon;
      expect(after, before);
      expect(tester.takeException(), isNull);
    },
  );
}
