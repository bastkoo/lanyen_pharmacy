"""Kiểm thử Mobile JWT với Redis giả lập và repositories mock; không ghi DB."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis
import jwt

from app import create_app
from app.services import mobile_auth_service as service

PHONE = "+84901234567"


def account(role=0, locked=False):
    return SimpleNamespace(MaNguoiDung=42, HoTen="Tài khoản kiểm thử", SDT=PHONE,
                           VaiTro=role, TrangThai=locked, Email=None, AnhDaiDien=None)


class MobileAuthTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "SECRET_KEY": "isolated-test-secret-" * 3,
            "SQLALCHEMY_DATABASE_URI": "postgresql+psycopg://unused:unused@localhost/unused",
            "APP_ENV": "development", "OTP_DEV_ENABLED": True,
            "SESSION_COOKIE_SECURE": False,
            "AUTH_ALLOWED_ORIGINS": ["http://127.0.0.1:5500"],
            "MOBILE_AUTH_ALLOWED_ORIGINS": ["http://127.0.0.1:5510"],
        })
        self.app.extensions["otp_redis"] = fakeredis.FakeRedis(decode_responses=True)
        self.client = self.app.test_client()
        self.find = self.start_patch("app.services.auth_service.users.find_by_phone", return_value=account())
        self.current = self.start_patch("app.services.auth_service.users.find_by_id", return_value=account())
        self.create = self.start_patch("app.services.auth_service.users.create_customer", return_value=account())
        self.start_patch("app.services.otp_service.secrets.randbelow", return_value=123456)
        self.start_patch("builtins.print")

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def post(self, path, body):
        return self.client.post("/api/mobile/auth/" + path, json=body)

    def issue(self):
        result = self.post("otp/request", {"phone": "0901234567"})
        self.assertEqual(result.status_code, 200)
        return result.json["challenge_token"]

    def login(self):
        return self.post("otp/verify", {"challenge_token": self.issue(), "otp": "123456"})

    def me(self, token):
        return self.client.get("/api/mobile/auth/me", headers={"Authorization": "Bearer " + token})

    def test_existing_user_token_pair_no_cookie_or_csrf(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("Set-Cookie", response.headers)
        self.assertNotIn("csrf_token", response.json)
        self.assertEqual(response.json["user"]["VaiTro"], 0)
        self.assertEqual(response.json["token_type"], "Bearer")
        self.assertEqual(response.json["expires_in"], 900)
        self.assertEqual(self.me(response.json["access_token"]).status_code, 200)
        self.create.assert_not_called()

    def test_otp_response_never_exposes_code(self):
        result = self.post("otp/request", {"phone": PHONE})
        self.assertNotIn("123456", result.get_data(as_text=True))
        self.assertEqual(result.json["retry_after"], 60)
        self.assertEqual(result.json["expires_in"], 300)
        self.assertNotIn("Set-Cookie", result.headers)

    def test_new_user_register_requires_one_time_proof_and_name(self):
        self.find.return_value = None
        result = self.login()
        self.assertEqual(result.json["code"], "PROFILE_REQUIRED")
        token = result.json["registration_token"]
        for invalid in [{}, {"ho_ten": " "}, {"ho_ten": "A", "VaiTro": 2}]:
            payload = dict(invalid, registration_token=token)
            self.assertEqual(self.post("register", payload).status_code, 400)
        self.create.assert_not_called()
        response = self.post("register", {"registration_token": token, "ho_ten": "  Nguyễn An  "})
        self.assertEqual(response.status_code, 200)
        self.create.assert_called_once_with(PHONE, "Nguyễn An")
        self.assertEqual(self.post("register", {"registration_token": token, "ho_ten": "An"}).status_code, 401)

    def test_incorrect_code_attempts_expiry_and_replay(self):
        challenge = self.issue()
        for _ in range(4):
            self.assertEqual(self.post("otp/verify", {"challenge_token": challenge, "otp": "000000"}).json["code"], "OTP_INVALID")
        self.assertEqual(self.post("otp/verify", {"challenge_token": challenge, "otp": "000000"}).json["code"], "OTP_ATTEMPTS_EXCEEDED")
        self.assertEqual(self.post("otp/verify", {"challenge_token": challenge, "otp": "123456"}).json["code"], "OTP_EXPIRED")
        self.find.assert_not_called()

    def test_resend_is_rate_limited(self):
        self.issue()
        self.assertEqual(self.post("otp/request", {"phone": PHONE}).status_code, 429)

    def test_otp_proof_is_bound_to_challenge(self):
        self.find.return_value = None
        first = self.issue()
        with self.app.app_context():
            second, _ = service.encode("otp_challenge", PHONE, 300, binding="different-binding")
        response = self.post("otp/verify", {"challenge_token": second, "otp": "123456"})
        token = response.json["registration_token"]
        with self.app.app_context():
            claims = service.decode(token, "registration")
            claims["binding"] = service.decode(first, "otp_challenge")["binding"]
            altered = jwt.encode(claims, service.signing_key(), algorithm="HS256")
        self.assertEqual(self.post("register", {"registration_token": altered, "ho_ten": "An"}).status_code, 401)

    def test_access_token_expiry_tampering_and_type(self):
        tokens = self.login().json
        self.assertEqual(self.me(tokens["access_token"] + "bad").status_code, 401)
        self.assertEqual(self.me(tokens["refresh_token"]).status_code, 401)
        with self.app.app_context():
            claims = service.decode(tokens["access_token"], "access")
            expired, _ = service.encode("access", "42", -1, sid=claims["sid"])
            wrong_aud = dict(claims, aud="wrong-audience")
            wrong = jwt.encode(wrong_aud, service.signing_key(), algorithm="HS256")
        self.assertEqual(self.me(expired).json["code"], "TOKEN_EXPIRED")
        self.assertEqual(self.me(wrong).status_code, 401)

    def test_refresh_rotation_and_reuse_revoke_whole_family(self):
        old = self.login().json
        renewed = self.post("refresh", {"refresh_token": old["refresh_token"]})
        self.assertEqual(renewed.status_code, 200)
        self.assertNotEqual(old["refresh_token"], renewed.json["refresh_token"])
        self.assertEqual(self.me(renewed.json["access_token"]).status_code, 200)
        self.assertEqual(self.post("refresh", {"refresh_token": old["refresh_token"]}).status_code, 401)
        self.assertEqual(self.me(renewed.json["access_token"]).status_code, 401)

    def test_logout_revokes_access_and_refresh(self):
        tokens = self.login().json
        self.assertEqual(self.post("logout", {"refresh_token": tokens["refresh_token"]}).status_code, 200)
        self.assertEqual(self.me(tokens["access_token"]).status_code, 401)
        self.assertEqual(self.post("refresh", {"refresh_token": tokens["refresh_token"]}).status_code, 401)

    def test_roles_and_locks_are_read_from_database_each_time(self):
        tokens = self.login().json
        for role in (0, 1, 2):
            self.current.return_value = account(role)
            response = self.me(tokens["access_token"])
            self.assertEqual(response.json["user"]["VaiTro"], role)
        self.current.return_value = account(locked=True)
        self.assertEqual(self.me(tokens["access_token"]).json["code"], "ACCOUNT_LOCKED")
        self.current.return_value = account()
        self.assertEqual(self.me(tokens["access_token"]).status_code, 401)

    def test_unknown_or_locked_role_cannot_login(self):
        self.find.return_value = account(99)
        self.assertEqual(self.login().status_code, 403)
        self.app.extensions["otp_redis"].flushall()
        self.find.return_value = account(locked=True)
        self.assertEqual(self.login().status_code, 403)

    def test_web_cookie_not_required_or_changed_and_bearer_does_not_log_web_in(self):
        anonymous = self.client.get("/api/auth/me")
        cookie = self.client.get_cookie("lanyen_session").value
        tokens = self.login().json
        self.assertEqual(self.client.get_cookie("lanyen_session").value, cookie)
        self.assertEqual(self.me(tokens["access_token"]).status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me",
            headers={"Authorization": "Bearer " + tokens["access_token"]}).status_code, 401)
        self.assertIn("csrf_token", anonymous.json)
        self.assertEqual(self.client.get("/api/mobile/auth/me").status_code, 401)

    def test_mobile_cors_only_adds_mobile_origin_and_authorization(self):
        headers = {"Origin": "http://127.0.0.1:5510",
                   "Access-Control-Request-Method": "GET",
                   "Access-Control-Request-Headers": "Authorization"}
        response = self.client.options("/api/mobile/auth/me", headers=headers)
        self.assertEqual(response.headers["Access-Control-Allow-Origin"], headers["Origin"])
        self.assertIn("Authorization", response.headers["Access-Control-Allow-Headers"])
        web = self.client.options("/api/auth/me", headers=headers)
        self.assertNotIn("Access-Control-Allow-Origin", web.headers)
        headers["Origin"] = "https://evil.example"
        self.assertNotIn("Access-Control-Allow-Origin",
            self.client.options("/api/mobile/auth/me", headers=headers).headers)

    def test_invalid_json_payload_and_oversized_body(self):
        self.assertEqual(self.post("otp/request", {"phone": "abc"}).status_code, 400)
        self.assertEqual(self.post("otp/verify", {"challenge_token": "x", "otp": "12345"}).status_code, 400)
        response = self.client.post("/api/mobile/auth/otp/request", data="{}", content_type="text/plain")
        self.assertEqual(response.status_code, 415)
        self.assertEqual(self.post("otp/request", {"phone": "x" * 20000}).status_code, 413)

    def test_redis_failure_does_not_expose_internal_error(self):
        from redis import RedisError
        self.app.extensions["otp_redis"].eval = lambda *a: (_ for _ in ()).throw(RedisError("private-secret"))
        response = self.post("otp/request", {"phone": PHONE})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private-secret", response.get_data(as_text=True))

    def test_development_otp_gate_is_preserved(self):
        self.app.config["OTP_DEV_ENABLED"] = False
        self.assertEqual(self.post("otp/request", {"phone": PHONE}).status_code, 503)


if __name__ == "__main__":
    unittest.main()
