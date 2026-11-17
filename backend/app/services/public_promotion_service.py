from app.repositories import chuong_trinh_khuyen_mai_repository as promotions
from app.repositories import chi_tiet_khuyen_mai_repository as details
from app.schemas.promotion_schema import PromotionSchema
from app.services.inventory_service import current_date
from app.services.product_service import ProductError, database_operation, serialize_public_products
from app.repositories import don_vi_gia_thuoc_repository as units
from app.services.inventory_service import usable_stock
from app.services.sale_pricing import smallest_price, sale_price


def public_program(program, today):
    return dict(PromotionSchema().dump(program),
                TrangThai='ACTIVE' if program.NgayBatDau <= today else 'UPCOMING')


@database_operation
def list_programs(page, per_page):
    today = current_date()
    records, total = promotions.list_public(today, page, per_page)
    return {'items': [public_program(program, today) for program in records],
            'page': page, 'per_page': per_page, 'total': total,
            'pages': (total + per_page - 1) // per_page, 'as_of': today.isoformat()}


@database_operation
def list_products(promotion_id, page, per_page):
    today = current_date()
    program = promotions.find_by_id(promotion_id)
    if program is None or program.NgayKetThuc < today:
        raise ProductError('PROMOTION_NOT_FOUND', 404)
    records, total = details.public_products(promotion_id, page, per_page)
    product_ids = [product.MaThuoc for product, _ in records]
    raw_units = units.public_units(product_ids)
    unit_map = {unit.MaDonGia: unit for unit in raw_units}
    stock = usable_stock(product_ids)
    products = serialize_public_products([product for product, detail in records], raw_units, stock)
    upcoming = program.NgayBatDau > today
    for product, (_, detail) in zip(products, records):
        product['KhuyenMai'] = {'MaChuongTrinh': promotion_id, 'LoaiGiamGia': detail.LoaiGiamGia,
                               'GiaTriGiam': str(detail.GiaTriGiam), 'SoLuong': detail.SoLuong,
                               'TrangThai': 'UPCOMING' if upcoming else 'ACTIVE'}
        quota = max(0, detail.SoLuong)
        if not upcoming:
            quota = min(quota, stock.get(product['MaThuoc'], 0))
        base = smallest_price([unit for unit in raw_units if unit.MaThuoc == product['MaThuoc']])
        for unit in product['DonViGia']:
            raw = unit_map[unit['MaDonGia']]
            price = sale_price(raw, detail, base)
            unit['GiaKhuyenMai'] = price
            unit['SoLuongKhuyenMai'] = (quota // raw.SoLuongQuyDoi if raw.SoLuongQuyDoi > 0 and
                                       (upcoming or (price is not None and price < raw.GiaBan)) else 0)
    return {'promotion': public_program(program, today), 'items': products,
            'page': page, 'per_page': per_page, 'total': total,
            'pages': (total + per_page - 1) // per_page, 'as_of': today.isoformat()}
