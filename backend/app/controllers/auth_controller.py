import secrets
from functools import wraps

from flask import g, jsonify, request, session
from marshmallow import ValidationError

from app.schemas.auth_schema import OtpRequestSchema, OtpVerifySchema, RegisterSchema, UserSchema
from app.services import auth_service, otp_service
from app.utils.auth import csrf_token


def payload(schema):
    def decorate(view):
        @wraps(view)
        def wrapped():
            if not request.is_json:
                return jsonify(code='JSON_REQUIRED'), 415
            body = request.get_json(silent=True)
            if not isinstance(body, dict):
                return jsonify(code='INVALID_REQUEST'), 400
            try:
                return view(schema().load(body))
            except ValidationError:
                return jsonify(code='INVALID_REQUEST'), 400
            except auth_service.AuthError as error:
                return jsonify(code=error.code), error.status
        return wrapped
    return decorate


def authenticated(user):
    session.clear()
    session.permanent = True
    session['user_id'] = user.MaNguoiDung
    return jsonify(code='AUTHENTICATED', user=UserSchema().dump(user), csrf_token=csrf_token())


@payload(OtpRequestSchema)
def request_otp(data):
    phone = otp_service.normalize_phone(data['phone'])
    session.pop('verification_proof', None)
    session.setdefault('otp_binding', secrets.token_urlsafe(32))
    return jsonify(otp_service.request_otp(phone, request.remote_addr or 'unknown'))


@payload(OtpVerifySchema)
def verify_otp(data):
    phone = otp_service.normalize_phone(data['phone'])
    binding = session.get('otp_binding')
    if not binding:
        raise auth_service.AuthError('VERIFICATION_EXPIRED', 401)
    proof = otp_service.verify_otp(phone, data['otp'], request.remote_addr or 'unknown', binding)
    session['verification_proof'] = proof
    user = auth_service.login_phone(phone)
    if user is None:
        return jsonify(code='PROFILE_REQUIRED', csrf_token=csrf_token())
    otp_service.consume_proof(proof, binding)
    return authenticated(user)


@payload(RegisterSchema)
def register(data):
    proof = session.pop('verification_proof', None)
    binding = session.get('otp_binding', '')
    if not proof or not binding:
        raise auth_service.AuthError('VERIFICATION_EXPIRED', 401)
    phone = otp_service.consume_proof(proof, binding)
    return authenticated(auth_service.login_phone(phone, data['ho_ten']))


def me():
    return jsonify(code='AUTHENTICATED', user=UserSchema().dump(g.current_user), csrf_token=csrf_token())


def logout():
    session.clear()
    return jsonify(code='LOGGED_OUT')
