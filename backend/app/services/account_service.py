from functools import wraps

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.repositories import account_repository as accounts
from app.repositories import nguoi_dung_repository as users
from app.schemas.account_schema import AccountOutputSchema
from app.services.auth_service import AuthError, check_user


class AccountError(Exception):
    def __init__(self, code, status):
        self.code = code
        self.status = status


def database_operation(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except AccountError:
            accounts.rollback()
            raise
        except IntegrityError as error:
            accounts.rollback()
            if getattr(error.orig, 'sqlstate', None) == '23505':
                raise AccountError('ACCOUNT_PHONE_EXISTS', 409) from None
            raise AccountError('DATABASE_UNAVAILABLE', 503) from None
        except SQLAlchemyError:
            accounts.rollback()
            raise AccountError('DATABASE_UNAVAILABLE', 503) from None
    return wrapped


def require_internal(account_id):
    account = accounts.find_internal(account_id)
    if account is None or account.VaiTro not in (1, 2):
        raise AccountError('ACCOUNT_NOT_FOUND', 404)
    return account


def lock_and_recheck_actor(actor_id):
    accounts.lock_writes()
    try:
        actor = check_user(accounts.find_by_id(actor_id))
    except AuthError as error:
        raise AccountError(error.code, error.status) from None
    if actor.VaiTro != 2:
        raise AccountError('FORBIDDEN', 403)


def check_phone(phone, exclude_id=None):
    existing = users.find_by_phone(phone)
    if existing is not None and existing.MaNguoiDung != exclude_id:
        raise AccountError('ACCOUNT_PHONE_EXISTS', 409)


def protect_last_manager(account):
    if account.VaiTro == 2 and not account.TrangThai and accounts.count_active_managers() <= 1:
        raise AccountError('LAST_ACTIVE_MANAGER', 409)


@database_operation
def list_accounts(search, page, per_page, role=None, status=None):
    rows, total = accounts.list_accounts(search, page, per_page, role, status)
    return dict(items=AccountOutputSchema(many=True).dump(rows), page=page, per_page=per_page,
                total=total, pages=(total + per_page - 1) // per_page)


@database_operation
def get_account(account_id):
    return AccountOutputSchema().dump(require_internal(account_id))


@database_operation
def create_account(actor_id, data):
    lock_and_recheck_actor(actor_id)
    check_phone(data['SDT'])
    result = AccountOutputSchema().dump(accounts.create(data))
    accounts.commit()
    return result


@database_operation
def update_account(actor_id, account_id, data):
    lock_and_recheck_actor(actor_id)
    account = require_internal(account_id)
    if account_id == actor_id and data['VaiTro'] != 2:
        raise AccountError('CANNOT_DEMOTE_SELF', 409)
    if account.VaiTro == 2 and data['VaiTro'] == 1:
        protect_last_manager(account)
    check_phone(data['SDT'], exclude_id=account_id)
    result = AccountOutputSchema().dump(accounts.update(account, data))
    accounts.commit()
    return result


@database_operation
def set_status(actor_id, account_id, locked):
    lock_and_recheck_actor(actor_id)
    account = require_internal(account_id)
    if locked and account_id == actor_id:
        raise AccountError('CANNOT_LOCK_SELF', 409)
    if locked:
        protect_last_manager(account)
    result = AccountOutputSchema().dump(accounts.set_status(account, locked))
    accounts.commit()
    return result
