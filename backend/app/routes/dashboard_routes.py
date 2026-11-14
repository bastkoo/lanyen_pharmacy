from flask import Blueprint

from app.controllers import dashboard_controller as controller
from app.routes.product_routes import product_error, no_store
from app.services.product_service import ProductError
from app.utils.auth import require_roles


dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/manager/dashboard')
dashboard_bp.add_url_rule('/summary', view_func=require_roles(2)(controller.summary), methods=['GET'])
dashboard_bp.add_url_rule('/recent-orders', view_func=require_roles(2)(controller.recent_orders), methods=['GET'])
dashboard_bp.add_url_rule('/revenue', view_func=require_roles(2)(controller.revenue), methods=['GET'])
dashboard_bp.register_error_handler(ProductError, product_error)
dashboard_bp.after_request(no_store)
