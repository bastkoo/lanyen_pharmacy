"""Category APIs with mocked repositories; never connect to PostgreSQL."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import create_app
from app.repositories import loai_thuoc_repository as repository


BASE = '/api/manager/categories'


class CategoryTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'category-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development',
            'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        # Any accidental database connection fails locally before network access.
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.repo = {}
        for name in ('lock_writes', 'find_by_id', 'find_duplicate', 'list_categories',
                     'create', 'update', 'has_medicines', 'remove', 'commit', 'rollback'):
            self.repo[name] = self.start_patch('app.repositories.loai_thuoc_repository.' + name)
        self.category = SimpleNamespace(MaLoaiThuoc=3, TenLoaiThuoc='Thuoc giam dau')
        self.repo['find_by_id'].return_value = self.category
        self.repo['find_duplicate'].return_value = False
        self.repo['has_medicines'].return_value = False
        self.repo['create'].return_value = self.category
        self.repo['update'].return_value = self.category
        self.repo['list_categories'].return_value = ([self.category], 1)
        self.user = SimpleNamespace(MaNguoiDung=12, VaiTro=2, TrangThai=False)
        self.find_user = self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', return_value=self.user)
        self.client = self.app.test_client()
        self.token = 'test-csrf-token'
        with self.client.session_transaction() as state:
            state['user_id'] = 12
            state['csrf_token'] = self.token

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        mocked = patcher.start()
        self.addCleanup(patcher.stop)
        return mocked

    def send(self, method='POST', path=BASE, **kwargs):
        kwargs.setdefault('headers', {'X-CSRF-Token': self.token})
        if method in ('POST', 'PUT') and 'data' not in kwargs:
            kwargs.setdefault('json', {'TenLoaiThuoc': '  Thuoc\t giam  dau\n'})
        return self.client.open(path, method=method, **kwargs)

    def test_create_normalizes_and_commits(self):
        result = self.send()
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json['category']['MaLoaiThuoc'], 3)
        self.repo['create'].assert_called_once_with('Thuoc giam dau')
        self.repo['find_duplicate'].assert_called_once_with('Thuoc giam dau')
        self.repo['lock_writes'].assert_called_once()
        self.repo['commit'].assert_called_once()

    def test_invalid_names_and_unknown_fields(self):
        for body in ({}, {'TenLoaiThuoc': ''}, {'TenLoaiThuoc': ' \t\n'},
                     {'TenLoaiThuoc': 'a' * 256}, {'TenLoaiThuoc': None},
                     {'TenLoaiThuoc': 123}, {'TenLoaiThuoc': ['A']},
                     {'TenLoaiThuoc': 'A\x00B'}, {'TenLoaiThuoc': 'A', 'MaLoaiThuoc': 4},
                     {'TenLoaiThuoc': 'A', 'unexpected': True}):
            for method, path in (('POST', BASE), ('PUT', BASE + '/3')):
                with self.subTest(body=body, method=method):
                    self.assertEqual(self.send(method, path, json=body).status_code, 400)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_max_length_after_normalization(self):
        self.assertEqual(self.send(json={'TenLoaiThuoc': '  ' + 'a' * 255 + '  '}).status_code, 201)

    def test_duplicate_create_and_update(self):
        self.repo['find_duplicate'].return_value = True
        for method, path in (('POST', BASE), ('PUT', BASE + '/3')):
            result = self.send(method, path)
            self.assertEqual((result.status_code, result.json['code']), (409, 'CATEGORY_NAME_EXISTS'))
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()
        self.repo['commit'].assert_not_called()

    def test_update_excludes_self(self):
        self.assertEqual(self.send('PUT', BASE + '/3').status_code, 200)
        self.repo['find_duplicate'].assert_called_once_with('Thuoc giam dau', exclude_id=3)
        self.repo['update'].assert_called_once_with(self.category, 'Thuoc giam dau')
        self.repo['commit'].assert_called_once()

    def test_delete_empty_category(self):
        self.assertEqual(self.send('DELETE', BASE + '/3').status_code, 200)
        self.repo['has_medicines'].assert_called_once_with(3)
        self.repo['remove'].assert_called_once_with(3)
        self.repo['commit'].assert_called_once()

    def test_delete_referenced_category(self):
        self.repo['has_medicines'].return_value = True
        result = self.send('DELETE', BASE + '/3')
        self.assertEqual((result.status_code, result.json['code']), (409, 'CATEGORY_IN_USE'))
        self.repo['remove'].assert_not_called()
        self.repo['commit'].assert_not_called()
        self.repo['rollback'].assert_called_once()

    def test_missing_category(self):
        self.repo['find_by_id'].return_value = None
        for method in ('GET', 'PUT', 'DELETE'):
            result = self.send(method, BASE + '/999')
            self.assertEqual((result.status_code, result.json['code']), (404, 'CATEGORY_NOT_FOUND'))
        self.repo['remove'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_detail_and_paginated_search(self):
        self.assertEqual(self.send('GET', BASE + '/3').json['category']['MaLoaiThuoc'], 3)
        result = self.send('GET', BASE + '?search=+giam++dau+&page=2&per_page=5')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json['total'], 1)
        self.repo['list_categories'].assert_called_once_with('giam dau', 2, 5)
        self.assertEqual(result.headers['Cache-Control'], 'no-store')

    def test_empty_list_and_invalid_pagination(self):
        self.repo['list_categories'].return_value = ([], 0)
        result = self.send('GET')
        self.assertEqual((result.json['items'], result.json['pages']), ([], 0))
        for query in ('page=0', 'page=-1', 'page=abc', 'per_page=0', 'per_page=101',
                      'page=1.5', 'page=999999999999999', 'search=' + 'a' * 256):
            self.assertEqual(self.send('GET', BASE + '?' + query).status_code, 400)

    def endpoints(self):
        return [('GET', BASE), ('GET', BASE + '/3'), ('POST', BASE),
                ('PUT', BASE + '/3'), ('DELETE', BASE + '/3')]

    def test_unauthenticated_all_endpoints(self):
        with self.client.session_transaction() as state:
            state.pop('user_id')
        for method, path in self.endpoints():
            self.assertEqual(self.send(method, path).status_code, 401)
        self.repo['find_by_id'].assert_not_called()
        self.repo['lock_writes'].assert_not_called()

    def test_forbidden_roles_all_endpoints(self):
        for role in (0, 1, 99):
            self.user.VaiTro = role
            for method, path in self.endpoints():
                self.assertEqual(self.send(method, path).status_code, 403)
        self.repo['list_categories'].assert_not_called()
        self.repo['lock_writes'].assert_not_called()

    def test_locked_deleted_and_live_role(self):
        self.user.TrangThai = True
        result = self.send('GET')
        self.assertEqual(result.json['code'], 'ACCOUNT_LOCKED')
        self.assertEqual(self.send('GET').status_code, 401)
        with self.client.session_transaction() as state:
            state['user_id'] = 12
        self.find_user.return_value = None
        self.assertEqual(self.send('GET').status_code, 401)

    def test_csrf_all_mutations(self):
        for method, path in self.endpoints()[2:]:
            for headers in ({}, {'X-CSRF-Token': 'wrong'},
                            {'X-CSRF-Token': self.token, 'Origin': 'https://evil.example'}):
                self.assertEqual(self.send(method, path, headers=headers).status_code, 403)
        self.repo['lock_writes'].assert_not_called()

    def test_json_errors(self):
        for method, path in (('POST', BASE), ('PUT', BASE + '/3')):
            for body in ('null', '[]', '{bad'):
                self.assertEqual(self.send(method, path, data=body, content_type='application/json').status_code, 400)
            self.assertEqual(self.send(method, path, data='text').status_code, 415)

    def test_database_failures_safe_and_rollback(self):
        for operation, method, path in (
            ('list_categories', 'GET', BASE), ('find_by_id', 'GET', BASE + '/3'),
            ('create', 'POST', BASE), ('update', 'PUT', BASE + '/3'),
            ('remove', 'DELETE', BASE + '/3'), ('commit', 'POST', BASE),
        ):
            with self.subTest(operation=operation):
                self.repo[operation].side_effect = SQLAlchemyError('private credentials SQL traceback')
                result = self.send(method, path)
                self.assertEqual(result.status_code, 503)
                self.assertNotIn('private', result.get_data(as_text=True))
                self.repo[operation].side_effect = None
        self.assertEqual(self.repo['rollback'].call_count, 6)

    def test_fk_race_returns_conflict(self):
        self.repo['remove'].side_effect = IntegrityError('private SQL', {}, SimpleNamespace(sqlstate='23503'))
        result = self.send('DELETE', BASE + '/3')
        self.assertEqual((result.status_code, result.json['code']), (409, 'CATEGORY_IN_USE'))
        self.repo['commit'].assert_not_called()
        self.repo['rollback'].assert_called_once()

    def test_other_integrity_error_safe(self):
        self.repo['create'].side_effect = IntegrityError('private SQL', {}, Exception('private'))
        self.assertEqual(self.send().status_code, 503)
        self.repo['rollback'].assert_called_once()


class CategoryRepositoryTests(unittest.TestCase):
    """Inspect generated PostgreSQL SQL without executing it."""

    def test_duplicate_query_normalizes_case_and_whitespace(self):
        from sqlalchemy.dialects import postgresql
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one_or_none.return_value = None
            self.assertFalse(repository.find_duplicate('Thuoc Giam Dau', exclude_id=3))
            compiled = execute.call_args.args[0].compile(dialect=postgresql.dialect())
            sql = str(compiled)
            self.assertIn('lower(trim(regexp_replace', sql)
            self.assertIn('!=', sql)
            self.assertIn('Thuoc Giam Dau', compiled.params.values())

    def test_search_escapes_wildcards_and_limits(self):
        from sqlalchemy.dialects import postgresql
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 0
            execute.return_value.scalars.return_value.all.return_value = []
            self.assertEqual(repository.list_categories('%_', 2, 5), ([], 0))
            compiled = execute.call_args.args[0].compile(dialect=postgresql.dialect())
            self.assertIn('/%/_', compiled.params.values())
            self.assertIn('ORDER BY', str(compiled))
            self.assertIn('LIMIT', str(compiled))

    def test_delete_targets_parent_only(self):
        from sqlalchemy.dialects import postgresql
        with patch.object(repository.db.session, 'execute') as execute:
            repository.remove(3)
            sql = str(execute.call_args.args[0].compile(dialect=postgresql.dialect()))
            self.assertIn('DELETE FROM "LoaiThuoc"', sql)
            self.assertNotIn('"Thuoc"', sql)


if __name__ == '__main__':
    unittest.main()
