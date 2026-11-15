from flask import jsonify, request
from marshmallow import ValidationError

from app.schemas.promotion_schema import PromotionSchema
from app.schemas.unit_schema import UnitQuerySchema
from app.services import promotion_service as service


def payload():
    if not request.is_json:
        raise service.PromotionError('JSON_REQUIRED', 415)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise service.PromotionError('INVALID_REQUEST', 400)
    try:
        return PromotionSchema().load(body)
    except ValidationError:
        raise service.PromotionError('INVALID_REQUEST', 400) from None


def list_promotions():
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Repeated parameters')
        query = UnitQuerySchema().load(request.args.to_dict())
    except ValidationError:
        raise service.PromotionError('INVALID_REQUEST', 400) from None
    return jsonify(code='PROMOTIONS_LISTED', **service.list_promotions(**query))


def get_promotion(promotion_id):
    return jsonify(code='PROMOTION_FOUND', promotion=service.get_promotion(promotion_id))


def create_promotion():
    return jsonify(code='PROMOTION_CREATED', promotion=service.create_promotion(payload())), 201


def update_promotion(promotion_id):
    return jsonify(code='PROMOTION_UPDATED', promotion=service.update_promotion(promotion_id, payload()))


def delete_promotion(promotion_id):
    service.delete_promotion(promotion_id)
    return jsonify(code='PROMOTION_DELETED')
