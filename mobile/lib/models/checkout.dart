import 'catalog.dart';
import 'customer_cart.dart';

class DeliveryAddress {
  DeliveryAddress.fromJson(Map<String, dynamic> data)
    : id = '${data['MaDiaChi']}',
      city = catalogText(data['TinhThanh']),
      ward = catalogText(data['PhuongXa']),
      street = catalogText(data['DiaChiCuThe']),
      primary = data['DiaChiGiao'] == true {
    if (!RegExp(r'^[1-9]\d{0,18}$').hasMatch(id)) throw const FormatException();
  }
  final String id, city, ward, street;
  final bool primary;
  String get full => '$street, $ward, $city';
}

class CheckoutQuote {
  CheckoutQuote.fromJson(Map<String, dynamic> data)
    : original = _money(data['original']),
      subtotal = _money(data['subtotal']),
      total = _money(data['total']),
      productDiscount = _money(data['product_discount']),
      pointsDiscount = _money(data['points_discount']),
      redeemed = _money(data['redeemed']),
      balance = _money(data['balance']),
      earned = _money(data['estimated_points']),
      lines = _records(data['items'], CartLine.fromJson) {
    if (data['code'] != 'CHECKOUT_QUOTED' ||
        original - productDiscount != subtotal ||
        subtotal - pointsDiscount != total) {
      throw const FormatException();
    }
  }
  final BigInt original,
      subtotal,
      total,
      productDiscount,
      pointsDiscount,
      redeemed,
      balance,
      earned;
  final List<CartLine> lines;
}

class PlacedOrder {
  PlacedOrder.fromJson(Map<String, dynamic> data)
    : id = '${data['MaDonHang']}',
      original = _money(data['TongTien']),
      discount = _money(data['TienGiamGia']),
      total = _money(data['TongThanhToan']),
      status = _integer(data['TrangThaiDonHang']),
      paymentStatus = _integer(data['TrangThaiThanhToan']),
      paymentMethod = _integer(data['PhuongThucThanhToan']),
      environment = _environment(data['payment_environment']) {
    if (!RegExp(r'^[1-9]\d{0,18}$').hasMatch(id) ||
        !{0, 1, 2, 3, 4, 5}.contains(status) ||
        !{0, 1}.contains(paymentMethod) ||
        !{0, 1}.contains(paymentStatus)) {
      throw const FormatException();
    }
  }
  final String id;
  final BigInt original, discount, total;
  final int status, paymentStatus, paymentMethod;
  final String? environment;
  bool get pendingPayment =>
      paymentMethod == 1 && paymentStatus == 0 && status == 0;
  String get statusLabel => const [
    'Chờ thanh toán / duyệt',
    'Đang xử lý',
    'Đang giao',
    'Đã hoàn thành',
    'Đã hủy',
    'Đã trả',
  ][status];
}

BigInt _money(dynamic value) =>
    cartMoney(value) ?? (throw const FormatException());
int _integer(dynamic value) =>
    value is int ? value : (throw const FormatException());
String? _environment(dynamic value) =>
    value == null || value == 'sandbox' || value == 'production'
    ? value as String?
    : (throw const FormatException());
List<T> _records<T>(dynamic data, T Function(Map<String, dynamic>) parse) {
  if (data is! List) throw const FormatException();
  return List.unmodifiable(
    data.map((value) {
      if (value is! Map<String, dynamic>) throw const FormatException();
      return parse(value);
    }),
  );
}

List<DeliveryAddress> checkoutAddresses(dynamic values) =>
    _records(values, DeliveryAddress.fromJson);
List<PlacedOrder> checkoutOrders(dynamic values) =>
    _records(values, PlacedOrder.fromJson);
