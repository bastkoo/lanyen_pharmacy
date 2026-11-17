from functools import wraps

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.repositories import loai_thuoc_repository as categories
from app.repositories import thuoc_repository as products
from app.repositories import don_vi_gia_thuoc_repository as units
from app.schemas.product_schema import ProductSchema
from app.schemas.public_catalog_schema import PublicProductSchema, PublicProductDetailSchema
from app.services.cloudinary_service import validate_product_image_url
from app.utils.image_validator import ImageError


class ProductError(Exception):
    def __init__(self, code, status):
        self.code = code
        self.status = status


def database_operation(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except ProductError:
            products.rollback()
            raise
        except ImageError as error:
            products.rollback()
            raise ProductError(error.code, error.status) from None
        except IntegrityError as error:
            products.rollback()
            if getattr(error.orig, 'sqlstate', None) == '23503':
                code = 'PRODUCT_IN_USE' if view.__name__ == 'delete_product' else 'FOREIGN_KEY_CONFLICT'
                raise ProductError(code, 409) from None
            raise ProductError('DATABASE_UNAVAILABLE', 503) from None
        except SQLAlchemyError:
            products.rollback()
            raise ProductError('DATABASE_UNAVAILABLE', 503) from None
    return wrapped


def require_product(product_id, for_update=False):
    product = products.find_by_id(product_id, for_update=for_update)
    if product is None:
        raise ProductError('PRODUCT_NOT_FOUND', 404)
    return product


def require_category(category_id):
    if categories.find_by_id(category_id) is None:
        raise ProductError('CATEGORY_NOT_FOUND', 404)


@database_operation
def list_products(filters):
    items, total = products.list_products(**filters)
    page, per_page = filters['page'], filters['per_page']
    return {'items': ProductSchema(many=True).dump(items), 'page': page,
            'per_page': per_page, 'total': total, 'pages': (total + per_page - 1) // per_page}


@database_operation
def list_public_products(filters):
    if 'category_id' in filters:
        require_category(filters['category_id'])
    items, total = products.list_products(**filters, sort_by='TenThuoc')
    page, per_page = filters['page'], filters['per_page']
    return {'items': serialize_public_products(items), 'page': page,
            'per_page': per_page, 'total': total, 'pages': (total + per_page - 1) // per_page}


def serialize_public_products(items, unit_records=None, stock_totals=None):
    serialized = PublicProductSchema(many=True).dump(items)
    grouped = {item['MaThuoc']: [] for item in serialized}
    from app.services.inventory_service import usable_stock
    stock = usable_stock(list(grouped)) if stock_totals is None else stock_totals
    for unit in units.public_units(list(grouped)) if unit_records is None else unit_records:
        grouped[unit.MaThuoc].append({'MaDonGia': unit.MaDonGia,
                                     'DonViTinh': unit.DonViTinh, 'GiaBan': unit.GiaBan,
                                     'ConHang': unit.SoLuongQuyDoi > 0 and
                                     stock.get(unit.MaThuoc, 0) >= unit.SoLuongQuyDoi})
    for item in serialized:
        item['DonViGia'] = grouped[item['MaThuoc']]
    return serialized


@database_operation
def get_public_product(product_id, promotion_id=None):
    from app.repositories import chuong_trinh_khuyen_mai_repository as promotions
    from app.repositories import chi_tiet_khuyen_mai_repository as offers
    from app.services.inventory_service import current_date, usable_stock
    from app.services.public_promotion_service import apply_offer
    from app.services.sale_pricing import cart_prices

    product = require_product(product_id)
    raw_units = units.public_units([product_id])
    stock = usable_stock([product_id])
    result = PublicProductDetailSchema().dump(product)
    result['DonViGia'] = serialize_public_products([product], raw_units, stock)[0]['DonViGia']
    category = categories.find_by_id(product.MaLoaiThuoc)
    result['TenLoaiThuoc'] = category.TenLoaiThuoc if category else ''
    today = current_date()
    if promotion_id is not None:
        program = promotions.find_by_id(promotion_id)
        detail = offers.find_by_id(promotion_id, product_id)
        if program is None or program.NgayKetThuc < today or detail is None:
            raise ProductError('PROMOTION_NOT_FOUND', 404)
        return apply_offer(result, detail, program, raw_units, stock, today)
    active = offers.active_for_products([product_id], today)
    catalog = {(product_id, unit.MaDonGia): (product, unit) for unit in raw_units}
    for unit in result['DonViGia']:
        quote = cart_prices([(product_id, unit['MaDonGia'], 1)], catalog, raw_units, active)[0]
        if quote and quote['KhuyenMai']:
            offer, program = next((offer, program) for offer, program in active
                if offer.MaChuongTrinh == quote['KhuyenMai']['MaChuongTrinh'])
            preview = apply_offer({'MaThuoc': product_id, 'DonViGia': [unit]}, offer, program, raw_units, stock, today)
            unit['KhuyenMai'] = preview['KhuyenMai']
    return result


@database_operation
def get_product(product_id):
    return ProductSchema().dump(require_product(product_id))


@database_operation
def create_product(data):
    require_category(data['MaLoaiThuoc'])
    validate_product_image_url(data['HinhAnh'])
    result = ProductSchema().dump(products.create(data))
    products.commit()
    return result


@database_operation
def update_product(product_id, data):
    product = require_product(product_id, for_update=True)
    require_category(data['MaLoaiThuoc'])
    if data['HinhAnh'] != product.HinhAnh:
        validate_product_image_url(data['HinhAnh'])
    result = ProductSchema().dump(products.update(product, data))
    products.commit()
    return result


@database_operation
def delete_product(product_id):
    require_product(product_id, for_update=True)
    if products.has_references(product_id):
        raise ProductError('PRODUCT_IN_USE', 409)
    products.remove(product_id)
    products.commit()
