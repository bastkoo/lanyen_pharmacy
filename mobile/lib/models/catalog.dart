// Dữ liệu công khai; giá giữ dạng số nguyên, không chuyển sang số thực.
int catalogId(dynamic value) {
  if (value is! int || value <= 0) throw const FormatException();
  return value;
}

String catalogText(dynamic value) {
  if (value is! String || value.trim().isEmpty) throw const FormatException();
  return value;
}

class CatalogPage<T> {
  const CatalogPage(this.items, this.page, this.pages, this.total);
  final List<T> items;
  final int page, pages, total;
  factory CatalogPage.parse(
    Map<String, dynamic> data,
    String code,
    T Function(Map<String, dynamic>) parse,
    int requestedPage,
  ) {
    if (data['code'] != code ||
        data['items'] is! List ||
        data['page'] != requestedPage ||
        data['pages'] is! int ||
        data['total'] is! int ||
        data['pages'] < 0 ||
        data['total'] < 0) {
      throw const FormatException();
    }
    return CatalogPage(
      List.unmodifiable(
        (data['items'] as List).map((item) {
          if (item is! Map<String, dynamic>) throw const FormatException();
          return parse(item);
        }),
      ),
      requestedPage,
      data['pages'] as int,
      data['total'] as int,
    );
  }
}

class CatalogCategory {
  const CatalogCategory(this.id, this.name);
  final int id;
  final String name;
  factory CatalogCategory.fromJson(Map<String, dynamic> data) =>
      CatalogCategory(
        catalogId(data['MaLoaiThuoc']),
        catalogText(data['TenLoaiThuoc']),
      );
}

class CatalogPromotion {
  CatalogPromotion.fromJson(Map<String, dynamic> data)
    : id = catalogId(data['MaChuongTrinh']),
      name = catalogText(data['TenChuongTrinh']),
      start = catalogText(data['NgayBatDau']),
      end = catalogText(data['NgayKetThuc']),
      active = data['TrangThai'] == 'ACTIVE' {
    if (!['ACTIVE', 'UPCOMING'].contains(data['TrangThai']) ||
        DateTime.tryParse(start) == null ||
        DateTime.tryParse(end) == null) {
      throw const FormatException();
    }
  }
  final int id;
  final String name, start, end;
  final bool active;
  String get dates =>
      '${start.split('-').reversed.join('/')} – ${end.split('-').reversed.join('/')}';
  // Cùng mốc Asia/Ho_Chi_Minh của Web: kết thúc hết ngày NgayKetThuc.
  DateTime get startsAt => DateTime.parse('${start}T00:00:00+07:00');
  DateTime get endsAt =>
      DateTime.parse('${end}T00:00:00+07:00').add(const Duration(days: 1));
  String stateAt(DateTime now) => now.isBefore(startsAt)
      ? 'UPCOMING'
      : now.isBefore(endsAt)
      ? 'ACTIVE'
      : 'ENDED';
  Duration remainingAt(DateTime now) {
    final duration = (now.isBefore(startsAt) ? startsAt : endsAt).difference(
      now,
    );
    return duration.isNegative ? Duration.zero : duration;
  }
}

class CatalogPrice {
  CatalogPrice.fromJson(Map<String, dynamic> data)
    : id = catalogId(data['MaDonGia']),
      unit = catalogText(data['DonViTinh']),
      original = _money(data['GiaBan']),
      sale = data['GiaKhuyenMai'] == null ? null : _money(data['GiaKhuyenMai']),
      available = data['ConHang'] == true,
      activeOffer =
          data['KhuyenMai'] is Map &&
          data['KhuyenMai']['TrangThai'] == 'ACTIVE',
      quota = data['SoLuongKhuyenMai'] is int
          ? data['SoLuongKhuyenMai'] as int
          : 0;
  final String unit;
  final int id;
  final BigInt original;
  final BigInt? sale;
  final bool available;
  final bool activeOffer;
  final int quota;
  bool get discounted =>
      sale != null && sale! < original && quota > 0 && available;
  static BigInt _money(dynamic value) {
    // Từ chối số JSON vượt miền nguyên chính xác của Flutter Web.
    if (value is! int || value < 0 || value > 9007199254740991) {
      throw const FormatException();
    }
    return BigInt.from(value);
  }
}

String formatVnd(BigInt value) =>
    '${value.toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (match) => '${match[1]}.')}đ';

class CatalogProduct {
  CatalogProduct.fromJson(Map<String, dynamic> data)
    : id = catalogId(data['MaThuoc']),
      name = catalogText(data['TenThuoc']),
      image = data['HinhAnh'] is String ? data['HinhAnh'] as String : '',
      description = data['MoTa'] is String ? data['MoTa'] as String : '',
      prescription = data['KeDon'] == true,
      consultation = data['PhanLoai'] == true,
      upcomingOffer =
          data['KhuyenMai'] is Map &&
          data['KhuyenMai']['TrangThai'] == 'UPCOMING',
      hasOffer = data['KhuyenMai'] is Map,
      activeOffer =
          data['KhuyenMai'] is Map &&
          data['KhuyenMai']['TrangThai'] == 'ACTIVE',
      prices = (data['DonViGia'] is List ? data['DonViGia'] as List : const [])
          .map((value) {
            if (value is! Map<String, dynamic>) throw const FormatException();
            return CatalogPrice.fromJson(value);
          })
          .toList(growable: false);
  final int id;
  final String name, image, description;
  final bool prescription, activeOffer;
  final bool consultation, upcomingOffer, hasOffer;
  final List<CatalogPrice> prices;
  CatalogPrice? get displayPrice {
    for (final price in prices) {
      if ((activeOffer || price.activeOffer) && price.discounted) return price;
    }
    for (final price in prices) {
      if (price.available) return price;
    }
    return prices.firstOrNull;
  }

  bool get discounted =>
      (activeOffer || (displayPrice?.activeOffer ?? false)) &&
      (displayPrice?.discounted ?? false);
}
