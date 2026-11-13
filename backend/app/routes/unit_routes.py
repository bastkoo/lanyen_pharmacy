from flask import Blueprint, jsonify

from app.controllers import unit_controller as controller
from app.services.unit_service import UnitError
from app.utils.auth import csrf_protect, require_roles


unit_bp = Blueprint('units', __name__, url_prefix='/api/manager/products/<int:product_id>/units')
for path, method, view in (
    ('', 'GET', controller.list_units),
    ('/<int:unit_id>', 'GET', controller.get_unit),
    ('', 'POST', controller.create_unit),
    ('/<int:unit_id>', 'PUT', controller.update_unit),
    ('/<int:unit_id>', 'DELETE', controller.delete_unit),
):
    if method != 'GET':
        view = csrf_protect(view)
    unit_bp.add_url_rule(path, view_func=require_roles(2)(view), methods=[method])


@unit_bp.errorhandler(UnitError)
def unit_error(error):
    return jsonify(code=error.code), error.status


@unit_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
