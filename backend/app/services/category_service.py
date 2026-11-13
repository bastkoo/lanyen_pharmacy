from functools import wraps

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.repositories import loai_thuoc_repository as categories
from app.schemas.category_schema import CategorySchema


class CategoryError(Exception):
    def __init__(self, code, status):
        self.code = code
        self.status = status


def database_operation(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except CategoryError:
            categories.rollback()
            raise
        except IntegrityError as error:
            categories.rollback()
            # A medicine can be inserted after the reference pre-check.
            if view.__name__ == 'delete_category' and getattr(error.orig, 'sqlstate', None) == '23503':
                raise CategoryError('CATEGORY_IN_USE', 409) from None
            raise CategoryError('DATABASE_UNAVAILABLE', 503) from None
        except SQLAlchemyError:
            categories.rollback()
            raise CategoryError('DATABASE_UNAVAILABLE', 503) from None
    return wrapped


def require_category(category_id):
    category = categories.find_by_id(category_id)
    if category is None:
        raise CategoryError('CATEGORY_NOT_FOUND', 404)
    return category


@database_operation
def list_categories(search, page, per_page):
    items, total = categories.list_categories(search, page, per_page)
    return {'items': CategorySchema(many=True).dump(items), 'page': page,
            'per_page': per_page, 'total': total,
            'pages': (total + per_page - 1) // per_page}


@database_operation
def get_category(category_id):
    return CategorySchema().dump(require_category(category_id))


@database_operation
def create_category(name):
    categories.lock_writes()
    if categories.find_duplicate(name):
        raise CategoryError('CATEGORY_NAME_EXISTS', 409)
    category = categories.create(name)
    result = CategorySchema().dump(category)
    categories.commit()
    return result


@database_operation
def update_category(category_id, name):
    categories.lock_writes()
    category = require_category(category_id)
    if categories.find_duplicate(name, exclude_id=category_id):
        raise CategoryError('CATEGORY_NAME_EXISTS', 409)
    result = CategorySchema().dump(categories.update(category, name))
    categories.commit()
    return result


@database_operation
def delete_category(category_id):
    categories.lock_writes()
    require_category(category_id)
    if categories.has_medicines(category_id):
        raise CategoryError('CATEGORY_IN_USE', 409)
    categories.remove(category_id)
    categories.commit()
