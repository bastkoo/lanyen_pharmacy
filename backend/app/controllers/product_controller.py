from flask import jsonify, request
from marshmallow import ValidationError

from app.schemas.product_schema import ProductCreateSchema, ProductQuerySchema, ProductSchema
from app.services import product_service as service


def payload(schema):
    if not request.is_json:
        raise service.ProductError('JSON_REQUIRED', 415)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise service.ProductError('INVALID_REQUEST', 400)
    try:
        return schema().load(body)
    except ValidationError:
        raise service.ProductError('INVALID_REQUEST', 400) from None


def list_products():
    try:
        # Reject repeated parameters rather than silently ignoring one value.
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Repeated parameters')
        filters = ProductQuerySchema().load(request.args.to_dict())
    except ValidationError:
        raise service.ProductError('INVALID_REQUEST', 400) from None
    if 'phan_loai' in filters:
        filters['phan_loai'] = filters['phan_loai'] == 'true'
    return jsonify(code='PRODUCTS_LISTED', **service.list_products(filters))


def get_product(product_id):
    return jsonify(code='PRODUCT_FOUND', product=service.get_product(product_id))


def create_product():
    return jsonify(code='PRODUCT_CREATED', product=service.create_product(payload(ProductCreateSchema))), 201


def update_product(product_id):
    return jsonify(code='PRODUCT_UPDATED', product=service.update_product(product_id, payload(ProductSchema)))


def delete_product(product_id):
    service.delete_product(product_id)
    return jsonify(code='PRODUCT_DELETED')
