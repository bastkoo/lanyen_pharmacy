from flask import Blueprint, jsonify, session

from app.controllers import account_controller as controller
from app.services.account_service import AccountError
from app.utils.auth import csrf_protect, csrf_token, require_roles


account_bp = Blueprint('accounts', __name__, url_prefix='/api/manager/accounts')
for path, method, view in (
    ('', 'GET', controller.list_accounts),
    ('/<int:account_id>', 'GET', controller.get_account),
    ('', 'POST', controller.create_account),
    ('/<int:account_id>', 'PUT', controller.update_account),
    ('/<int:account_id>/status', 'PATCH', controller.set_status),
):
    if method != 'GET':
        view = csrf_protect(view)
    account_bp.add_url_rule(path, view_func=require_roles(2)(view), methods=[method])


@account_bp.errorhandler(AccountError)
def account_error(error):
    # Account permissions may change while a write waits for its database lock.
    if error.code in ('UNAUTHENTICATED', 'ACCOUNT_LOCKED'):
        session.clear()
        return jsonify(code=error.code, csrf_token=csrf_token()), error.status
    return jsonify(code=error.code), error.status


@account_bp.after_request
def no_store(response):
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
