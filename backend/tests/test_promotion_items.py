"""Promotion detail APIs use repository mocks; no real PostgreSQL connections."""
import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import create_app
from app.models.chi_tiet_khuyen_mai import ChiTietKhuyenMai
from app.repositories import chi_tiet_khuyen_mai_repository as repository


BASE = '/api/manager/promotions/7/items'


def create_data(**overrides):
    return dict(dict(MaThuoc=3, LoaiGiamGia=True, GiaTriGiam=10, SoLuong=100), **overrides)


def edit_data(**overrides):
    return dict(dict(LoaiGiamGia=True, GiaTriGiam=20), **overrides)


class PromotionItemTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'promotion-item-test-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development',
            'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.repo = {name: self.start_patch('app.repositories.chi_tiet_khuyen_mai_repository.' + name)
                     for name in ('find_by_id', 'list_items', 'create', 'update', 'remove')}
        self.item = SimpleNamespace(MaChuongTrinh=7, **create_data(GiaTriGiam=Decimal('10.00')))
        self.repo['find_by_id'].return_value = None
        self.repo['list_items'].return_value = ([self.item], 1)
        self.repo['create'].side_effect = lambda promotion_id, data: SimpleNamespace(MaChuongTrinh=promotion_id, **data)
        self.repo['update'].side_effect = lambda item, data: SimpleNamespace(
            MaChuongTrinh=item.MaChuongTrinh, MaThuoc=item.MaThuoc, SoLuong=item.SoLuong, **data)
        self.parent = self.start_patch('app.repositories.chuong_trinh_khuyen_mai_repository.find_by_id', return_value=SimpleNamespace(MaChuongTrinh=7))
        self.product = self.start_patch('app.repositories.thuoc_repository.find_by_id', return_value=SimpleNamespace(MaThuoc=3))
        self.commit = self.start_patch('app.repositories.chuong_trinh_khuyen_mai_repository.commit')
        self.rollback = self.start_patch('app.repositories.chuong_trinh_khuyen_mai_repository.rollback')
        self.user = SimpleNamespace(MaNguoiDung=12, VaiTro=2, TrangThai=False)
        self.find_user = self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', return_value=self.user)
        self.client = self.app.test_client()
        self.token = 'item-csrf'
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
            kwargs.setdefault('json', create_data() if method == 'POST' else edit_data())
        return self.client.open(path, method=method, **kwargs)

    def endpoints(self):
        return [('GET', BASE), ('GET', BASE + '/3'), ('POST', BASE),
                ('PUT', BASE + '/3'), ('DELETE', BASE + '/3')]

    def existing(self):
        self.repo['find_by_id'].return_value = self.item

    def test_list_and_detail_exact_five_fields(self):
        result = self.send('GET', BASE + '?page=2&per_page=5')
        expected = dict(MaChuongTrinh=7, **create_data(GiaTriGiam='10.00'))
        self.assertEqual(result.json, dict(code='PROMOTION_ITEMS_LISTED', items=[expected], page=2, per_page=5, total=1, pages=1))
        self.repo['list_items'].assert_called_once_with(7, 2, 5)
        self.existing()
        self.assertEqual(self.send('GET', BASE + '/3').json, dict(code='PROMOTION_ITEM_FOUND', item=expected))
        self.repo['find_by_id'].assert_called_once_with(7, 3, for_update=False)
        self.commit.assert_not_called()

    def test_create_percentage_and_commit(self):
        result = self.send()
        self.assertEqual((result.status_code, result.json['code']), (201, 'PROMOTION_ITEM_CREATED'))
        self.assertEqual(result.json['item'], dict(MaChuongTrinh=7, **create_data(GiaTriGiam='10.00')))
        self.repo['create'].assert_called_once_with(7, create_data(GiaTriGiam=Decimal('10.00')))
        self.product.assert_called_once_with(3)
        self.commit.assert_called_once()

    def test_direct_money_decimal_precision_and_limits(self):
        for value in (0, 1000, 1000.25, 9999999999.99):
            with self.subTest(value=value):
                result = self.send(json=create_data(LoaiGiamGia=False, GiaTriGiam=value))
                self.assertEqual(result.status_code, 201)
                self.assertEqual(result.json['item']['GiaTriGiam'], f'{Decimal(str(value)):.2f}')
        for value in (-1, 10000000000, 0.001, 1.005, float('nan'), float('inf'), '10.00', True, None, [], {}):
            self.assertEqual(self.send(json=create_data(LoaiGiamGia=False, GiaTriGiam=value)).status_code, 400)

    def test_percentage_integer_1_to_100_create_and_edit(self):
        self.existing()
        for value in (0, -1, 101, 10.0, 1.5, '10', True, None):
            self.repo['find_by_id'].return_value = None
            self.assertEqual(self.send(json=create_data(GiaTriGiam=value)).status_code, 400)
            self.existing()
            self.assertEqual(self.send('PUT', BASE + '/3', json=edit_data(GiaTriGiam=value)).status_code, 400)
        for value in (1, 100):
            self.repo['find_by_id'].return_value = None
            self.assertEqual(self.send(json=create_data(GiaTriGiam=value)).status_code, 201)
            self.existing()
            self.assertEqual(self.send('PUT', BASE + '/3', json=edit_data(GiaTriGiam=value)).status_code, 200)

    def test_strict_boolean_and_required_fields(self):
        for value in (0, 1, 'true', 'false', None, [], {}):
            self.assertEqual(self.send(json=create_data(LoaiGiamGia=value)).status_code, 400)
        for name in create_data():
            body = create_data()
            del body[name]
            self.assertEqual(self.send(json=body).status_code, 400)
        self.existing()
        for name in edit_data():
            body = edit_data()
            del body[name]
            self.assertEqual(self.send('PUT', BASE + '/3', json=body).status_code, 400)

    def test_product_id_and_remaining_quantity_strict_integers(self):
        for name in ('MaThuoc', 'SoLuong'):
            for value in (-1, 1.5, 1.0, '1', True, None, 2147483648):
                self.assertEqual(self.send(json=create_data(**{name: value})).status_code, 400)
        self.assertEqual(self.send(json=create_data(MaThuoc=0)).status_code, 400)
        self.assertEqual(self.send(json=create_data(SoLuong=0)).status_code, 201)
        self.assertEqual(self.send(json=create_data(SoLuong=2147483647)).status_code, 201)

    def test_no_unknown_fields_or_fake_model_columns(self):
        for key in ('MaCTKM', 'MaChuongTrinh', 'PhanTramGiam', 'DieuKien', 'TrangThai'):
            self.assertEqual(self.send(json=create_data(**{key: 1})).status_code, 400)
        self.existing()
        for key in ('MaThuoc', 'MaChuongTrinh', 'SoLuong', 'MaCTKM', 'DieuKien'):
            self.assertEqual(self.send('PUT', BASE + '/3', json=edit_data(**{key: 3})).status_code, 400)

    def test_missing_product(self):
        self.product.return_value = None
        result = self.send()
        self.assertEqual((result.status_code, result.json['code']), (404, 'PRODUCT_NOT_FOUND'))
        self.repo['create'].assert_not_called()
        self.commit.assert_not_called()

    def test_missing_promotion_all_endpoints(self):
        self.parent.return_value = None
        for method, path in self.endpoints():
            result = self.send(method, path)
            self.assertEqual((result.status_code, result.json['code']), (404, 'PROMOTION_NOT_FOUND'))
        self.repo['create'].assert_not_called()
        self.repo['remove'].assert_not_called()

    def test_duplicate_composite_key_rejected(self):
        self.existing()
        result = self.send()
        self.assertEqual((result.status_code, result.json['code']), (409, 'PROMOTION_ITEM_EXISTS'))
        self.repo['create'].assert_not_called()
        self.commit.assert_not_called()
        self.rollback.assert_called_once()

    def test_same_product_in_different_promotions_allowed(self):
        for promotion_id in (7, 8):
            result = self.send(path=f'/api/manager/promotions/{promotion_id}/items')
            self.assertEqual(result.status_code, 201)
            self.assertEqual(result.json['item']['MaChuongTrinh'], promotion_id)

    def test_update_type_and_discount_without_replacing_remaining_quantity(self):
        self.existing()
        self.item.SoLuong = 17
        result = self.send('PUT', BASE + '/3', json=edit_data(LoaiGiamGia=False, GiaTriGiam=1500.50))
        self.assertEqual(result.json, dict(code='PROMOTION_ITEM_UPDATED', item=dict(MaChuongTrinh=7, MaThuoc=3, SoLuong=17, LoaiGiamGia=False, GiaTriGiam='1500.50')))
        self.repo['find_by_id'].assert_called_once_with(7, 3, for_update=True)
        self.repo['update'].assert_called_once_with(self.item, dict(LoaiGiamGia=False, GiaTriGiam=Decimal('1500.50')))
        self.commit.assert_called_once()

    def test_exhausted_item_stays_available_to_manager_without_reactivation(self):
        self.existing()
        self.item.SoLuong = 0
        result = self.send('PUT', BASE + '/3')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json['item']['SoLuong'], 0)
        self.assertEqual(self.send('GET', BASE + '/3').json['item']['SoLuong'], 0)

    def test_delete_only_scoped_item(self):
        self.existing()
        result = self.send('DELETE', BASE + '/3')
        self.assertEqual(result.json, dict(code='PROMOTION_ITEM_DELETED'))
        self.repo['find_by_id'].assert_called_once_with(7, 3, for_update=True)
        self.repo['remove'].assert_called_once_with(7, 3)
        self.commit.assert_called_once()

    def test_missing_or_other_promotion_item(self):
        for item in (None, SimpleNamespace(MaChuongTrinh=8, MaThuoc=3), SimpleNamespace(MaChuongTrinh=7, MaThuoc=4)):
            self.repo['find_by_id'].return_value = item
            for method in ('GET', 'PUT', 'DELETE'):
                result = self.send(method, BASE + '/3')
                self.assertEqual((result.status_code, result.json['code']), (404, 'PROMOTION_ITEM_NOT_FOUND'))
        self.repo['update'].assert_not_called()
        self.repo['remove'].assert_not_called()

    def test_empty_list_and_invalid_queries(self):
        self.repo['list_items'].return_value = ([], 0)
        self.assertEqual(self.send('GET').json, dict(code='PROMOTION_ITEMS_LISTED', items=[], total=0, page=1, per_page=20, pages=0))
        for query in ('page=0', 'page=2147483648', 'page=1.5', 'per_page=101', 'page=1&page=2', 'search=x', 'status=active'):
            self.assertEqual(self.send('GET', BASE + '?' + query).status_code, 400)

    def test_anonymous_all_endpoints(self):
        with self.client.session_transaction() as state:
            state.clear()
        for method, path in self.endpoints():
            self.assertEqual(self.send(method, path).status_code, 401)
        self.parent.assert_not_called()

    def test_customer_and_employee_forbidden(self):
        for role in (0, 1, 99):
            self.user.VaiTro = role
            for method, path in self.endpoints():
                result = self.send(method, path)
                self.assertEqual((result.status_code, result.json['code']), (403, 'FORBIDDEN'))
        self.parent.assert_not_called()

    def test_locked_deleted_and_role_changes(self):
        self.user.TrangThai = True
        for method, path in self.endpoints():
            self.login()
            self.assertEqual(self.send(method, path).json['code'], 'ACCOUNT_LOCKED')
            with self.client.session_transaction() as state:
                self.assertNotIn('user_id', state)
        self.login()
        self.find_user.return_value = None
        self.assertEqual(self.send('GET').status_code, 401)
        self.login()
        self.find_user.return_value = self.user
        self.user.TrangThai = False
        self.user.VaiTro = 1
        self.assertEqual(self.send('GET').status_code, 403)
        self.user.VaiTro = 2
        self.assertEqual(self.send('GET').status_code, 200)

    def test_csrf_and_origin_all_mutations(self):
        for method, path in self.endpoints()[2:]:
            for headers in ({}, {'X-CSRF-Token': 'wrong'}, {'X-CSRF-Token': self.token, 'Origin': 'https://evil.example'}):
                self.assertEqual(self.send(method, path, headers=headers).json['code'], 'CSRF_FAILED')
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()
        self.repo['remove'].assert_not_called()

    def test_json_body_and_media_type(self):
        for method, path in [('POST', BASE), ('PUT', BASE + '/3')]:
            for raw in ('null', '[]', 'true', '1', '"text"', '{', ''):
                self.assertEqual(self.send(method, path, data=raw, content_type='application/json').status_code, 400)
            self.assertEqual(self.send(method, path, data='x', content_type='text/plain').status_code, 415)

    def test_unique_and_fk_races(self):
        for state, code in [('23505', 'PROMOTION_ITEM_EXISTS'), ('23503', 'FOREIGN_KEY_CONFLICT')]:
            self.repo['create'].side_effect = IntegrityError('private SQL', {}, SimpleNamespace(sqlstate=state))
            result = self.send()
            self.assertEqual((result.status_code, result.json['code']), (409, code))
            self.assertNotIn('private', result.get_data(as_text=True))
        self.commit.assert_not_called()
        self.assertEqual(self.rollback.call_count, 2)

    def test_database_errors_safe_rollback(self):
        for name, method, path in [('list_items', 'GET', BASE), ('create', 'POST', BASE),
                                   ('update', 'PUT', BASE + '/3'), ('remove', 'DELETE', BASE + '/3')]:
            self.repo['find_by_id'].return_value = self.item if method != 'POST' else None
            self.repo[name].side_effect = SQLAlchemyError('private SQL password')
            result = self.send(method, path)
            self.assertEqual((result.status_code, result.json['code']), (503, 'DATABASE_UNAVAILABLE'))
            self.assertNotIn('private', result.get_data(as_text=True))
            self.repo[name].side_effect = None
        self.commit.assert_not_called()
        self.assertEqual(self.rollback.call_count, 4)

    def test_parent_product_and_commit_failures(self):
        for mocked in (self.parent, self.product, self.commit):
            mocked.side_effect = SQLAlchemyError('secret')
            self.assertEqual(self.send().json, dict(code='DATABASE_UNAVAILABLE'))
            mocked.side_effect = None
        self.assertEqual(self.rollback.call_count, 3)

    def test_unexpected_integrity_error_is_safe(self):
        self.repo['create'].side_effect = IntegrityError('secret', {}, Exception('secret'))
        self.assertEqual(self.send().json, dict(code='DATABASE_UNAVAILABLE'))

    def test_headers_on_success_and_failure(self):
        for response in (self.send(), self.send(headers={}), self.send('GET', headers={})):
            self.assertEqual(response.headers['Cache-Control'], 'no-store')
            self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')


class PromotionItemRepositoryTests(unittest.TestCase):
    def compile(self, statement):
        return statement.compile(dialect=postgresql.dialect())

    def test_lookup_lock_and_delete_use_both_keys(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.find_by_id(7, 3, for_update=True)
            self.assertIn('FOR UPDATE', str(self.compile(execute.call_args.args[0])))
            for action in (lambda: repository.find_by_id(7, 3), lambda: repository.remove(7, 3)):
                action()
                compiled = self.compile(execute.call_args.args[0])
                where = str(compiled).split('WHERE')[1]
                self.assertIn('"MaChuongTrinh"', where)
                self.assertIn('"MaThuoc"', where)
                self.assertEqual(set(compiled.params.values()), {7, 3})
                self.assertNotIn('CASCADE', str(compiled))
            self.assertIn('DELETE FROM "ChiTietKhuyenMai"', str(compiled))
            self.assertNotIn('DonVi_GiaThuoc', str(compiled))

    def test_list_scoped_paginated_sorted_by_product(self):
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 0
            execute.return_value.scalars.return_value.all.return_value = []
            self.assertEqual(repository.list_items(7, 2, 5), ([], 0))
            for invocation in execute.call_args_list:
                compiled = self.compile(invocation.args[0])
                self.assertIn('"MaChuongTrinh" =', str(compiled))
                self.assertIn(7, compiled.params.values())
            self.assertIn('ORDER BY "ChiTietKhuyenMai"."MaThuoc"', str(compiled))
            self.assertIn('LIMIT', str(compiled))
            self.assertIn('OFFSET', str(compiled))

    def test_create_update_whitelist_preserves_keys_and_quantity(self):
        with patch.object(repository.db.session, 'add') as add, \
                patch.object(repository.db.session, 'flush') as flush, \
                patch.object(repository.db.session, 'commit') as commit:
            item = repository.create(7, create_data(GiaTriGiam=Decimal('10.00')))
            add.assert_called_once_with(item)
            repository.update(item, dict(edit_data(LoaiGiamGia=False, GiaTriGiam=Decimal('1000.00')), MaThuoc=9, MaChuongTrinh=9, SoLuong=0))
            self.assertEqual((item.MaChuongTrinh, item.MaThuoc, item.SoLuong), (7, 3, 100))
            self.assertEqual((item.LoaiGiamGia, item.GiaTriGiam), (False, Decimal('1000.00')))
            self.assertEqual(flush.call_count, 2)
            commit.assert_not_called()

    def test_composite_primary_key_and_foreign_keys_unchanged(self):
        self.assertEqual({column.name for column in ChiTietKhuyenMai.__table__.primary_key}, {'MaChuongTrinh', 'MaThuoc'})
        self.assertEqual({fk.target_fullname for fk in ChiTietKhuyenMai.__table__.foreign_keys}, {'ChuongTrinhKhuyenMai.MaChuongTrinh', 'Thuoc.MaThuoc'})
        self.assertTrue(all(fk.ondelete is None for fk in ChiTietKhuyenMai.__table__.foreign_keys))


if __name__ == '__main__':
    unittest.main()
