
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.repositories import nguoi_dung_repository as users
from app.services.otp_service import AuthError


def check_user(user):
    if user is None:
        raise AuthError('UNAUTHENTICATED', 401)
    if user.TrangThai:
        raise AuthError('ACCOUNT_LOCKED', 403)
    if user.VaiTro not in (0, 1, 2):
        raise AuthError('FORBIDDEN', 403)
    return user


def login_phone(phone, ho_ten=None):
    try:
        user = users.find_by_phone(phone)
        if user is None:
            if ho_ten is None:
                return None
            user = users.create_customer(phone, ho_ten.strip())
        return check_user(user)
    except SQLAlchemyError:
        db.session.rollback()
        raise AuthError('DATABASE_UNAVAILABLE', 503) from None


def current_user(user_id):
    try:
        return check_user(users.find_by_id(user_id))
    except SQLAlchemyError:
        db.session.rollback()
        raise AuthError('DATABASE_UNAVAILABLE', 503) from None
