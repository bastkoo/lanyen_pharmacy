"""Unit/price APIs with repository mocks; PostgreSQL connections forbidden."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import create_app
from app.repositories import don_vi_gia_thuoc_repository as repository


BASE = '/api/manager/products/3/units'


def valid_data():
    return dict(DonViTinh='Hop', GiaBan=10000, SoLuongQuyDoi=10)


class UnitTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'unit-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development',
            'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.repo = {name: self.start_patch('app.repositories.don_vi_gia_thuoc_repository.' + name)
                     for name in ('find_by_id', 'list_units', 'create', 'update',
                                  'has_references', 'remove', 'commit', 'rollback')}
        self.unit = SimpleNamespace(MaDonGia=7, MaThuoc=3, **valid_data())
        self.repo['find_by_id'].return_value = self.unit
        self.repo['list_units'].return_value = ([self.unit], 1)
        self.repo['create'].side_effect = lambda product_id, data: SimpleNamespace(
            MaDonGia=7, MaThuoc=product_id, **data)
        self.repo['update'].return_value = self.unit
        self.repo['has_references'].return_value = False
        self.product = self.start_patch('app.repositories.thuoc_repository.find_by_id',
                                        return_value=SimpleNamespace(MaThuoc=3))
        self.user = SimpleNamespace(MaNguoiDung=12, VaiTro=2, TrangThai=False)
        self.find_user = self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', return_value=self.user)
        self.client = self.app.test_client()
        self.token = 'unit-test-csrf'
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
                ('PUT', BASE + '/7'), ('DELETE', BASE + '/7')]

    def test_create_and_trim(self):
        response = self.send(json=dict(valid_data(), DonViTinh='  Hop  '))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json['unit'], dict(valid_data(), MaDonGia=7, MaThuoc=3))
        self.repo['create'].assert_called_once_with(3, valid_data())
        self.repo['commit'].assert_called_once()

    def test_missing_each_field_create_and_update(self):
        for field in valid_data():
            body = valid_data()
            del body[field]
            for method, path in (('POST', BASE), ('PUT', BASE + '/7')):
                with self.subTest(field=field, method=method):
                    self.assertEqual(self.send(method, path, json=body).status_code, 400)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_name_validation(self):
        for name in ('', ' \n\t', 'a' * 51, None, 12, True, [], {}, 'a\x00b'):
            with self.subTest(name=name):
                self.assertEqual(self.send(json=dict(valid_data(), DonViTinh=name)).status_code, 400)
        self.assertEqual(self.send(json=dict(valid_data(), DonViTinh='a' * 50)).status_code, 201)

    def test_integer_types_and_bounds(self):
        for field in ('GiaBan', 'SoLuongQuyDoi'):
            for value in (-1, True, False, 1.0, '1', None, [], {}, 2147483648):
                for method, path in (('POST', BASE), ('PUT', BASE + '/7')):
                    with self.subTest(field=field, value=value, method=method):
                        self.assertEqual(self.send(method, path, json=dict(valid_data(), **{field: value})).status_code, 400)
        self.assertEqual(self.send(json=dict(valid_data(), GiaBan=0, SoLuongQuyDoi=1)).status_code, 201)
        self.assertEqual(self.send(json=dict(valid_data(), SoLuongQuyDoi=0)).status_code, 400)
        self.assertEqual(self.send(json=dict(valid_data(), GiaBan=2147483647, SoLuongQuyDoi=2147483647)).status_code, 201)

    def test_unknown_and_obsolete_fields(self):
        for key in ('MaDonGia', 'MaThuoc', 'TrangThai', 'MaDonVi', 'DonVi', 'HeSoQuyDoi', 'VaiTro'):
            for method, path in (('POST', BASE), ('PUT', BASE + '/7')):
                self.assertEqual(self.send(method, path, json=dict(valid_data(), **{key: 1})).status_code, 400)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_list_detail_and_pagination(self):
        response = self.send('GET', BASE + '?page=2&per_page=5')
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json['total'], response.json['pages']), (1, 1))
        self.repo['list_units'].assert_called_once_with(3, 2, 5)
        response = self.send('GET', BASE + '/7')
        self.assertEqual(response.json['unit']['MaDonGia'], 7)
        self.repo['find_by_id'].assert_called_once_with(3, 7, for_update=False)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_empty_list_and_invalid_pagination(self):
        self.repo['list_units'].return_value = ([], 0)
        response = self.send('GET')
        self.assertEqual((response.json['items'], response.json['pages']), ([], 0))
        for query in ('page=0', 'page=1.5', 'page=abc', 'per_page=101', 'per_page=0',
                      'page=2147483648', 'other=1', 'page=1&page=2'):
            self.assertEqual(self.send('GET', BASE + '?' + query).status_code, 400)

    def test_update(self):
        data = dict(DonViTinh='Vi', GiaBan=2000, SoLuongQuyDoi=2)
        self.assertEqual(self.send('PUT', BASE + '/7', json=data).status_code, 200)
        self.repo['find_by_id'].assert_called_once_with(3, 7, for_update=True)
        self.repo['update'].assert_called_once_with(self.unit, data)
        self.repo['commit'].assert_called_once()

    def test_delete_unreferenced(self):
        self.assertEqual(self.send('DELETE', BASE + '/7').status_code, 200)
        self.repo['find_by_id'].assert_called_once_with(3, 7, for_update=True)
        self.repo['has_references'].assert_called_once_with(7)
        self.repo['remove'].assert_called_once_with(3, 7)
        self.repo['commit'].assert_called_once()

    def test_delete_referenced(self):
        self.repo['has_references'].return_value = True
        response = self.send('DELETE', BASE + '/7')
        self.assertEqual((response.status_code, response.json['code']), (409, 'UNIT_IN_USE'))
        self.repo['remove'].assert_not_called()
        self.repo['commit'].assert_not_called()
        self.repo['rollback'].assert_called_once()

    def test_product_not_found_every_endpoint(self):
        self.product.return_value = None
        for method, path in self.endpoints():
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (404, 'PRODUCT_NOT_FOUND'))
        self.repo['find_by_id'].assert_not_called()
        self.repo['create'].assert_not_called()
        self.repo['list_units'].assert_not_called()

    def test_missing_unit_or_other_product(self):
        for unit in (None, SimpleNamespace(MaDonGia=7, MaThuoc=4, **valid_data())):
            self.repo['find_by_id'].return_value = unit
            for method in ('GET', 'PUT', 'DELETE'):
                response = self.send(method, BASE + '/7')
                self.assertEqual((response.status_code, response.json['code']), (404, 'UNIT_NOT_FOUND'))
        self.repo['update'].assert_not_called()
        self.repo['remove'].assert_not_called()
        self.repo['commit'].assert_not_called()

    def test_anonymous(self):
        with self.client.session_transaction() as state:
            state.pop('user_id')
        for method, path in self.endpoints():
            self.assertEqual(self.send(method, path).status_code, 401)
        self.product.assert_not_called()

    def test_roles(self):
        for role in (0, 1, 99):
            self.user.VaiTro = role
            for method, path in self.endpoints():
                self.assertEqual(self.send(method, path).status_code, 403)
        self.product.assert_not_called()

    def test_live_lock_and_deleted_account(self):
        self.user.TrangThai = True
        for method, path in self.endpoints():
            self.login()
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (403, 'ACCOUNT_LOCKED'))
            self.assertEqual(self.send('GET').status_code, 401)
        self.login()
        self.find_user.return_value = None
        self.assertEqual(self.send('GET').status_code, 401)

    def test_csrf(self):
        for method, path in self.endpoints()[2:]:
            for headers in ({}, {'X-CSRF-Token': 'wrong'},
                            {'X-CSRF-Token': self.token, 'Origin': 'https://evil.example'}):
                self.assertEqual(self.send(method, path, headers=headers).status_code, 403)
        self.product.assert_not_called()

    def test_json_errors(self):
        for method, path in (('POST', BASE), ('PUT', BASE + '/7')):
            for body in ('null', '[]', '{bad'):
                self.assertEqual(self.send(method, path, data=body, content_type='application/json').status_code, 400)
            self.assertEqual(self.send(method, path, data='text').status_code, 415)

    def test_database_errors_safe_rollback(self):
        for operation, method, path in (
            ('list_units', 'GET', BASE), ('find_by_id', 'GET', BASE + '/7'),
            ('create', 'POST', BASE), ('update', 'PUT', BASE + '/7'),
            ('has_references', 'DELETE', BASE + '/7'), ('remove', 'DELETE', BASE + '/7'),
            ('commit', 'POST', BASE),
        ):
            with self.subTest(operation=operation):
                original = self.repo[operation].side_effect
                self.repo[operation].side_effect = SQLAlchemyError('private SQL credentials traceback')
                response = self.send(method, path)
                self.assertEqual(response.status_code, 503)
                self.assertNotIn('private', response.get_data(as_text=True))
                self.repo[operation].side_effect = original
        self.assertEqual(self.repo['rollback'].call_count, 7)

    def test_product_database_error(self):
        self.product.side_effect = SQLAlchemyError('private')
        self.assertEqual(self.send().status_code, 503)
        self.repo['create'].assert_not_called()
        self.repo['rollback'].assert_called_once()

    def test_foreign_key_races(self):
        for operation, method, path, code in (
            ('create', 'POST', BASE, 'FOREIGN_KEY_CONFLICT'),
            ('update', 'PUT', BASE + '/7', 'FOREIGN_KEY_CONFLICT'),
            ('remove', 'DELETE', BASE + '/7', 'UNIT_IN_USE'),
        ):
            self.repo[operation].side_effect = IntegrityError('private SQL', {}, SimpleNamespace(sqlstate='23503'))
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (409, code))
        self.repo['commit'].assert_not_called()
        self.assertEqual(self.repo['rollback'].call_count, 3)

    def test_other_integrity_error(self):
        self.repo['create'].side_effect = IntegrityError('private', {}, Exception('private'))
        response = self.send()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.get_data(as_text=True))


class UnitRepositoryTests(unittest.TestCase):
    def compile(self, statement):
        return statement.compile(dialect=postgresql.dialect())

    def test_scoped_lookup_lock_and_delete(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.find_by_id(3, 7, for_update=True)
            compiled = self.compile(execute.call_args.args[0])
            self.assertIn('FOR UPDATE', str(compiled))
            for operation in (lambda: repository.find_by_id(3, 7), lambda: repository.remove(3, 7)):
                operation()
                compiled = self.compile(execute.call_args.args[0])
                where = str(compiled).split('WHERE')[1]
                self.assertIn('"MaThuoc"', where)
                self.assertIn('"MaDonGia"', where)
                self.assertEqual(set(compiled.params.values()), {3, 7})
                self.assertNotIn('CASCADE', str(compiled))
            self.assertIn('DELETE FROM "DonVi_GiaThuoc"', str(compiled))

    def test_paginated_list_scoped_to_product(self):
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 0
            execute.return_value.scalars.return_value.all.return_value = []
            self.assertEqual(repository.list_units(3, 2, 5), ([], 0))
            for invocation in execute.call_args_list:
                compiled = self.compile(invocation.args[0])
                self.assertIn('"MaThuoc" =', str(compiled))
                self.assertIn(3, compiled.params.values())
            self.assertIn('ORDER BY', str(compiled))
            self.assertIn('LIMIT', str(compiled))
            self.assertIn('OFFSET', str(compiled))

    def test_reference_query_covers_all_actual_foreign_keys(self):
        from app.models.don_vi_gia_thuoc import DonViGiaThuoc
        expected = {table.name for table in DonViGiaThuoc.metadata.tables.values()
                    for fk in table.foreign_keys if fk.column.table is DonViGiaThuoc.__table__}
        self.assertEqual({model.__tablename__ for model in repository.REFERENCE_MODELS}, expected)
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = True
            self.assertTrue(repository.has_references(7))
            sql = str(self.compile(execute.call_args.args[0]))
            self.assertEqual(sql.count('EXISTS'), len(expected))
            for table in expected:
                self.assertIn('FROM "' + table + '"', sql)

    def test_create_update_flush_without_committing(self):
        with patch.object(repository.db.session, 'add') as add, \
                patch.object(repository.db.session, 'flush') as flush, \
                patch.object(repository.db.session, 'commit') as commit:
            unit = repository.create(3, valid_data())
            self.assertEqual(unit.MaThuoc, 3)
            add.assert_called_once_with(unit)
            repository.update(unit, dict(DonViTinh='Vien', GiaBan=0, SoLuongQuyDoi=1))
            self.assertEqual((unit.DonViTinh, unit.GiaBan, unit.SoLuongQuyDoi), ('Vien', 0, 1))
            self.assertEqual(flush.call_count, 2)
            commit.assert_not_called()


if __name__ == '__main__':
    unittest.main()
