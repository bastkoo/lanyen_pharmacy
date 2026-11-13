"""API + actual Lua scripts against isolated Redis emulation; no database writes."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis
from redis import ConnectionError
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.repositories import nguoi_dung_repository as repository
from app.services import otp_service
from app.utils.auth import require_roles

PHONE = '+84901234567'


def user(role=0, locked=False):
    return SimpleNamespace(MaNguoiDung=12, HoTen='Nguyễn An', SDT=PHONE,
                           VaiTro=role, TrangThai=locked, Email=None, AnhDaiDien=None)


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'test-only-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': True,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.redis = fakeredis.FakeRedis(decode_responses=True)
        self.app.extensions['otp_redis'] = self.redis
        self.app.add_url_rule('/test/manager', view_func=require_roles(2)(lambda: {'ok': True}))
        self.client = self.app.test_client()
        self.csrf = self.client.get('/api/auth/me').json['csrf_token']
        self.find = self.start_patch('app.services.auth_service.users.find_by_phone', return_value=user())
        self.create = self.start_patch('app.services.auth_service.users.create_customer', return_value=user())
        self.start_patch('app.services.otp_service.secrets.randbelow', return_value=123456)
        self.output = self.start_patch('builtins.print')

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        result = patcher.start()
        if target.endswith('create_customer'):
            self.create_patcher = patcher
        self.addCleanup(patcher.stop)
        return result

    def post(self, path, data):
        result = self.client.post('/api/auth/' + path, json=data,
                                  headers={'X-CSRF-Token': self.csrf})
        if result.json and 'csrf_token' in result.json:
            self.csrf = result.json['csrf_token']
        return result

    def issue(self):
        return self.post('otp/request', {'phone': '090 123 4567'})

    def verify(self, otp='123456'):
        return self.post('otp/verify', {'phone': PHONE, 'otp': otp})

    def login(self):
        self.issue()
        return self.verify()

    def test_issue_hash_ttl_and_no_code_response(self):
        result = self.issue()
        self.assertEqual(result.status_code, 200)
        self.assertNotIn('123456', result.get_data(as_text=True))
        key = next(k for k in self.redis.scan_iter('lanyen:otp:*') if not k.endswith(':cooldown'))
        self.assertGreater(self.redis.ttl(key), 290)
        self.assertNotIn('123456', str(self.redis.hgetall(key)))
        self.assertNotIn(PHONE, key)
        self.output.assert_called_once()

    def test_existing_user_and_cookie(self):
        result = self.login()
        self.assertEqual(result.json['code'], 'AUTHENTICATED')
        self.find.assert_called_once_with(PHONE)
        self.create.assert_not_called()
        for flag in ('HttpOnly', 'SameSite=Lax'):
            self.assertIn(flag, result.headers['Set-Cookie'])
        self.assertEqual(result.headers['Cache-Control'], 'no-store')
        self.assertEqual(list(self.redis.scan_iter('lanyen:proof:*')), [])

    def test_wrong_attempt_limit(self):
        self.issue()
        for _ in range(4):
            self.assertEqual(self.verify('000000').json['code'], 'OTP_INVALID')
        self.assertEqual(self.verify('000000').json['code'], 'OTP_ATTEMPTS_EXCEEDED')
        self.assertEqual(self.verify().json['code'], 'OTP_EXPIRED')
        self.find.assert_not_called()

    def test_expired_otp(self):
        self.issue()
        for key in self.redis.scan_iter('lanyen:otp:*'):
            self.redis.expire(key, 0)
        self.assertEqual(self.verify().json['code'], 'OTP_EXPIRED')

    def test_replay(self):
        self.login()
        self.assertEqual(self.verify().status_code, 401)
        self.assertEqual(self.find.call_count, 1)

    def test_resend_cooldown_replaces_code(self):
        self.issue()
        self.assertEqual(self.issue().status_code, 429)
        for key in self.redis.scan_iter('*:cooldown'):
            self.redis.delete(key)
        with patch('app.services.otp_service.secrets.randbelow', return_value=654321):
            self.assertEqual(self.issue().status_code, 200)
        self.assertEqual(self.verify().json['code'], 'OTP_INVALID')
        self.assertEqual(self.verify('654321').status_code, 200)

    def test_request_limits_survive_resends(self):
        for _ in range(5):
            self.issue()
            for key in self.redis.scan_iter('*:cooldown'):
                self.redis.delete(key)
        self.assertEqual(self.issue().status_code, 429)

    def test_ip_limits(self):
        with self.app.app_context():
            for _ in range(30):
                otp_service.rate_limit('request-ip', '127.0.0.1', 30)
        self.assertEqual(self.issue().status_code, 429)

    def test_new_user_register_and_replay(self):
        self.find.return_value = None
        self.assertEqual(self.login().json['code'], 'PROFILE_REQUIRED')
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)
        # /me preserves pending proof in the anonymous session.
        self.csrf = self.client.get('/api/auth/me').json['csrf_token']
        result = self.post('register', {'ho_ten': '  Nguyễn An  '})
        self.assertEqual(result.json['code'], 'AUTHENTICATED')
        self.create.assert_called_once_with(PHONE, 'Nguyễn An')
        self.assertEqual(self.post('register', {'ho_ten': 'An'}).status_code, 401)

    def test_register_requires_name_and_forbids_role(self):
        self.find.return_value = None
        self.login()
        for body in ({}, {'ho_ten': ''}, {'ho_ten': '  '}, {'ho_ten': 'A', 'VaiTro': 2},
                     {'ho_ten': 'A', 'phone': PHONE}, {'ho_ten': None}):
            self.assertEqual(self.post('register', body).status_code, 400)
        self.create.assert_not_called()
        self.assertEqual(self.post('register', {'ho_ten': 'An'}).status_code, 200)

    def test_register_proof_expiry(self):
        self.find.return_value = None
        self.login()
        for key in self.redis.scan_iter('lanyen:proof:*'):
            self.redis.expire(key, 0)
        self.assertEqual(self.post('register', {'ho_ten': 'An'}).status_code, 401)
        self.create.assert_not_called()

    def test_proof_bound_to_session(self):
        self.find.return_value = None
        self.login()
        with self.client.session_transaction() as state:
            state['otp_binding'] = 'different-binding'
        self.assertEqual(self.post('register', {'ho_ten': 'An'}).status_code, 401)

    def test_locked_and_unknown_role(self):
        for value in (user(locked=True), user(99)):
            self.redis.flushall()  # Only this test's isolated fake instance.
            self.find.return_value = value
            self.assertEqual(self.login().status_code, 403)
            self.assertEqual(self.client.get('/api/auth/me').status_code, 401)

    def test_roles_and_live_lock(self):
        self.login()
        for role in (0, 1, 2):
            with patch('app.services.auth_service.users.find_by_id', return_value=user(role)):
                self.assertEqual(self.client.get('/api/auth/me').status_code, 200)
                self.assertEqual(self.client.get('/test/manager').status_code, 200 if role == 2 else 403)
        with patch('app.services.auth_service.users.find_by_id', return_value=user(locked=True)):
            self.assertEqual(self.client.get('/api/auth/me').status_code, 403)
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)

    def test_csrf_all_mutations_and_rotation(self):
        old = self.csrf
        for path in ('otp/request', 'otp/verify', 'register', 'logout'):
            for headers in ({}, {'X-CSRF-Token': self.csrf, 'Origin': 'https://evil.example'}):
                self.assertEqual(self.client.post('/api/auth/' + path, json={}, headers=headers).status_code, 403)
        self.login()
        self.assertNotEqual(old, self.csrf)
        self.assertEqual(self.client.post('/api/auth/logout', json={}, headers={'X-CSRF-Token': old}).status_code, 403)
        self.assertEqual(self.post('logout', {}).status_code, 200)
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)

    def test_unavailable_redis_safe(self):
        self.redis.eval = lambda *args: (_ for _ in ()).throw(ConnectionError('private credential'))
        result = self.issue()
        self.assertEqual(result.status_code, 503)
        self.assertNotIn('private', result.get_data(as_text=True))
        self.output.assert_not_called()

    def test_database_failure_safe(self):
        self.find.side_effect = SQLAlchemyError('private')
        with patch('app.services.auth_service.db.session.rollback') as rollback:
            result = self.login()
        self.assertEqual(result.status_code, 503)
        self.assertNotIn('private', result.get_data(as_text=True))
        rollback.assert_called_once()

    def test_register_database_failure_does_not_reuse_proof(self):
        self.find.return_value = None
        self.login()
        self.create.side_effect = SQLAlchemyError('private')
        with patch('app.services.auth_service.db.session.rollback') as rollback:
            result = self.post('register', {'ho_ten': 'An'})
        self.assertEqual(result.status_code, 503)
        self.assertNotIn('private', result.get_data(as_text=True))
        rollback.assert_called_once()
        self.assertEqual(self.post('register', {'ho_ten': 'An'}).status_code, 401)

    def test_tampered_and_expired_session(self):
        self.login()
        name = self.app.config['SESSION_COOKIE_NAME']
        cookie = self.client.get_cookie(name).value
        self.client.set_cookie(name, cookie + 'tampered')
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)
        self.client.set_cookie(name, cookie)
        self.app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=-1)
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)

    def test_secure_cookie_flag(self):
        self.app.config['SESSION_COOKIE_SECURE'] = True
        self.assertIn('Secure', self.login().headers['Set-Cookie'])

    def test_dev_gates_no_output(self):
        for env, enabled in (('production', False), ('development', False)):
            self.app.config.update(APP_ENV=env, OTP_DEV_ENABLED=enabled)
            self.assertEqual(self.issue().status_code, 503)
        self.output.assert_not_called()

    def test_production_rejects_simulation(self):
        with self.assertRaises(RuntimeError):
            create_app({'SECRET_KEY': 'x' * 32, 'APP_ENV': 'production', 'OTP_DEV_ENABLED': True})

    def test_json_phone_validation(self):
        for value in ('+12025550123', 'abc', '123456', '090123456789', ''):
            self.assertEqual(self.post('otp/request', {'phone': value}).status_code, 400)
        for body in ('{bad', '[]', 'null'):
            result = self.client.post('/api/auth/otp/request', data=body, content_type='application/json',
                                      headers={'X-CSRF-Token': self.csrf})
            self.assertEqual(result.status_code, 400)
        self.assertEqual(self.client.post('/api/auth/otp/request', data='text',
                         headers={'X-CSRF-Token': self.csrf}).status_code, 415)

    def test_cors(self):
        for origin, allowed in (('https://shop.example', True), ('https://evil.example', False)):
            result = self.client.options('/api/auth/otp/request', headers={
                'Origin': origin, 'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, X-CSRF-Token'})
            self.assertEqual('Access-Control-Allow-Origin' in result.headers, allowed)
            if allowed:
                self.assertEqual(result.headers['Access-Control-Allow-Credentials'], 'true')

    def test_atomic_otp_and_proof_consumption(self):
        self.issue()
        def verify(_):
            with self.app.app_context():
                try:
                    return otp_service.verify_otp(PHONE, '123456', 'thread-ip', 'binding')
                except otp_service.AuthError:
                    return None
        with ThreadPoolExecutor(max_workers=8) as pool:
            proofs = [p for p in pool.map(verify, range(8)) if p]
        self.assertEqual(len(proofs), 1)
        def consume(_):
            with self.app.app_context():
                try:
                    return otp_service.consume_proof(proofs[0], 'binding')
                except otp_service.AuthError:
                    return None
        with ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual([p for p in pool.map(consume, range(8)) if p], [PHONE])

    def test_repository_defaults(self):
        self.create_patcher.stop()
        with self.app.app_context(), patch.object(repository, 'find_by_phone', return_value=user()), \
                patch.object(repository.db.session, 'execute') as execute, \
                patch.object(repository.db.session, 'commit'):
            repository.create_customer(PHONE, 'An')
            compiled = execute.call_args.args[0].compile(dialect=postgresql.dialect())
            self.assertIn('ON CONFLICT ("SDT") DO NOTHING', str(compiled))
            self.assertEqual(compiled.params['VaiTro'], 0)
            self.assertIs(compiled.params['TrangThai'], False)


if __name__ == '__main__':
    unittest.main()
