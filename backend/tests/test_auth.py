"""Isolated API tests: no real Firebase credentials or database data are used."""
import unittest
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from firebase_admin import auth
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.repositories import nguoi_dung_repository as repository
from app.utils.auth import require_roles


def user(role=0, locked=False):
    return SimpleNamespace(MaNguoiDung=12, HoTen="Nguyễn An", SDT="+84901234567",
                           VaiTro=role, TrangThai=locked, Email=None, AnhDaiDien=None)


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "SECRET_KEY": "test-only-secret-" * 3,
            "SQLALCHEMY_DATABASE_URI": "postgresql+psycopg://unused:unused@localhost/unused",
            "SESSION_COOKIE_SECURE": False,
            "AUTH_ALLOWED_ORIGINS": ["https://shop.example"],
        })
        # Test-only route verifies the reusable role guard without adding product APIs.
        self.app.add_url_rule("/test/manager", view_func=require_roles(2)(lambda: {"ok": True}))
        self.client = self.app.test_client()
        self.csrf = self.client.get("/api/auth/me").json["csrf_token"]
        self.firebase_app = patch("app.services.auth_service.get_firebase_app", return_value=object())
        self.verify = patch("app.services.auth_service.auth.verify_id_token", return_value={
            "phone_number": "+84901234567", "firebase": {"sign_in_provider": "phone"}})
        self.find = patch("app.services.auth_service.users.find_by_phone", return_value=user())
        self.create = patch("app.services.auth_service.users.create_customer", return_value=user())
        for mock_patch in (self.firebase_app, self.verify, self.find, self.create):
            mock = mock_patch.start()
            self.addCleanup(mock_patch.stop)
            if mock_patch is self.verify:
                self.verify_mock = mock
            elif mock_patch is self.find:
                self.find_mock = mock
            elif mock_patch is self.create:
                self.create_mock = mock

    def login(self, data=None, **kwargs):
        return self.client.post("/api/auth/firebase", json=data or {"id_token": "valid"},
                                headers={"X-CSRF-Token": self.csrf}, **kwargs)

    def test_existing_user(self):
        result = self.login()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json["user"]["VaiTro"], 0)
        self.find_mock.assert_called_once_with("+84901234567")
        self.assertTrue(self.verify_mock.call_args.kwargs["check_revoked"])
        self.create_mock.assert_not_called()
        self.assertIn("HttpOnly", result.headers["Set-Cookie"])
        self.assertIn("SameSite=Lax", result.headers["Set-Cookie"])
        self.assertEqual(result.headers["Cache-Control"], "no-store")
        with patch("app.services.auth_service.users.find_by_id", return_value=user()):
            self.assertEqual(self.client.get("/api/auth/me").status_code, 200)

    def test_profile_required(self):
        self.find_mock.return_value = None
        result = self.login()
        self.assertEqual(result.json["code"], "PROFILE_REQUIRED")
        self.create_mock.assert_not_called()
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

    def test_complete_profile_after_prompt(self):
        self.find_mock.return_value = None
        self.assertEqual(self.login().json["code"], "PROFILE_REQUIRED")
        self.assertEqual(self.login({"id_token": "valid", "ho_ten": "An"}).status_code, 200)
        self.assertEqual(self.verify_mock.call_count, 2)

    def test_new_user(self):
        self.find_mock.return_value = None
        result = self.login({"id_token": "valid", "ho_ten": "  Nguyễn An  "})
        self.assertEqual(result.status_code, 200)
        self.create_mock.assert_called_once_with("+84901234567", "Nguyễn An")

    def test_invalid_expired_revoked_disabled_tokens(self):
        for error in (auth.InvalidIdTokenError("invalid"), auth.ExpiredIdTokenError("expired", None),
                      auth.RevokedIdTokenError("revoked"), auth.UserDisabledError("disabled")):
            with self.subTest(error=type(error).__name__):
                self.verify_mock.side_effect = error
                self.assertEqual(self.login().status_code, 401)
        self.find_mock.assert_not_called()

    def test_phone_provider_required(self):
        for claims in ({"firebase": {"sign_in_provider": "password"}, "phone_number": "+84901234567"},
                       {"firebase": {"sign_in_provider": "phone"}},
                       {"firebase": {"sign_in_provider": "phone"}, "phone_number": "0901234567"}):
            self.verify_mock.return_value = claims
            self.assertEqual(self.login().json["code"], "PHONE_AUTH_REQUIRED")
        self.find_mock.assert_not_called()

    def test_locked_user(self):
        self.find_mock.return_value = user(locked=True)
        self.assertEqual(self.login().json["code"], "ACCOUNT_LOCKED")
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

    def test_validation_and_mass_assignment(self):
        for payload in ({"id_token": "valid", "ho_ten": "   "},
                        {"id_token": "valid", "ho_ten": "a" * 256},
                        {"id_token": "valid", "VaiTro": 2},
                        {"id_token": "valid", "SDT": "+84999999999"},
                        {"id_token": "valid", "ho_ten": None}, {"ho_ten": "An"}):
            self.assertEqual(self.login(payload).status_code, 400)
        self.verify_mock.assert_not_called()

    def test_csrf_login_and_logout(self):
        for path in ("/api/auth/firebase", "/api/auth/logout"):
            self.assertEqual(self.client.post(path, json={}).status_code, 403)
            self.assertEqual(self.client.post(path, json={}, headers={
                "X-CSRF-Token": self.csrf, "Origin": "https://evil.example"}).status_code, 403)

    def test_logout_rotation_and_anonymous(self):
        result = self.login()
        new_csrf = result.json["csrf_token"]
        self.assertNotEqual(new_csrf, self.csrf)
        self.assertEqual(self.client.post("/api/auth/logout", headers={
            "X-CSRF-Token": self.csrf}).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/logout", headers={
            "X-CSRF-Token": new_csrf}).status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_roles_and_live_account_status(self):
        self.login()
        for role in (0, 1, 2):
            with patch("app.services.auth_service.users.find_by_id", return_value=user(role)):
                self.assertEqual(self.client.get("/api/auth/me").status_code, 200)
                self.assertEqual(self.client.get("/test/manager").status_code, 200 if role == 2 else 403)
        with patch("app.services.auth_service.users.find_by_id", return_value=user(locked=True)):
            self.assertEqual(self.client.get("/api/auth/me").status_code, 403)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_database_error_safe_and_rollback(self):
        self.find_mock.side_effect = SQLAlchemyError("private internal details")
        with patch("app.services.auth_service.db.session.rollback") as rollback:
            result = self.login()
            self.assertEqual(result.status_code, 503)
            self.assertNotIn("private", result.get_data(as_text=True))
            rollback.assert_called_once()

    def test_create_error_rolls_back_without_login(self):
        self.find_mock.return_value = None
        self.create_mock.side_effect = SQLAlchemyError("internal")
        with patch("app.services.auth_service.db.session.rollback") as rollback:
            self.assertEqual(self.login({"id_token": "valid", "ho_ten": "An"}).status_code, 503)
            rollback.assert_called_once()
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

    def test_deleted_user_loses_session(self):
        self.login()
        with patch("app.services.auth_service.users.find_by_id", return_value=None):
            self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        with self.client.session_transaction() as session:
            self.assertNotIn("user_id", session)

    def test_tampered_and_expired_session(self):
        self.login()
        name = self.app.config["SESSION_COOKIE_NAME"]
        cookie = self.client.get_cookie(name).value
        self.client.set_cookie(name, cookie + "tampered")
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        self.client.set_cookie(name, cookie)
        self.app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(seconds=-1)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_json_and_cors(self):
        for body in ("{bad", "[]", "null"):
            result = self.client.post("/api/auth/firebase", data=body,
                                      content_type="application/json",
                                      headers={"X-CSRF-Token": self.csrf})
            self.assertEqual(result.status_code, 400)
        result = self.client.post("/api/auth/firebase", data="text", headers={"X-CSRF-Token": self.csrf})
        self.assertEqual(result.status_code, 415)
        for origin, allowed in (("https://shop.example", True), ("https://evil.example", False)):
            result = self.client.options("/api/auth/firebase", headers={
                "Origin": origin, "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type, X-CSRF-Token"})
            self.assertEqual("Access-Control-Allow-Origin" in result.headers, allowed)
            if allowed:
                self.assertEqual(result.headers["Access-Control-Allow-Credentials"], "true")

    def test_firebase_configuration_error_safe(self):
        with patch("app.services.auth_service.get_firebase_app", side_effect=ValueError("private")):
            result = self.login()
            self.assertEqual(result.status_code, 503)
            self.assertNotIn("private", result.get_data(as_text=True))

    def test_unknown_role_denied(self):
        self.find_mock.return_value = user(99)
        self.assertEqual(self.login().status_code, 403)

    def test_secure_cookie(self):
        self.app.config["SESSION_COOKIE_SECURE"] = True
        self.assertIn("Secure", self.login().headers["Set-Cookie"])

    def test_repository_conflict_statement_and_defaults(self):
        # Verifies SQL/defaults and returns the winner when an insert loses a race.
        winner = user(role=1)
        self.create.stop()
        with self.app.app_context(), patch.object(repository, "find_by_phone", return_value=winner), \
                patch.object(repository.db.session, "execute") as execute, \
                patch.object(repository.db.session, "commit") as commit:
            self.assertIs(repository.create_customer("+84901234567", "An"), winner)
            compiled = execute.call_args.args[0].compile(dialect=postgresql.dialect())
            self.assertIn('ON CONFLICT ("SDT") DO NOTHING', str(compiled))
            self.assertEqual(compiled.params["VaiTro"], 0)
            self.assertIs(compiled.params["TrangThai"], False)
            commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
