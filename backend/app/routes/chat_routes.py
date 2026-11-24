from flask import Blueprint, request, jsonify
from werkzeug.exceptions import RequestEntityTooLarge

from app.controllers import chat_controller as controller
from app.utils.auth import require_roles, csrf_protect
from app.utils.image_validator import MAX_IMAGE_BYTES

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')


def route(path, name, role, method='GET'):
    handler = getattr(controller, name)
    if method != 'GET':
        handler = csrf_protect(handler)
    chat_bp.add_url_rule(path, endpoint=f'{role}_{name}', view_func=require_roles(role)(handler), methods=[method])


route('/messages', 'history', 0)
route('/ai', 'ai_answer', 0, 'POST')
route('/messages', 'send', 0, 'POST')
route('/unread', 'unread', 0)
route('/read', 'read', 0, 'POST')
route('/images', 'upload', 0, 'POST')
route('/offers/<int:message_id>/cart', 'purchase', 0, 'POST')
route('/offers/<int:message_id>/quote', 'offer_quote', 0)
route('/offers/<int:message_id>/checkout', 'offer_checkout', 0, 'POST')
route('/threads', 'queue', 1)
route('/threads/pending-count', 'pending_count', 1)
route('/threads/<int:thread_id>/messages', 'history', 1)
route('/threads/<int:thread_id>/messages', 'send', 1, 'POST')
route('/threads/<int:thread_id>/read', 'read', 1, 'POST')
route('/threads/<int:thread_id>/claim', 'claim', 1, 'POST')
route('/threads/<int:thread_id>/finish', 'finish', 1, 'POST')
route('/threads/<int:thread_id>/images', 'upload', 1, 'POST')


@chat_bp.before_request
def limit_body():
    request.max_content_length = MAX_IMAGE_BYTES + 64 * 1024 if request.path.endswith('/images') else 64 * 1024
    request.max_form_memory_size = 256 * 1024
    request.max_form_parts = 2


@chat_bp.errorhandler(RequestEntityTooLarge)
def too_large(error):
    return jsonify(code='IMAGE_TOO_LARGE' if request.path.endswith('/images') else 'INVALID_REQUEST'), 413


@chat_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
