from flask import Blueprint
from app.controllers import employee_order_controller as controller
from app.utils.auth import require_roles, csrf_protect

employee_order_bp = Blueprint('employee_orders', __name__, url_prefix='/api/employee/orders')
employee_order_bp.add_url_rule('', view_func=require_roles(1)(controller.list_orders), methods=['GET'])
employee_order_bp.add_url_rule('/pending-count', view_func=require_roles(1)(controller.pending_count), methods=['GET'])
employee_order_bp.add_url_rule('/completed', view_func=require_roles(1)(controller.completed_orders), methods=['GET'])
employee_order_bp.add_url_rule('/returns', view_func=require_roles(1)(controller.return_orders), methods=['GET'])
employee_order_bp.add_url_rule('/<int:order_id>/returns', view_func=require_roles(1)(controller.return_detail), methods=['GET'])
employee_order_bp.add_url_rule('/<int:order_id>/returns', view_func=csrf_protect(require_roles(1)(controller.return_submit)), methods=['POST'])
employee_order_bp.add_url_rule('/counter/customer', view_func=require_roles(1)(controller.counter_customer), methods=['GET'])
employee_order_bp.add_url_rule('/counter/products', view_func=require_roles(1)(controller.counter_catalog), methods=['GET'])
employee_order_bp.add_url_rule('/counter/pending', view_func=require_roles(1)(controller.counter_pending), methods=['GET'])
employee_order_bp.add_url_rule('/counter/quote', view_func=csrf_protect(require_roles(1)(controller.counter_quote)), methods=['POST'])
employee_order_bp.add_url_rule('/counter', view_func=csrf_protect(require_roles(1)(controller.counter_create)), methods=['POST'])
employee_order_bp.add_url_rule('/counter/<int:order_id>', view_func=require_roles(1)(controller.counter_order), methods=['GET'])
employee_order_bp.add_url_rule('/counter/<int:order_id>/complete', view_func=csrf_protect(require_roles(1)(controller.counter_complete)), methods=['POST'])
employee_order_bp.add_url_rule('/counter/<int:order_id>/payment', view_func=csrf_protect(require_roles(1)(controller.counter_payment)), methods=['POST'])
employee_order_bp.add_url_rule('/<int:order_id>', view_func=require_roles(1)(controller.detail), methods=['GET'])
employee_order_bp.add_url_rule('/<int:order_id>/status', view_func=csrf_protect(require_roles(1)(controller.update)), methods=['POST'])
employee_order_bp.add_url_rule('/<int:order_id>/cancel', view_func=csrf_protect(require_roles(1)(controller.cancel)), methods=['POST'])


@employee_order_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
