from flask import Blueprint, jsonify

from app.controllers import category_controller as controller
from app.services.category_service import CategoryError
from app.utils.auth import csrf_protect, require_roles


category_bp = Blueprint('categories', __name__, url_prefix='/api/manager/categories')

for path, method, view in (
    ('', 'GET', controller.list_categories),
    ('/<int:category_id>', 'GET', controller.get_category),
    ('', 'POST', controller.create_category),
    ('/<int:category_id>', 'PUT', controller.update_category),
    ('/<int:category_id>', 'DELETE', controller.delete_category),
):
    if method != 'GET':
        view = csrf_protect(view)
    category_bp.add_url_rule(path, view_func=require_roles(2)(view), methods=[method])


@category_bp.errorhandler(CategoryError)
def category_error(error):
    return jsonify(code=error.code), error.status


@category_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
