import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_products_controller.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_product_widgets.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_product_detail_screen.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_home_controller.dart';

import 'auth_test_support.dart';
import 'customer_home_test.dart' show catalogFixture, page, productFixture;

Map<String, dynamic> detailedProduct(int id) => {
  ...productFixture(id),
  'KeDon': true,
  'QuyCachDongGoi': 'Hộp 10 vỉ',
  'TenLoaiThuoc': 'Danh mục 2',
  'DangBaoChe': 'Dạng bào chế kiểm thử',
  'NhaSanXuat': 'Nhà sản xuất kiểm thử',
  'NuocSanXuat': 'Nước sản xuất kiểm thử',
  'SoDangKy': 'Đăng ký kiểm thử',
  'MaDuoc': 'Mã dược kiểm thử',
  'MaVach': 'Mã vạch kiểm thử',
  'MoTa': 'Mô tả đầy đủ từ API',
  'CachDung': 'Cách dùng từ API kiểm thử',
  'ChongChiDinh': 'Chống chỉ định từ API kiểm thử',
  'BaoQuan': 'Bảo quản từ API kiểm thử',
};

void main() {
  for (final scenario in ['mua', 'mua chữ lớn', 'tư vấn', 'hết hàng']) {
    testWidgets(
      'Chi tiết $scenario: thanh thao tác cố định, hỗ trợ và giỏ có padding',
      (tester) async {
        final large = scenario == 'mua chữ lớn';
        final width = large ? 320.0 : 390.0;
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 900);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final transport = catalogFixture();
        final data = detailedProduct(1);
        data['PhanLoai'] = scenario == 'tư vấn';
        final first = Map<String, dynamic>.from(
          (data['DonViGia'] as List).first as Map,
        );
        first['ConHang'] = scenario != 'hết hàng';
        data['DonViGia'] = [
          first,
          {
            ...first,
            'MaDonGia': 201,
            'DonViTinh': 'Vỉ',
            'GiaBan': 20000,
            'GiaKhuyenMai': 18000,
          },
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
        await home.loadCart();
        var support = 0, cart = 0;
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: MediaQuery(
              data: MediaQueryData(
                textScaler: TextScaler.linear(large ? 2 : 1),
              ),
              child: CustomerProductDetailScreen(
                home: home,
                productId: 1,
                onConsult: () => support++,
                onCart: () => cart++,
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final bar = find.byKey(const ValueKey('detail-bottom-bar'));
        final before = tester.getRect(bar);
        final button = find.descendant(
          of: bar,
          matching: find.byType(FilledButton),
        );
        expect(button, findsOneWidget);
        expect(
          tester.getRect(find.byKey(const ValueKey('detail-cart'))).right,
          lessThanOrEqualTo(width - 12),
        );
        if (scenario.startsWith('mua')) {
          final unit = find.byKey(const ValueKey('unit-option-201'));
          await tester.ensureVisible(unit);
          await tester.tap(unit);
          await tester.pumpAndSettle();
          await tester.tap(button);
          await tester.pumpAndSettle();
          expect(home.cart!.items.single.unitId, 201);
          expect(
            find.descendant(
              of: find.byKey(const ValueKey('detail-cart')),
              matching: find.text('1'),
            ),
            findsOneWidget,
          );
        } else if (scenario == 'hết hàng') {
          expect(
            find.descendant(of: bar, matching: find.text('Hết hàng')),
            findsOneWidget,
          );
          expect(tester.widget<FilledButton>(button).onPressed, isNull);
        } else {
          expect(
            find.descendant(of: bar, matching: find.text('Nhắn tin')),
            findsOneWidget,
          );
          await tester.tap(button);
          expect(support, 1);
        }
        await tester.scrollUntilVisible(
          find.text('Bảo quản từ API kiểm thử'),
          350,
          scrollable: find
              .descendant(
                of: find.byKey(const ValueKey('product-detail-scroll')),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.pumpAndSettle();
        expect(tester.getRect(bar), before);
        await tester.tap(find.byKey(const ValueKey('detail-support')));
        expect(support, scenario == 'tư vấn' ? 2 : 1);
        await tester.tap(find.byKey(const ValueKey('detail-cart')));
        expect(cart, 1);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        home.dispose();
      },
    );
  }
  test(
    'Bộ lọc kê đơn và danh mục giữ lại qua phân trang, giá lấy từ chi tiết API',
    () async {
      final transport = catalogFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      transport.catalogData['products'] = page('PRODUCTS_LISTED', [
        detailedProduct(3),
      ]);
      transport.catalogData['products/3'] = {
        'code': 'PRODUCT_FOUND',
        'product': detailedProduct(3),
      };
      final controller = CustomerProductsController(
        CatalogApi(auth.api.client),
        search: 'vitamin',
        categoryId: 2,
      );
      addTearDown(controller.dispose);
      await controller.initialize();
      expect(controller.title, 'Danh mục 2');
      await controller.filterPrescription(true);
      final request = transport.requests.lastWhere(
        (value) => value.uri.path == '/api/mobile/catalog/products',
      );
      expect(request.uri.queryParameters['ke_don'], 'true');
      expect(request.uri.queryParameters['category_id'], '2');
      expect(request.uri.queryParameters['search'], 'vitamin');
      expect(
        controller.items.single.displayName,
        'Sản phẩm kiểm thử 3 (Hộp 10 vỉ)',
      );
      expect(controller.items.single.usage, 'Cách dùng từ API kiểm thử');
      expect(request.headers.containsKey('Authorization'), isFalse);
      await controller.filterCategory(3);
      expect(controller.title, 'Danh mục 3');
      await controller.clearFilters();
      expect(controller.title, 'Kết quả tìm kiếm');
      expect(controller.hasFilters, isFalse);
      expect(controller.search, 'vitamin');
      final cleared = transport.requests
          .lastWhere((r) => r.uri.path == '/api/mobile/catalog/products')
          .uri
          .queryParameters;
      expect(cleared.containsKey('category_id'), isFalse);
      expect(cleared.containsKey('ke_don'), isFalse);
    },
  );

  testWidgets(
    'Danh sách hai cột, bộ lọc, chi tiết đầy đủ và trở về giữ lựa chọn',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 1100);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final transport = catalogFixture();
      transport.catalogData['products'] = page(
        'PRODUCTS_LISTED',
        List.generate(6, (i) => detailedProduct(i + 1)),
      );
      for (var id = 1; id <= 6; id++) {
        transport.catalogData['products/$id'] = {
          'code': 'PRODUCT_FOUND',
          'product': detailedProduct(id),
        };
      }
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
      await tester.enterText(
        find.byKey(const ValueKey('home-search')),
        'vitamin',
      );
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(find.byType(CustomerProductCard), findsNWidgets(6));
      final first = find.text('Sản phẩm kiểm thử 1 (Hộp 10 vỉ)');
      final second = find.text('Sản phẩm kiểm thử 2 (Hộp 10 vỉ)');
      final third = find.text('Sản phẩm kiểm thử 3 (Hộp 10 vỉ)');
      expect(tester.getTopLeft(first).dy, tester.getTopLeft(second).dy);
      expect(
        tester.getTopLeft(third).dy,
        greaterThan(tester.getTopLeft(first).dy),
      );
      expect(
        tester.getTopLeft(first).dx,
        lessThan(tester.getTopLeft(second).dx),
      );
      expect(tester.getTopLeft(first).dx, tester.getTopLeft(third).dx);
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Thuốc kê đơn').last);
      await tester.pumpAndSettle();
      expect(
        transport.requests
            .lastWhere((r) => r.uri.path == '/api/mobile/catalog/products')
            .uri
            .queryParameters['ke_don'],
        'true',
      );
      await tester.tap(second);
      await tester.pumpAndSettle();
      expect(find.text('Chi tiết sản phẩm'), findsOneWidget);
      expect(find.text('Danh mục 2'), findsOneWidget);
      expect(find.text('Dạng bào chế kiểm thử'), findsOneWidget);
      final text = find.text('Bảo quản từ API kiểm thử');
      await tester.scrollUntilVisible(
        text,
        350,
        scrollable: find
            .descendant(
              of: find.byKey(const ValueKey('product-detail-scroll')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
      expect(text, findsOneWidget);
      expect(find.text('Cách dùng từ API kiểm thử'), findsOneWidget);
      expect(find.text('Chống chỉ định từ API kiểm thử'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('products-search')), findsOneWidget);
      expect(find.text('Thuốc kê đơn'), findsOneWidget);
      expect(tester.takeException(), isNull);
      // Khi phiên kết thúc, các route con cũng phải rời khỏi khu vực khách hàng.
      await tester.tap(second);
      await tester.pumpAndSettle();
      await auth.logout();
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('home-search')), findsOneWidget);
      expect(find.text('Chi tiết sản phẩm'), findsNothing);
    },
  );

  testWidgets('Đổi danh mục cập nhật Appbar, nút nhà và giỏ về đúng tab', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1100);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final transport = catalogFixture();
    transport.cartItems.addAll([
      {'MaThuoc': 1, 'MaDonGia': 101, 'SoLuong': 8, 'TenThuoc': 'Thuốc A'},
      {'MaThuoc': 1, 'MaDonGia': 111, 'SoLuong': 3, 'TenThuoc': 'Thuốc A'},
      {'MaThuoc': 2, 'MaDonGia': 102, 'SoLuong': 5, 'TenThuoc': 'Thuốc B'},
    ]);
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
    await tester.ensureVisible(find.text('Danh mục 1'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Danh mục 1'));
    await tester.pumpAndSettle();
    final header = find.byType(AppBar);
    expect(
      find.descendant(of: header, matching: find.text('Danh mục 1')),
      findsOneWidget,
    );
    await tester.tap(find.byType(DropdownButtonFormField<int>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Danh mục 2').last);
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: header, matching: find.text('Danh mục 2')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: header, matching: find.text('Danh mục 1')),
      findsNothing,
    );
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('products-cart')),
        matching: find.text('2'),
      ),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('products-home')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('home-search')), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('home-search')), 'mô tả');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: header, matching: find.text('Kết quả tìm kiếm')),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('products-cart')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('customer-cart')), findsOneWidget);
    expect(find.text('2 sản phẩm'), findsOneWidget);
    expect(find.byKey(const ValueKey('products-search')), findsNothing);
    expect(
      transport.requests.where(
        (r) => r.uri.path == '/api/mobile/cart' && r.method == 'GET',
      ),
      isNotEmpty,
    );
    expect(tester.takeException(), isNull);
  });
}
