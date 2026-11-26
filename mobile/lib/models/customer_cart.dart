import 'catalog.dart';

class CartLine {
  CartLine.fromJson(Map<String, dynamic> data)
    : productId = catalogId(data['MaThuoc']),
      unitId = catalogId(data['MaDonGia']),
      quantity = catalogId(data['SoLuong']),
      name = catalogText(data['TenThuoc']),
      unit = data['DonViTinh'] is String ? data['DonViTinh'] as String : '',
      available = data['ConHang'] == true;
  final int productId, unitId, quantity;
  final String name, unit;
  final bool available;
}

class CustomerCart {
  const CustomerCart(this.items);
  final List<CartLine> items;
  // Một thuốc có nhiều đơn vị tính vẫn chỉ đếm một sản phẩm trên huy hiệu.
  int get productCount => items.map((item) => item.productId).toSet().length;
  factory CustomerCart.fromJson(Map<String, dynamic> data) {
    if (data['code'] != 'CART_LISTED' ||
        data['authenticated'] != true ||
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
    );
  }
}
