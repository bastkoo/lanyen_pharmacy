from flask import Blueprint, jsonify

from app.controllers import public_catalog_controller as controller
from app.services.category_service import CategoryError
from app.services.product_service import ProductError


public_catalog_bp = Blueprint('public_catalog', __name__, url_prefix='/api')
public_catalog_bp.add_url_rule('/categories', view_func=controller.list_categories, methods=['GET'])
public_catalog_bp.add_url_rule('/products', view_func=controller.list_products, methods=['GET'])
public_catalog_bp.add_url_rule('/products/<int:product_id>', view_func=controller.product_detail, methods=['GET'])
public_catalog_bp.add_url_rule('/promotions', view_func=controller.list_promotions, methods=['GET'])
public_catalog_bp.add_url_rule('/promotions/<int:promotion_id>/products', view_func=controller.promotion_products, methods=['GET'])


@public_catalog_bp.errorhandler(ProductError)
@public_catalog_bp.errorhandler(CategoryError)
def catalog_error(error):
    return jsonify(code=error.code), error.status


@public_catalog_bp.after_request
def catalog_headers(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
