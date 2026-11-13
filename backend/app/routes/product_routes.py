from flask import Blueprint, jsonify

from app.controllers import product_controller as controller
from app.services.product_service import ProductError
from app.utils.auth import csrf_protect, require_roles


product_bp = Blueprint('products', __name__, url_prefix='/api/manager/products')
for path, method, view in (
    ('', 'GET', controller.list_products),
    ('/<int:product_id>', 'GET', controller.get_product),
    ('', 'POST', controller.create_product),
    ('/<int:product_id>', 'PUT', controller.update_product),
    ('/<int:product_id>', 'DELETE', controller.delete_product),
):
    if method != 'GET':
        view = csrf_protect(view)
    product_bp.add_url_rule(path, view_func=require_roles(2)(view), methods=[method])


@product_bp.errorhandler(ProductError)
def product_error(error):
    return jsonify(code=error.code), error.status


@product_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
