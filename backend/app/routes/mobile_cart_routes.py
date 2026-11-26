"""Giỏ hàng JWT dùng chung xử lý giỏ hiện có, độc lập cookie Website."""
from flask import Blueprint, current_app, jsonify, request
from marshmallow import Schema, fields, validate

from app.controllers.cart_controller import CartAddSchema
from app.controllers.mobile_auth_controller import payload
from app.services import cart_service, mobile_auth_service
from app.services.otp_service import AuthError
from app.services import mobile_cart_merge_service

mobile_cart_bp = Blueprint('mobile_cart', __name__, url_prefix='/api/mobile/cart')


class GuestCartLineSchema(CartAddSchema):
    SoLuong = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))


class GuestCartMergeSchema(Schema):
    merge_id = fields.String(required=True, validate=validate.Regexp(r'^[a-f0-9]{32}$'))
    created_at = fields.Integer(required=True, strict=True, validate=validate.Range(min=1))
    items = fields.List(fields.Nested(GuestCartLineSchema), required=True, validate=validate.Length(min=1, max=50))


@mobile_cart_bp.before_request
def authenticate_customer():
    request.max_content_length = 16 * 1024
    if request.method == 'OPTIONS':
        return None
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer ') or not header[7:].strip():
        raise AuthError('UNAUTHENTICATED', 401)
    user = mobile_auth_service.active_user(mobile_auth_service.decode(header[7:].strip(), 'access'))
    if user.VaiTro != 0:
        raise AuthError('FORBIDDEN', 403)
    from flask import g
    g.mobile_cart_owner = user.MaNguoiDung


@mobile_cart_bp.get('')
def read():
    from flask import g
    if request.args:
        raise AuthError('INVALID_REQUEST', 400)
    return jsonify(cart_service.get_cart(owner_id=g.mobile_cart_owner))


@mobile_cart_bp.post('/items')
@payload(CartAddSchema)
@cart_service.operation
def add(data):
    from flask import g
    cart_service.add_database(g.mobile_cart_owner, [(data['MaThuoc'], data['MaDonGia'], 1)], check_stock=True)
    return {'code': 'CART_ITEM_ADDED'}


@mobile_cart_bp.post('/merge')
@payload(GuestCartMergeSchema)
@cart_service.operation
def merge(data):
    from flask import g
    return mobile_cart_merge_service.merge(g.mobile_cart_owner, data)


@mobile_cart_bp.errorhandler(AuthError)
def cart_error(error):
    return jsonify(code=error.code), error.status


@mobile_cart_bp.errorhandler(413)
def too_large(error):
    return jsonify(code='INVALID_REQUEST'), 413


@mobile_cart_bp.after_request
def mobile_headers(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.vary.add('Origin')
    origin = request.headers.get('Origin', '')
    allowed = (current_app.config['AUTH_ALLOWED_ORIGINS'] +
               current_app.config.get('MOBILE_AUTH_ALLOWED_ORIGINS', []))
    if origin and origin in allowed:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response
