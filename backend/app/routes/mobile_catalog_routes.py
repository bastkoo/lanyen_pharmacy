"""Danh mục công khai cho Mobile, dùng nguyên controller/service của Website."""
from flask import Blueprint, current_app, jsonify, request

from app.controllers import public_catalog_controller as controller
from app.services.category_service import CategoryError
from app.services.product_service import ProductError

mobile_catalog_bp = Blueprint('mobile_catalog', __name__, url_prefix='/api/mobile/catalog')
mobile_catalog_bp.add_url_rule('/categories', view_func=controller.list_categories, methods=['GET'])
mobile_catalog_bp.add_url_rule('/products', view_func=controller.list_products, methods=['GET'])
mobile_catalog_bp.add_url_rule('/products/<int:product_id>', view_func=controller.product_detail, methods=['GET'])
mobile_catalog_bp.add_url_rule('/promotions', view_func=controller.list_promotions, methods=['GET'])
mobile_catalog_bp.add_url_rule('/promotions/<int:promotion_id>/products', view_func=controller.promotion_products, methods=['GET'])


@mobile_catalog_bp.errorhandler(ProductError)
@mobile_catalog_bp.errorhandler(CategoryError)
def catalog_error(error):
    return jsonify(code=error.code), error.status


@mobile_catalog_bp.after_request
def catalog_headers(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Chỉ mở CORS đọc công khai trên endpoint mới; không dùng cookie hoặc token.
    origin = request.headers.get('Origin', '')
    allowed = (current_app.config['AUTH_ALLOWED_ORIGINS'] +
               current_app.config.get('MOBILE_AUTH_ALLOWED_ORIGINS', []))
    response.vary.add('Origin')
    if origin and origin in allowed:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    return response
