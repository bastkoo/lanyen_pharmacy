
from flask import Flask

from app.config.config import Config
from app.extensions import db, migrate, cors, jwt


def create_app(test_config=None):
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
    if not app.config.get("SECRET_KEY") or len(app.config["SECRET_KEY"]) < 32:
        raise RuntimeError("SECRET_KEY must contain at least 32 characters.")

    # Initialize extensions
    db.init_app(app)

    # Import models để Flask-Migrate nhận diện các bảng
    from app import models

    migrate.init_app(app, db)
    cors.init_app(app, origins=app.config["AUTH_ALLOWED_ORIGINS"],
                  supports_credentials=True, allow_headers=["Content-Type", "X-CSRF-Token"])
    jwt.init_app(app)

    from app.routes.auth_routes import auth_bp
    app.register_blueprint(auth_bp)

    return app
