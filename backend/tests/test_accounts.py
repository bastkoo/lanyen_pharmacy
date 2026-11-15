"""Internal-account security tests: repository mocks, no PostgreSQL connections."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Lock
from types import SimpleNamespace
from unittest.mock import Mock, patch

import fakeredis
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import create_app
from app.models.nguoi_dung import NguoiDung
from app.repositories import account_repository as repository


BASE = '/api/manager/accounts'


def user(account_id=13, role=1, locked=False, phone='+84901111111'):
    return SimpleNamespace(MaNguoiDung=account_id, HoTen='Nhan vien', SDT=phone,
                           VaiTro=role, TrangThai=locked, Email='staff@example.com', AnhDaiDien=None)


def create_data(**values):
    return dict(dict(HoTen='Nhan vien moi', SDT='0903333333', VaiTro=1), **values)


def edit_data(**values):
    return dict(dict(HoTen='Nhan vien cap nhat', SDT='0901111111', VaiTro=1), **values)


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'internal-account-test-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.actor = user(12, 2, phone='+84900000000')
        self.target = user()
        self.rows = {12: self.actor, 13: self.target}
        self.repo = {name: self.start_patch('app.repositories.account_repository.' + name)
                     for name in ('lock_writes', 'find_by_id', 'find_internal', 'list_accounts',
                                  'count_active_managers', 'create', 'update', 'set_status', 'commit', 'rollback')}
        self.find_user = self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', side_effect=lambda key: self.rows.get(key))
        self.find_phone = self.start_patch('app.repositories.nguoi_dung_repository.find_by_phone', side_effect=lambda phone: next((row for row in self.rows.values() if row.SDT == phone), None))
        self.repo['find_by_id'].side_effect = lambda key: self.rows.get(key)
        self.repo['find_internal'].side_effect = lambda key: self.rows.get(key) if self.rows.get(key) and self.rows[key].VaiTro in (1, 2) else None
        self.repo['count_active_managers'].return_value = 2
        self.repo['list_accounts'].return_value = ([self.target], 1)
        self.repo['create'].side_effect = self.create_row
        self.repo['update'].side_effect = self.update_row
        self.repo['set_status'].side_effect = self.change_status
        self.client = self.app.test_client()
        self.token = 'account-test-csrf'
        self.login(self.client, 12)

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def create_row(self, data):
        result = SimpleNamespace(MaNguoiDung=20, TrangThai=False, **data)
        self.rows[20] = result
        return result

    def update_row(self, account, data):
        for key, value in data.items():
            setattr(account, key, value)
        return account

    def change_status(self, account, locked):
        account.TrangThai = locked
        return account

    def login(self, client, account_id):
        with client.session_transaction() as session:
            session['user_id'] = account_id
            session['csrf_token'] = self.token

    def send(self, method='POST', path=BASE, **kwargs):
        kwargs.setdefault('headers', {'X-CSRF-Token': self.token})
        if method in ('POST', 'PUT', 'PATCH') and 'data' not in kwargs:
            kwargs.setdefault('json', create_data() if method == 'POST' else edit_data() if method == 'PUT' else {'TrangThai': True})
        return self.client.open(path, method=method, **kwargs)

    def endpoints(self):
        return [('GET', BASE), ('GET', BASE + '/13'), ('POST', BASE),
                ('PUT', BASE + '/13'), ('PATCH', BASE + '/13/status')]

    def test_list_detail_filters_and_public_fields(self):
        result = self.send('GET', BASE + '?search=Lan&page=2&per_page=5&role=1&status=false')
        self.assertEqual((result.status_code, result.json['code']), (200, 'ACCOUNTS_LISTED'))
        self.repo['list_accounts'].assert_called_once_with('Lan', 2, 5, 1, False)
        self.assertEqual((result.json['page'], result.json['per_page'], result.json['total']), (2, 5, 1))
        detail = self.send('GET', BASE + '/13')
        self.assertEqual(detail.json['code'], 'ACCOUNT_FOUND')
        self.assertEqual(set(detail.json['account']), {'MaNguoiDung', 'HoTen', 'SDT', 'VaiTro', 'TrangThai', 'Email', 'AnhDaiDien'})
        self.repo['commit'].assert_not_called()
        self.repo['lock_writes'].assert_not_called()

    def test_empty_list_default_and_invalid_query(self):
        self.repo['list_accounts'].return_value = ([], 0)
        result = self.send('GET')
        self.assertEqual(result.json, dict(code='ACCOUNTS_LISTED', items=[], page=1, per_page=20, total=0, pages=0))
        for query in ('role=0', 'role=3', 'role=1.5', 'status=0', 'status=True', 'status=active',
                      'page=0', 'page=2147483648', 'page=1.5', 'per_page=101', 'role=1&role=2',
                      'status=false&status=true', 'sort_by=SDT', 'search=' + 'a' * 256, 'search=%00'):
            self.assertEqual(self.send('GET', BASE + '?' + query).status_code, 400, query)

    def test_create_employee_and_manager_with_normalized_phone(self):
        for index, role in enumerate((1, 2)):
            result = self.send(json=create_data(SDT=f'090333333{index}', VaiTro=role))
            self.assertEqual((result.status_code, result.json['code']), (201, 'ACCOUNT_CREATED'))
            account = result.json['account']
            self.assertEqual((account['VaiTro'], account['TrangThai'], account['SDT']), (role, False, f'+8490333333{index}'))
            self.assertIsNone(account['Email'])
            self.assertIsNone(account['AnhDaiDien'])
        self.assertEqual(self.repo['lock_writes'].call_count, 2)

    def test_create_does_not_issue_otp_or_create_customer(self):
        with patch('app.services.otp_service.request_otp') as issue, \
                patch('app.services.otp_service.verify_otp') as verify, \
                patch('app.repositories.nguoi_dung_repository.create_customer') as customer:
            self.assertEqual(self.send().status_code, 201)
            issue.assert_not_called()
            verify.assert_not_called()
            customer.assert_not_called()

    def test_duplicate_phone_of_customer_employee_or_manager_refused(self):
        for role in (0, 1, 2):
            self.rows[30] = user(30, role, phone='+84903333333')
            result = self.send()
            self.assertEqual((result.status_code, result.json['code']), (409, 'ACCOUNT_PHONE_EXISTS'))
            self.assertEqual(self.rows[30].VaiTro, role)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_required_name_phone_role_and_name_length(self):
        for key in create_data():
            data = create_data()
            del data[key]
            self.assertEqual(self.send(json=data).status_code, 400)
        for name in ('', ' \t', 'x' * 256, None, True, 123, 'a\x00b', 'a\nb'):
            self.assertEqual(self.send(json=create_data(HoTen=name)).status_code, 400)
        result = self.send(json=create_data(HoTen='  ' + 'a' * 255 + '  '))
        self.assertEqual(result.status_code, 201)
        self.assertEqual(len(result.json['account']['HoTen']), 255)

    def test_role_strictly_one_or_two(self):
        for role in (0, 3, -1, True, False, 1.0, '1', None, [], {}):
            for method, path in [('POST', BASE), ('PUT', BASE + '/13')]:
                self.assertEqual(self.send(method, path, json=(create_data if method == 'POST' else edit_data)(VaiTro=role)).status_code, 400)

    def test_phone_validation_reuses_module_01(self):
        for phone in ('0903333333', '+84903333333', '090 333 3333', '(090)333-3333'):
            self.rows.pop(20, None)
            self.assertEqual(self.send(json=create_data(SDT=phone)).json['account']['SDT'], '+84903333333')
        for phone in ('', 'abc', '0123456789', '090123', '09012345678', '+840903333333', True, 903333333, None, ' ' * 25):
            self.assertEqual(self.send(json=create_data(SDT=phone)).status_code, 400)

    def test_optional_email_avatar_validation_and_null_clear(self):
        for data in (create_data(Email='bad'), create_data(Email='a' * 256 + '@example.com'), create_data(Email=True),
                     create_data(AnhDaiDien='http://example.com/image.png'), create_data(AnhDaiDien='javascript:alert(1)'),
                     create_data(AnhDaiDien='https://example.com:99999/a'), create_data(AnhDaiDien=True)):
            self.assertEqual(self.send(json=data).status_code, 400)
        result = self.send(json=create_data(Email='  staff@example.com  ', AnhDaiDien='https://example.com/avatar.png'))
        self.assertEqual(result.json['account']['Email'], 'staff@example.com')
        self.assertEqual(self.send('PUT', BASE + '/13', json=edit_data(Email='', AnhDaiDien=None)).json['account']['Email'], None)

    def test_mass_assignment_and_status_field_rejected(self):
        for field in ('MaNguoiDung', 'TrangThai', 'MatKhau', 'PasswordHash', 'TenDangNhap', 'NgayTao', 'NgayCapNhat'):
            for method, path in [('POST', BASE), ('PUT', BASE + '/13')]:
                self.assertEqual(self.send(method, path, json=(create_data if method == 'POST' else edit_data)(**{field: 1})).status_code, 400)

    def test_update_profile_preserves_omitted_optional_fields_and_status(self):
        result = self.send('PUT', BASE + '/13')
        self.assertEqual(result.json['code'], 'ACCOUNT_UPDATED')
        self.assertEqual(result.json['account']['Email'], 'staff@example.com')
        self.assertFalse(result.json['account']['TrangThai'])
        self.assertEqual(result.json['account']['SDT'], '+84901111111')

    def test_promote_employee_and_demote_other_manager(self):
        self.assertEqual(self.send('PUT', BASE + '/13', json=edit_data(VaiTro=2)).json['account']['VaiTro'], 2)
        self.assertEqual(self.send('PUT', BASE + '/13', json=edit_data(VaiTro=1)).json['account']['VaiTro'], 1)
        self.repo['count_active_managers'].assert_called_once()

    def test_no_self_demotion_or_self_lock(self):
        self.assertEqual(self.send('PUT', BASE + '/12', json=edit_data()).json['code'], 'CANNOT_DEMOTE_SELF')
        self.assertEqual(self.send('PATCH', BASE + '/12/status').json['code'], 'CANNOT_LOCK_SELF')
        self.repo['update'].assert_not_called()
        self.repo['set_status'].assert_not_called()

    def test_self_phone_update_keeps_identity_and_session(self):
        result = self.send('PUT', BASE + '/12', json=edit_data(VaiTro=2, SDT='0907777777'))
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json['account']['MaNguoiDung'], 12)
        with self.client.session_transaction() as state:
            self.assertEqual((state['user_id'], state['csrf_token']), (12, self.token))
        self.assertEqual(self.client.get('/api/auth/me').json['user']['SDT'], '+84907777777')

    def test_duplicate_phone_on_update_including_customer(self):
        self.rows[30] = user(30, 0, phone='+84903333333')
        result = self.send('PUT', BASE + '/13', json=edit_data(SDT='0903333333'))
        self.assertEqual(result.json['code'], 'ACCOUNT_PHONE_EXISTS')
        self.assertEqual(self.rows[30].VaiTro, 0)

    def test_customer_and_missing_target_not_in_scope(self):
        self.rows[30] = user(30, 0)
        for target in (30, 999):
            for method, suffix in [('GET', ''), ('PUT', ''), ('PATCH', '/status')]:
                result = self.send(method, f'{BASE}/{target}{suffix}')
                self.assertEqual((result.status_code, result.json['code']), (404, 'ACCOUNT_NOT_FOUND'))
        self.repo['update'].assert_not_called()
        self.repo['set_status'].assert_not_called()

    def test_last_active_manager_cannot_be_locked_or_demoted(self):
        self.target.VaiTro = 2
        self.repo['count_active_managers'].return_value = 1
        for method, path, body in [('PUT', BASE + '/13', edit_data(VaiTro=1)), ('PATCH', BASE + '/13/status', {'TrangThai': True})]:
            result = self.send(method, path, json=body)
            self.assertEqual((result.status_code, result.json['code']), (409, 'LAST_ACTIVE_MANAGER'))
        self.repo['update'].assert_not_called()
        self.repo['set_status'].assert_not_called()

    def test_locked_manager_can_be_demoted_without_counting_active(self):
        self.target.VaiTro = 2
        self.target.TrangThai = True
        self.assertEqual(self.send('PUT', BASE + '/13').status_code, 200)
        self.repo['count_active_managers'].assert_not_called()

    def test_lock_unlock_employee_and_other_manager(self):
        for role in (1, 2):
            self.target.VaiTro = role
            self.assertTrue(self.send('PATCH', BASE + '/13/status', json={'TrangThai': True}).json['account']['TrangThai'])
            self.assertFalse(self.send('PATCH', BASE + '/13/status', json={'TrangThai': False}).json['account']['TrangThai'])

    def test_status_strict_boolean_and_whitelist(self):
        for body in ({}, {'TrangThai': 1}, {'TrangThai': 'true'}, {'TrangThai': None}, {'TrangThai': False, 'VaiTro': 2}):
            self.assertEqual(self.send('PATCH', BASE + '/13/status', json=body).status_code, 400)

    def test_locked_existing_sessions_cannot_access_any_guarded_api(self):
        self.target.VaiTro = 2
        target_client = self.app.test_client()
        self.login(target_client, 13)
        self.assertEqual(target_client.get('/api/auth/me').status_code, 200)
        self.assertEqual(self.send('PATCH', BASE + '/13/status').status_code, 200)
        for path in ('/api/auth/me', BASE, '/api/manager/products', '/api/manager/promotions'):
            self.login(target_client, 13)
            response = target_client.get(path)
            self.assertEqual((response.status_code, response.json['code']), (403, 'ACCOUNT_LOCKED'))
            self.assertEqual(target_client.get(path).status_code, 401)

    def test_anonymous_customer_employee_forbidden(self):
        for role in (None, 0, 1):
            if role is None:
                with self.client.session_transaction() as state:
                    state.clear()
            else:
                self.login(self.client, 12)
                self.actor.VaiTro = role
            for method, path in self.endpoints():
                self.assertEqual(self.send(method, path).status_code, 401 if role is None else 403)
        self.repo['create'].assert_not_called()
        self.repo['lock_writes'].assert_not_called()

    def test_actor_rechecked_after_lock_before_writes(self):
        for actor, expected in [(None, 'UNAUTHENTICATED'), (user(12, 2, True), 'ACCOUNT_LOCKED'), (user(12, 1), 'FORBIDDEN')]:
            self.login(self.client, 12)
            self.repo['find_by_id'].side_effect = None
            self.repo['find_by_id'].return_value = actor
            result = self.send()
            self.assertEqual(result.json['code'], expected)
        self.repo['create'].assert_not_called()

    def test_csrf_origin_all_writes(self):
        for method, path in self.endpoints()[2:]:
            for headers in ({}, {'X-CSRF-Token': 'wrong'}, {'X-CSRF-Token': self.token, 'Origin': 'https://evil.example'}):
                self.assertEqual(self.send(method, path, headers=headers).json['code'], 'CSRF_FAILED')
        self.repo['lock_writes'].assert_not_called()

    def test_json_media_type_and_malformed_bodies(self):
        for method, path in self.endpoints()[2:]:
            for raw in ('null', '[]', '1', 'true', '{', ''):
                self.assertEqual(self.send(method, path, data=raw, content_type='application/json').status_code, 400)
            self.assertEqual(self.send(method, path, data='name=x', content_type='text/plain').status_code, 415)

    def test_unique_race_database_and_commit_failures_safe(self):
        self.repo['create'].side_effect = IntegrityError('secret SQL', {}, SimpleNamespace(sqlstate='23505'))
        self.assertEqual(self.send().json, {'code': 'ACCOUNT_PHONE_EXISTS'})
        self.repo['create'].side_effect = IntegrityError('secret SQL', {}, Exception('secret'))
        self.assertEqual(self.send().json, {'code': 'DATABASE_UNAVAILABLE'})
        self.repo['create'].side_effect = self.create_row
        self.repo['commit'].side_effect = SQLAlchemyError('password SQL')
        result = self.send()
        self.assertEqual(result.json, {'code': 'DATABASE_UNAVAILABLE'})
        self.assertNotIn('password', result.get_data(as_text=True))

    def test_database_failures_read_and_write_rollback(self):
        for name, method, path in [('list_accounts', 'GET', BASE), ('find_internal', 'GET', BASE + '/13'),
                                   ('lock_writes', 'POST', BASE), ('update', 'PUT', BASE + '/13'),
                                   ('set_status', 'PATCH', BASE + '/13/status')]:
            original = self.repo[name].side_effect
            self.repo[name].side_effect = SQLAlchemyError('private')
            result = self.send(method, path)
            self.assertEqual((result.status_code, result.json['code']), (503, 'DATABASE_UNAVAILABLE'))
            self.repo[name].side_effect = original
        self.assertEqual(self.repo['rollback'].call_count, 5)

    def test_headers_and_no_delete_endpoint(self):
        for result in (self.send('GET'), self.send(headers={})):
            self.assertEqual(result.headers['Cache-Control'], 'no-store')
            self.assertEqual(result.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(self.send('DELETE', BASE + '/13').status_code, 405)
        self.assertFalse(hasattr(repository, 'remove'))

    def test_new_account_and_changed_phone_login_through_real_otp_flow(self):
        self.app.config['OTP_DEV_ENABLED'] = True
        self.app.extensions['otp_redis'] = fakeredis.FakeRedis(decode_responses=True)
        created = self.send().json['account']
        self.assertEqual(created['VaiTro'], 1)
        self.send('PUT', BASE + '/13', json=edit_data(SDT='0908888888'))
        with patch('app.services.otp_service.secrets.randbelow', return_value=123456), patch('builtins.print'):
            for phone, account_id in [('0903333333', 20), ('0908888888', 13)]:
                client = self.app.test_client()
                csrf = client.get('/api/auth/me').json['csrf_token']
                self.assertEqual(client.post('/api/auth/otp/request', json={'phone': phone}, headers={'X-CSRF-Token': csrf}).status_code, 200)
                response = client.post('/api/auth/otp/verify', json={'phone': phone, 'otp': '123456'}, headers={'X-CSRF-Token': csrf})
                self.assertEqual(response.json['code'], 'AUTHENTICATED')
                self.assertEqual((response.json['user']['MaNguoiDung'], response.json['user']['VaiTro']), (account_id, 1))

    def test_concurrent_cross_disable_keeps_an_active_manager(self):
        # Simulates the repository lock/commit contract, not PostgreSQL isolation.
        for action in ('lock', 'demote', 'mixed'):
            with self.subTest(action=action):
                self.rows = {12: user(12, 2, phone='+84900000000'), 13: user(13, 2)}
                barrier, write_lock = Barrier(2), Lock()

                def initial_read(key):
                    snapshot = SimpleNamespace(**vars(self.rows[key]))
                    barrier.wait(timeout=5)
                    return snapshot

                self.find_user.side_effect = initial_read
                self.repo['lock_writes'].side_effect = lambda: write_lock.acquire(timeout=5) or self.fail('Lock timeout')
                self.repo['commit'].side_effect = write_lock.release
                self.repo['rollback'].side_effect = write_lock.release
                self.repo['count_active_managers'].side_effect = lambda: sum(row.VaiTro == 2 and not row.TrangThai for row in self.rows.values())

                def send_as(actor, target):
                    client = self.app.test_client()
                    self.login(client, actor)
                    if action == 'lock' or (action == 'mixed' and actor == 12):
                        return client.patch(f'{BASE}/{target}/status', json={'TrangThai': True}, headers={'X-CSRF-Token': self.token}).status_code
                    return client.put(f'{BASE}/{target}', json=edit_data(SDT=self.rows[target].SDT, VaiTro=1), headers={'X-CSRF-Token': self.token}).status_code

                with ThreadPoolExecutor(max_workers=2) as executor:
                    results = list(executor.map(lambda pair: send_as(*pair), [(12, 13), (13, 12)]))
                self.assertEqual(sorted(results), [200, 403])
                self.assertEqual(sum(row.VaiTro == 2 and not row.TrangThai for row in self.rows.values()), 1)


class AccountRepositoryTests(unittest.TestCase):
    def compile(self, statement):
        return statement.compile(dialect=postgresql.dialect())

    def test_table_lock_starts_after_guard_read_transaction(self):
        order = Mock()
        with patch.object(repository.db.session, 'rollback') as rollback, patch.object(repository.db.session, 'execute') as execute:
            order.attach_mock(rollback, 'rollback')
            order.attach_mock(execute, 'execute')
            repository.lock_writes()
            self.assertEqual(order.mock_calls[0][0], 'rollback')
            self.assertIn('LOCK TABLE "NguoiDung" IN SHARE ROW EXCLUSIVE MODE', str(execute.call_args.args[0]))

    def test_actor_and_target_refresh_identity_and_scope(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.find_by_id(12)
            self.assertTrue(execute.call_args.args[0].get_execution_options()['populate_existing'])
            repository.find_internal(13)
            sql = str(self.compile(execute.call_args.args[0]))
            self.assertIn('"MaNguoiDung" =', sql)
            self.assertIn('"VaiTro" IN', sql)
            self.assertIn(13, self.compile(execute.call_args.args[0]).params.values())

    def test_list_scope_search_escape_filters_pagination(self):
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 0
            execute.return_value.scalars.return_value.all.return_value = []
            self.assertEqual(repository.list_accounts('%_', 2, 5, 2, False), ([], 0))
            for invocation in execute.call_args_list:
                sql = str(self.compile(invocation.args[0]))
                self.assertIn('"VaiTro" IN', sql)
                self.assertIn('"HoTen"', sql)
                self.assertIn('"SDT"', sql)
                self.assertIn('"TrangThai" IS false', sql)
            self.assertIn('/%/_', self.compile(execute.call_args.args[0]).params.values())
            self.assertIn('ORDER BY', sql)
            self.assertIn('LIMIT', sql)
            self.assertIn('OFFSET', sql)
            repository.list_accounts('090 111-1111', 1, 20)
            self.assertIn('+84901111111', self.compile(execute.call_args.args[0]).params.values())

    def test_active_manager_count_predicate(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.count_active_managers()
            compiled = self.compile(execute.call_args.args[0])
            self.assertIn('"VaiTro" =', str(compiled))
            self.assertIn('"TrangThai" IS false', str(compiled))
            self.assertIn(2, compiled.params.values())

    def test_create_update_status_whitelists_and_no_otp_fields(self):
        with patch.object(repository.db.session, 'add') as add, patch.object(repository.db.session, 'flush') as flush, patch.object(repository.db.session, 'commit') as commit:
            account = repository.create(dict(HoTen='Staff', SDT='+84903333333', VaiTro=1, Email=None, AnhDaiDien=None))
            add.assert_called_once_with(account)
            account.MaNguoiDung = 15
            repository.update(account, dict(HoTen='New', SDT='+84903333334', VaiTro=2, MaNguoiDung=99, TrangThai=True))
            self.assertEqual((account.MaNguoiDung, account.TrangThai, account.VaiTro), (15, False, 2))
            repository.set_status(account, True)
            self.assertTrue(account.TrangThai)
            self.assertEqual(flush.call_count, 3)
            commit.assert_not_called()
        self.assertEqual(set(NguoiDung.__table__.columns.keys()), {'MaNguoiDung', 'HoTen', 'SDT', 'VaiTro', 'TrangThai', 'Email', 'AnhDaiDien'})


if __name__ == '__main__':
    unittest.main()
