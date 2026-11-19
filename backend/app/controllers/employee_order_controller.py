from flask import g, request, jsonify
from marshmallow import ValidationError

from app.schemas.order_schema import EmployeeOrderQuerySchema, EmployeeOrderUpdateSchema
from app.services import employee_order_service as service
from app.services.auth_service import AuthError
from app.services import counter_order_service as counter
from app.schemas.order_schema import CounterQuoteSchema, CounterCreateSchema, CompletedOrderQuerySchema
from app.schemas.public_catalog_schema import PublicProductQuerySchema


def counter_catalog():
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Duplicate parameter.')
        values = PublicProductQuerySchema().load(request.args.to_dict())
        return jsonify(code='COUNTER_PRODUCTS', **counter.catalog(values))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


def counter_customer():
    if set(request.args) != {'phone'} or len(request.args.getlist('phone')) != 1 or len(request.args['phone']) > 24:
        return jsonify(code='INVALID_REQUEST'), 400
    try:
        return jsonify(code='COUNTER_CUSTOMER', **counter.customer(request.args['phone']))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def counter_payload(schema, callback, code):
    try:
        if request.args or not request.is_json or not isinstance(request.get_json(silent=True), dict):
            raise ValidationError('Object required.')
        values = schema().load(request.get_json())
        return jsonify(code=code, **callback(values))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


def counter_quote():
    return counter_payload(CounterQuoteSchema, counter.quote, 'COUNTER_QUOTED')


def counter_create():
    return counter_payload(CounterCreateSchema, lambda values: dict(order=counter.create(g.current_user, values)), 'COUNTER_CREATED')


def completed_orders():
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Duplicate parameter.')
        values = CompletedOrderQuerySchema().load(request.args.to_dict())
        return jsonify(code='EMPLOYEE_ORDERS_LISTED', **service.list_orders(**values))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


def counter_pending():
    try:
        return jsonify(code='COUNTER_PENDING', items=counter.pending())
    except AuthError as error:
        return jsonify(code=error.code), error.status


def counter_order(order_id):
    try:
        return jsonify(code='EMPLOYEE_ORDER_DETAIL', order=counter.detail(order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def counter_complete(order_id):
    try:
        if request.args or not request.is_json or request.get_json(silent=True) != {}:
            return jsonify(code='INVALID_REQUEST'), 400
        return jsonify(code='COUNTER_COMPLETED', order=counter.complete(g.current_user, order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def counter_payment(order_id):
    try:
        if request.args or (request.get_data() and request.get_json(silent=True) != {}):
            return jsonify(code='INVALID_REQUEST'), 400
        return jsonify(code='COUNTER_PAYMENT', payment=counter.payment(order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def pending_count():
    try:
        return jsonify(code='EMPLOYEE_PENDING_COUNT', count=service.pending_count())
    except AuthError as error:
        return jsonify(code=error.code), error.status


def list_orders():
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Duplicate query parameter.')
        values = EmployeeOrderQuerySchema().load(request.args.to_dict())
        return jsonify(code='EMPLOYEE_ORDERS_LISTED', **service.list_orders(**values))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


def detail(order_id):
    if request.args:
        return jsonify(code='INVALID_REQUEST'), 400
    try:
        return jsonify(code='EMPLOYEE_ORDER_DETAIL', order=service.detail(order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def update(order_id):
    if request.args or not request.is_json:
        return jsonify(code='INVALID_REQUEST'), 400
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValidationError('Object required.')
        values = EmployeeOrderUpdateSchema().load(data)
        return jsonify(code='EMPLOYEE_ORDER_UPDATED', order=service.update(g.current_user, order_id, **values))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


def cancel(order_id):
    if request.args or (request.get_data() and request.get_json(silent=True) != {}):
        return jsonify(code='INVALID_REQUEST'), 400
    try:
        return jsonify(code='EMPLOYEE_ORDER_CANCELLED', order=service.cancel(g.current_user, order_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status
