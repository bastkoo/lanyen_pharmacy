from flask import jsonify, request
from marshmallow import ValidationError

from app.schemas.unit_schema import UnitQuerySchema, UnitSchema
from app.services import unit_service as service


def payload():
    if not request.is_json:
        raise service.UnitError('JSON_REQUIRED', 415)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise service.UnitError('INVALID_REQUEST', 400)
    try:
        return UnitSchema().load(body)
    except ValidationError:
        raise service.UnitError('INVALID_REQUEST', 400) from None


def list_units(product_id):
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Repeated parameters')
        filters = UnitQuerySchema().load(request.args.to_dict())
    except ValidationError:
        raise service.UnitError('INVALID_REQUEST', 400) from None
    return jsonify(code='UNITS_LISTED', **service.list_units(product_id, **filters))


def get_unit(product_id, unit_id):
    return jsonify(code='UNIT_FOUND', unit=service.get_unit(product_id, unit_id))


def create_unit(product_id):
    return jsonify(code='UNIT_CREATED', unit=service.create_unit(product_id, payload())), 201


def update_unit(product_id, unit_id):
    return jsonify(code='UNIT_UPDATED', unit=service.update_unit(product_id, unit_id, payload()))


def delete_unit(product_id, unit_id):
    service.delete_unit(product_id, unit_id)
    return jsonify(code='UNIT_DELETED')
