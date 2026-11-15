from flask import jsonify

from app.controllers.promotion_controller import payload, query_payload
from app.schemas.promotion_item_schema import PromotionItemCreateSchema, PromotionItemSchema
from app.services import promotion_item_service as service


def list_items(promotion_id):
    return jsonify(code='PROMOTION_ITEMS_LISTED', **service.list_items(promotion_id, **query_payload()))


def get_item(promotion_id, product_id):
    return jsonify(code='PROMOTION_ITEM_FOUND', item=service.get_item(promotion_id, product_id))


def create_item(promotion_id):
    return jsonify(code='PROMOTION_ITEM_CREATED', item=service.create_item(promotion_id, payload(PromotionItemCreateSchema))), 201


def update_item(promotion_id, product_id):
    return jsonify(code='PROMOTION_ITEM_UPDATED', item=service.update_item(promotion_id, product_id, payload(PromotionItemSchema)))


def delete_item(promotion_id, product_id):
    service.delete_item(promotion_id, product_id)
    return jsonify(code='PROMOTION_ITEM_DELETED')
