import 'catalog.dart';

class CartLine {
  CartLine.fromJson(Map<String, dynamic> data)
    : productId = catalogId(data['MaThuoc']),
      unitId = catalogId(data['MaDonGia']),
      quantity = catalogId(data['SoLuong']),
      name = catalogText(data['TenThuoc']),
      unit = data['DonViTinh'] is String ? data['DonViTinh'] as String : '',
      available = data['ConHang'] == true,
      promotionalQuantity = data['SoLuongKhuyenMai'] is int
          ? data['SoLuongKhuyenMai'] as int
          : 0,
      consultation = data['PhanLoai'] == true,
      image = data['HinhAnh'] is String ? data['HinhAnh'] as String : '',
      packaging = data['QuyCachDongGoi'] is String
          ? data['QuyCachDongGoi'] as String
          : '',
      price = cartMoney(data['GiaBan']),
      original = cartMoney(data['GiaGoc'] ?? data['GiaBan']),
      total = cartMoney(data['ThanhTien']),
      promotion = data['KhuyenMai'] is Map
          ? Map<String, dynamic>.from(data['KhuyenMai'] as Map)
          : null,
      units = data['DonViGia'] is List
          ? List<Map<String, dynamic>>.from(
              (data['DonViGia'] as List).map(
                (i) => Map<String, dynamic>.from(i as Map),
              ),
            )
          : const [];
  final int productId, unitId, quantity;
  final int promotionalQuantity;
  final String name, unit;
  final bool available;
  final bool consultation;
  final String image, packaging;
  final BigInt? price, original, total;
  final Map<String, dynamic>? promotion;
  final List<Map<String, dynamic>> units;
  bool get discounted =>
      promotion != null &&
      original != null &&
      total != null &&
      total! < original! * BigInt.from(quantity);
  String get promotionName => promotion?['TenChuongTrinh'] is String
      ? promotion!['TenChuongTrinh'] as String
      : '';
  String? get discountPercent => catalogPromotionPercent(promotion);
  Map<String, dynamic> toEntry() => {
    'MaThuoc': productId,
    'MaDonGia': unitId,
    'SoLuong': quantity,
  };
}

BigInt? cartMoney(dynamic value) {
  if (value == null) return null;
  if (value is int && (value < 0 || value > 9007199254740991)) {
    throw const FormatException();
  }
  final text = value.toString();
  if (!RegExp(r'^\d+(\.0+)?$').hasMatch(text)) throw const FormatException();
  return BigInt.parse(text.split('.').first);
}

class CustomerCart {
  const CustomerCart(this.items, {this.total, this.estimatedPoints});
  final List<CartLine> items;
  final BigInt? total, estimatedPoints;
  BigInt get originalTotal => items.fold(
    BigInt.zero,
    (sum, item) =>
        sum + (item.original ?? BigInt.zero) * BigInt.from(item.quantity),
  );
  BigInt get savings {
    final value = originalTotal - (total ?? originalTotal);
    return value.isNegative ? BigInt.zero : value;
  }

  // Một thuốc có nhiều đơn vị tính vẫn chỉ đếm một sản phẩm trên huy hiệu.
  int get productCount => items.map((item) => item.productId).toSet().length;
  factory CustomerCart.fromJson(Map<String, dynamic> data) {
    if (data['code'] != 'CART_LISTED' ||
        data['authenticated'] is! bool ||
        data['items'] is! List) {
      throw const FormatException();
    }
    return CustomerCart(
      List.unmodifiable(
        (data['items'] as List).map((item) {
          if (item is! Map<String, dynamic>) throw const FormatException();
          return CartLine.fromJson(item);
        }),
      ),
      total: cartMoney(data['total']),
      estimatedPoints: cartMoney(data['estimated_points']),
    );
  }
}
