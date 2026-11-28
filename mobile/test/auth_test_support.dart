import 'dart:async';
import 'dart:convert';

import 'package:lan_yen_pharmacy/core/network/api.dart';
import 'package:lan_yen_pharmacy/core/network/api_client.dart';
import 'package:lan_yen_pharmacy/core/storage/session_storage.dart';
import 'package:lan_yen_pharmacy/core/storage/guest_cart_storage.dart';
import 'package:lan_yen_pharmacy/features/auth/auth_controller.dart';

// Fixtures chỉ nằm trong test, không tồn tại đường bỏ qua xác thực trong app.
class AuthStubTransport implements ApiTransport {
  AuthStubTransport({this.role = 0, this.newUser = false});
  final int role;
  final bool newUser;
  final List<
    ({
      Uri uri,
      String method,
      Map<String, String> headers,
      Map<String, dynamic>? body,
    })
  >
  requests = [];
  bool loggedIn = false;
  bool expiredAccess = false;
  bool logoutFails = false;
  String? failureCode;
  int failureStatus = 503;
  Completer<void>? hold;
  int refreshCount = 0;
  final Map<String, Map<String, dynamic>> catalogData = {};
  bool catalogFails = false;
  final List<Map<String, dynamic>> cartItems = [];
  final Set<String> mergedGuestBatches = {};
  bool loseMergeResponse = false;
  String? cartFailure;
  int cartAdds = 0;
  Map<String, dynamic> get user => {
    'MaNguoiDung': 42,
    'HoTen': 'Nguyễn An',
    'VaiTro': role,
    'TrangThai': false,
  };
  Map<String, dynamic> get tokens => {
    'code': 'AUTHENTICATED',
    'user': user,
    'token_type': 'Bearer',
    'access_token': 'access-fixture-$role',
    'refresh_token': 'refresh-fixture-$role',
    'expires_in': 900,
  };

  @override
  Future<ApiResponse> send(
    Uri uri,
    String method,
    Map<String, String> headers, {
    Map<String, dynamic>? body,
  }) async {
    requests.add((
      uri: uri,
      method: method,
      headers: Map.of(headers),
      body: body,
    ));
    if (hold != null) await hold!.future;
    if (failureCode != null) {
      return ApiResponse(failureStatus, jsonEncode({'code': failureCode}));
    }
    final path = uri.path;
    if (path.startsWith('/api/mobile/cart')) {
      if (path.endsWith('/quote')) {
        final authorized = headers.containsKey('Authorization');
        if (authorized && !loggedIn)
          return const ApiResponse(401, '{"code":"UNAUTHENTICATED"}');
        if (cartFailure != null)
          return ApiResponse(409, jsonEncode({'code': cartFailure}));
        final entries = (body!['items'] as List).cast<Map<String, dynamic>>();
        final ids = entries.map((i) => i['MaDonGia']).toSet();
        final source = authorized
            ? cartItems.where((i) => ids.contains(i['MaDonGia'])).toList()
            : entries;
        final lines = <Map<String, dynamic>>[];
        var total = 0;
        for (final entry in source) {
          final product =
              catalogData['products/${entry['MaThuoc']}']?['product']
                  as Map<String, dynamic>?;
          final units = (product?['DonViGia'] as List? ?? []);
          final unit = units
              .where((i) => i['MaDonGia'] == entry['MaDonGia'])
              .firstOrNull;
          final original =
              (unit?['GiaBan'] ?? entry['GiaBan'] ?? 120000) as int;
          final sale = unit?['GiaKhuyenMai'] as int?;
          final count = entry['SoLuong'] as int;
          final quota = unit?['SoLuongKhuyenMai'] as int? ?? 0;
          final discounted = sale != null && sale < original && quota > 0;
          final applied = count < quota ? count : quota;
          final sum = discounted
              ? sale * applied + original * (count - applied)
              : original * count;
          total += sum;
          lines.add({
            ...entry,
            'TenThuoc':
                product?['TenThuoc'] ??
                entry['TenThuoc'] ??
                'Sản phẩm kiểm thử ${entry['MaThuoc']}',
            'DonViTinh': unit?['DonViTinh'] ?? entry['DonViTinh'] ?? 'Hộp',
            'ConHang': unit?['ConHang'] ?? entry['ConHang'] ?? true,
            'HinhAnh': '',
            'QuyCachDongGoi': product?['QuyCachDongGoi'] ?? '',
            'PhanLoai': product?['PhanLoai'] ?? false,
            'GiaBan': discounted ? sale : original,
            'GiaGoc': original,
            'ThanhTien': sum,
            'DonViGia': units,
            'SoLuongKhuyenMai': applied,
            if (discounted) 'KhuyenMai': {'TenChuongTrinh': 'Ưu đãi kiểm thử'},
          });
        }
        return ApiResponse(
          200,
          jsonEncode({
            'code': 'CART_LISTED',
            'authenticated': authorized,
            'items': lines,
            'total': total,
            'estimated_points': total ~/ 1000,
          }),
        );
      }
      if (expiredAccess) {
        return const ApiResponse(401, '{"code":"TOKEN_EXPIRED"}');
      }
      if (!loggedIn) {
        return const ApiResponse(401, '{"code":"UNAUTHENTICATED"}');
      }
      if (cartFailure != null) {
        return ApiResponse(409, jsonEncode({'code': cartFailure}));
      }
      if (path.endsWith('/items/remove')) {
        cartItems.removeWhere((i) => i['MaDonGia'] == body!['MaDonGia']);
        return const ApiResponse(200, '{"code":"CART_ITEM_REMOVED"}');
      }
      if (path.endsWith('/items/update')) {
        final source = cartItems
            .where((i) => i['MaDonGia'] == body!['MaDonGia'])
            .firstOrNull;
        if (source == null)
          return const ApiResponse(404, '{"code":"CART_ITEM_NOT_FOUND"}');
        final duplicate = cartItems
            .where(
              (i) =>
                  !identical(i, source) && i['MaDonGia'] == body!['DonViMoi'],
            )
            .firstOrNull;
        if (duplicate != null) {
          duplicate['SoLuong'] =
              (duplicate['SoLuong'] as int) + (body!['SoLuong'] as int);
          cartItems.remove(source);
        } else {
          source['MaDonGia'] = body!['DonViMoi'];
          source['SoLuong'] = body['SoLuong'];
        }
        return const ApiResponse(200, '{"code":"CART_ITEM_UPDATED"}');
      }
      if (path.endsWith('/merge') && method == 'POST') {
        if (mergedGuestBatches.add(body!['merge_id'] as String)) {
          for (final line in body['items'] as List) {
            final existing = cartItems
                .where((item) => item['MaDonGia'] == line['MaDonGia'])
                .firstOrNull;
            if (existing != null) {
              existing['SoLuong'] =
                  (existing['SoLuong'] as int) + (line['SoLuong'] as int);
            } else {
              cartItems.add({
                ...Map<String, dynamic>.from(line as Map),
                'TenThuoc': 'Sản phẩm kiểm thử ${line['MaThuoc']}',
                'DonViTinh': 'Hộp',
                'ConHang': true,
              });
            }
          }
        }
        if (loseMergeResponse) {
          return const ApiResponse(503, '{"code":"DATABASE_UNAVAILABLE"}');
        }
        return const ApiResponse(200, '{"code":"CART_MERGED"}');
      }
      if (method == 'POST') {
        cartAdds++;
        final existing = cartItems
            .where((item) => item['MaDonGia'] == body?['MaDonGia'])
            .firstOrNull;
        if (existing != null) {
          existing['SoLuong'] = (existing['SoLuong'] as int) + 1;
        } else {
          cartItems.add({
            'MaThuoc': body!['MaThuoc'],
            'MaDonGia': body['MaDonGia'],
            'SoLuong': 1,
            'TenThuoc': 'Sản phẩm kiểm thử ${body['MaThuoc']}',
            'DonViTinh': 'Hộp',
            'ConHang': true,
          });
        }
        return const ApiResponse(200, '{"code":"CART_ITEM_ADDED"}');
      }
      return ApiResponse(
        200,
        jsonEncode({
          'code': 'CART_LISTED',
          'authenticated': true,
          'items': cartItems,
        }),
      );
    }
    if (path.contains('/mobile/catalog/')) {
      if (catalogFails) {
        return const ApiResponse(503, '{"code":"SERVICE_UNAVAILABLE"}');
      }
      final name = path.split('/mobile/catalog/').last;
      return ApiResponse(
        200,
        jsonEncode(
          catalogData['$name?page=${uri.queryParameters['page'] ?? '1'}'] ??
              catalogData[name] ??
              {
                'code': name == 'categories'
                    ? 'CATEGORIES_LISTED'
                    : name == 'promotions'
                    ? 'PROMOTIONS_LISTED'
                    : 'PRODUCTS_LISTED',
                'items': [],
                'page': int.parse(uri.queryParameters['page'] ?? '1'),
                'per_page': 100,
                'total': 0,
                'pages': 0,
              },
        ),
      );
    }
    if (path.endsWith('/otp/request')) {
      return ApiResponse(
        200,
        jsonEncode({
          'code': 'OTP_SENT',
          'challenge_token': 'challenge-fixture-${requests.length}',
          'expires_in': 300,
          'retry_after': 60,
        }),
      );
    }
    if (path.endsWith('/otp/verify')) {
      if (body?['otp'] != '123456') {
        return const ApiResponse(401, '{"code":"OTP_INVALID"}');
      }
      if (newUser) {
        return const ApiResponse(
          200,
          '{"code":"PROFILE_REQUIRED","registration_token":"profile-fixture"}',
        );
      }
      loggedIn = true;
      return ApiResponse(200, jsonEncode(tokens));
    }
    if (path.endsWith('/register')) {
      loggedIn = true;
      return ApiResponse(200, jsonEncode(tokens));
    }
    if (path.endsWith('/refresh')) {
      refreshCount++;
      expiredAccess = false;
      loggedIn = true;
      return ApiResponse(200, jsonEncode(tokens));
    }
    if (path.endsWith('/logout')) {
      if (logoutFails) {
        return const ApiResponse(503, '{"code":"AUTH_UNAVAILABLE"}');
      }
      loggedIn = false;
      return const ApiResponse(200, '{"code":"LOGGED_OUT"}');
    }
    if (path.endsWith('/me')) {
      if (expiredAccess) {
        return const ApiResponse(401, '{"code":"TOKEN_EXPIRED"}');
      }
      if (!loggedIn) {
        return const ApiResponse(401, '{"code":"UNAUTHENTICATED"}');
      }
      return ApiResponse(
        200,
        jsonEncode({'code': 'AUTHENTICATED', 'user': user}),
      );
    }
    return const ApiResponse(404, '{"code":"NOT_FOUND"}');
  }

  @override
  void close() {}
}

AuthController testController(
  AuthStubTransport transport, {
  TokenStore? store,
  DateTime Function()? now,
}) => AuthController(
  guestCart: GuestCartStorage(MemoryTokenStore()),
  api: AuthApi(
    ApiClient(
      baseUrl: 'http://127.0.0.1:8123/api',
      session: SessionStorage(store: store),
      transport: transport,
    ),
  ),
  now: now,
);

Future<void> loginFixture(
  AuthController controller, {
  bool newUser = false,
}) async {
  await controller.restoreSession();
  await controller.requestOtp('0901234567');
  await controller.verifyOtp('123456');
  if (newUser) await controller.register('Nguyễn An');
}
