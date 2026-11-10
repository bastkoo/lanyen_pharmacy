import secrets
from functools import wraps

from flask import current_app, g, jsonify, request, session

from app.services.auth_service import AuthError, current_user


def csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_urlsafe(32)
    return session["csrf_token"]


def csrf_protect(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        origin = request.headers.get("Origin")
        allowed = current_app.config["AUTH_ALLOWED_ORIGINS"]
        if origin and origin != request.host_url.rstrip("/") and origin not in allowed:
            return jsonify(code="CSRF_FAILED"), 403
        expected = session.get("csrf_token")
        received = request.headers.get("X-CSRF-Token", "")
        if not expected or not secrets.compare_digest(expected.encode(), received.encode()):
            return jsonify(code="CSRF_FAILED"), 403
        return view(*args, **kwargs)
    return wrapped


def require_roles(*roles):
    """Read current role/status from PostgreSQL on every protected request."""
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            try:
                user_id = session.get("user_id")
                if user_id is None:
                    raise AuthError("UNAUTHENTICATED", 401)
                g.current_user = current_user(user_id)
                if roles and g.current_user.VaiTro not in roles:
                    raise AuthError("FORBIDDEN", 403)
            except AuthError as error:
                if error.code in ("UNAUTHENTICATED", "ACCOUNT_LOCKED"):
                    session.clear()
                return jsonify(code=error.code, csrf_token=csrf_token()), error.status
            return view(*args, **kwargs)
        return wrapped
    return decorator
