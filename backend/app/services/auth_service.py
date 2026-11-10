import re

from firebase_admin import auth, exceptions
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError

from app.config.firebase import get_firebase_app
from app.extensions import db
from app.repositories import nguoi_dung_repository as users


class AuthError(Exception):
    def __init__(self, code, status):
        self.code = code
        self.status = status


def verify_phone_token(id_token):
    try:
        firebase_app = get_firebase_app(current_app)
    except Exception:
        # Credential exceptions may include private data; never log them.
        raise AuthError("AUTH_UNAVAILABLE", 503) from None
    try:
        claims = auth.verify_id_token(id_token, app=firebase_app, check_revoked=True)
    except auth.CertificateFetchError:
        raise AuthError("AUTH_UNAVAILABLE", 503) from None
    except (auth.InvalidIdTokenError, auth.RevokedIdTokenError,
            auth.UserDisabledError, auth.UserNotFoundError, ValueError):
        raise AuthError("INVALID_TOKEN", 401) from None
    except exceptions.FirebaseError:
        raise AuthError("AUTH_UNAVAILABLE", 503) from None
    phone = claims.get("phone_number", "")
    if (claims.get("firebase", {}).get("sign_in_provider") != "phone"
            or not isinstance(phone, str)
            or not re.fullmatch(r"\+[1-9][0-9]{1,13}", phone)):
        raise AuthError("PHONE_AUTH_REQUIRED", 401)
    return phone


def check_user(user):
    if user is None:
        raise AuthError("UNAUTHENTICATED", 401)
    if user.TrangThai:
        raise AuthError("ACCOUNT_LOCKED", 403)
    if user.VaiTro not in (0, 1, 2):
        raise AuthError("FORBIDDEN", 403)
    return user


def login(id_token, ho_ten=None):
    phone = verify_phone_token(id_token)
    try:
        user = users.find_by_phone(phone)
        if user is None:
            if ho_ten is None:
                return None
            user = users.create_customer(phone, ho_ten.strip())
        return check_user(user)
    except SQLAlchemyError:
        db.session.rollback()
        raise AuthError("DATABASE_UNAVAILABLE", 503) from None


def current_user(user_id):
    try:
        return check_user(users.find_by_id(user_id))
    except SQLAlchemyError:
        db.session.rollback()
        raise AuthError("DATABASE_UNAVAILABLE", 503) from None
