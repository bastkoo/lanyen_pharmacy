from functools import wraps

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.extensions import db
from app.repositories import dia_chi_repository as addresses
from app.repositories import nguoi_dung_repository as users
from app.schemas.address_schema import AddressOutputSchema
from app.services.auth_service import AuthError, check_user


class AddressError(Exception):
    def __init__(self, code, status):
        self.code, self.status = code, status


def operation(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except (AddressError, AuthError):
            db.session.rollback()
            raise
        except IntegrityError as error:
            db.session.rollback()
            code = 'ADDRESS_IN_USE' if getattr(error.orig, 'sqlstate', None) == '23503' else 'DATABASE_UNAVAILABLE'
            raise AddressError(code, 409 if code == 'ADDRESS_IN_USE' else 503) from None
        except SQLAlchemyError:
            db.session.rollback()
            raise AddressError('DATABASE_UNAVAILABLE', 503) from None
    return wrapped


def locked_rows(user_id):
    # Lock the owner even for an empty address book; all writes share this lock.
    check_user(users.lock_by_id(user_id))
    return addresses.list_owned(user_id)


def owned(rows, address_id):
    item = next((row for row in rows if row.MaDiaChi == address_id), None)
    if item is None:
        raise AddressError('ADDRESS_NOT_FOUND', 404)
    return item


def select_primary(rows, chosen=None):
    if rows:
        chosen = chosen or next((row for row in rows if row.DiaChiGiao), rows[0])
        for row in rows:
            row.DiaChiGiao = row is chosen


@operation
def list_addresses(user_id):
    rows = addresses.list_owned(user_id)
    return AddressOutputSchema(many=True).dump(sorted(rows, key=lambda row: (not row.DiaChiGiao, row.MaDiaChi)))


@operation
def create_address(user_id, data):
    rows = locked_rows(user_id)
    select_primary(rows)
    item = addresses.create(user_id, data, primary=not rows)
    db.session.flush()
    result = AddressOutputSchema().dump(item)
    db.session.commit()
    return result


@operation
def update_address(user_id, address_id, data):
    rows = locked_rows(user_id)
    item = owned(rows, address_id)
    addresses.update(item, data)
    select_primary(rows)
    result = AddressOutputSchema().dump(item)
    db.session.commit()
    return result


@operation
def make_primary(user_id, address_id):
    rows = locked_rows(user_id)
    item = owned(rows, address_id)
    select_primary(rows, item)
    db.session.commit()


@operation
def delete_address(user_id, address_id):
    rows = locked_rows(user_id)
    item = owned(rows, address_id)
    remaining = [row for row in rows if row is not item]
    # MaDiaChi order is creation order; the oldest remaining address is promoted.
    select_primary(remaining, remaining[0] if item.DiaChiGiao and remaining else None)
    addresses.remove(item)
    db.session.commit()
