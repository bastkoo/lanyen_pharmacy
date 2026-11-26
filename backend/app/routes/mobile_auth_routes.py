"""API Mobile JWT độc lập; giữ nguyên /api/auth của Website."""
from flask import Blueprint, current_app, jsonify, request

from app.controllers import mobile_auth_controller as controller
from app.services.otp_service import AuthError

mobile_auth_bp = Blueprint("mobile_auth", __name__, url_prefix="/api/mobile/auth")
mobile_auth_bp.add_url_rule("/otp/request", view_func=controller.request_otp, methods=["POST"])
mobile_auth_bp.add_url_rule("/otp/verify", view_func=controller.verify_otp, methods=["POST"])
mobile_auth_bp.add_url_rule("/register", view_func=controller.register, methods=["POST"])
mobile_auth_bp.add_url_rule("/me", view_func=controller.me, methods=["GET"])
mobile_auth_bp.add_url_rule("/refresh", view_func=controller.refresh, methods=["POST"])
mobile_auth_bp.add_url_rule("/logout", view_func=controller.logout, methods=["POST"])


@mobile_auth_bp.before_request
def mobile_request_limits():
    request.max_content_length = 16 * 1024
    # API token không dùng cookie ambient, nên không cần CSRF token của Web.
    # Không gọi request.session hoặc thay đổi cookie của Website.


@mobile_auth_bp.errorhandler(AuthError)
def auth_error(error):
    return jsonify(code=error.code), error.status


@mobile_auth_bp.errorhandler(413)
def too_large(error):
    return jsonify(code="INVALID_REQUEST"), 413


@mobile_auth_bp.after_request
def mobile_headers(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    # CORS chỉ bổ sung ở blueprint mới; không thay CORS/Origin của Website.
    origin = request.headers.get("Origin", "")
    allowed = (current_app.config["AUTH_ALLOWED_ORIGINS"] +
               current_app.config.get("MOBILE_AUTH_ALLOWED_ORIGINS", []))
    if origin and origin in allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.vary.add("Origin")
    return response
