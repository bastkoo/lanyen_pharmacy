from flask import g, request, jsonify
from marshmallow import ValidationError

from app.schemas.order_schema import EmployeeOrderQuerySchema, EmployeeOrderUpdateSchema
from app.services import employee_order_service as service
from app.services.auth_service import AuthError


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
