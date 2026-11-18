from flask import Blueprint

from app.controllers import order_controller
from app.utils.auth import csrf_protect, require_roles

order_bp = Blueprint('orders', __name__, url_prefix='/api')
order_bp.add_url_rule('/orders', view_func=csrf_protect(require_roles(0, 1, 2)(order_controller.create)), methods=['POST'])
order_bp.add_url_rule('/orders', view_func=require_roles(0, 1, 2)(order_controller.list_owned), methods=['GET'])
order_bp.add_url_rule('/orders/<int:order_id>', view_func=require_roles(0, 1, 2)(order_controller.read), methods=['GET'])
order_bp.add_url_rule('/orders/<int:order_id>/detail', view_func=require_roles(0, 1, 2)(order_controller.detail), methods=['GET'])
order_bp.add_url_rule('/orders/<int:order_id>/reorder', view_func=require_roles(0, 1, 2)(order_controller.reorder_options), methods=['GET'])
order_bp.add_url_rule('/orders/<int:order_id>/reorder', view_func=csrf_protect(require_roles(0, 1, 2)(order_controller.reorder)), methods=['POST'])
order_bp.add_url_rule('/payments/sepay/return', view_func=order_controller.payment_return, methods=['GET'])
order_bp.add_url_rule('/orders/<int:order_id>/payment', view_func=csrf_protect(require_roles(0, 1, 2)(order_controller.initialize_payment)), methods=['POST'])
order_bp.add_url_rule('/payments/sepay/ipn', view_func=order_controller.ipn, methods=['POST'])
# SePay authenticates server-to-server with its API key, without browser cookies/CSRF.
order_bp.add_url_rule('/payments/sepay/webhook', view_func=order_controller.webhook, methods=['POST'])


@order_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
