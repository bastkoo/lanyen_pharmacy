"""Batch/inventory unit tests: repository mocks and no PostgreSQL connections."""
import unittest
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import create_app
from app.repositories import inventory_repository, lo_thuoc_repository


BASE = '/api/manager/products/3/batches'
INVENTORY = '/api/manager/inventory'
TODAY = date(2026, 11, 13)


def valid_data():
    return dict(SoLoSanXuat='LOT-01', NgaySanXuat='2026-01-01', HanSuDung='2027-01-01',
                SoLuongNhap=100, GiaNhap=500)


def loaded_data():
    return dict(valid_data(), NgaySanXuat=date(2026, 1, 1), HanSuDung=date(2027, 1, 1))


class BatchInventoryTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'batch-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development',
            'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.repo = {name: self.start_patch('app.repositories.lo_thuoc_repository.' + name)
                     for name in ('find_by_id', 'list_batches', 'create', 'update')}
        self.product = self.start_patch('app.repositories.thuoc_repository.find_by_id',
                                        return_value=SimpleNamespace(MaThuoc=3))
        self.commit = self.start_patch('app.repositories.thuoc_repository.commit')
        self.rollback = self.start_patch('app.repositories.thuoc_repository.rollback')
        self.batch = SimpleNamespace(MaLo=7, MaThuoc=3, SoLuongTon=100, **loaded_data())
        self.repo['find_by_id'].return_value = self.batch
        self.repo['list_batches'].return_value = ([self.batch], 1)
        self.repo['create'].side_effect = lambda product_id, data: SimpleNamespace(
            MaLo=7, MaThuoc=product_id, SoLuongTon=data['SoLuongNhap'], **data)
        self.repo['update'].return_value = self.batch
        self.summary = self.start_patch('app.repositories.inventory_repository.summary', return_value=([], 0))
        self.expiry = self.start_patch('app.repositories.inventory_repository.expiring', return_value=([], 0))
        self.start_patch('app.services.inventory_service.current_date', return_value=TODAY)
        self.user = SimpleNamespace(MaNguoiDung=12, VaiTro=2, TrangThai=False)
        self.find_user = self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', return_value=self.user)
        self.client = self.app.test_client()
        self.token = 'batch-test-csrf'
        self.login()

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

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
                ('PUT', BASE + '/7'), ('DELETE', BASE + '/7')] + [
                    ('GET', INVENTORY + path) for path in ('/summary', '/low-stock', '/expiring')]

    def test_create_and_initialize_stock(self):
        response = self.send(json=dict(valid_data(), SoLoSanXuat=' LOT-01 '))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json['batch']['SoLuongTon'], 100)
        self.assertEqual(response.json['batch']['NgaySanXuat'], '2026-01-01')
        self.repo['create'].assert_called_once_with(3, loaded_data())
        self.commit.assert_called_once()

    def test_no_global_batch_number_uniqueness(self):
        self.assertEqual(self.send().status_code, 201)
        self.assertEqual(self.send().status_code, 201)
        self.assertEqual(self.repo['create'].call_count, 2)

    def test_missing_each_required_field(self):
        for key in valid_data():
            data = valid_data()
            del data[key]
            with self.subTest(field=key):
                self.assertEqual(self.send(json=data).status_code, 400)
        self.repo['create'].assert_not_called()

    def test_name_validation(self):
        for name in ('', ' \n\t ', 'a' * 101, None, 1, True, [], {}, 'a\x00b'):
            self.assertEqual(self.send(json=dict(valid_data(), SoLoSanXuat=name)).status_code, 400)
        self.assertEqual(self.send(json=dict(valid_data(), SoLoSanXuat='a' * 100)).status_code, 201)

    def test_invalid_dates(self):
        for field in ('NgaySanXuat', 'HanSuDung'):
            for value in ('2026-02-30', '2026-13-01', '20261113', '2026-1-1',
                          '2026-01-01T00:00:00', '', 'not-a-date', None, 123, True):
                with self.subTest(field=field, value=value):
                    self.assertEqual(self.send(json=dict(valid_data(), **{field: value})).status_code, 400)

    def test_expiry_must_be_after_manufacture(self):
        for expiry in ('2026-01-01', '2025-12-31'):
            self.assertEqual(self.send(json=dict(valid_data(), HanSuDung=expiry)).status_code, 400)
            self.assertEqual(self.send('PUT', BASE + '/7', json=dict(valid_data(), HanSuDung=expiry)).status_code, 400)

    def test_leap_day_valid_and_invalid(self):
        self.assertEqual(self.send(json=dict(valid_data(), NgaySanXuat='2024-02-29')).status_code, 201)
        self.assertEqual(self.send(json=dict(valid_data(), NgaySanXuat='2025-02-29')).status_code, 400)

    def test_strict_integers(self):
        for field in ('SoLuongNhap', 'GiaNhap'):
            for value in (-1, True, False, 1.0, '1', None, [], {}, 2147483648):
                with self.subTest(field=field, value=value):
                    self.assertEqual(self.send(json=dict(valid_data(), **{field: value})).status_code, 400)
        self.assertEqual(self.send(json=dict(valid_data(), SoLuongNhap=0)).status_code, 400)
        self.assertEqual(self.send(json=dict(valid_data(), GiaNhap=0)).status_code, 201)

    def test_forbid_identifiers_stock_and_unknown_fields(self):
        for key in ('MaLo', 'MaThuoc', 'SoLuongTon', 'extra'):
            for method, path in (('POST', BASE), ('PUT', BASE + '/7')):
                self.assertEqual(self.send(method, path, json=dict(valid_data(), **{key: 1})).status_code, 400)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_product_not_found(self):
        self.product.return_value = None
        for method, path in self.endpoints()[:5]:
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (404, 'PRODUCT_NOT_FOUND'))
        self.repo['find_by_id'].assert_not_called()
        self.repo['create'].assert_not_called()

    def test_batch_missing_or_other_product(self):
        for batch in (None, SimpleNamespace(MaLo=7, MaThuoc=4)):
            self.repo['find_by_id'].return_value = batch
            for method in ('GET', 'PUT', 'DELETE'):
                response = self.send(method, BASE + '/7')
                self.assertEqual((response.status_code, response.json['code']), (404, 'BATCH_NOT_FOUND'))
        self.repo['update'].assert_not_called()

    def test_list_detail_pagination(self):
        self.assertEqual(self.send('GET', BASE + '/7').json['batch']['MaLo'], 7)
        response = self.send('GET', BASE + '?page=2&per_page=5')
        self.assertEqual(response.status_code, 200)
        self.repo['list_batches'].assert_called_once_with(3, 2, 5)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_update_metadata_preserves_quantities(self):
        data = valid_data()
        del data['SoLuongNhap']
        self.assertEqual(self.send('PUT', BASE + '/7', json=data).status_code, 200)
        self.repo['find_by_id'].assert_called_once_with(3, 7, for_update=True)
        self.assertNotIn('SoLuongNhap', self.repo['update'].call_args.args[1])
        self.commit.assert_called_once()

    def test_update_same_received_quantity_is_no_change(self):
        self.assertEqual(self.send('PUT', BASE + '/7').status_code, 200)

    def test_reject_received_quantity_change_even_without_dispatch(self):
        for stock in (100, 70):
            self.batch.SoLuongTon = stock
            for quantity in (50, 90, 110):
                response = self.send('PUT', BASE + '/7', json=dict(valid_data(), SoLuongNhap=quantity))
                self.assertEqual((response.status_code, response.json['code']), (409, 'BATCH_QUANTITY_IMMUTABLE'))
        self.repo['update'].assert_not_called()
        self.commit.assert_not_called()

    def test_reject_inconsistent_existing_stock(self):
        for stock in (-1, 101):
            self.batch.SoLuongTon = stock
            response = self.send('PUT', BASE + '/7')
            self.assertEqual((response.status_code, response.json['code']), (409, 'BATCH_STOCK_INCONSISTENT'))
        self.repo['update'].assert_not_called()

    def test_reject_delete_without_audit_proof(self):
        for stock in (0, 70, 100):
            self.batch.SoLuongTon = stock
            response = self.send('DELETE', BASE + '/7')
            self.assertEqual((response.status_code, response.json['code']), (409, 'BATCH_DELETE_UNSAFE'))
        self.commit.assert_not_called()
        self.assertFalse(hasattr(lo_thuoc_repository, 'remove'))

    def test_summary_serializes_aggregate_and_zero_stock(self):
        rows = [dict(MaThuoc=3, TenThuoc='A', TongSoLuongTon=150, NguongTonKho=10, TonKhoThap=False),
                dict(MaThuoc=4, TenThuoc='B', TongSoLuongTon=0, NguongTonKho=0, TonKhoThap=True)]
        self.summary.return_value = (rows, 2)
        response = self.send('GET', INVENTORY + '/summary')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['items'], rows)
        self.summary.assert_called_once_with(1, 20, low_stock=False)

    def test_low_stock_threshold_equality_and_no_batches(self):
        rows = [dict(MaThuoc=3, TenThuoc='A', TongSoLuongTon=10, NguongTonKho=10, TonKhoThap=True),
                dict(MaThuoc=4, TenThuoc='B', TongSoLuongTon=0, NguongTonKho=5, TonKhoThap=True)]
        self.summary.return_value = (rows, 2)
        response = self.send('GET', INVENTORY + '/low-stock?page=2&per_page=5')
        self.assertEqual(response.json['items'], rows)
        self.summary.assert_called_once_with(2, 5, low_stock=True)

    def expiry_row(self, expiry):
        return dict(loaded_data(), MaLo=7, MaThuoc=3, SoLuongTon=30,
                    TenThuoc='A', HanSuDung=expiry)

    def test_expiring_default_days(self):
        self.expiry.return_value = ([self.expiry_row(TODAY + timedelta(days=30))], 1)
        response = self.send('GET', INVENTORY + '/expiring')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['items'][0]['TrangThaiHan'], 'EXPIRING')
        self.assertEqual(response.json['as_of'], TODAY.isoformat())
        self.expiry.assert_called_once_with(TODAY, TODAY + timedelta(days=30), 'expiring', 1, 20)

    def test_expired_separate_status(self):
        self.expiry.return_value = ([self.expiry_row(TODAY - timedelta(days=1))], 1)
        response = self.send('GET', INVENTORY + '/expiring?status=expired&days=7')
        self.assertEqual(response.json['code'], 'EXPIRED_BATCHES_LISTED')
        self.assertEqual(response.json['items'][0]['TrangThaiHan'], 'EXPIRED')
        self.expiry.assert_called_once_with(TODAY, TODAY + timedelta(days=7), 'expired', 1, 20)

    def test_zero_day_window(self):
        self.assertEqual(self.send('GET', INVENTORY + '/expiring?days=0').status_code, 200)
        self.expiry.assert_called_once_with(TODAY, TODAY, 'expiring', 1, 20)

    def test_invalid_pagination_and_expiry_queries(self):
        for endpoint in (BASE, INVENTORY + '/summary', INVENTORY + '/low-stock', INVENTORY + '/expiring'):
            for query in ('page=0', 'per_page=101', 'page=1.5', 'page=abc', 'unknown=1', 'page=1&page=2'):
                self.assertEqual(self.send('GET', endpoint + '?' + query).status_code, 400)
        for query in ('days=-1', 'days=abc', 'days=1.5', 'days=36501', 'status=all'):
            self.assertEqual(self.send('GET', INVENTORY + '/expiring?' + query).status_code, 400)

    def test_anonymous_all_endpoints(self):
        with self.client.session_transaction() as state:
            state.pop('user_id')
        for method, path in self.endpoints():
            self.assertEqual(self.send(method, path).status_code, 401)
        self.product.assert_not_called()
        self.summary.assert_not_called()
        self.expiry.assert_not_called()

    def test_forbidden_roles_all_endpoints(self):
        for role in (0, 1, 99):
            self.user.VaiTro = role
            for method, path in self.endpoints():
                self.assertEqual(self.send(method, path).status_code, 403)
        self.product.assert_not_called()

    def test_live_lock(self):
        self.user.TrangThai = True
        for method, path in self.endpoints():
            self.login()
            self.assertEqual(self.send(method, path).json['code'], 'ACCOUNT_LOCKED')
            self.assertEqual(self.send('GET', INVENTORY + '/summary').status_code, 401)

    def test_csrf_all_mutations(self):
        for method, path in self.endpoints()[2:5]:
            for headers in ({}, {'X-CSRF-Token': 'wrong'},
                            {'X-CSRF-Token': self.token, 'Origin': 'https://evil.example'}):
                self.assertEqual(self.send(method, path, headers=headers).status_code, 403)
        self.product.assert_not_called()

    def test_json_errors(self):
        for method, path in (('POST', BASE), ('PUT', BASE + '/7')):
            for body in ('null', '[]', '{bad'):
                self.assertEqual(self.send(method, path, data=body, content_type='application/json').status_code, 400)
            self.assertEqual(self.send(method, path, data='text').status_code, 415)

    def test_database_failures_rollback_and_safe_response(self):
        for operation, method, path in (
            ('list_batches', 'GET', BASE), ('find_by_id', 'GET', BASE + '/7'),
            ('create', 'POST', BASE), ('update', 'PUT', BASE + '/7'),
        ):
            original = self.repo[operation].side_effect
            self.repo[operation].side_effect = SQLAlchemyError('private credentials SQL traceback')
            response = self.send(method, path)
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('private', response.get_data(as_text=True))
            self.repo[operation].side_effect = original
        for mock, path in ((self.summary, INVENTORY + '/summary'),
                           (self.summary, INVENTORY + '/low-stock'), (self.expiry, INVENTORY + '/expiring')):
            mock.side_effect = SQLAlchemyError('private')
            self.assertEqual(self.send('GET', path).status_code, 503)
            mock.side_effect = None
        self.assertEqual(self.rollback.call_count, 7)

    def test_fk_conflict_after_product_check(self):
        self.repo['create'].side_effect = IntegrityError('private', {}, SimpleNamespace(sqlstate='23503'))
        response = self.send()
        self.assertEqual((response.status_code, response.json['code']), (409, 'FOREIGN_KEY_CONFLICT'))
        self.commit.assert_not_called()
        self.rollback.assert_called_once()

    def test_commit_failure_and_product_database_failure(self):
        self.commit.side_effect = SQLAlchemyError('private')
        self.assertEqual(self.send().status_code, 503)
        self.commit.side_effect = None
        self.product.side_effect = SQLAlchemyError('private')
        self.assertEqual(self.send().status_code, 503)
        self.assertEqual(self.rollback.call_count, 2)


class BatchInventoryRepositoryTests(unittest.TestCase):
    def compile(self, query):
        return query.compile(dialect=postgresql.dialect())

    def test_create_initializes_stock_and_update_never_assigns_quantities(self):
        with patch.object(lo_thuoc_repository.db.session, 'add'), \
                patch.object(lo_thuoc_repository.db.session, 'flush'), \
                patch.object(lo_thuoc_repository.db.session, 'commit') as commit:
            batch = lo_thuoc_repository.create(3, loaded_data())
            self.assertEqual((batch.SoLuongNhap, batch.SoLuongTon), (100, 100))
            batch.SoLuongTon = 70
            data = dict(loaded_data(), SoLoSanXuat='NEW', SoLuongNhap=999, SoLuongTon=999, MaThuoc=4)
            lo_thuoc_repository.update(batch, data)
            self.assertEqual((batch.SoLuongNhap, batch.SoLuongTon, batch.MaThuoc), (100, 70, 3))
            self.assertEqual(batch.SoLoSanXuat, 'NEW')
            commit.assert_not_called()

    def test_scoped_batch_lookup_and_lock(self):
        with patch.object(lo_thuoc_repository.db.session, 'execute') as execute:
            lo_thuoc_repository.find_by_id(3, 7, for_update=True)
            compiled = self.compile(execute.call_args.args[0])
            where = str(compiled).split('WHERE')[1]
            self.assertIn('"MaThuoc"', where)
            self.assertIn('"MaLo"', where)
            self.assertIn('FOR UPDATE', where)
            self.assertEqual(set(compiled.params.values()), {3, 7})

    def test_list_batches_scoped_and_paginated(self):
        with patch.object(lo_thuoc_repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 1
            execute.return_value.scalars.return_value.all.return_value = ['batch']
            self.assertEqual(lo_thuoc_repository.list_batches(3, 2, 5), (['batch'], 1))
            compiled = self.compile(execute.call_args.args[0])
            self.assertIn('"MaThuoc" =', str(compiled).split('WHERE')[1])
            self.assertIn('ORDER BY "LoThuoc"."MaLo"', str(compiled))
            self.assertIn('LIMIT', str(compiled))
            self.assertIn('OFFSET', str(compiled))

    def test_sum_multiple_batches_outer_join_for_missing_batches(self):
        with patch.object(inventory_repository, 'paginate', return_value=([], 0)) as paginate:
            inventory_repository.summary(1, 20)
            sql = str(self.compile(paginate.call_args.args[0]))
            self.assertIn('sum("LoThuoc"."SoLuongTon")', sql)
            self.assertIn('GROUP BY "LoThuoc"."MaThuoc"', sql)
            self.assertIn('LEFT OUTER JOIN', sql)
            self.assertIn('coalesce(', sql)
            self.assertIn('<= "Thuoc"."NguongTonKho"', sql)
            self.assertNotIn('DonVi_GiaThuoc', sql)
            self.assertNotIn('HanSuDung', sql)

    def test_low_stock_predicate_includes_threshold_equality(self):
        with patch.object(inventory_repository, 'paginate', return_value=([], 0)) as paginate:
            inventory_repository.summary(1, 20, low_stock=True)
            compiled = self.compile(paginate.call_args.args[0])
            self.assertIn('WHERE coalesce(', str(compiled))
            self.assertIn('<= "Thuoc"."NguongTonKho"', str(compiled).split('WHERE')[1])
            self.assertIn(0, compiled.params.values())

    def test_expiring_boundaries_exclude_expired_and_zero_stock(self):
        with patch.object(inventory_repository, 'paginate', return_value=([], 0)) as paginate:
            until = TODAY + timedelta(days=30)
            inventory_repository.expiring(TODAY, until, 'expiring', 1, 20)
            compiled = self.compile(paginate.call_args.args[0])
            where = str(compiled).split('WHERE')[1]
            self.assertIn('"SoLuongTon" >', where)
            self.assertIn('"HanSuDung" >=', where)
            self.assertIn('"HanSuDung" <=', where)
            self.assertIn(TODAY, compiled.params.values())
            self.assertIn(until, compiled.params.values())

    def test_expired_boundaries(self):
        with patch.object(inventory_repository, 'paginate', return_value=([], 0)) as paginate:
            inventory_repository.expiring(TODAY, TODAY + timedelta(days=30), 'expired', 1, 20)
            compiled = self.compile(paginate.call_args.args[0])
            where = str(compiled).split('WHERE')[1]
            self.assertIn('"SoLuongTon" >', where)
            self.assertIn('"HanSuDung" <', where)
            self.assertNotIn('"HanSuDung" <=', where)
            self.assertIn(TODAY, compiled.params.values())

    def test_paginate_aggregate_counts_groups_not_batches(self):
        with patch.object(inventory_repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 2
            execute.return_value.mappings.return_value.all.return_value = [
                dict(MaThuoc=3, TongSoLuongTon=150), dict(MaThuoc=4, TongSoLuongTon=0)]
            items, total = inventory_repository.summary(2, 5)
            self.assertEqual(total, 2)
            self.assertEqual([item['TongSoLuongTon'] for item in items], [150, 0])
            count_sql = str(self.compile(execute.call_args_list[0].args[0]))
            self.assertIn('count(*)', count_sql)
            self.assertIn('LEFT OUTER JOIN', count_sql)
            page_sql = str(self.compile(execute.call_args.args[0]))
            self.assertIn('LIMIT', page_sql)
            self.assertIn('OFFSET', page_sql)


if __name__ == '__main__':
    unittest.main()
