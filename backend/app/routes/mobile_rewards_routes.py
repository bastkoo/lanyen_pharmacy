"""Điểm thưởng Mobile JWT, độc lập với session/cookie Website."""
from flask import Blueprint, current_app, g, jsonify, request
from marshmallow import Schema, ValidationError, fields, validate

from app.controllers.mobile_auth_controller import payload
from app.services import mobile_auth_service, mobile_rewards_service
from app.services.otp_service import AuthError

mobile_rewards_bp = Blueprint('mobile_rewards', __name__, url_prefix='/api/mobile/rewards')


class RewardsQuery(Schema):
    page = fields.Integer(load_default=1, validate=validate.Range(min=1, max=2147483647))


@mobile_rewards_bp.before_request
def authenticate():
    request.max_content_length = 1024
    if request.method == 'OPTIONS':
        return None
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer ') or not header[7:].strip():
        raise AuthError('UNAUTHENTICATED', 401)
    user = mobile_auth_service.active_user(mobile_auth_service.decode(header[7:].strip(), 'access'))
    if user.VaiTro != 0:
        raise AuthError('FORBIDDEN', 403)
    g.mobile_rewards_owner = user.MaNguoiDung


@mobile_rewards_bp.get('')
def read():
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Repeated query')
        filters = RewardsQuery().load(request.args.to_dict())
    except ValidationError:
        raise AuthError('INVALID_REQUEST', 400) from None
    return jsonify(mobile_rewards_service.read(g.mobile_rewards_owner, filters['page']))


@mobile_rewards_bp.post('/check-in')
@payload(Schema)
def check_in(data):
    if request.args:
        raise AuthError('INVALID_REQUEST', 400)
    return mobile_rewards_service.check_in(g.mobile_rewards_owner)


@mobile_rewards_bp.errorhandler(AuthError)
def auth_error(error):
    return jsonify(code=error.code), error.status


@mobile_rewards_bp.errorhandler(413)
def too_large(error):
    return jsonify(code='INVALID_REQUEST'), 413


@mobile_rewards_bp.after_request
def headers(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.vary.add('Origin')
    origin = request.headers.get('Origin', '')
    allowed = current_app.config['AUTH_ALLOWED_ORIGINS'] + current_app.config.get('MOBILE_AUTH_ALLOWED_ORIGINS', [])
    if origin and origin in allowed:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response
