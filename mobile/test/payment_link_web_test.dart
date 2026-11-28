import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:url_launcher/link.dart';
import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/network/api_client.dart';
import 'package:lan_yen_pharmacy/core/theme/app_theme.dart';
import 'package:lan_yen_pharmacy/features/customer/customer_order_screen.dart';
import 'package:lan_yen_pharmacy/models/checkout.dart';

import 'auth_test_support.dart';

// Không mở cổng thật: chỉ kiểm tra Flutter Web tạo liên kết trực tiếp với vé đã cấp.
class PaymentLinkTransport extends AuthStubTransport {
  @override
  Future<ApiResponse> send(
    Uri uri,
    String method,
    Map<String, String> headers, {
    Map<String, dynamic>? body,
  }) {
    if (uri.path.endsWith('/checkout/orders/45/payment')) {
      return Future.value(
        ApiResponse(
          200,
          jsonEncode({
            'code': 'PAYMENT_LINK_CREATED',
            'path': 'mobile/checkout/payment',
            'ticket': 'signed-fixture-ticket',
          }),
        ),
      );
    }
    return super.send(uri, method, headers, body: body);
  }
}

void main() {
  testWidgets(
    'Web dùng Link mở QR trực tiếp; không gắn JWT vào URL thanh toán',
    (tester) async {
      final auth = testController(PaymentLinkTransport());
      addTearDown(auth.dispose);
      await loginFixture(auth);
      final order = PlacedOrder.fromJson({
        'MaDonHang': '45',
        'TongTien': '36000',
        'TienGiamGia': '4000',
        'TongThanhToan': '32000',
        'TrangThaiDonHang': 0,
        'TrangThaiThanhToan': 0,
        'PhuongThucThanhToan': 1,
        'payment_environment': 'production',
      });
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: CustomerOrderScreen(api: CheckoutApi(auth.api), initial: order),
        ),
      );
      await tester.pumpAndSettle();
      final link = tester.widget<Link>(find.byType(Link));
      expect(link.target, LinkTarget.blank);
      expect(link.uri?.path, '/api/mobile/checkout/payment');
      expect(link.uri?.fragment, 'signed-fixture-ticket');
      expect(link.uri?.query, isEmpty);
      expect(link.uri.toString(), isNot(contains('access-fixture')));
      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey('order-open-payment')),
            )
            .onPressed,
        isNotNull,
      );
      expect(find.text('Thanh toán QR'), findsOneWidget);
      expect(find.textContaining('sandbox'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
    skip: !kIsWeb,
  );
}
