
from flask import Flask

from app.config.config import Config
from app.extensions import db, migrate, cors, jwt


def create_app():
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)

    # Import models để Flask-Migrate nhận diện các bảng
    from app import models

    migrate.init_app(app, db)
    cors.init_app(app)
    jwt.init_app(app)

    return app
