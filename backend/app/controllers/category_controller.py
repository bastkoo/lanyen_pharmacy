from flask import jsonify, request
from marshmallow import ValidationError

from app.schemas.category_schema import CategorySchema
from app.services import category_service


def category_payload():
    if not request.is_json:
        raise category_service.CategoryError('JSON_REQUIRED', 415)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise category_service.CategoryError('INVALID_REQUEST', 400)
    try:
        return CategorySchema().load(body)['TenLoaiThuoc']
    except ValidationError:
        raise category_service.CategoryError('INVALID_REQUEST', 400) from None


def list_categories():
    try:
        page = int(request.args.get('page', '1'))
        per_page = int(request.args.get('per_page', '20'))
        if page < 1 or not 1 <= per_page <= 100 or page > 2147483647:
            raise ValueError
    except ValueError:
        raise category_service.CategoryError('INVALID_REQUEST', 400) from None
    search = ' '.join(request.args.get('search', '').split())
    if len(search) > 255:
        raise category_service.CategoryError('INVALID_REQUEST', 400)
    return jsonify(code='CATEGORIES_LISTED', **category_service.list_categories(search, page, per_page))


def get_category(category_id):
    return jsonify(code='CATEGORY_FOUND', category=category_service.get_category(category_id))


def create_category():
    return jsonify(code='CATEGORY_CREATED', category=category_service.create_category(category_payload())), 201


def update_category(category_id):
    return jsonify(code='CATEGORY_UPDATED', category=category_service.update_category(category_id, category_payload()))


def delete_category(category_id):
    category_service.delete_category(category_id)
    return jsonify(code='CATEGORY_DELETED')
