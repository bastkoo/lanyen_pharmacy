from flask import Blueprint, request, jsonify, session
from werkzeug.exceptions import RequestEntityTooLarge, BadRequest
from app.controllers import auth_controller, upload_controller
from app.utils.image_validator import ImageError, MAX_IMAGE_BYTES
from app.utils.auth import csrf_protect, require_roles
from app.controllers import address_controller
from app.services.address_service import AddressError
from app.services.auth_service import AuthError
from app.utils.auth import csrf_token


auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')
for path, view in (('/otp/request', auth_controller.request_otp),
                   ('/otp/verify', auth_controller.verify_otp),
                   ('/register', auth_controller.register),
                   ('/logout', auth_controller.logout)):
    auth_bp.add_url_rule(path, view_func=csrf_protect(view), methods=['POST'])
auth_bp.add_url_rule('/me', view_func=require_roles(0, 1, 2)(auth_controller.me), methods=['GET'])
auth_bp.add_url_rule('/me', view_func=require_roles(0, 1, 2)(csrf_protect(auth_controller.update_profile)), methods=['PUT'])
auth_bp.add_url_rule('/me/avatar', view_func=require_roles(0, 1, 2)(csrf_protect(upload_controller.upload_avatar)), methods=['POST'])
auth_bp.add_url_rule('/me/points', view_func=require_roles(0, 1, 2)(auth_controller.points), methods=['GET'])

for path, method, view in (
    ('/me/addresses', 'GET', address_controller.list_addresses),
    ('/me/addresses', 'POST', address_controller.create_address),
    ('/me/addresses/<int:address_id>', 'PUT', address_controller.update_address),
    ('/me/addresses/<int:address_id>', 'DELETE', address_controller.delete_address),
    ('/me/addresses/<int:address_id>/primary', 'PATCH', address_controller.make_primary),
):
    if method != 'GET':
        view = csrf_protect(view)
    auth_bp.add_url_rule(path, view_func=require_roles(0, 1, 2)(view), methods=[method])


@auth_bp.errorhandler(AddressError)
@auth_bp.errorhandler(AuthError)
def address_error(error):
    if error.code in ('ACCOUNT_LOCKED', 'UNAUTHENTICATED'):
        session.clear()
        return jsonify(code=error.code, csrf_token=csrf_token()), error.status
    return jsonify(code=error.code), error.status


@auth_bp.before_request
def limit_avatar():
    if request.endpoint == 'auth.upload_avatar':
        request.max_content_length = MAX_IMAGE_BYTES + 64 * 1024
        request.max_form_memory_size = 256 * 1024
        request.max_form_parts = 2


@auth_bp.errorhandler(ImageError)
def image_error(error):
    return jsonify(code=error.code), error.status


@auth_bp.errorhandler(RequestEntityTooLarge)
def too_large(error):
    return jsonify(code='IMAGE_TOO_LARGE'), 413


@auth_bp.errorhandler(BadRequest)
def bad_request(error):
    return jsonify(code='INVALID_REQUEST'), 400


@auth_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
