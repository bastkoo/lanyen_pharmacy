from flask import jsonify, request
from marshmallow import Schema, fields, validate, ValidationError

from app.controllers.auth_controller import payload
from app.services import cart_service
from app.services.auth_service import AuthError
from app.utils.auth import csrf_token


class CartAddSchema(Schema):
    MaThuoc = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))
    MaDonGia = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))


class CartUpdateSchema(Schema):
    MaDonGia = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))
    SoLuong = fields.Integer(required=True, strict=True, validate=validate.Range(min=1, max=2147483647))


class CartQuoteSchema(Schema):
    MaDonGia = fields.List(fields.Integer(strict=True, validate=validate.Range(min=1, max=2147483647)), required=True,
                          validate=validate.Length(max=1000))


@payload(CartAddSchema)
def add(data):
    return jsonify(cart_service.add_item(data['MaThuoc'], data['MaDonGia']))


def read():
    if request.args:
        return jsonify(code='INVALID_REQUEST'), 400
    try:
        return jsonify(**cart_service.get_cart(), csrf_token=csrf_token())
    except AuthError as error:
        return jsonify(code=error.code), error.status


def remove(unit_id):
    try:
        return jsonify(cart_service.remove_item(unit_id))
    except AuthError as error:
        return jsonify(code=error.code), error.status


def update(unit_id):
    if not request.is_json:
        return jsonify(code='JSON_REQUIRED'), 415
    try:
        data = CartUpdateSchema().load(request.get_json(silent=True))
        return jsonify(cart_service.update_item(unit_id, data['MaDonGia'], data['SoLuong']))
    except ValidationError:
        return jsonify(code='INVALID_REQUEST'), 400
    except AuthError as error:
        return jsonify(code=error.code), error.status


@payload(CartQuoteSchema)
def quote(data):
    return jsonify(cart_service.get_cart(set(data['MaDonGia'])))
