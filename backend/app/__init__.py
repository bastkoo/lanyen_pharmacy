
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

    if '*' in app.config['AUTH_ALLOWED_ORIGINS']:
        raise RuntimeError('Explicit frontend origins are required.')
    if app.config['APP_ENV'] != 'development' and app.config['OTP_DEV_ENABLED']:
        raise RuntimeError('Development OTP cannot be enabled outside development.')
    from app.services.otp_service import init_app as init_otp
    init_otp(app)

    # Initialize extensions
    db.init_app(app)

    # Import models so Flask-Migrate can discover the approved tables.
    from app import models

    migrate.init_app(app, db)
    cors.init_app(app, origins=app.config["AUTH_ALLOWED_ORIGINS"],
                  supports_credentials=True, allow_headers=["Content-Type", "X-CSRF-Token"])
    jwt.init_app(app)

    from app.routes.auth_routes import auth_bp
    app.register_blueprint(auth_bp)
    from app.routes.category_routes import category_bp
    app.register_blueprint(category_bp)
    from app.routes.product_routes import product_bp
    app.register_blueprint(product_bp)
    from app.routes.unit_routes import unit_bp
    app.register_blueprint(unit_bp)
    from app.routes.batch_routes import batch_bp, inventory_bp
    app.register_blueprint(batch_bp)
    app.register_blueprint(inventory_bp)

    return app
