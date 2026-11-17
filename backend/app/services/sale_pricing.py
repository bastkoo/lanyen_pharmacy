from decimal import Decimal, ROUND_HALF_UP


def smallest_price(units):
    valid = [unit for unit in units if unit.SoLuongQuyDoi > 0 and unit.GiaBan >= 0]
    if not valid:
        return None
    unit = min(valid, key=lambda unit: (unit.SoLuongQuyDoi, unit.MaDonGia))
    return Decimal(unit.GiaBan) / unit.SoLuongQuyDoi


def sale_price(unit, detail, base_price):
    if base_price is None or unit.SoLuongQuyDoi <= 0:
        return None
    discount = Decimal(detail.GiaTriGiam)
    if detail.LoaiGiamGia:
        if not 0 < discount <= 100:
            return None
        discount = base_price * discount / 100
    if discount < 0:
        return None
    price = max(Decimal(0), Decimal(unit.GiaBan) - discount * unit.SoLuongQuyDoi)
    return int(price.quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def cart_prices(entries, catalog, all_units, programs):
    """One program per cart line; quota shared by lines in their existing order."""
    bases = {}
    for unit in all_units:
        bases.setdefault(unit.MaThuoc, []).append(unit)
    bases = {product_id: smallest_price(units) for product_id, units in bases.items()}
    remaining = {(detail.MaChuongTrinh, detail.MaThuoc): detail.SoLuong for detail, _ in programs}
    result = []
    for product_id, unit_id, quantity in entries:
        _, unit = catalog.get((product_id, unit_id), (None, None))
        if unit is None or unit.GiaBan < 0:
            result.append(None)
            continue
        best = {'GiaBan': unit.GiaBan, 'ThanhTien': quantity * unit.GiaBan,
                'SoLuongKhuyenMai': 0, 'KhuyenMai': None}
        for detail, program in programs:
            if detail.MaThuoc != product_id or unit.SoLuongQuyDoi <= 0:
                continue
            count = min(quantity, remaining[(detail.MaChuongTrinh, product_id)] // unit.SoLuongQuyDoi)
            price = sale_price(unit, detail, bases.get(product_id))
            if not count or price is None or price >= unit.GiaBan:
                continue
            total = price * count + (quantity - count) * unit.GiaBan
            if total < best['ThanhTien']:
                best = {'GiaBan': price, 'ThanhTien': total, 'SoLuongKhuyenMai': count,
                        'KhuyenMai': {'MaChuongTrinh': program.MaChuongTrinh,
                                     'TenChuongTrinh': program.TenChuongTrinh,
                                     'LoaiGiamGia': detail.LoaiGiamGia,
                                     'GiaTriGiam': str(detail.GiaTriGiam)}}
        if best['KhuyenMai']:
            key = (best['KhuyenMai']['MaChuongTrinh'], product_id)
            remaining[key] -= best['SoLuongKhuyenMai'] * unit.SoLuongQuyDoi
        result.append(best)
    return result
