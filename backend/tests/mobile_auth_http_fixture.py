"""HTTP fixture riêng cho test Flutter; tuyệt đối không chạy bằng entrypoint Web."""
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis
from werkzeug.serving import make_server

from app import create_app

users = {}
for index, role in enumerate((0, 1, 2), start=7):
    phone = "+8490123456" + str(index)
    users[phone] = SimpleNamespace(MaNguoiDung=index, HoTen="Tài khoản HTTP fixture",
        SDT=phone, VaiTro=role, TrangThai=False, Email=None, AnhDaiDien=None)


def create_customer(phone, name):
    users[phone] = SimpleNamespace(MaNguoiDung=20, HoTen=name, SDT=phone, VaiTro=0,
                                  TrangThai=False, Email=None, AnhDaiDien=None)
    return users[phone]


def main():
    app = create_app({"TESTING": True, "SECRET_KEY": "http-fixture-only-" * 4,
        "SQLALCHEMY_DATABASE_URI": "postgresql+psycopg://unused:unused@localhost/unused",
        "APP_ENV": "development", "OTP_DEV_ENABLED": True,
        "AUTH_ALLOWED_ORIGINS": [], "SESSION_COOKIE_SECURE": False})
    app.extensions["otp_redis"] = fakeredis.FakeRedis(decode_responses=True)
    app.add_url_rule("/__mobile_auth_fixture",
        view_func=lambda: {"fixture": "isolated-mobile-jwt-v1"})
    with patch("app.services.auth_service.users.find_by_phone", side_effect=users.get), \
         patch("app.services.auth_service.users.find_by_id",
               side_effect=lambda key: next((u for u in users.values() if u.MaNguoiDung == key), None)), \
         patch("app.services.auth_service.users.create_customer", side_effect=create_customer), \
         patch("app.services.otp_service.secrets.randbelow", return_value=123456):
        server = make_server("127.0.0.1", 0, app)
        print("MOBILE_AUTH_FIXTURE_PORT=" + str(server.server_port), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()


if __name__ == "__main__":
    main()
