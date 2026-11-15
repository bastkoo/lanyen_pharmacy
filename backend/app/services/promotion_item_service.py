from functools import wraps

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.repositories import chi_tiet_khuyen_mai_repository as items
from app.repositories import chuong_trinh_khuyen_mai_repository as promotions
from app.repositories import thuoc_repository as products
from app.schemas.promotion_item_schema import PromotionItemSchema
from app.services.promotion_service import PromotionError, require_promotion


def database_operation(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except PromotionError:
            promotions.rollback()
            raise
        except IntegrityError as error:
            promotions.rollback()
            state = getattr(error.orig, 'sqlstate', None)
            if state == '23505' and view.__name__ == 'create_item':
                raise PromotionError('PROMOTION_ITEM_EXISTS', 409) from None
            if state == '23503':
                raise PromotionError('FOREIGN_KEY_CONFLICT', 409) from None
            raise PromotionError('DATABASE_UNAVAILABLE', 503) from None
        except SQLAlchemyError:
            promotions.rollback()
            raise PromotionError('DATABASE_UNAVAILABLE', 503) from None
    return wrapped


def require_item(promotion_id, product_id, for_update=False):
    item = items.find_by_id(promotion_id, product_id, for_update=for_update)
    if item is None or item.MaChuongTrinh != promotion_id or item.MaThuoc != product_id:
        raise PromotionError('PROMOTION_ITEM_NOT_FOUND', 404)
    return item


@database_operation
def list_items(promotion_id, page, per_page):
    require_promotion(promotion_id)
    records, total = items.list_items(promotion_id, page, per_page)
    return dict(items=PromotionItemSchema(many=True).dump(records), page=page, per_page=per_page,
                total=total, pages=(total + per_page - 1) // per_page)


@database_operation
def get_item(promotion_id, product_id):
    require_promotion(promotion_id)
    return PromotionItemSchema().dump(require_item(promotion_id, product_id))


@database_operation
def create_item(promotion_id, data):
    require_promotion(promotion_id)
    if products.find_by_id(data['MaThuoc']) is None:
        raise PromotionError('PRODUCT_NOT_FOUND', 404)
    if items.find_by_id(promotion_id, data['MaThuoc']) is not None:
        raise PromotionError('PROMOTION_ITEM_EXISTS', 409)
    result = PromotionItemSchema().dump(items.create(promotion_id, data))
    promotions.commit()
    return result


@database_operation
def update_item(promotion_id, product_id, data):
    require_promotion(promotion_id)
    item = require_item(promotion_id, product_id, for_update=True)
    result = PromotionItemSchema().dump(items.update(item, data))
    promotions.commit()
    return result


@database_operation
def delete_item(promotion_id, product_id):
    require_promotion(promotion_id)
    require_item(promotion_id, product_id, for_update=True)
    items.remove(promotion_id, product_id)
    promotions.commit()
