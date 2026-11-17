from flask import Blueprint

from app.controllers import cart_controller
from app.utils.auth import csrf_protect

cart_bp = Blueprint('cart', __name__, url_prefix='/api/cart')
cart_bp.add_url_rule('', view_func=cart_controller.read, methods=['GET'])
cart_bp.add_url_rule('/items', view_func=csrf_protect(cart_controller.add), methods=['POST'])
cart_bp.add_url_rule('/items/<int:unit_id>', view_func=csrf_protect(cart_controller.remove), methods=['DELETE'])
cart_bp.add_url_rule('/items/<int:unit_id>', view_func=csrf_protect(cart_controller.update), methods=['PUT'])
cart_bp.add_url_rule('/quote', view_func=csrf_protect(cart_controller.quote), methods=['POST'])


@cart_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
