from flask import Blueprint

from app.controllers import auth_controller
from app.utils.auth import csrf_protect, require_roles


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
auth_bp.add_url_rule("/firebase", view_func=csrf_protect(auth_controller.firebase_login), methods=["POST"])
auth_bp.add_url_rule("/me", view_func=require_roles(0, 1, 2)(auth_controller.me), methods=["GET"])
auth_bp.add_url_rule("/logout", view_func=csrf_protect(auth_controller.logout), methods=["POST"])


@auth_bp.after_request
def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response
