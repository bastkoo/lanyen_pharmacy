"""Loopback-only browser fixture: fake Redis and repository, never real PostgreSQL."""
import secrets
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis
from app import create_app
from app.services import auth_service

app = create_app({
    'SECRET_KEY': secrets.token_urlsafe(48), 'APP_ENV': 'development',
    'OTP_DEV_ENABLED': True, 'SESSION_COOKIE_SECURE': False,
    'AUTH_ALLOWED_ORIGINS': ['http://localhost:5500'],
    'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
})
app.extensions['otp_redis'] = fakeredis.FakeRedis(decode_responses=True)
accounts = {}


def create_customer(phone, name):
    account = SimpleNamespace(MaNguoiDung=1, HoTen=name, SDT=phone, VaiTro=0,
                              TrangThai=False, Email=None, AnhDaiDien=None)
    accounts[phone] = account
    return account


if __name__ == '__main__':
    with patch.object(auth_service.users, 'find_by_phone', side_effect=accounts.get), \
            patch.object(auth_service.users, 'create_customer', side_effect=create_customer), \
            patch.object(auth_service.users, 'find_by_id', side_effect=lambda uid: next(
                (u for u in accounts.values() if u.MaNguoiDung == uid), None)), \
            patch('app.services.otp_service.secrets.randbelow', return_value=123456):
        app.run(host='127.0.0.1', port=5001, debug=False, use_reloader=False)
