from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest, RequestEntityTooLarge

from app.controllers import upload_controller
from app.utils.auth import csrf_protect, require_roles
from app.utils.image_validator import ImageError, MAX_IMAGE_BYTES


upload_bp = Blueprint('uploads', __name__, url_prefix='/api/manager/uploads')
upload_bp.add_url_rule('/products', view_func=require_roles(2)(csrf_protect(upload_controller.upload_product)),
                       methods=['POST'])


@upload_bp.before_request
def limit_upload_body():
    # Allow multipart envelope overhead, then enforce the exact file limit in validator.
    request.max_content_length = MAX_IMAGE_BYTES + 64 * 1024
    request.max_form_memory_size = 256 * 1024
    request.max_form_parts = 2


@upload_bp.errorhandler(ImageError)
def image_error(error):
    return jsonify(code=error.code), error.status


@upload_bp.errorhandler(RequestEntityTooLarge)
def too_large(error):
    return jsonify(code='IMAGE_TOO_LARGE'), 413


@upload_bp.errorhandler(BadRequest)
def bad_request(error):
    return jsonify(code='INVALID_REQUEST'), 400


@upload_bp.errorhandler(Exception)
def internal_error(error):
    # Never log exception text: provider exceptions can contain credentials/URLs.
    current_app.logger.error('Product image upload failed unexpectedly')
    return jsonify(code='UPLOAD_FAILED'), 500


@upload_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
