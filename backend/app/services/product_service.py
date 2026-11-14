from functools import wraps

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.repositories import loai_thuoc_repository as categories
from app.repositories import thuoc_repository as products
from app.schemas.product_schema import ProductSchema
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
