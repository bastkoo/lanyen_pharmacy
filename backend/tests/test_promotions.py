"""Promotion API/repository tests with mocks; real PostgreSQL connections forbidden."""
import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import create_app
from app.models.chuong_trinh_khuyen_mai import ChuongTrinhKhuyenMai
from app.repositories import chuong_trinh_khuyen_mai_repository as repository


BASE = '/api/manager/promotions'


def valid_data():
    return dict(TenChuongTrinh='Khuyen mai thang 11', NgayBatDau='2026-11-01', NgayKetThuc='2026-11-30')


def loaded_data():
    return dict(valid_data(), NgayBatDau=date(2026, 11, 1), NgayKetThuc=date(2026, 11, 30))


class PromotionTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'promotion-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development',
            'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.repo = {name: self.start_patch('app.repositories.chuong_trinh_khuyen_mai_repository.' + name)
                     for name in ('find_by_id', 'list_promotions', 'create', 'update',
                                  'has_details', 'remove', 'commit', 'rollback')}
        self.promotion = SimpleNamespace(MaChuongTrinh=7, **loaded_data())
        self.repo['find_by_id'].return_value = self.promotion
        self.repo['list_promotions'].return_value = ([self.promotion], 1)
        self.repo['has_details'].return_value = False
        self.repo['create'].side_effect = lambda data: SimpleNamespace(MaChuongTrinh=7, **data)
        self.repo['update'].side_effect = lambda item, data: SimpleNamespace(MaChuongTrinh=item.MaChuongTrinh, **data)
        self.user = SimpleNamespace(MaNguoiDung=12, VaiTro=2, TrangThai=False)
        self.find_user = self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', return_value=self.user)
        self.client = self.app.test_client()
        self.token = 'promotion-test-csrf'
        self.login()

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        mocked = patcher.start()
        self.addCleanup(patcher.stop)
        return mocked

    def login(self):
        with self.client.session_transaction() as state:
            state['user_id'] = 12
            state['csrf_token'] = self.token

    def send(self, method='POST', path=BASE, **kwargs):
        kwargs.setdefault('headers', {'X-CSRF-Token': self.token})
        if method in ('POST', 'PUT') and 'data' not in kwargs:
            kwargs.setdefault('json', valid_data())
        return self.client.open(path, method=method, **kwargs)

    def endpoints(self):
        return [('GET', BASE), ('GET', BASE + '/7'), ('POST', BASE),
                ('PUT', BASE + '/7'), ('DELETE', BASE + '/7')]

    def test_manager_list_and_detail_exact_contract(self):
        response = self.send('GET', BASE + '?page=2&per_page=5')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, dict(code='PROMOTIONS_LISTED', items=[dict(valid_data(), MaChuongTrinh=7)],
                                            total=1, page=2, per_page=5, pages=1))
        self.repo['list_promotions'].assert_called_once_with(2, 5)
        detail = self.send('GET', BASE + '/7')
        self.assertEqual(detail.json, dict(code='PROMOTION_FOUND', promotion=dict(valid_data(), MaChuongTrinh=7)))
        self.repo['find_by_id'].assert_called_once_with(7, for_update=False)
        for name in ('create', 'update', 'remove', 'commit'):
            self.repo[name].assert_not_called()

    def test_create_trim_and_commit(self):
        response = self.send(json=dict(valid_data(), TenChuongTrinh='  Khuyen mai thang 11  '))
        self.assertEqual((response.status_code, response.json['code']), (201, 'PROMOTION_CREATED'))
        self.assertEqual(response.json['promotion'], dict(valid_data(), MaChuongTrinh=7))
        self.repo['create'].assert_called_once_with(loaded_data())
        self.repo['commit'].assert_called_once()

    def test_update_locks_and_preserves_id(self):
        body = dict(valid_data(), TenChuongTrinh='Updated', NgayKetThuc='2026-12-31')
        response = self.send('PUT', BASE + '/7', json=body)
        self.assertEqual(response.json, dict(code='PROMOTION_UPDATED', promotion=dict(body, MaChuongTrinh=7)))
        self.repo['find_by_id'].assert_called_once_with(7, for_update=True)
        self.repo['update'].assert_called_once_with(self.promotion, dict(body, NgayBatDau=date(2026, 11, 1), NgayKetThuc=date(2026, 12, 31)))
        self.repo['commit'].assert_called_once()

    def test_missing_each_required_field(self):
        for name in valid_data():
            body = valid_data()
            del body[name]
            for method, path in [('POST', BASE), ('PUT', BASE + '/7')]:
                with self.subTest(name=name, method=method):
                    self.assertEqual(self.send(method, path, json=body).status_code, 400)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_name_type_empty_length_and_nul(self):
        for name in ('', ' \t\n', 'x' * 256, 'a\x00b', None, True, 1, [], {}):
            for method, path in [('POST', BASE), ('PUT', BASE + '/7')]:
                with self.subTest(name=name, method=method):
                    self.assertEqual(self.send(method, path, json=dict(valid_data(), TenChuongTrinh=name)).status_code, 400)
        self.assertEqual(self.send(json=dict(valid_data(), TenChuongTrinh='  ' + 'x' * 255 + '  ')).status_code, 201)
        self.assertEqual(self.send(json=dict(valid_data(), TenChuongTrinh='💊' * 255)).status_code, 201)

    def test_invalid_dates_and_types(self):
        for name in ('NgayBatDau', 'NgayKetThuc'):
            for value in ('2026-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '2026-1-01',
                          '01/11/2026', '2026-11-01T00:00:00Z', ' 2026-11-01', '', None, True, 20261101, [], {}):
                for method, path in [('POST', BASE), ('PUT', BASE + '/7')]:
                    with self.subTest(name=name, value=value, method=method):
                        self.assertEqual(self.send(method, path, json=dict(valid_data(), **{name: value})).status_code, 400)

    def test_end_before_start_rejected(self):
        for method, path in [('POST', BASE), ('PUT', BASE + '/7')]:
            response = self.send(method, path, json=dict(valid_data(), NgayKetThuc='2026-10-31'))
            self.assertEqual((response.status_code, response.json['code']), (400, 'INVALID_REQUEST'))

    def test_equal_past_dates_and_leap_day_allowed(self):
        for start, end in [('2000-01-01', '2000-01-01'), ('2024-02-29', '2024-03-01')]:
            for method, path in [('POST', BASE), ('PUT', BASE + '/7')]:
                self.assertIn(self.send(method, path, json=dict(valid_data(), NgayBatDau=start, NgayKetThuc=end)).status_code, (200, 201))

    def test_duplicate_names_and_overlapping_dates_not_restricted(self):
        for _ in range(2):
            self.assertEqual(self.send().status_code, 201)
        self.assertEqual(self.repo['create'].call_count, 2)

    def test_primary_key_and_unknown_fields_rejected(self):
        for name in ('MaChuongTrinh', 'TrangThai', 'MoTa', 'MaGiamGia', 'MaThuoc', 'ChiTietKhuyenMai'):
            for method, path in [('POST', BASE), ('PUT', BASE + '/7')]:
                self.assertEqual(self.send(method, path, json=dict(valid_data(), **{name: 1})).status_code, 400)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_empty_list_and_default_pagination(self):
        self.repo['list_promotions'].return_value = ([], 0)
        response = self.send('GET')
        self.assertEqual(response.json, dict(code='PROMOTIONS_LISTED', items=[], page=1, per_page=20, total=0, pages=0))
        self.repo['list_promotions'].assert_called_once_with(1, 20)

    def test_invalid_unknown_and_repeated_query(self):
        for query in ('page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=2147483648', 'per_page=0',
                      'per_page=101', 'per_page=true', 'page=1&page=2', 'per_page=5&per_page=5',
                      'TrangThai=1', 'search=anything'):
            with self.subTest(query=query):
                self.assertEqual(self.send('GET', BASE + '?' + query).status_code, 400)
        self.repo['list_promotions'].assert_not_called()

    def test_missing_promotion_get_update_delete(self):
        self.repo['find_by_id'].return_value = None
        for method in ('GET', 'PUT', 'DELETE'):
            response = self.send(method, BASE + '/999')
            self.assertEqual((response.status_code, response.json['code']), (404, 'PROMOTION_NOT_FOUND'))
        for name in ('update', 'remove', 'commit', 'has_details'):
            self.repo[name].assert_not_called()

    def test_delete_without_details(self):
        response = self.send('DELETE', BASE + '/7')
        self.assertEqual(response.json, dict(code='PROMOTION_DELETED'))
        self.repo['find_by_id'].assert_called_once_with(7, for_update=True)
        self.repo['has_details'].assert_called_once_with(7)
        self.repo['remove'].assert_called_once_with(7)
        self.repo['commit'].assert_called_once()

    def test_delete_with_details_refused(self):
        self.repo['has_details'].return_value = True
        response = self.send('DELETE', BASE + '/7')
        self.assertEqual((response.status_code, response.json['code']), (409, 'PROMOTION_IN_USE'))
        self.repo['remove'].assert_not_called()
        self.repo['commit'].assert_not_called()
        self.repo['rollback'].assert_called_once()

    def test_delete_fk_race_safe_rollback(self):
        self.repo['remove'].side_effect = IntegrityError('private SQL', {}, SimpleNamespace(sqlstate='23503'))
        response = self.send('DELETE', BASE + '/7')
        self.assertEqual((response.status_code, response.json['code']), (409, 'PROMOTION_IN_USE'))
        self.repo['commit'].assert_not_called()
        self.repo['rollback'].assert_called_once()

    def test_unauthenticated_all_endpoints(self):
        with self.client.session_transaction() as state:
            state.clear()
        for method, path in self.endpoints():
            self.assertEqual(self.send(method, path).status_code, 401)
        for name in ('list_promotions', 'find_by_id', 'create', 'update', 'remove'):
            self.repo[name].assert_not_called()

    def test_customer_employee_other_roles_forbidden(self):
        for role in (0, 1, 99):
            self.user.VaiTro = role
            for method, path in self.endpoints():
                response = self.send(method, path)
                self.assertEqual((response.status_code, response.json['code']), (403, 'FORBIDDEN'))
        self.repo['find_by_id'].assert_not_called()
        self.repo['create'].assert_not_called()

    def test_locked_account_all_endpoints(self):
        self.user.TrangThai = True
        for method, path in self.endpoints():
            self.login()
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (403, 'ACCOUNT_LOCKED'))
            with self.client.session_transaction() as state:
                self.assertNotIn('user_id', state)

    def test_deleted_account_and_live_role_checks(self):
        self.find_user.return_value = None
        self.assertEqual(self.send('GET').status_code, 401)
        self.login()
        self.find_user.return_value = self.user
        self.user.VaiTro = 1
        self.assertEqual(self.send('GET').status_code, 403)
        self.user.VaiTro = 2
        self.assertEqual(self.send('GET').status_code, 200)

    def test_csrf_missing_wrong_and_origin_all_writes(self):
        for method, path in self.endpoints()[2:]:
            for headers in ({}, {'X-CSRF-Token': 'wrong'}, {'X-CSRF-Token': self.token, 'Origin': 'https://evil.example'}):
                response = self.send(method, path, headers=headers)
                self.assertEqual((response.status_code, response.json['code']), (403, 'CSRF_FAILED'))
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()
        self.repo['remove'].assert_not_called()

    def test_allowed_origin_and_get_without_csrf(self):
        self.assertEqual(self.send(headers={'X-CSRF-Token': self.token, 'Origin': 'https://shop.example'}).status_code, 201)
        self.assertEqual(self.send('GET', headers={}).status_code, 200)

    def test_malformed_or_nonobject_json_and_content_type(self):
        for method, path in [('POST', BASE), ('PUT', BASE + '/7')]:
            for raw in ('null', '[]', '1', 'true', '"name"', '{', ''):
                self.assertEqual(self.send(method, path, data=raw, content_type='application/json').status_code, 400)
            self.assertEqual(self.send(method, path, data='name=x', content_type='text/plain').status_code, 415)

    def test_database_errors_rollback_and_hide_internal_data(self):
        for name, method, path in [('list_promotions', 'GET', BASE), ('find_by_id', 'GET', BASE + '/7'),
                                   ('create', 'POST', BASE), ('update', 'PUT', BASE + '/7'),
                                   ('has_details', 'DELETE', BASE + '/7'), ('remove', 'DELETE', BASE + '/7')]:
            self.repo[name].side_effect = SQLAlchemyError('private secret SQL')
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (503, 'DATABASE_UNAVAILABLE'))
            self.assertNotIn('private', response.get_data(as_text=True))
            self.repo[name].side_effect = None
        self.assertEqual(self.repo['rollback'].call_count, 6)
        self.repo['commit'].assert_not_called()

    def test_commit_errors_and_other_integrity_errors(self):
        for error in (SQLAlchemyError('private'), IntegrityError('private', {}, Exception('private'))):
            self.repo['commit'].side_effect = error
            response = self.send()
            self.assertEqual((response.status_code, response.json['code']), (503, 'DATABASE_UNAVAILABLE'))
            self.assertNotIn('private', response.get_data(as_text=True))
        self.assertEqual(self.repo['rollback'].call_count, 2)

    def test_cache_and_nosniff_headers_on_success_and_failure(self):
        for method, path in self.endpoints():
            response = self.send(method, path)
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        response = self.send(headers={})
        self.assertEqual(response.headers['Cache-Control'], 'no-store')


class PromotionRepositoryTests(unittest.TestCase):
    def compile(self, statement):
        return statement.compile(dialect=postgresql.dialect())

    def test_scoped_lookup_and_row_lock(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.find_by_id(7, for_update=True)
            compiled = self.compile(execute.call_args.args[0])
            self.assertIn('FOR UPDATE', str(compiled))
            self.assertIn('WHERE "ChuongTrinhKhuyenMai"."MaChuongTrinh" =', str(compiled))
            self.assertIn(7, compiled.params.values())

    def test_list_count_stable_order_limit_offset(self):
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 0
            execute.return_value.scalars.return_value.all.return_value = []
            self.assertEqual(repository.list_promotions(3, 5), ([], 0))
            count_sql = str(self.compile(execute.call_args_list[0].args[0]))
            self.assertIn('count(', count_sql)
            compiled = self.compile(execute.call_args_list[1].args[0])
            self.assertIn('ORDER BY "ChuongTrinhKhuyenMai"."MaChuongTrinh"', str(compiled))
            self.assertIn('LIMIT', str(compiled))
            self.assertIn('OFFSET', str(compiled))
            self.assertIn(5, compiled.params.values())
            self.assertIn(10, compiled.params.values())

    def test_actual_fk_reference_and_parent_only_delete(self):
        references = {table.name for table in ChuongTrinhKhuyenMai.metadata.tables.values()
                      for fk in table.foreign_keys if fk.column.table is ChuongTrinhKhuyenMai.__table__}
        self.assertEqual(references, {'ChiTietKhuyenMai'})
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = True
            self.assertTrue(repository.has_details(7))
            compiled = self.compile(execute.call_args.args[0])
            self.assertIn('EXISTS', str(compiled))
            self.assertIn('FROM "ChiTietKhuyenMai"', str(compiled))
            self.assertIn(7, compiled.params.values())
            repository.remove(7)
            compiled = self.compile(execute.call_args.args[0])
            self.assertIn('DELETE FROM "ChuongTrinhKhuyenMai"', str(compiled))
            self.assertIn('WHERE', str(compiled))
            self.assertNotIn('ChiTietKhuyenMai', str(compiled))
            self.assertNotIn('CASCADE', str(compiled))
            self.assertEqual(list(compiled.params.values()), [7])

    def test_create_update_only_writable_fields_and_flush(self):
        with patch.object(repository.db.session, 'add') as add, \
                patch.object(repository.db.session, 'flush') as flush, \
                patch.object(repository.db.session, 'commit') as commit:
            promotion = repository.create(loaded_data())
            add.assert_called_once_with(promotion)
            promotion.MaChuongTrinh = 7
            repository.update(promotion, dict(loaded_data(), TenChuongTrinh='New', MaChuongTrinh=99))
            self.assertEqual(promotion.MaChuongTrinh, 7)
            self.assertEqual(promotion.TenChuongTrinh, 'New')
            self.assertEqual(flush.call_count, 2)
            commit.assert_not_called()


if __name__ == '__main__':
    unittest.main()
