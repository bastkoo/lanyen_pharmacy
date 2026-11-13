from functools import wraps

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.repositories import don_vi_gia_thuoc_repository as units
from app.repositories import thuoc_repository as products
from app.schemas.unit_schema import UnitSchema


class UnitError(Exception):
    def __init__(self, code, status):
        self.code = code
        self.status = status


def database_operation(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except UnitError:
            units.rollback()
            raise
        except IntegrityError as error:
            units.rollback()
            if getattr(error.orig, 'sqlstate', None) == '23503':
                code = 'UNIT_IN_USE' if view.__name__ == 'delete_unit' else 'FOREIGN_KEY_CONFLICT'
                raise UnitError(code, 409) from None
            raise UnitError('DATABASE_UNAVAILABLE', 503) from None
        except SQLAlchemyError:
            units.rollback()
            raise UnitError('DATABASE_UNAVAILABLE', 503) from None
    return wrapped


def require_product(product_id):
    if products.find_by_id(product_id) is None:
        raise UnitError('PRODUCT_NOT_FOUND', 404)


def require_unit(product_id, unit_id, for_update=False):
    unit = units.find_by_id(product_id, unit_id, for_update=for_update)
    if unit is None or unit.MaThuoc != product_id:
        raise UnitError('UNIT_NOT_FOUND', 404)
    return unit


@database_operation
def list_units(product_id, page, per_page):
    require_product(product_id)
    items, total = units.list_units(product_id, page, per_page)
    return {'items': UnitSchema(many=True).dump(items), 'page': page, 'per_page': per_page,
            'total': total, 'pages': (total + per_page - 1) // per_page}


@database_operation
def get_unit(product_id, unit_id):
    require_product(product_id)
    return UnitSchema().dump(require_unit(product_id, unit_id))


@database_operation
def create_unit(product_id, data):
    require_product(product_id)
    result = UnitSchema().dump(units.create(product_id, data))
    units.commit()
    return result


@database_operation
def update_unit(product_id, unit_id, data):
    require_product(product_id)
    unit = require_unit(product_id, unit_id, for_update=True)
    result = UnitSchema().dump(units.update(unit, data))
    units.commit()
    return result


@database_operation
def delete_unit(product_id, unit_id):
    require_product(product_id)
    require_unit(product_id, unit_id, for_update=True)
    if units.has_references(unit_id):
        raise UnitError('UNIT_IN_USE', 409)
    units.remove(product_id, unit_id)
    units.commit()
