import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', '')
    CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '')
    CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '')
    APP_ENV = os.getenv('APP_ENV', 'production')
    OTP_DEV_ENABLED = os.getenv('OTP_DEV_ENABLED', 'false').lower() == 'true'
    REDIS_URL = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0')
    OTP_TTL_SECONDS = 300
    SECRET_KEY = os.getenv("SECRET_KEY")
    AUTH_ALLOWED_ORIGINS = [
        origin.strip().rstrip("/")
        for origin in os.getenv("AUTH_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    SESSION_COOKIE_NAME = "lanyen_session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"
    SESSION_COOKIE_SAMESITE = "Lax"
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
    SESSION_REFRESH_EACH_REQUEST = False

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
