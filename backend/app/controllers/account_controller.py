from flask import g, jsonify, request
from marshmallow import ValidationError

from app.schemas.account_schema import AccountCreateSchema, AccountQuerySchema, AccountSchema, AccountStatusSchema
from app.services import account_service as service


def payload(schema):
    if not request.is_json:
        raise service.AccountError('JSON_REQUIRED', 415)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise service.AccountError('INVALID_REQUEST', 400)
    try:
        return schema().load(body)
    except ValidationError:
        raise service.AccountError('INVALID_REQUEST', 400) from None


def list_accounts():
    try:
        if any(len(values) != 1 for _, values in request.args.lists()):
            raise ValidationError('Repeated query')
        filters = AccountQuerySchema().load(request.args.to_dict())
    except ValidationError:
        raise service.AccountError('INVALID_REQUEST', 400) from None
    if 'status' in filters:
        filters['status'] = filters['status'] == 'true'
    return jsonify(code='ACCOUNTS_LISTED', **service.list_accounts(**filters))


def get_account(account_id):
    return jsonify(code='ACCOUNT_FOUND', account=service.get_account(account_id))


def create_account():
    return jsonify(code='ACCOUNT_CREATED', account=service.create_account(g.current_user.MaNguoiDung, payload(AccountCreateSchema))), 201


def update_account(account_id):
    return jsonify(code='ACCOUNT_UPDATED', account=service.update_account(g.current_user.MaNguoiDung, account_id, payload(AccountSchema)))


def set_status(account_id):
    data = payload(AccountStatusSchema)
    return jsonify(code='ACCOUNT_STATUS_UPDATED', account=service.set_status(g.current_user.MaNguoiDung, account_id, data['TrangThai']))
