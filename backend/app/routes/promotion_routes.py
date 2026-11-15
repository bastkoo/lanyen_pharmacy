from flask import Blueprint, jsonify

from app.controllers import promotion_controller as controller
from app.controllers import promotion_item_controller as item_controller
from app.services.promotion_service import PromotionError
from app.utils.auth import csrf_protect, require_roles


promotion_bp = Blueprint('promotions', __name__, url_prefix='/api/manager/promotions')
for path, method, view in (
    ('', 'GET', controller.list_promotions),
    ('/<int:promotion_id>', 'GET', controller.get_promotion),
    ('', 'POST', controller.create_promotion),
    ('/<int:promotion_id>', 'PUT', controller.update_promotion),
    ('/<int:promotion_id>', 'DELETE', controller.delete_promotion),
):
    if method != 'GET':
        view = csrf_protect(view)
    promotion_bp.add_url_rule(path, view_func=require_roles(2)(view), methods=[method])

for path, method, view in (
    ('/<int:promotion_id>/items', 'GET', item_controller.list_items),
    ('/<int:promotion_id>/items', 'POST', item_controller.create_item),
    ('/<int:promotion_id>/items/<int:product_id>', 'GET', item_controller.get_item),
    ('/<int:promotion_id>/items/<int:product_id>', 'PUT', item_controller.update_item),
    ('/<int:promotion_id>/items/<int:product_id>', 'DELETE', item_controller.delete_item),
):
    if method != 'GET':
        view = csrf_protect(view)
    promotion_bp.add_url_rule(path, view_func=require_roles(2)(view), methods=[method])


@promotion_bp.errorhandler(PromotionError)
def promotion_error(error):
    return jsonify(code=error.code), error.status


@promotion_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
