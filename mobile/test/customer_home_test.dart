import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/app/app_router.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_product_widgets.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_home_controller.dart';
import 'package:lan_yen_pharmacy/models/catalog.dart';

import 'auth_test_support.dart';

Map<String, dynamic> page(String code, List<Map<String, dynamic>> items) => {
  'code': code,
  'items': items,
  'page': 1,
  'pages': items.isEmpty ? 0 : 1,
  'total': items.length,
};
Map<String, dynamic> productFixture(int id) => {
  'MaThuoc': id,
  'TenThuoc': 'Sản phẩm kiểm thử $id',
  'HinhAnh': '',
  'MoTa': 'Thông tin mô tả từ API kiểm thử.',
  'KeDon': false,
  'KhuyenMai': {'TrangThai': 'ACTIVE'},
  'DonViGia': [
    {
      'MaDonGia': 100 + id,
      'DonViTinh': 'Hộp',
      'GiaBan': 120000,
      'GiaKhuyenMai': 99000,
      'ConHang': true,
      'SoLuongKhuyenMai': 4,
    },
  ],
};
AuthStubTransport catalogFixture() {
  final transport = AuthStubTransport();
  transport.catalogData.addAll({
    'categories': page(
      'CATEGORIES_LISTED',
      List.generate(
        9,
        (index) => {
          'MaLoaiThuoc': index + 1,
          'TenLoaiThuoc': 'Danh mục ${index + 1}',
        },
      ),
    ),
    'promotions': page('PROMOTIONS_LISTED', [
      {
        'MaChuongTrinh': 7,
        'TenChuongTrinh': 'Chương trình kiểm thử',
        'NgayBatDau': '2026-11-01',
        'NgayKetThuc': '2026-11-30',
        'TrangThai': 'ACTIVE',
      },
    ]),
    'promotions/7/products': page('PROMOTION_PRODUCTS_LISTED', [
      productFixture(1),
      productFixture(2),
    ]),
    'products': page('PRODUCTS_LISTED', [productFixture(3)]),
    'products/1': {'code': 'PRODUCT_FOUND', 'product': productFixture(1)},
    'products/2': {'code': 'PRODUCT_FOUND', 'product': productFixture(2)},
    'products/3': {'code': 'PRODUCT_FOUND', 'product': productFixture(3)},
  });
  return transport;
}

void main() {
  test('Nhãn ưu đãi theo loại Backend, không suy giảm tiền ra tỷ lệ', () {
    final percent = {
      ...productFixture(1),
      'KhuyenMai': {
        'TrangThai': 'ACTIVE',
        'LoaiGiamGia': true,
        'GiaTriGiam': '10.00',
      },
    };
    expect(CatalogProduct.fromJson(percent).offerBadge, '-10%');
    percent['KhuyenMai'] = {
      'TrangThai': 'ACTIVE',
      'LoaiGiamGia': false,
      'GiaTriGiam': '10000',
    };
    expect(CatalogProduct.fromJson(percent).offerBadge, 'Ưu đãi');
  });

  testWidgets(
    'Refactor màu giữ nguyên foreground/background/overlay theo trạng thái Theme',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Builder(
            builder: (context) {
              final original =
                  (Theme.of(context).filledButtonTheme.style ??
                          const ButtonStyle())
                      .merge(
                        const FilledButton(
                          onPressed: null,
                          child: SizedBox(),
                        ).defaultStyleOf(context),
                      );
              final local = CustomerProductColors.purchaseStyle(context);
              expect(local.shape?.resolve({}), original.shape?.resolve({}));
              expect(
                local.minimumSize?.resolve({}),
                original.minimumSize?.resolve({}),
              );
              expect(local.padding?.resolve({}), original.padding?.resolve({}));
              for (final states in <Set<WidgetState>>[
                {},
                {WidgetState.disabled},
                {WidgetState.focused},
                {WidgetState.hovered},
                {WidgetState.pressed},
              ]) {
                expect(
                  local.foregroundColor?.resolve(states),
                  original.foregroundColor?.resolve(states),
                );
                expect(
                  local.backgroundColor?.resolve(states),
                  original.backgroundColor?.resolve(states),
                );
                expect(
                  local.overlayColor?.resolve(states),
                  original.overlayColor?.resolve(states),
                );
              }
              return const SizedBox();
            },
          ),
        ),
      );
    },
  );

  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'Tên chương trình dài, đơn vị hiện đủ và quota/giá cập nhật ở scale $scale',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(scale == 1 ? 390 : 320, 1100);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final transport = catalogFixture();
        final longName =
            'Ưu đãi chăm sóc sức khỏe gia đình và những người thương yêu nhân dịp chương trình tri ân khách hàng Lan Yến';
        (transport.catalogData['promotions']!['items'] as List)
                .first['TenChuongTrinh'] =
            longName;
        transport.catalogData['promotions/7/products']!['items'] = [
          {
            ...productFixture(1),
            'KhuyenMai': {
              'TrangThai': 'ACTIVE',
              'LoaiGiamGia': true,
              'GiaTriGiam': '10.00',
            },
            'DonViGia': [
              {
                'MaDonGia': 101,
                'DonViTinh': 'Hộp',
                'GiaBan': 120000,
                'GiaKhuyenMai': 108000,
                'SoLuongKhuyenMai': 4,
                'ConHang': true,
              },
              {
                'MaDonGia': 901,
                'DonViTinh': 'Vỉ',
                'GiaBan': 12000,
                'GiaKhuyenMai': 10800,
                'SoLuongKhuyenMai': 40,
                'ConHang': true,
              },
              {
                'MaDonGia': 902,
                'DonViTinh': 'Viên',
                'GiaBan': 1200,
                'GiaKhuyenMai': 1080,
                'SoLuongKhuyenMai': 400,
                'ConHang': true,
              },
            ],
          },
        ];
        final auth = testController(transport);
        addTearDown(auth.dispose);
        await loginFixture(auth);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: AppRouter(controller: auth),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.widget<Text>(find.text(longName)).maxLines, 2);
        expect(find.text('-10%'), findsOneWidget);
        expect(find.byType(DropdownButtonFormField<int>), findsNothing);
        expect(find.byKey(const ValueKey('unit-option-101')), findsOneWidget);
        expect(find.byKey(const ValueKey('unit-option-902')), findsOneWidget);
        expect(find.text('Còn 4 Hộp ưu đãi'), findsOneWidget);
        expect(find.text('120.000đ'), findsOneWidget);
        expect(find.textContaining(RegExp(r'^\d{2,} ngày$')), findsNothing);
        final option = find.byKey(const ValueKey('unit-option-901'));
        await Scrollable.ensureVisible(tester.element(option), alignment: .4);
        await tester.pumpAndSettle();
        await tester.tap(option);
        await tester.pumpAndSettle();
        expect(find.text('Còn 40 Vỉ ưu đãi'), findsOneWidget);
        expect(find.text('10.800đ / Vỉ'), findsOneWidget);
        expect(transport.cartAdds, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }

  test(
    'Danh mục đọc đủ trang, sản phẩm chuyển trang, lỗi contract được xử lý',
    () async {
      final transport = catalogFixture();
      final auth = testController(transport);
      addTearDown(auth.dispose);
      final home = CustomerHomeController(CatalogApi(auth.api.client));
      addTearDown(home.dispose);
      transport.catalogData['categories']!['pages'] = 2;
      transport.catalogData['categories']!['total'] = 10;
      transport.catalogData['categories?page=2'] = {
        ...page('CATEGORIES_LISTED', [
          {'MaLoaiThuoc': 10, 'TenLoaiThuoc': 'Danh mục 10'},
        ]),
        'page': 2,
        'pages': 2,
        'total': 10,
      };
      await home.loadCategories();
      expect(home.categories.length, 10);
      transport.catalogData['products?page=2'] = {
        ...page('PRODUCTS_LISTED', [productFixture(9)]),
        'page': 2,
        'pages': 2,
        'total': 13,
      };
      await home.browse(query: 'vitamin', page: 2);
      expect(home.resultPage, 2);
      expect(home.results.single.id, 9);
      transport.catalogData['products']!['code'] = 'INVALID';
      await home.browse(query: 'vitamin');
      expect(home.searchError, isNotNull);
    },
  );

  testWidgets('Trang chủ: nhãn, tương phản, vùng chạm và trạng thái rỗng/lỗi', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    try {
      final transport = AuthStubTransport();
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
      expect(find.text('Chưa có danh mục được công bố.'), findsOneWidget);
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      await expectLater(tester, meetsGuideline(textContrastGuideline));
      transport.catalogFails = true;
      // Kéo làm mới chỉ đọc; lỗi có nút thử lại, không thay bằng dữ liệu giả.
      await tester.drag(find.byType(ListView).first, const Offset(0, 500));
      await tester.pumpAndSettle();
      expect(find.text('Thử lại'), findsWidgets);
    } finally {
      handle.dispose();
    }
  });

  test('Giá khuyến mãi phải còn quota, còn hàng và chương trình ACTIVE', () {
    final json = productFixture(1);
    var product = CatalogProduct.fromJson(json);
    expect(product.discounted, isTrue);
    expect(formatVnd(product.displayPrice!.sale!), '99.000đ');
    (json['DonViGia'] as List).first['SoLuongKhuyenMai'] = 0;
    product = CatalogProduct.fromJson(json);
    expect(product.discounted, isFalse);
    (json['DonViGia'] as List).first['SoLuongKhuyenMai'] = 4;
    json['KhuyenMai'] = {'TrangThai': 'UPCOMING'};
    expect(CatalogProduct.fromJson(json).discounted, isFalse);
  });

  test('Mã hóa query, lỗi khối độc lập và tải lại', () async {
    final transport = catalogFixture();
    final auth = testController(transport);
    addTearDown(auth.dispose);
    await loginFixture(auth);
    final home = CustomerHomeController(CatalogApi(auth.api.client));
    addTearDown(home.dispose);
    await home.load();
    expect(home.categories.length, 9);
    expect(home.offers.length, 2);
    await home.browse(query: 'vitamin & khoáng / chất?');
    expect(
      transport.requests
          .lastWhere(
            (request) => request.uri.path == '/api/mobile/catalog/products',
          )
          .uri
          .queryParameters['search'],
      'vitamin & khoáng / chất?',
    );
    expect(
      transport.requests.last.headers.containsKey('Authorization'),
      isFalse,
    );
    transport.catalogFails = true;
    await home.loadCategories();
    expect(home.categoriesError, isNotNull);
    expect(home.offers.length, 2);
    transport.catalogFails = false;
    await home.loadCategories();
    expect(home.categoriesError, isNull);
  });

  test('Bỏ kết quả tìm kiếm khi đã đóng hoặc controller bị dispose', () async {
    final transport = catalogFixture();
    final auth = testController(transport);
    addTearDown(auth.dispose);
    final home = CustomerHomeController(CatalogApi(auth.api.client));
    transport.hold = Completer<void>();
    final request = home.browse(query: 'vitamin');
    home.closeSearch();
    home.dispose();
    transport.hold!.complete();
    await request;
    expect(home.results, isEmpty);
  });

  for (final width in [320.0, 360.0, 390.0, 430.0, 600.0, 900.0]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('Trang chủ rộng $width chữ $scale không tràn', (
        tester,
      ) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 1000);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final auth = testController(catalogFixture());
        addTearDown(auth.dispose);
        await loginFixture(auth);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: AppRouter(controller: auth),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Xin chào, Nguyễn An'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.drag(find.byType(ListView).first, const Offset(0, -700));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.tap(find.byKey(const ValueKey('customer-tab-4')));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('Đăng xuất'),
          120,
          scrollable: find.byType(Scrollable).last,
        );
        await tester.pumpAndSettle();
        expect(find.text('Đăng xuất'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets('Danh mục đầu 6, mở đủ; tìm kiếm, chi tiết và thanh cố định', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1000);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final transport = catalogFixture();
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
    expect(find.text('Danh mục 6'), findsOneWidget);
    expect(find.text('Danh mục 7'), findsNothing);
    await tester.ensureVisible(find.byKey(const ValueKey('expand-categories')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('expand-categories')));
    await tester.pumpAndSettle();
    expect(find.text('Danh mục 9'), findsOneWidget);
    await tester.ensureVisible(find.text('Danh mục 9'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Danh mục 9'));
    await tester.pumpAndSettle();
    expect(
      transport.requests
          .lastWhere(
            (request) => request.uri.path == '/api/mobile/catalog/products',
          )
          .uri
          .queryParameters['category_id'],
      '9',
    );
    await tester.enterText(
      find.byKey(const ValueKey('products-search')),
      'vitamin',
    );
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    expect(
      transport.requests
          .lastWhere(
            (request) => request.uri.path == '/api/mobile/catalog/products',
          )
          .uri
          .queryParameters['search'],
      'vitamin',
    );
    expect(find.byKey(const ValueKey('products-search')), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await Scrollable.ensureVisible(
      tester.element(find.text('Sản phẩm kiểm thử 1')),
      alignment: .4,
    );
    await tester.pumpAndSettle();
    // NestedScrollView có header ghim: đưa thẻ vào vùng giữa, tránh nút bị thanh dưới che.
    for (var attempt = 0; attempt < 2; attempt++) {
      final y = tester.getCenter(find.text('Sản phẩm kiểm thử 1')).dy;
      if (y >= 140 && y <= 800) break;
      await tester.drag(
        find.byKey(const ValueKey('customer-home-content')),
        Offset(0, 400 - y),
      );
      await tester.pumpAndSettle();
    }
    await tester.tap(find.text('Sản phẩm kiểm thử 1'));
    await tester.pumpAndSettle();
    expect(transport.requests.last.uri.path, endsWith('/products/1'));
    expect(find.text('Thông tin mô tả từ API kiểm thử.'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await Scrollable.ensureVisible(
      tester.element(find.text('Tư vấn thuốc')),
      alignment: .4,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tư vấn thuốc'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Kênh nhắn tin tư vấn đang được chuẩn bị'),
      findsOneWidget,
    );
  });

  testWidgets('Xuất ảnh trang chủ bằng font thực', (tester) async {
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
    final transport = catalogFixture();
    final previewProducts = List.generate(
      3,
      (index) => {
        ...productFixture(index + 1),
        'QuyCachDongGoi': 'Hộp 10 vỉ',
        'TenLoaiThuoc': 'Danh mục 1',
        'DangBaoChe': 'Dạng bào chế từ API kiểm thử',
        'NhaSanXuat': 'Nhà sản xuất kiểm thử',
        'NuocSanXuat': 'Nước sản xuất kiểm thử',
        'CachDung': 'Thông tin cách dùng từ API kiểm thử',
        'BaoQuan': 'Thông tin bảo quản từ API kiểm thử',
      },
    );
    transport.catalogData['products'] = page(
      'PRODUCTS_LISTED',
      previewProducts,
    );
    for (final product in previewProducts) {
      transport.catalogData['products/${product['MaThuoc']}'] = {
        'code': 'PRODUCT_FOUND',
        'product': product,
      };
    }
    final auth = testController(transport);
    addTearDown(auth.dispose);
    await loginFixture(auth);
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          home: AppRouter(controller: auth),
        ),
      ),
    );
    await tester.pumpAndSettle();
    for (final section in ['top', 'categories']) {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage();
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        final file = File('build/home-preview/$section.png');
        await file.parent.create(recursive: true);
        await file.writeAsBytes(data!.buffer.asUint8List());
        image.dispose();
      });
      await tester.drag(find.byType(ListView).first, const Offset(0, -750));
      await tester.pumpAndSettle();
    }
    await tester.enterText(
      find.byKey(const ValueKey('home-search')),
      'vitamin',
    );
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    for (final section in ['products', 'detail']) {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage();
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        await File('build/home-preview/$section.png')
            .writeAsBytes(data!.buffer.asUint8List());
        image.dispose();
      });
      if (section == 'products') {
        final name = find.text('Sản phẩm kiểm thử 1 (Hộp 10 vỉ)');
        await tester.ensureVisible(name);
        await tester.pumpAndSettle();
        await tester.tap(name);
        await tester.pumpAndSettle();
      }
    }
  });
}
