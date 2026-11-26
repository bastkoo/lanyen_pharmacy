import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_products_controller.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_product_widgets.dart';

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
    },
  );

  testWidgets(
    'Danh sách ba cột, bộ lọc, chi tiết đầy đủ và trở về giữ lựa chọn',
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
      expect(tester.getTopLeft(second).dy, tester.getTopLeft(third).dy);
      expect(
        tester.getTopLeft(first).dx,
        lessThan(tester.getTopLeft(second).dx),
      );
      expect(
        tester.getTopLeft(second).dx,
        lessThan(tester.getTopLeft(third).dx),
      );
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
      expect(find.byKey(const ValueKey('phone-input')), findsOneWidget);
      expect(find.text('Chi tiết sản phẩm'), findsNothing);
    },
  );
}
