import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/network/api_client.dart';
import 'package:lan_yen_pharmacy/core/network/api_exception.dart';
import 'package:lan_yen_pharmacy/core/storage/checkout_storage.dart';
import 'package:lan_yen_pharmacy/core/storage/session_storage.dart';
import 'package:lan_yen_pharmacy/core/theme/app_colors.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_checkout_controller.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_checkout_screen.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_order_screen.dart';
import 'package:lan_yen_pharmacy/models/checkout.dart';

import 'auth_test_support.dart';

// Transport dùng hoàn toàn dữ liệu giả, kể cả vé SePay; không tạo đơn/thanh toán thật.
class CheckoutStub extends AuthStubTransport {
  final addresses = <Map<String, dynamic>>[
    {
      'MaDiaChi': '9',
      'TinhThanh': 'Huế',
      'PhuongXa': 'Vỹ Dạ',
      'DiaChiCuThe': 'Nhà 1',
      'DiaChiGiao': true,
    },
  ];
  final Map<String, dynamic> saved = {};
  bool loseResponse = false,
      loseRecovery = false,
      changedPrice = false,
      invalidResponse = false;
  bool noProductDiscount = false;
  int posts = 0, quotes = 0;
  Completer<void>? checkoutHold;
  Map<String, dynamic> order = {
    'MaDonHang': '45',
    'TongTien': '36000',
    'TienGiamGia': '4000',
    'TongThanhToan': '32000',
    'TrangThaiDonHang': 1,
    'TrangThaiThanhToan': 0,
    'PhuongThucThanhToan': 0,
  };
  @override
  Future<ApiResponse> send(
    Uri uri,
    String method,
    Map<String, String> headers, {
    Map<String, dynamic>? body,
  }) async {
    if (!uri.path.startsWith('/api/mobile/checkout')) {
      return super.send(uri, method, headers, body: body);
    }
    requests.add((uri: uri, method: method, headers: headers, body: body));
    if (checkoutHold != null) await checkoutHold!.future;
    ApiResponse result(Object data, [int status = 200]) =>
        ApiResponse(status, jsonEncode(data));
    final path = uri.path;
    if (path.endsWith('/quote')) {
      quotes++;
      final usePoints = body!['DoiDiem'] == true;
      return result({
        'code': 'CHECKOUT_QUOTED',
        'original': '36000',
        'subtotal': noProductDiscount ? '36000' : '32000',
        'total': noProductDiscount
            ? (usePoints ? '35750' : '36000')
            : (usePoints ? '31750' : '32000'),
        'product_discount': noProductDiscount ? '0' : '4000',
        'balance': '25',
        'redeemed': usePoints ? '25' : '0',
        'points_discount': usePoints ? '250' : '0',
        'estimated_points': '31',
        'items': [
          {
            'MaThuoc': 7,
            'MaDonGia': 8,
            'TenThuoc': 'Sản phẩm kiểm thử',
            'QuyCachDongGoi': 'Hộp 3 vỉ',
            'SoLuong': 3,
            'DonViTinh': 'Vỉ',
            'ConHang': true,
            'GiaBan': '10000',
            'GiaGoc': '12000',
            'ThanhTien': '32000',
            'SoLuongKhuyenMai': 2,
            'KhuyenMai': {
              'TenChuongTrinh': 'Ngày văn hóa Việt Nam',
              'LoaiGiamGia': true,
              'GiaTriGiam': '5',
            },
          },
        ],
      });
    }
    if (path.endsWith('/addresses')) {
      if (method == 'POST') {
        addresses.add({'MaDiaChi': '10', ...body!});
        return result({
          'code': 'ADDRESS_CREATED',
          'address': addresses.last,
        }, 201);
      }
      return result({'code': 'ADDRESSES_LISTED', 'items': addresses});
    }
    if (path.endsWith('/addresses/9/update')) {
      addresses[0] = {...addresses[0], ...body!};
      return result({'code': 'ADDRESS_UPDATED', 'address': addresses[0]});
    }
    if (path.contains('/requests/')) {
      if (loseRecovery) throw const ApiException(ApiFailure.connection);
      final data = saved[uri.pathSegments.last];
      return data == null
          ? result({'code': 'ORDER_NOT_FOUND'}, 404)
          : result({'code': 'ORDER_READ', 'order': data});
    }
    if (path.endsWith('/orders')) {
      if (method == 'GET') {
        return result({
          'code': 'ORDERS_LISTED',
          'items': saved.values.toList(),
        });
      }
      posts++;
      if (changedPrice) return result({'code': 'QUOTE_CHANGED'}, 409);
      order = {
        ...order,
        'PhuongThucThanhToan': body!['PhuongThucThanhToan'],
        'TongThanhToan': body['TongThanhToan'],
      };
      saved[body['request_id'] as String] = Map.of(order);
      if (loseResponse) throw const ApiException(ApiFailure.connection);
      return result({
        'code': 'ORDER_CREATED',
        'order': invalidResponse ? null : order,
      }, 201);
    }
    if (path.endsWith('/payment')) {
      return result({
        'code': 'PAYMENT_LINK_CREATED',
        'path': 'mobile/checkout/payment',
        'ticket': 'signed-test-ticket',
      });
    }
    return result({'code': 'ORDER_READ', 'order': order});
  }
}

void main() {
  Future<({CheckoutApi api, CustomerCheckoutController controller})> setup(
    CheckoutStub transport, {
    MemoryTokenStore? store,
  }) async {
    final auth = testController(transport);
    addTearDown(auth.dispose);
    await loginFixture(auth);
    final api = CheckoutApi(auth.api);
    final controller = CustomerCheckoutController(api, [
      8,
    ], CheckoutStorage(store ?? MemoryTokenStore(), 42));
    addTearDown(controller.dispose);
    await controller.initialize();
    return (api: api, controller: controller);
  }

  test(
    'Địa chỉ, xu và đơn chọn đúng, JWT không dùng cookie; chặn nhấn trùng',
    () async {
      final transport = CheckoutStub();
      final state = await setup(transport);
      final c = state.controller;
      expect(c.addressId, '9');
      expect(c.quote!.lines.single.promotionalQuantity, 2);
      await c.setPoints(true);
      c.note = 'Gọi trước';
      final hold = transport.checkoutHold = Completer<void>();
      final submit = c.submit();
      await Future<void>.delayed(Duration.zero);
      await c.submit();
      hold.complete();
      await submit;
      expect(transport.posts, 1);
      final sent = transport.requests.firstWhere(
        (r) => r.method == 'POST' && r.uri.path.endsWith('/orders'),
      );
      expect(sent.body!['TongThanhToan'], '31750');
      expect(sent.body!['MaDonGia'], [8]);
      expect(sent.body!['MaDiaChi'], '9');
      expect(sent.body!['GhiChu'], 'Gọi trước');
      expect(sent.headers['Authorization'], startsWith('Bearer '));
      expect(sent.headers.containsKey('Cookie'), isFalse);
    },
  );
  test('Mất phản hồi khôi phục đơn cũ, không tự POST lại', () async {
    final transport = CheckoutStub()..loseResponse = true;
    final state = await setup(transport);
    await state.controller.submit();
    expect(state.controller.order?.id, '45');
    expect(transport.posts, 1);
  });
  test(
    'Mất cả phản hồi và tra cứu: giữ journal, mở lại chỉ GET, không đặt trùng',
    () async {
      final store = MemoryTokenStore();
      final transport = CheckoutStub()
        ..loseResponse = true
        ..loseRecovery = true;
      final state = await setup(transport, store: store);
      await state.controller.submit();
      expect(state.controller.uncertain, isTrue);
      expect(state.controller.canSubmit, isFalse);
      transport.loseRecovery = false;
      final next = CustomerCheckoutController(state.api, [
        8,
      ], CheckoutStorage(store, 42));
      addTearDown(next.dispose);
      await next.initialize();
      expect(next.order?.id, '45');
      expect(transport.posts, 1);
      expect(await CheckoutStorage(store, 42).read(), isNull);
    },
  );
  test(
    'Giá đổi yêu cầu tải lại, đổi hình thức nhận hàng không gửi địa chỉ cũ',
    () async {
      final transport = CheckoutStub()..changedPrice = true;
      final state = await setup(transport);
      await state.controller.submit();
      expect(state.controller.quote, isNull);
      expect(state.controller.order, isNull);
      transport.changedPrice = false;
      await state.controller.refreshQuote();
      state.controller.setReceipt('pickup');
      await state.controller.submit();
      expect(
        transport.requests
            .lastWhere(
              (r) => r.method == 'POST' && r.uri.path.endsWith('/orders'),
            )
            .body!['MaDiaChi'],
        isNull,
      );
    },
  );
  test(
    'Bridge dùng đúng backend, vé nằm fragment, không đưa JWT vào URL',
    () async {
      final state = await setup(CheckoutStub());
      final uri = await state.api.payment('45');
      expect(uri.host, '127.0.0.1');
      expect(uri.fragment, 'signed-test-ticket');
      expect(uri.query, isEmpty);
      expect(uri.toString(), isNot(contains('access-fixture')));
    },
  );
  test(
    'Thêm và đổi địa chỉ lưu trên backend rồi chọn địa chỉ mới cho đơn',
    () async {
      final transport = CheckoutStub();
      final state = await setup(transport);
      final c = state.controller;
      expect(
        await c.saveAddress({
          'TinhThanh': 'Huế',
          'PhuongXa': 'Thuận Hóa',
          'DiaChiCuThe': 'Nhà 2',
        }),
        isTrue,
      );
      expect(c.addressId, '10');
      expect(c.addresses.length, 2);
      expect(
        await c.saveAddress({
          'TinhThanh': 'Huế',
          'PhuongXa': 'Vỹ Dạ',
          'DiaChiCuThe': 'Nhà 3',
        }, id: '9'),
        isTrue,
      );
      expect(c.addresses.first.street, 'Nhà 3');
      await c.submit();
      expect(
        transport.requests
            .lastWhere(
              (r) => r.method == 'POST' && r.uri.path.endsWith('/orders'),
            )
            .body!['MaDiaChi'],
        '9',
      );
    },
  );
  test('Journal lỗi chặn đặt mới cho đến khi đọc được yêu cầu trước', () async {
    final store = MemoryTokenStore();
    await store.write('invalid');
    final state = await setup(CheckoutStub(), store: store);
    state.controller.setReceipt('pickup');
    await state.controller.refreshQuote();
    expect(state.controller.canSubmit, isFalse);
    await store.clear();
    await state.controller.retry();
    expect(state.controller.canSubmit, isTrue);
  });
  test(
    'Payload trả về hỏng được chuyển thành lỗi API, khôi phục lại đơn bằng GET',
    () async {
      final transport = CheckoutStub()..invalidResponse = true;
      final state = await setup(transport);
      await state.controller.submit();
      expect(state.controller.order?.id, '45');
      expect(transport.posts, 1);
    },
  );
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'Đặt hàng trên 320px chữ x$scale không tràn và gửi đúng thông tin',
      (tester) async {
        tester.view.physicalSize = const Size(320, 740);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final transport = CheckoutStub();
        final auth = testController(transport);
        addTearDown(auth.dispose);
        await loginFixture(auth);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            home: MediaQuery(
              data: MediaQueryData(
                size: const Size(320, 740),
                textScaler: TextScaler.linear(scale),
              ),
              child: CustomerCheckoutScreen(
                api: CheckoutApi(auth.api),
                units: const [8],
                user: auth.user!,
                storage: CheckoutStorage(MemoryTokenStore(), 42),
                onCreated: () {},
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          tester.widget<AppBar>(find.byType(AppBar)).backgroundColor,
          AppColors.appBarBackground,
        );
        await tester.scrollUntilVisible(
          find.text('Sản phẩm đã chọn (1)'),
          200,
          scrollable: find
              .descendant(
                of: find.byKey(const ValueKey('checkout-scroll')),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.pumpAndSettle();
        expect(find.textContaining('Hộp 3 vỉ'), findsOneWidget);
        expect(
          find.byKey(const ValueKey('checkout-product-image-8')),
          findsOneWidget,
        );
        expect(find.textContaining('Thành tiền:'), findsNothing);
        expect(find.textContaining('2 Vỉ được ưu đãi'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.tap(find.byKey(const ValueKey('checkout-submit')));
        await tester.pumpAndSettle();
        expect(find.byKey(const ValueKey('customer-order')), findsOneWidget);
        expect(transport.posts, 1);
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
  for (final (noDiscount, usePoints, savings) in [
    (false, true, '4.250đ'),
    (true, false, null),
    (true, true, '250đ'),
  ]) {
    testWidgets('Tổng tiền căn hai cột, tiết kiệm $savings và xu $usePoints', (
      tester,
    ) async {
      final transport = CheckoutStub()..noProductDiscount = noDiscount;
      final auth = testController(transport);
      addTearDown(auth.dispose);
      await loginFixture(auth);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: CustomerCheckoutScreen(
            api: CheckoutApi(auth.api),
            units: const [8],
            user: auth.user!,
            storage: CheckoutStorage(MemoryTokenStore(), 42),
            onCreated: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      final scroll = find
          .descendant(
            of: find.byKey(const ValueKey('checkout-scroll')),
            matching: find.byType(Scrollable),
          )
          .first;
      if (usePoints) {
        await tester.scrollUntilVisible(
          find.byType(Switch),
          250,
          scrollable: scroll,
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byType(Switch));
        await tester.pumpAndSettle();
      }
      await tester.scrollUntilVisible(
        find.text('Điểm thưởng'),
        250,
        scrollable: scroll,
      );
      await tester.pumpAndSettle();
      for (final label in [
        'Tổng tiền',
        'Giảm giá trực tiếp',
        'Giảm giá điểm thưởng',
        'Thành tiền',
        'Điểm thưởng',
      ]) {
        expect(find.byKey(ValueKey('checkout-total-$label')), findsOneWidget);
      }
      final saved = find.byKey(const ValueKey('checkout-total-Tiết kiệm được'));
      if (savings == null) {
        expect(saved, findsNothing);
      } else {
        expect(
          find.descendant(of: saved, matching: find.text(savings)),
          findsOneWidget,
        );
      }
      expect(find.text('Trước khuyến mãi'), findsNothing);
      expect(find.text('Sau khuyến mãi'), findsNothing);
      final points = find.byKey(
        const ValueKey('checkout-total-Giảm giá điểm thưởng'),
      );
      expect(
        find.descendant(
          of: points,
          matching: find.text(usePoints ? '−250đ' : '0đ'),
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      expect(transport.posts, 0);
      await tester.pumpWidget(const SizedBox());
    });
  }

  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'Chọn địa chỉ từ bảng dưới và mở quản lý địa chỉ, chữ x$scale',
      (tester) async {
        tester.view.physicalSize = const Size(320, 740);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final transport = CheckoutStub();
        transport.addresses.add({
          'MaDiaChi': '10',
          'TinhThanh': 'Huế',
          'PhuongXa': 'Thuận Hóa',
          'DiaChiCuThe': 'Địa chỉ nhận hàng thứ hai',
          'DiaChiGiao': false,
        });
        final auth = testController(transport);
        addTearDown(auth.dispose);
        await loginFixture(auth);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: TextScaler.linear(scale)),
              child: child!,
            ),
            home: CustomerCheckoutScreen(
              api: CheckoutApi(auth.api),
              units: const [8],
              user: auth.user!,
              storage: CheckoutStorage(MemoryTokenStore(), 42),
              onCreated: () {},
            ),
          ),
        );
        await tester.pumpAndSettle();
        final delivery = tester.getTopLeft(
          find.byKey(const ValueKey('checkout-receipt-delivery')),
        );
        final pickup = tester.getTopLeft(
          find.byKey(const ValueKey('checkout-receipt-pickup')),
        );
        expect(delivery.dy, pickup.dy);
        await tester.ensureVisible(
          find.byKey(const ValueKey('checkout-receipt-pickup')),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const ValueKey('checkout-receipt-pickup')));
        await tester.pumpAndSettle();
        expect(find.text('Nhà thuốc Lan Yến'), findsOneWidget);
        expect(
          find.byKey(const ValueKey('checkout-choose-address')),
          findsNothing,
        );
        await tester.ensureVisible(
          find.byKey(const ValueKey('checkout-receipt-delivery')),
        );
        await tester.pumpAndSettle();
        await tester.tap(
          find.byKey(const ValueKey('checkout-receipt-delivery')),
        );
        await tester.pumpAndSettle();
        await tester.ensureVisible(
          find.byKey(const ValueKey('checkout-choose-address')),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const ValueKey('checkout-choose-address')));
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('checkout-address-sheet')),
          findsOneWidget,
        );
        await tester.scrollUntilVisible(
          find.byKey(const ValueKey('checkout-address-option-10')),
          160,
          scrollable: find
              .descendant(
                of: find.byKey(const ValueKey('checkout-address-sheet')),
                matching: find.byType(Scrollable),
              )
              .first,
        );
        await tester.pumpAndSettle();
        await tester.tap(
          find.byKey(const ValueKey('checkout-address-option-10')),
        );
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('checkout-address-sheet')),
          findsNothing,
        );
        expect(
          find.text('Địa chỉ nhận hàng thứ hai, Thuận Hóa, Huế'),
          findsOneWidget,
        );
        await tester.tap(find.byKey(const ValueKey('checkout-choose-address')));
        await tester.pumpAndSettle();
        await tester.tap(
          find.byKey(const ValueKey('checkout-sheet-add-address')),
        );
        await tester.pumpAndSettle();
        expect(
          find.byKey(const ValueKey('customer-address-management')),
          findsOneWidget,
        );
        expect(
          find.text('Tính năng quản lý địa chỉ đang được hoàn thiện.'),
          findsOneWidget,
        );
        await tester.pageBack();
        await tester.pumpAndSettle();
        expect(
          find.text('Địa chỉ nhận hàng thứ hai, Thuận Hóa, Huế'),
          findsOneWidget,
        );
        expect(
          transport.requests.where(
            (r) => r.method == 'POST' && r.uri.path.endsWith('/addresses'),
          ),
          isEmpty,
        );
        expect(tester.takeException(), isNull);
        await tester.tap(find.byKey(const ValueKey('checkout-submit')));
        await tester.pumpAndSettle();
        final order = transport.requests.singleWhere(
          (r) => r.method == 'POST' && r.uri.path.endsWith('/orders'),
        );
        expect(order.body!['MaDiaChi'], '10');
        expect(order.body!['HinhThucNhanHang'], 'delivery');
        await tester.pumpWidget(const SizedBox());
      },
    );
  }

  testWidgets(
    'QR mở URI đã chuẩn bị; xác nhận Backend mới đổi trạng thái trả tiền',
    (tester) async {
      final transport = CheckoutStub()
        ..order['PhuongThucThanhToan'] = 1
        ..order['TrangThaiDonHang'] = 0;
      final auth = testController(transport);
      addTearDown(auth.dispose);
      await loginFixture(auth);
      Uri? opened;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: CustomerOrderScreen(
            api: CheckoutApi(auth.api),
            initial: PlacedOrder.fromJson(transport.order),
            openPayment: (uri) async {
              opened = uri;
              return true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Thanh toán QR'));
      await tester.pumpAndSettle();
      expect(opened?.fragment, 'signed-test-ticket');
      expect(find.text('Nhà thuốc đã xác nhận thanh toán.'), findsNothing);
      transport.order['TrangThaiThanhToan'] = 1;
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(find.text('Nhà thuốc đã xác nhận thanh toán.'), findsOneWidget);
      expect(find.text('Thanh toán QR'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('Xuất ảnh giao diện xác nhận đặt hàng', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
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
    final auth = testController(CheckoutStub());
    addTearDown(auth.dispose);
    await loginFixture(auth);
    final key = GlobalKey();
    await tester.pumpWidget(
      RepaintBoundary(
        key: key,
        child: MaterialApp(
          theme: AppTheme.light,
          debugShowCheckedModeBanner: false,
          home: CustomerCheckoutScreen(
            api: CheckoutApi(auth.api),
            units: const [8],
            user: auth.user!,
            storage: CheckoutStorage(MemoryTokenStore(), 42),
            onCreated: () {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    Future<void> capture(String filename) async => tester.runAsync(() async {
      final image = await boundary.toImage();
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await Directory('build/review').create(recursive: true);
      await File('build/review/$filename.png')
          .writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
    await capture('checkout');
    await tester.tap(find.byKey(const ValueKey('checkout-choose-address')));
    await tester.pumpAndSettle();
    await capture('checkout-addresses');
    await tester.tap(find.byTooltip('Đóng'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Sản phẩm đã chọn (1)'),
      220,
      scrollable: find
          .descendant(
            of: find.byKey(const ValueKey('checkout-scroll')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await capture('checkout-products');
    await tester.scrollUntilVisible(
      find.text('Phương thức thanh toán'),
      220,
      scrollable: find
          .descendant(
            of: find.byKey(const ValueKey('checkout-scroll')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await capture('checkout-payment');
    await tester.scrollUntilVisible(
      find.text('Thông tin thanh toán'),
      220,
      scrollable: find
          .descendant(
            of: find.byKey(const ValueKey('checkout-scroll')),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await capture('checkout-summary');
    await tester.pumpWidget(const SizedBox());
  });
}
