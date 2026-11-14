from flask import Blueprint, jsonify

from app.controllers import batch_controller as controller
from app.services.product_service import ProductError
from app.utils.auth import csrf_protect, require_roles


batch_bp = Blueprint('batches', __name__, url_prefix='/api/manager/products/<int:product_id>/batches')
inventory_bp = Blueprint('inventory', __name__, url_prefix='/api/manager/inventory')

for path, method, view in (
    ('', 'GET', controller.list_batches),
    ('/<int:batch_id>', 'GET', controller.get_batch),
    ('', 'POST', controller.create_batch),
    ('/<int:batch_id>', 'PUT', controller.update_batch),
    ('/<int:batch_id>', 'DELETE', controller.delete_batch),
):
    if method != 'GET':
        view = csrf_protect(view)
    batch_bp.add_url_rule(path, view_func=require_roles(2)(view), methods=[method])

for path, view in (('/summary', controller.summary), ('/expiring', controller.expiring),
                   ('/low-stock', controller.low_stock)):
    inventory_bp.add_url_rule(path, view_func=require_roles(2)(view), methods=['GET'])


def domain_error(error):
    return jsonify(code=error.code), error.status


def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


for blueprint in (batch_bp, inventory_bp):
    blueprint.register_error_handler(ProductError, domain_error)
    blueprint.after_request(no_store)
