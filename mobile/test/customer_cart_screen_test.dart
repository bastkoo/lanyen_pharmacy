import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_cart_controller.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_cart_screen.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_home_controller.dart';
import 'package:lan_yen_pharmacy/models/catalog.dart';
import 'package:lan_yen_pharmacy/models/customer_cart.dart';

import 'auth_test_support.dart';
import 'customer_home_test.dart' show catalogFixture, productFixture;

// Tự dọn timer của controller khi cây Widget bị tháo trong kiểm thử.
class _HomeOwner extends StatefulWidget {
  const _HomeOwner({required this.home, required this.child});
  final CustomerHomeController home;
  final Widget child;
  @override
  State<_HomeOwner> createState() => _HomeOwnerState();
}

class _HomeOwnerState extends State<_HomeOwner> {
  @override
  Widget build(BuildContext context) => widget.child;
  @override
  void dispose() {
    widget.home.dispose();
    super.dispose();
  }
}

void main() {
  test(
    'Đổi sang đơn vị đã có trong giỏ khách sẽ gộp lượng, không tạo dòng trùng',
    () async {
      final transport = catalogFixture();
      final data = productFixture(1);
      data['DonViGia'] = [
        ...data['DonViGia'] as List,
        {'MaDonGia': 201, 'DonViTinh': 'Vỉ', 'GiaBan': 20000, 'ConHang': true},
      ];
      transport.catalogData['products/1'] = {
        'code': 'PRODUCT_FOUND',
        'product': data,
      };
      final auth = testController(transport);
      addTearDown(auth.dispose);
      final home = CustomerHomeController(
        CatalogApi(auth.api.client),
        cartApi: CartApi(auth.api),
        guestCart: auth.guestCart,
      );
      addTearDown(home.dispose);
      final product = CatalogProduct.fromJson(data);
      for (final price in product.prices) {
        await home.addToCart(product, price);
      }
      final controller = CustomerCartController(home);
      addTearDown(controller.dispose);
      await controller.refresh();
      expect(
        await home.editCart(controller.lines.first, 1, destinationId: 201),
        isTrue,
      );
      await controller.refresh();
      expect(home.cart!.items.length, 1);
      expect(home.cart!.items.single.unitId, 201);
      expect(home.cart!.items.single.quantity, 2);
      expect(home.cart!.productCount, 1);
      expect(controller.summary!.total, BigInt.from(40000));
    },
  );
  test('Tổng giảm giá chỉ áp dụng một phần số lượng, không nhân giá giảm cho cả dòng', () {
    final cart = CustomerCart.fromJson({
      'code': 'CART_LISTED',
      'authenticated': false,
      'total': '318000',
      'estimated_points': '318',
      'items': [
        {
          'MaThuoc': 1,
          'MaDonGia': 101,
          'SoLuong': 3,
          'TenThuoc': 'A',
          'GiaBan': '99000',
          'GiaGoc': '120000',
          'ThanhTien': '318000',
          'SoLuongKhuyenMai': 2,
          'KhuyenMai': {'TenChuongTrinh': 'Ưu đãi'},
        },
      ],
    });
    expect(cart.savings, BigInt.from(42000));
    expect(cart.items.single.promotionalQuantity, 2);
  });

  test('Giỏ khách: chọn sản phẩm tính lại tiền/xu; đổi đơn vị, giảm về không và lỗi báo giá', () async {
    final transport = catalogFixture();
    final auth = testController(transport);
    addTearDown(auth.dispose);
    final home = CustomerHomeController(
      CatalogApi(auth.api.client),
      cartApi: CartApi(auth.api),
      guestCart: auth.guestCart,
    );
    addTearDown(home.dispose);
    for (final id in [1, 2]) {
      final product = CatalogProduct.fromJson(productFixture(id));
      await home.addToCart(product, product.displayPrice!);
    }
    final controller = CustomerCartController(home);
    addTearDown(controller.dispose);
    await controller.refresh();
    expect(controller.summary!.total, BigInt.from(198000));
    expect(controller.summary!.estimatedPoints, BigInt.from(198));
    controller.toggle(101);
    await controller.refresh();
    expect(controller.summary!.total, BigInt.from(99000));
    expect(controller.summary!.estimatedPoints, BigInt.from(99));
    controller.selectAll();
    await controller.refresh();
    expect(controller.selected.length, 2);
    controller.selectAll();
    await controller.refresh();
    expect(controller.canBuy, isFalse);
    expect(controller.summary!.total, BigInt.zero);
    expect(await home.editCart(controller.lines.first, 0), isTrue);
    await controller.refresh();
    expect((await auth.guestCart.read())['items'].length, 1);
    transport.cartFailure = 'DATABASE_UNAVAILABLE';
    await controller.refresh();
    expect(controller.error, isNotNull);
    expect(controller.canBuy, isFalse);
  });

  test('Giỏ JWT sửa/xóa đúng dòng; không sửa localStorage giỏ khách', () async {
    final transport = catalogFixture();
    final auth = testController(transport);
    addTearDown(auth.dispose);
    await loginFixture(auth);
    transport.cartItems.add({
      'MaThuoc': 1,
      'MaDonGia': 101,
      'SoLuong': 2,
      'TenThuoc': 'A',
    });
    final home = CustomerHomeController(
      CatalogApi(auth.api.client),
      cartApi: CartApi(auth.api),
      guestCart: auth.guestCart,
      customerId: auth.user!.id,
    );
    addTearDown(home.dispose);
    await home.loadCart();
    expect(await home.editCart(home.cart!.items.single, 3), isTrue);
    expect(transport.cartItems.single['SoLuong'], 3);
    expect(await home.editCart(home.cart!.items.single, 0), isTrue);
    expect(transport.cartItems, isEmpty);
    expect((await auth.guestCart.read())['items'], isEmpty);
    for (final request in transport.requests.where(
      (r) =>
          r.uri.path.endsWith('/items/update') ||
          r.uri.path.endsWith('/items/remove'),
    )) {
      expect(request.headers['Authorization'], startsWith('Bearer '));
    }
  });

  for (final size in [const Size(390, 1000), const Size(320, 800)]) {
    testWidgets(
      'Giỏ $size: ưu đãi, vuốt mở xóa, giảm về không và bottom cố định',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = size;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final auth = testController(catalogFixture());
        addTearDown(auth.dispose);
        final home = CustomerHomeController(
          CatalogApi(auth.api.client),
          cartApi: CartApi(auth.api),
          guestCart: auth.guestCart,
        );
        for (final id in [1, 2]) {
          final product = CatalogProduct.fromJson(productFixture(id));
          await home.addToCart(product, product.displayPrice!);
        }
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: _HomeOwner(
              home: home,
              child: MediaQuery(
                data: MediaQueryData(
                  textScaler: TextScaler.linear(size.width == 320 ? 2 : 1),
                ),
                child: CustomerCartScreen(
                  home: home,
                  onContinue: () {},
                  onCheckout: () {},
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Đang ưu đãi'), findsAtLeastNWidgets(1));
        expect(find.textContaining('Flash sale'), findsNothing);
        expect(find.textContaining('Đổi xu'), findsNothing);
        expect(find.text('Dự kiến +198 xu'), findsOneWidget);
        final summary = find.byKey(const ValueKey('cart-summary'));
        final before = tester.getRect(summary);
        final card = find.byKey(const ValueKey('cart-line-101'));
        await tester.dragFrom(
          tester.getTopLeft(card) + const Offset(160, 55),
          const Offset(-110, 0),
        );
        await tester.pumpAndSettle();
        expect(home.cart!.items.length, 2);
        final delete = find.byKey(const ValueKey('cart-delete-101'));
        await Scrollable.ensureVisible(tester.element(delete), alignment: .5);
        await tester.pumpAndSettle();
        await tester.tap(delete);
        await tester.pumpAndSettle();
        expect(home.cart!.items.length, 1);
        final minus = find.byKey(const ValueKey('cart-minus-102'));
        await tester.ensureVisible(minus);
        await tester.pumpAndSettle();
        await tester.tap(minus);
        await tester.pumpAndSettle();
        expect(home.cart!.items, isEmpty);
        expect(find.text('Giỏ hàng chưa có sản phẩm.'), findsOneWidget);
        expect(tester.getRect(summary).bottom, before.bottom);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Ảnh giỏ hàng dùng font thật và biểu tượng xu Website', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1000);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final font = FontLoader('BeVietnamPro');
    for (final w in [400, 500, 600]) {
      font.addFont(rootBundle.load('assets/fonts/be-vietnam-pro-$w.ttf'));
    }
    await font.load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    final auth = testController(catalogFixture());
    addTearDown(auth.dispose);
    final home = CustomerHomeController(
      CatalogApi(auth.api.client),
      cartApi: CartApi(auth.api),
      guestCart: auth.guestCart,
    );
    final product = CatalogProduct.fromJson(productFixture(1));
    await home.addToCart(product, product.displayPrice!);
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          home: _HomeOwner(
            home: home,
            child: CustomerCartScreen(
              home: home,
              onContinue: () {},
              onCheckout: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final image = await boundary.toImage();
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('build/home-preview/cart.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(data!.buffer.asUint8List());
      image.dispose();
    });
    expect(tester.takeException(), isNull);
  });
}
