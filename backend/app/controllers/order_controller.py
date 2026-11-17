from flask import current_app, g, jsonify, request

from app.controllers.auth_controller import payload
from app.schemas.order_schema import OrderCreateSchema
from app.services import order_service
from app.services.auth_service import AuthError
from app.services import sepay_gateway_service


@payload(OrderCreateSchema)
def create(data):
    return jsonify(code='ORDER_CREATED', order=order_service.create(g.current_user, data)), 201


def read(order_id):
    try:
        return jsonify(code='ORDER_READ', order=order_service.read(g.current_user.MaNguoiDung, order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


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
        payment = sepay_gateway_service.initialize(g.current_user.MaNguoiDung, order_id)
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
