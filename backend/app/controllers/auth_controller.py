from flask import g, jsonify, request, session
from marshmallow import ValidationError

from app.schemas.auth_schema import FirebaseLoginSchema, UserSchema
from app.services import auth_service
from app.utils.auth import csrf_token


def firebase_login():
    if not request.is_json:
        return jsonify(code="JSON_REQUIRED"), 415
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(code="INVALID_REQUEST"), 400
    try:
        data = FirebaseLoginSchema().load(payload)
    except ValidationError:
        return jsonify(code="INVALID_REQUEST"), 400
    try:
        user = auth_service.login(**data)
    except auth_service.AuthError as error:
        return jsonify(code=error.code), error.status
    if user is None:
        return jsonify(code="PROFILE_REQUIRED", csrf_token=csrf_token()), 200
    session.clear()
    session.permanent = True
    session["user_id"] = user.MaNguoiDung
    return jsonify(code="AUTHENTICATED", user=UserSchema().dump(user), csrf_token=csrf_token())


def me():
    return jsonify(code="AUTHENTICATED", user=UserSchema().dump(g.current_user), csrf_token=csrf_token())


def logout():
    session.clear()
    return jsonify(code="LOGGED_OUT")
