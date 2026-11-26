"""Điều phối HTTP cho Mobile JWT, không truy cập Flask session/cookie."""
from functools import wraps

from flask import jsonify, request
from marshmallow import ValidationError
from app.schemas.auth_schema import OtpRequestSchema

from app.schemas.mobile_auth_schema import (
    MobileOtpVerifySchema, MobileRegisterSchema, MobileRefreshSchema,
)
from app.services import mobile_auth_service
from app.services.otp_service import AuthError


def payload(schema):
    def decorate(view):
        @wraps(view)
        def wrapped():
            if not request.is_json:
                return jsonify(code="JSON_REQUIRED"), 415
            body = request.get_json(silent=True)
            if not isinstance(body, dict):
                return jsonify(code="INVALID_REQUEST"), 400
            try:
                data = schema().load(body)
            except ValidationError:
                return jsonify(code="INVALID_REQUEST"), 400
            return jsonify(view(data))
        return wrapped
    return decorate


@payload(OtpRequestSchema)
def request_otp(data):
    return mobile_auth_service.request_otp(data["phone"], request.remote_addr or "unknown")


@payload(MobileOtpVerifySchema)
def verify_otp(data):
    return mobile_auth_service.verify_otp(data["challenge_token"], data["otp"],
                                          request.remote_addr or "unknown")


@payload(MobileRegisterSchema)
def register(data):
    return mobile_auth_service.register(data["registration_token"], data["ho_ten"])


def me():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer ") or not header[7:].strip():
        raise AuthError("UNAUTHENTICATED", 401)
    return jsonify(mobile_auth_service.me(header[7:].strip()))


@payload(MobileRefreshSchema)
def refresh(data):
    return mobile_auth_service.refresh(data["refresh_token"])


@payload(MobileRefreshSchema)
def logout(data):
    return mobile_auth_service.logout(data["refresh_token"])
