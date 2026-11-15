from functools import wraps

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.repositories import chuong_trinh_khuyen_mai_repository as promotions
from app.schemas.promotion_schema import PromotionSchema


class PromotionError(Exception):
    def __init__(self, code, status):
        self.code = code
        self.status = status


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
            # Existing FK also protects against details inserted after pre-check.
            if view.__name__ == 'delete_promotion' and getattr(error.orig, 'sqlstate', None) == '23503':
                raise PromotionError('PROMOTION_IN_USE', 409) from None
            raise PromotionError('DATABASE_UNAVAILABLE', 503) from None
        except SQLAlchemyError:
            promotions.rollback()
            raise PromotionError('DATABASE_UNAVAILABLE', 503) from None
    return wrapped


def require_promotion(promotion_id, for_update=False):
    promotion = promotions.find_by_id(promotion_id, for_update=for_update)
    if promotion is None:
        raise PromotionError('PROMOTION_NOT_FOUND', 404)
    return promotion


@database_operation
def list_promotions(page, per_page):
    items, total = promotions.list_promotions(page, per_page)
    return dict(items=PromotionSchema(many=True).dump(items), page=page, per_page=per_page,
                total=total, pages=(total + per_page - 1) // per_page)


@database_operation
def get_promotion(promotion_id):
    return PromotionSchema().dump(require_promotion(promotion_id))


@database_operation
def create_promotion(data):
    result = PromotionSchema().dump(promotions.create(data))
    promotions.commit()
    return result


@database_operation
def update_promotion(promotion_id, data):
    promotion = require_promotion(promotion_id, for_update=True)
    result = PromotionSchema().dump(promotions.update(promotion, data))
    promotions.commit()
    return result


@database_operation
def delete_promotion(promotion_id):
    require_promotion(promotion_id, for_update=True)
    if promotions.has_details(promotion_id):
        raise PromotionError('PROMOTION_IN_USE', 409)
    promotions.remove(promotion_id)
    promotions.commit()
