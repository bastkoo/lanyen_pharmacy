"""Xác thực JWT riêng cho Mobile; không đọc hoặc sửa Flask session của Web."""
import hashlib
import hmac
import secrets
from datetime import datetime, timezone

import jwt
from flask import current_app

from app.schemas.auth_schema import UserSchema
from app.services import auth_service, otp_service

ACCESS_SECONDS = 15 * 60
REFRESH_SECONDS = 8 * 60 * 60
ISSUER = "lanyen-mobile"
AUDIENCE = "lanyen-mobile-app"


def signing_key():
    # Tách mục đích khóa ký, không dùng JWT_SECRET_KEY mặc định của Web.
    secret = current_app.config["SECRET_KEY"]
    return hmac.new(secret.encode(), b"lanyen/mobile/jwt/v1", hashlib.sha256).digest()


def encode(kind, subject, lifetime, **extra):
    now = int(datetime.now(timezone.utc).timestamp())
    claims = dict(iss=ISSUER, aud=AUDIENCE, sub=str(subject), iat=now,
                  nbf=now, exp=now + lifetime, jti=secrets.token_urlsafe(32),
                  kind=kind, **extra)
    return jwt.encode(claims, signing_key(), algorithm="HS256"), claims


def decode(token, kind):
    try:
        claims = jwt.decode(token, signing_key(), algorithms=["HS256"],
                            audience=AUDIENCE, issuer=ISSUER,
                            options={"require": ["exp", "iat", "nbf", "sub", "jti", "kind"]})
        if claims["kind"] != kind or not isinstance(claims["jti"], str):
            raise jwt.InvalidTokenError()
        return claims
    except jwt.ExpiredSignatureError:
        raise otp_service.AuthError("TOKEN_EXPIRED", 401) from None
    except (jwt.InvalidTokenError, TypeError, ValueError):
        raise otp_service.AuthError("INVALID_TOKEN", 401) from None


CREATE_SESSION = """
redis.call('HSET', KEYS[1], 'user', ARGV[1], 'refresh', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
"""
CHECK_SESSION = """
return redis.call('HGET', KEYS[1], 'user') == ARGV[1] and 1 or 0
"""
ROTATE_SESSION = """
if redis.call('HGET', KEYS[1], 'user') ~= ARGV[1] then return 0 end
if redis.call('HGET', KEYS[1], 'refresh') ~= ARGV[2] then
  redis.call('DEL', KEYS[1])
  return -1
end
redis.call('HSET', KEYS[1], 'refresh', ARGV[3])
return 1
"""
DELETE_SESSION = """
if redis.call('HGET', KEYS[1], 'user') == ARGV[1] then redis.call('DEL', KEYS[1]) end
return 1
"""


def session_key(claims):
    sid = claims.get("sid")
    if not isinstance(sid, str) or len(sid) != 43:
        raise otp_service.AuthError("INVALID_TOKEN", 401)
    return "lanyen:mobile:session:" + sid


def active_user(claims):
    subject = claims["sub"]
    if not subject.isdigit() or int(subject) < 1:
        raise otp_service.AuthError("INVALID_TOKEN", 401)
    key = session_key(claims)
    if otp_service.evaluate(CHECK_SESSION, [key], [subject]) != 1:
        raise otp_service.AuthError("UNAUTHENTICATED", 401)
    try:
        return auth_service.current_user(int(subject))
    except otp_service.AuthError as error:
        if error.code in ("ACCOUNT_LOCKED", "FORBIDDEN", "UNAUTHENTICATED"):
            otp_service.evaluate(DELETE_SESSION, [key], [subject])
        raise


def token_pair(user, sid=None, refresh_exp=None):
    now = int(datetime.now(timezone.utc).timestamp())
    sid = sid or secrets.token_urlsafe(32)
    refresh_exp = refresh_exp or now + REFRESH_SECONDS
    remaining = refresh_exp - now
    if remaining <= 0:
        raise otp_service.AuthError("TOKEN_EXPIRED", 401)
    access, _ = encode("access", user.MaNguoiDung, min(ACCESS_SECONDS, remaining), sid=sid)
    refresh, claims = encode("refresh", user.MaNguoiDung, remaining, sid=sid)
    return dict(code="AUTHENTICATED", user=UserSchema().dump(user),
                token_type="Bearer", access_token=access, refresh_token=refresh,
                expires_in=min(ACCESS_SECONDS, remaining)), claims


def authenticated(user):
    result, claims = token_pair(user)
    otp_service.evaluate(CREATE_SESSION, [session_key(claims)],
                         [claims["sub"], otp_service.digest(claims["jti"]), REFRESH_SECONDS])
    return result


def request_otp(phone, ip):
    phone = otp_service.normalize_phone(phone)
    result = otp_service.request_otp(phone, ip)
    token, _ = encode("otp_challenge", phone, current_app.config["OTP_TTL_SECONDS"],
                      binding=secrets.token_urlsafe(32))
    return dict(result, challenge_token=token)


def verify_otp(challenge_token, code, ip):
    claims = decode(challenge_token, "otp_challenge")
    phone = otp_service.normalize_phone(claims["sub"])
    proof = otp_service.verify_otp(phone, code, ip, claims["binding"])
    user = auth_service.login_phone(phone)
    if user is None:
        token, _ = encode("registration", phone, 300, binding=claims["binding"], proof=proof)
        return dict(code="PROFILE_REQUIRED", registration_token=token)
    otp_service.consume_proof(proof, claims["binding"])
    return authenticated(user)


def register(registration_token, name):
    claims = decode(registration_token, "registration")
    phone = otp_service.consume_proof(claims["proof"], claims["binding"])
    return authenticated(auth_service.login_phone(phone, name))


def me(access_token):
    user = active_user(decode(access_token, "access"))
    return dict(code="AUTHENTICATED", user=UserSchema().dump(user))


def refresh(refresh_token):
    claims = decode(refresh_token, "refresh")
    user = active_user(claims)
    result, new_claims = token_pair(user, sid=claims["sid"], refresh_exp=claims["exp"])
    rotated = otp_service.evaluate(ROTATE_SESSION, [session_key(claims)],
                                  [claims["sub"], otp_service.digest(claims["jti"]),
                                   otp_service.digest(new_claims["jti"])])
    if rotated != 1:
        raise otp_service.AuthError("UNAUTHENTICATED", 401)
    return result


def logout(refresh_token):
    claims = decode(refresh_token, "refresh")
    # Thu hồi cả family, access token cũ cũng không dùng được sau logout.
    otp_service.evaluate(DELETE_SESSION, [session_key(claims)], [claims["sub"]])
    return dict(code="LOGGED_OUT")
