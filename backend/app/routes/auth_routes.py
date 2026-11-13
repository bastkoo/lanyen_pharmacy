from flask import Blueprint
from app.controllers import auth_controller
from app.utils.auth import csrf_protect, require_roles


auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
for path, view in (('/otp/request', auth_controller.request_otp),
                   ('/otp/verify', auth_controller.verify_otp),
                   ('/register', auth_controller.register),
                   ('/logout', auth_controller.logout)):
    auth_bp.add_url_rule(path, view_func=csrf_protect(view), methods=['POST'])
auth_bp.add_url_rule('/me', view_func=require_roles(0, 1, 2)(auth_controller.me), methods=['GET'])


@auth_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
