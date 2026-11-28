"""Đặt hàng Mobile JWT; bridge SePay chỉ mang vé ngắn hạn, không đưa JWT vào URL."""
import html
import secrets

from flask import Blueprint, Response, current_app, g, jsonify, request
from marshmallow import Schema, fields, validate, validates_schema, ValidationError

from app.schemas.order_schema import OrderCreateSchema
from app.schemas.address_schema import AddressSchema
from app.services import mobile_auth_service, mobile_checkout_service as checkout
from app.services import address_service, order_service
from app.services.otp_service import AuthError

mobile_checkout_bp = Blueprint('mobile_checkout', __name__, url_prefix='/api/mobile/checkout')


class QuoteSchema(Schema):
    MaDonGia = fields.List(fields.Integer(strict=True, validate=validate.Range(min=1, max=2147483647)), required=True, validate=validate.Length(min=1, max=1000))
    DoiDiem = fields.Boolean(load_default=False)

    @validates_schema(pass_original=True)
    def check(self, data, original_data, **kwargs):
        if type(original_data.get('DoiDiem', False)) is not bool or len(set(data['MaDonGia'])) != len(data['MaDonGia']):
            raise ValidationError('Invalid selection')


class CreateSchema(OrderCreateSchema):
    request_id = fields.UUID(required=True)


def body(schema):
    if not request.is_json:
        raise AuthError('JSON_REQUIRED', 415)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise AuthError('INVALID_REQUEST', 400)
    try:
        return schema().load(data)
    except ValidationError:
        raise AuthError('INVALID_REQUEST', 400) from None


@mobile_checkout_bp.before_request
def authenticate():
    request.max_content_length = 128 * 1024
    if request.method == 'OPTIONS' or request.endpoint in {'mobile_checkout.payment_landing', 'mobile_checkout.payment_open', 'mobile_checkout.payment_return'}:
        return None
    if request.args and request.endpoint != 'mobile_checkout.orders':
        raise AuthError('INVALID_REQUEST', 400)
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer ') or not header[7:].strip():
        raise AuthError('UNAUTHENTICATED', 401)
    user = mobile_auth_service.active_user(mobile_auth_service.decode(header[7:].strip(), 'access'))
    if user.VaiTro != 0:
        raise AuthError('FORBIDDEN', 403)
    g.mobile_checkout_user = user


@mobile_checkout_bp.post('/quote')
def quote():
    return jsonify(checkout.quote(g.mobile_checkout_user.MaNguoiDung, body(QuoteSchema)))


@mobile_checkout_bp.get('/addresses')
def addresses():
    return jsonify(code='ADDRESSES_LISTED', items=address_service.list_addresses(g.mobile_checkout_user.MaNguoiDung))


@mobile_checkout_bp.post('/addresses')
def add_address():
    return jsonify(code='ADDRESS_CREATED', address=address_service.create_address(g.mobile_checkout_user.MaNguoiDung, body(AddressSchema))), 201


@mobile_checkout_bp.post('/addresses/<int:address_id>/update')
def update_address(address_id):
    return jsonify(code='ADDRESS_UPDATED', address=address_service.update_address(g.mobile_checkout_user.MaNguoiDung, address_id, body(AddressSchema)))


@mobile_checkout_bp.post('/orders')
def create_order():
    return jsonify(code='ORDER_CREATED', order=checkout.create(g.mobile_checkout_user, body(CreateSchema))), 201


@mobile_checkout_bp.get('/requests/<uuid:request_id>')
def recover(request_id):
    return jsonify(code='ORDER_READ', order=checkout.recover(g.mobile_checkout_user.MaNguoiDung, request_id))


@mobile_checkout_bp.get('/orders/<int:order_id>')
def read_order(order_id):
    return jsonify(code='ORDER_READ', order=order_service.read(g.mobile_checkout_user.MaNguoiDung, order_id))


@mobile_checkout_bp.get('/orders')
def orders():
    try:
        if set(request.args) - {'page'} or len(request.args.getlist('page')) > 1:
            raise ValueError()
        page = int(request.args.get('page', '1'))
        if not 1 <= page <= 2147483647:
            raise ValueError()
    except ValueError:
        raise AuthError('INVALID_REQUEST', 400) from None
    return jsonify(code='ORDERS_LISTED', **order_service.list_owned(g.mobile_checkout_user.MaNguoiDung, 'all', page, 10))


@mobile_checkout_bp.post('/orders/<int:order_id>/payment')
def payment(order_id):
    body(Schema)
    return jsonify(code='PAYMENT_LINK_CREATED', ticket=checkout.payment_ticket(g.mobile_checkout_user.MaNguoiDung, order_id), path='mobile/checkout/payment')


def page(content, script=''):
    nonce = secrets.token_urlsafe(24)
    markup = '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lan Yến Pharmacy</title><body>' + content
    if script:
        markup += f'<script nonce="{nonce}">{script}</script>'
    response = Response(markup + '</body></html>', mimetype='text/html')
    response.headers['Content-Security-Policy'] = f"default-src 'none'; script-src 'nonce-{nonce}'; form-action 'self' https://pay.sepay.vn https://pay-sandbox.sepay.vn; base-uri 'none'; frame-ancestors 'none'"
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response


@mobile_checkout_bp.get('/payment')
def payment_landing():
    # Fragment không gửi qua HTTP/access log. Không dùng access/refresh JWT tại bridge.
    return page('<p>Đang mở thanh toán SePay…</p><form method="POST" action="payment/open"><input type="hidden" name="ticket"></form>',
        "const t=location.hash.slice(1);history.replaceState(null,'',location.pathname);if(t){const f=document.forms[0];f.elements.ticket.value=t;f.submit();}else{document.body.textContent='Liên kết không hợp lệ. Vui lòng quay lại ứng dụng.';}")


@mobile_checkout_bp.post('/payment/open')
def payment_open():
    request.max_content_length = 4096
    if set(request.form) != {'ticket'} or len(request.form.getlist('ticket')) != 1:
        raise AuthError('INVALID_REQUEST', 400)
    form = checkout.payment_form(request.form['ticket'])
    inputs = ''.join(f'<input type="hidden" name="{html.escape(key, quote=True)}" value="{html.escape(str(value), quote=True)}">' for key, value in form['fields'].items())
    return page(f'<p>Đang chuyển đến SePay…</p><form method="POST" action="{html.escape(form["action"], quote=True)}">{inputs}<button type="submit">Mở thanh toán</button></form>', 'document.forms[0].submit();')


@mobile_checkout_bp.get('/payment/return')
def payment_return():
    # Return URL không bao giờ sửa trạng thái đơn hay coi query là bằng chứng trả tiền.
    return page('<h1>Lan Yến Pharmacy</h1><p>Hãy quay lại ứng dụng để kiểm tra trạng thái thanh toán. Không chuyển khoản lần nữa nếu trạng thái chưa cập nhật.</p>')


@mobile_checkout_bp.errorhandler(AuthError)
@mobile_checkout_bp.errorhandler(address_service.AddressError)
def error(value):
    return jsonify(code=value.code), value.status


@mobile_checkout_bp.errorhandler(413)
def too_large(error):
    return jsonify(code='INVALID_REQUEST'), 413


@mobile_checkout_bp.after_request
def headers(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.vary.add('Origin')
    allowed = current_app.config['AUTH_ALLOWED_ORIGINS'] + current_app.config.get('MOBILE_AUTH_ALLOWED_ORIGINS', [])
    origin = request.headers.get('Origin', '')
    if origin and origin in allowed:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response
