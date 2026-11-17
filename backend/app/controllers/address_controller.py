from flask import g, jsonify, request
from marshmallow import Schema, ValidationError

from app.schemas.address_schema import AddressSchema
from app.services import address_service as service


def payload(schema):
    if not request.is_json:
        raise service.AddressError('JSON_REQUIRED', 415)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise service.AddressError('INVALID_REQUEST', 400)
    try:
        return schema().load(data)
    except ValidationError:
        raise service.AddressError('INVALID_REQUEST', 400) from None


def list_addresses():
    if request.args:
        raise service.AddressError('INVALID_REQUEST', 400)
    return jsonify(code='ADDRESSES_LISTED', items=service.list_addresses(g.current_user.MaNguoiDung))


def create_address():
    return jsonify(code='ADDRESS_CREATED', address=service.create_address(g.current_user.MaNguoiDung, payload(AddressSchema))), 201


def update_address(address_id):
    return jsonify(code='ADDRESS_UPDATED', address=service.update_address(g.current_user.MaNguoiDung, address_id, payload(AddressSchema)))


def make_primary(address_id):
    payload(Schema)
    service.make_primary(g.current_user.MaNguoiDung, address_id)
    return jsonify(code='ADDRESS_PRIMARY_UPDATED')


def delete_address(address_id):
    service.delete_address(g.current_user.MaNguoiDung, address_id)
    return jsonify(code='ADDRESS_DELETED')
