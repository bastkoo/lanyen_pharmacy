import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class Config:
    GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
    GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
    SEPAY_ENV = os.getenv('SEPAY_ENV', 'sandbox')
    SEPAY_FRONTEND_ORIGIN = os.getenv('SEPAY_FRONTEND_ORIGIN', '')
    SEPAY_PRODUCTION_ENABLED = os.getenv('SEPAY_PRODUCTION_ENABLED', 'false').lower() == 'true'
    SEPAY_SANDBOX_MERCHANT_ID = os.getenv('SEPAY_SANDBOX_MERCHANT_ID', '')
    SEPAY_SANDBOX_SECRET_KEY = os.getenv('SEPAY_SANDBOX_SECRET_KEY', '')
    SEPAY_SANDBOX_IPN_SECRET_KEY = os.getenv('SEPAY_SANDBOX_IPN_SECRET_KEY', '')
    SEPAY_SANDBOX_CHECKOUT_URL = os.getenv('SEPAY_SANDBOX_CHECKOUT_URL', 'https://pay-sandbox.sepay.vn/v1/checkout/init')
    SEPAY_SANDBOX_API_BASE_URL = os.getenv('SEPAY_SANDBOX_API_BASE_URL', 'https://pgapi-sandbox.sepay.vn')
    SEPAY_PRODUCTION_MERCHANT_ID = os.getenv('SEPAY_PRODUCTION_MERCHANT_ID', '')
    SEPAY_PRODUCTION_SECRET_KEY = os.getenv('SEPAY_PRODUCTION_SECRET_KEY', '')
    SEPAY_PRODUCTION_IPN_SECRET_KEY = os.getenv('SEPAY_PRODUCTION_IPN_SECRET_KEY', '')
    SEPAY_PRODUCTION_CHECKOUT_URL = os.getenv('SEPAY_PRODUCTION_CHECKOUT_URL', 'https://pay.sepay.vn/v1/checkout/init')
    SEPAY_PRODUCTION_API_BASE_URL = os.getenv('SEPAY_PRODUCTION_API_BASE_URL', 'https://pgapi.sepay.vn')
    SEPAY_PRODUCTION_SUCCESS_URL = os.getenv('SEPAY_PRODUCTION_SUCCESS_URL', '')
    SEPAY_PRODUCTION_ERROR_URL = os.getenv('SEPAY_PRODUCTION_ERROR_URL', '')
    SEPAY_PRODUCTION_CANCEL_URL = os.getenv('SEPAY_PRODUCTION_CANCEL_URL', '')
    # Old unprefixed Gateway variables remain a sandbox-only compatibility group.
    SEPAY_MERCHANT_ID = os.getenv('SEPAY_MERCHANT_ID', '')
    SEPAY_SECRET_KEY = os.getenv('SEPAY_SECRET_KEY', '')
    SEPAY_IPN_SECRET_KEY = os.getenv('SEPAY_IPN_SECRET_KEY', '')
    SEPAY_CHECKOUT_URL = os.getenv('SEPAY_CHECKOUT_URL', 'https://pay-sandbox.sepay.vn/v1/checkout/init')
    SEPAY_API_BASE_URL = os.getenv('SEPAY_API_BASE_URL', 'https://pgapi-sandbox.sepay.vn')
    SEPAY_SUCCESS_URL = os.getenv('SEPAY_SUCCESS_URL', '')
    SEPAY_ERROR_URL = os.getenv('SEPAY_ERROR_URL', '')
    SEPAY_CANCEL_URL = os.getenv('SEPAY_CANCEL_URL', '')
    SEPAY_BANK = os.getenv('SEPAY_BANK', '')
    SEPAY_ACCOUNT_NUMBER = os.getenv('SEPAY_ACCOUNT_NUMBER', '')
    SEPAY_ACCOUNT_NAME = os.getenv('SEPAY_ACCOUNT_NAME', '')
    SEPAY_WEBHOOK_API_KEY = os.getenv('SEPAY_WEBHOOK_API_KEY', '')
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
    # Origin bổ sung chỉ cho API Mobile JWT, không mở rộng CORS của Web.
    MOBILE_AUTH_ALLOWED_ORIGINS = [
        origin.strip().rstrip('/')
        for origin in os.getenv('MOBILE_AUTH_ALLOWED_ORIGINS', '').split(',')
        if origin.strip() and origin.strip() != '*'
    ]
    SESSION_COOKIE_NAME = "lanyen_session"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
    SESSION_REFRESH_EACH_REQUEST = False

    # Payment environment never selects or changes the application's database.
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
