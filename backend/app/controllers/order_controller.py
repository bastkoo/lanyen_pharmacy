from flask import current_app, g, jsonify, request, redirect

from app.controllers.auth_controller import payload
from app.schemas.order_schema import OrderCreateSchema, OrderListQuerySchema, OrderReorderSchema, ReorderCheckoutSchema
from marshmallow import ValidationError
from app.services import order_service
from app.services.auth_service import AuthError
from app.services import sepay_gateway_service


@payload(OrderCreateSchema)
def create(data):
    return jsonify(code='ORDER_CREATED', order=order_service.create(g.current_user, data)), 201


def cancel(order_id):
    if request.args or (request.get_data() and request.get_json(silent=True) != {}):
        return jsonify(code='INVALID_REQUEST'), 400
    try:
        return jsonify(code='ORDER_CANCELLED', order=order_service.cancel(g.current_user.MaNguoiDung, order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def reorder_quote(order_id):
    return reorder_checkout_request(order_id, quote=True)


def reorder_checkout(order_id):
    return reorder_checkout_request(order_id, quote=False)


def reorder_checkout_request(order_id, quote):
    if request.args:
        return jsonify(code='INVALID_REQUEST'), 400
    if not request.is_json:
        return jsonify(code='JSON_REQUIRED'), 415
    try:
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            raise ValidationError('Object required.')
        data = (OrderReorderSchema() if quote else ReorderCheckoutSchema()).load(body)
        if quote:
            return jsonify(order_service.reorder_quote(g.current_user.MaNguoiDung, order_id, data['MaChiTiet']))
        return jsonify(code='ORDER_CREATED', order=order_service.create(g.current_user, data, reorder_id=order_id)), 201
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


def list_owned():
    try:
        if any(len(request.args.getlist(key)) != 1 for key in request.args):
            raise ValidationError('Duplicate filters.')
        values = OrderListQuerySchema().load(request.args.to_dict())
        return jsonify(code='ORDERS_LISTED', **order_service.list_owned(g.current_user.MaNguoiDung, **values))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


def read(order_id):
    try:
        return jsonify(code='ORDER_READ', order=order_service.read(g.current_user.MaNguoiDung, order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def reorder_options(order_id):
    if request.args:
        return jsonify(code='INVALID_REQUEST'), 400
    try:
        return jsonify(code='REORDER_OPTIONS', **order_service.reorder_options(g.current_user.MaNguoiDung, order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def reorder(order_id):
    if request.args:
        return jsonify(code='INVALID_REQUEST'), 400
    if not request.is_json:
        return jsonify(code='JSON_REQUIRED'), 415
    try:
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            raise ValidationError('Object required.')
        data = OrderReorderSchema().load(body)
        return jsonify(code='ORDER_REORDERED', **order_service.reorder(g.current_user.MaNguoiDung, order_id, data['MaChiTiet']))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


def detail(order_id):
    try:
        return jsonify(code='ORDER_DETAIL', order=order_service.read_detail(g.current_user.MaNguoiDung, order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def payment_return():
    # A browser return only redirects to the owned detail API's frontend. Never
    # infer payment from query parameters, or write order/payment/stock here.
    order_id = request.args.get('order', '')
    if not 1 <= len(order_id) <= 19 or not order_id.isascii() or not order_id.isdigit() or not 0 < int(order_id) <= 9223372036854775807:
        return jsonify(code='INVALID_REQUEST'), 400
    allowed = current_app.config['AUTH_ALLOWED_ORIGINS']
    origin = current_app.config.get('SEPAY_FRONTEND_ORIGIN') or (allowed[0] if allowed else '')
    if not origin or origin not in allowed:
        return jsonify(code='GATEWAY_CONFIG_INVALID'), 503
    storefront = request.args.get('storefront')
    frontend_origin = request.args.get('frontend_origin')
    if storefront is not None:
        matches = [value for value in allowed if sepay_gateway_service.storefront_key(value) == storefront]
        if (len(request.args.getlist('storefront')) != 1 or len(matches) != 1
                or frontend_origin is not None):
            return jsonify(code='INVALID_REQUEST'), 400
        origin = matches[0]
    # Compatibility with forms issued before the local storefront selector.
    if frontend_origin is not None:
        if len(request.args.getlist('frontend_origin')) != 1 or frontend_origin not in allowed:
            return jsonify(code='INVALID_REQUEST'), 400
        origin = frontend_origin
    if request.args.get('workspace') == 'employee':
        return redirect(f'{origin}/pages/employee/index.html?bill={int(order_id)}#counter', code=303)
    return redirect(f'{origin}/pages/customer/order-detail.html?order={int(order_id)}', code=303)


def webhook():
    if not request.is_json:
        return jsonify(success=False, code='JSON_REQUIRED'), 415
    try:
        order_service.webhook(request.headers.get('Authorization', ''), request.get_json(silent=True))
        return jsonify(success=True)
    except AuthError as error:
        return jsonify(success=False, code=error.code), error.status


def initialize_payment(order_id):
    # No client amount, invoice, merchant, callback URLs or status is accepted.
    if request.args or request.get_data():
        return jsonify(code='INVALID_REQUEST'), 400
    try:
        payment = sepay_gateway_service.initialize(g.current_user.MaNguoiDung, order_id,
                                                  frontend_origin=request.headers.get('Origin'))
        current_app.logger.info('sepay_initialize order_id=%s status=200 code=PAYMENT_INITIALIZED', order_id)
        return jsonify(code='PAYMENT_INITIALIZED', payment=payment)
    except AuthError as error:
        current_app.logger.warning('sepay_initialize order_id=%s status=%s code=%s', order_id, error.status, error.code)
        return jsonify(code=error.code), error.status


def ipn():
    if not request.is_json:
        current_app.logger.warning('sepay_ipn status=415 code=JSON_REQUIRED')
        return jsonify(success=False, code='JSON_REQUIRED'), 415
    try:
        outcome = sepay_gateway_service.receive_ipn(request.headers.get('X-Secret-Key', ''), request.get_json(silent=True))
        current_app.logger.info('sepay_ipn status=200 code=%s', outcome)
        return jsonify(success=True)
    except AuthError as error:
        current_app.logger.warning('sepay_ipn status=%s code=%s', error.status, error.code)
        return jsonify(success=False, code=error.code), error.status
