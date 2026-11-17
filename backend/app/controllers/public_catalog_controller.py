from flask import jsonify, request
from marshmallow import ValidationError

from app.schemas.public_catalog_schema import PublicCategoryQuerySchema, PublicProductQuerySchema
from app.services import category_service, product_service


def query(schema):
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Repeated parameters')
        return schema().load(request.args.to_dict())
    except ValidationError:
        raise product_service.ProductError('INVALID_REQUEST', 400) from None


def list_categories():
    filters = query(PublicCategoryQuerySchema)
    return jsonify(code='CATEGORIES_LISTED', **category_service.list_categories(**filters))


def list_products():
    filters = query(PublicProductQuerySchema)
    if 'ke_don' in filters:
        filters['ke_don'] = filters['ke_don'] == 'true'
    return jsonify(code='PRODUCTS_LISTED', **product_service.list_public_products(filters))
