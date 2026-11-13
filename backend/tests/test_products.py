"""Product unit/API tests: mocked repositories, real DB connections forbidden."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app import create_app
from app.repositories import thuoc_repository as repository


BASE = '/api/manager/products'


def valid_data():
    return dict(MaLoaiThuoc=2, HinhAnh='https://example.com/medicine.jpg',
                TenThuoc='Thuoc A', MoTa='Mo ta', MaDuoc='MD01', SoDangKy='SDK01',
                DangBaoChe='Vien', QuyCachDongGoi='Hop', NhaSanXuat='NSX',
                NuocSanXuat='Viet Nam', CachDung='Theo huong dan',
                ChongChiDinh='Theo huong dan', BaoQuan='Noi kho', NguongTonKho=0)


class ProductTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'product-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development',
            'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.repo = {name: self.start_patch('app.repositories.thuoc_repository.' + name)
                     for name in ('find_by_id', 'list_products', 'create', 'update',
                                  'has_references', 'remove', 'commit', 'rollback')}
        self.product = SimpleNamespace(MaThuoc=3, PhanLoai=False, **valid_data())
        self.repo['find_by_id'].return_value = self.product
        self.repo['list_products'].return_value = ([self.product], 1)
        self.repo['create'].side_effect = lambda data: SimpleNamespace(MaThuoc=3, **data)
        self.repo['update'].return_value = self.product
        self.repo['has_references'].return_value = False
        self.category = self.start_patch('app.repositories.loai_thuoc_repository.find_by_id',
                                         return_value=SimpleNamespace(MaLoaiThuoc=2))
        self.user = SimpleNamespace(MaNguoiDung=12, VaiTro=2, TrangThai=False)
        self.find_user = self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', return_value=self.user)
        self.client = self.app.test_client()
        self.token = 'test-csrf'
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

    def test_create_complete_data_default_false(self):
        response = self.send()
        self.assertEqual(response.status_code, 201)
        self.assertIs(response.json['product']['PhanLoai'], False)
        self.assertEqual(set(response.json['product']), set(valid_data()) | {'MaThuoc', 'PhanLoai'})
        self.repo['create'].assert_called_once_with(dict(valid_data(), PhanLoai=False))
        self.category.assert_called_once_with(2)
        self.repo['commit'].assert_called_once()

    def test_create_true_and_trim(self):
        response = self.send(json=dict(valid_data(), PhanLoai=True, TenThuoc='  Thuoc A  '))
        self.assertEqual(response.status_code, 201)
        self.assertIs(response.json['product']['PhanLoai'], True)
        self.assertEqual(response.json['product']['TenThuoc'], 'Thuoc A')

    def test_missing_each_required_field(self):
        for field in valid_data():
            body = valid_data()
            del body[field]
            for method, path in (('POST', BASE), ('PUT', BASE + '/3')):
                with self.subTest(field=field, method=method):
                    self.assertEqual(self.send(method, path, json=body).status_code, 400)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()

    def test_required_strings_blank_null_wrong_type(self):
        for field, original in valid_data().items():
            if not isinstance(original, str):
                continue
            for value in ('', ' \t\n', None, 12, True, [], {}, 'a\x00b'):
                with self.subTest(field=field, value=value):
                    self.assertEqual(self.send(json=dict(valid_data(), **{field: value})).status_code, 400)

    def test_string_length_limits(self):
        limits = dict(TenThuoc=255, MaDuoc=50, SoDangKy=100, DangBaoChe=255,
                      QuyCachDongGoi=255, NhaSanXuat=255, NuocSanXuat=255)
        for field, limit in limits.items():
            with self.subTest(field=field):
                self.assertEqual(self.send(json=dict(valid_data(), **{field: 'a' * limit})).status_code, 201)
                self.assertEqual(self.send(json=dict(valid_data(), **{field: 'a' * (limit + 1)})).status_code, 400)

    def test_invalid_image_urls(self):
        for url in ('http://example.com/a.jpg', 'javascript:alert(1)', '//example.com/a',
                    'https://', 'not-a-url', 'https://example.com:99999/a',
                    'https://example.com/a b', 'https://example.com\\evil/a', 'data:image/png;base64,a'):
            with self.subTest(url=url):
                self.assertEqual(self.send(json=dict(valid_data(), HinhAnh=url)).status_code, 400)

    def test_strict_integer_fields(self):
        for field in ('NguongTonKho', 'MaLoaiThuoc'):
            for value in (-1, True, False, 1.0, '1', None, [], 2147483648):
                with self.subTest(field=field, value=value):
                    self.assertEqual(self.send(json=dict(valid_data(), **{field: value})).status_code, 400)
        self.assertEqual(self.send(json=dict(valid_data(), MaLoaiThuoc=0)).status_code, 400)

    def test_strict_boolean(self):
        for value in ('true', 'false', 0, 1, None, [], {}):
            self.assertEqual(self.send(json=dict(valid_data(), PhanLoai=value)).status_code, 400)

    def test_forbid_id_and_unknown_fields(self):
        for field in ('MaThuoc', 'GhiChu', 'VaiTro', 'extra'):
            for method, path in (('POST', BASE), ('PUT', BASE + '/3')):
                self.assertEqual(self.send(method, path, json=dict(valid_data(), **{field: 1})).status_code, 400)

    def test_category_not_found(self):
        self.category.return_value = None
        for method, path in (('POST', BASE), ('PUT', BASE + '/3')):
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (404, 'CATEGORY_NOT_FOUND'))
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()
        self.repo['commit'].assert_not_called()

    def test_no_uniqueness_rule_for_codes(self):
        self.assertEqual(self.send().status_code, 201)
        self.assertEqual(self.send().status_code, 201)
        self.assertEqual(self.repo['create'].call_count, 2)

    def test_update_with_and_without_boolean(self):
        for body in (valid_data(), dict(valid_data(), PhanLoai=True)):
            self.assertEqual(self.send('PUT', BASE + '/3', json=body).status_code, 200)
            self.repo['update'].assert_called_with(self.product, body)
        self.repo['find_by_id'].assert_called_with(3, for_update=True)
        self.assertEqual(self.repo['commit'].call_count, 2)

    def test_missing_product(self):
        self.repo['find_by_id'].return_value = None
        for method in ('GET', 'PUT', 'DELETE'):
            response = self.send(method, BASE + '/999')
            self.assertEqual((response.status_code, response.json['code']), (404, 'PRODUCT_NOT_FOUND'))
        self.repo['update'].assert_not_called()
        self.repo['remove'].assert_not_called()

    def test_detail(self):
        response = self.send('GET', BASE + '/3')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['product']['MaThuoc'], 3)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_list_search_filters_sort_pagination(self):
        response = self.send('GET', BASE + '?search=SDK&category_id=2&phan_loai=false&page=2&per_page=5&sort_by=TenThuoc&sort_order=desc')
        self.assertEqual(response.status_code, 200)
        self.repo['list_products'].assert_called_once_with(search='SDK', category_id=2, phan_loai=False,
            page=2, per_page=5, sort_by='TenThuoc', sort_order='desc')
        self.assertEqual((response.json['total'], response.json['pages']), (1, 1))
        self.send('GET', BASE + '?phan_loai=true')
        self.assertIs(self.repo['list_products'].call_args.kwargs['phan_loai'], True)

    def test_list_defaults_and_empty(self):
        self.repo['list_products'].return_value = ([], 0)
        response = self.send('GET')
        self.assertEqual((response.json['items'], response.json['pages']), ([], 0))
        self.repo['list_products'].assert_called_once_with(search='', page=1, per_page=20,
                                                          sort_by='MaThuoc', sort_order='asc')

    def test_invalid_queries(self):
        for query in ('page=0', 'page=1.5', 'page=bad', 'per_page=101', 'per_page=0',
                      'category_id=0', 'category_id=1.5', 'phan_loai=1', 'phan_loai=False',
                      'sort_by=TenThuoc;DROP TABLE Thuoc', 'sort_order=bad', 'other=1',
                      'page=1&page=2', 'search=' + 'a' * 256):
            with self.subTest(query=query):
                self.assertEqual(self.send('GET', BASE + '?' + query).status_code, 400)
        self.repo['list_products'].assert_not_called()

    def test_delete_unreferenced(self):
        self.assertEqual(self.send('DELETE', BASE + '/3').status_code, 200)
        self.repo['find_by_id'].assert_called_once_with(3, for_update=True)
        self.repo['has_references'].assert_called_once_with(3)
        self.repo['remove'].assert_called_once_with(3)
        self.repo['commit'].assert_called_once()

    def test_delete_referenced(self):
        self.repo['has_references'].return_value = True
        response = self.send('DELETE', BASE + '/3')
        self.assertEqual((response.status_code, response.json['code']), (409, 'PRODUCT_IN_USE'))
        self.repo['remove'].assert_not_called()
        self.repo['commit'].assert_not_called()
        self.repo['rollback'].assert_called_once()

    def endpoints(self):
        return [('GET', BASE), ('GET', BASE + '/3'), ('POST', BASE),
                ('PUT', BASE + '/3'), ('DELETE', BASE + '/3')]

    def test_anonymous_all_endpoints(self):
        with self.client.session_transaction() as state:
            state.pop('user_id')
        for method, path in self.endpoints():
            self.assertEqual(self.send(method, path).status_code, 401)
        self.repo['find_by_id'].assert_not_called()
        self.repo['create'].assert_not_called()

    def test_roles_all_endpoints(self):
        for role in (0, 1, 99):
            self.user.VaiTro = role
            for method, path in self.endpoints():
                self.assertEqual(self.send(method, path).status_code, 403)
        self.repo['list_products'].assert_not_called()
        self.repo['create'].assert_not_called()

    def test_live_locked_account_all_endpoints(self):
        self.user.TrangThai = True
        for method, path in self.endpoints():
            self.login()
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (403, 'ACCOUNT_LOCKED'))
            self.assertEqual(self.send('GET').status_code, 401)

    def test_deleted_user(self):
        self.find_user.return_value = None
        self.assertEqual(self.send('GET').status_code, 401)

    def test_csrf_all_writes(self):
        for method, path in self.endpoints()[2:]:
            for headers in ({}, {'X-CSRF-Token': 'wrong'},
                            {'X-CSRF-Token': self.token, 'Origin': 'https://evil.example'}):
                self.assertEqual(self.send(method, path, headers=headers).status_code, 403)
        self.repo['create'].assert_not_called()
        self.repo['update'].assert_not_called()
        self.repo['remove'].assert_not_called()

    def test_json_errors(self):
        for method, path in (('POST', BASE), ('PUT', BASE + '/3')):
            for body in ('null', '[]', '{bad'):
                self.assertEqual(self.send(method, path, data=body, content_type='application/json').status_code, 400)
            self.assertEqual(self.send(method, path, data='text').status_code, 415)

    def test_postgresql_errors_rollback_and_safe_response(self):
        for operation, method, path in (
            ('list_products', 'GET', BASE), ('find_by_id', 'GET', BASE + '/3'),
            ('create', 'POST', BASE), ('update', 'PUT', BASE + '/3'),
            ('has_references', 'DELETE', BASE + '/3'), ('remove', 'DELETE', BASE + '/3'),
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

    def test_category_database_failure(self):
        self.category.side_effect = SQLAlchemyError('private')
        self.assertEqual(self.send().status_code, 503)
        self.repo['rollback'].assert_called_once()
        self.repo['create'].assert_not_called()

    def test_fk_races_create_update_delete(self):
        for operation, method, path, code in (
            ('create', 'POST', BASE, 'FOREIGN_KEY_CONFLICT'),
            ('update', 'PUT', BASE + '/3', 'FOREIGN_KEY_CONFLICT'),
            ('remove', 'DELETE', BASE + '/3', 'PRODUCT_IN_USE'),
        ):
            self.repo[operation].side_effect = IntegrityError('private', {}, SimpleNamespace(sqlstate='23503'))
            response = self.send(method, path)
            self.assertEqual((response.status_code, response.json['code']), (409, code))
        self.repo['commit'].assert_not_called()
        self.assertEqual(self.repo['rollback'].call_count, 3)

    def test_other_integrity_errors(self):
        self.repo['create'].side_effect = IntegrityError('private', {}, Exception('private'))
        response = self.send()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.get_data(as_text=True))


class ProductRepositoryTests(unittest.TestCase):
    def compile(self, statement):
        return statement.compile(dialect=postgresql.dialect())

    def test_search_all_columns_filter_and_stable_sort(self):
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 0
            execute.return_value.scalars.return_value.all.return_value = []
            repository.list_products('%_', 2, False, 2, 5, 'TenThuoc', 'desc')
            compiled = self.compile(execute.call_args.args[0])
            sql = str(compiled)
            where = sql.split('WHERE')[1].split('ORDER BY')[0]
            for field in ('TenThuoc', 'MaDuoc', 'SoDangKy', 'MaLoaiThuoc', 'PhanLoai'):
                self.assertIn('"' + field + '"', where)
            self.assertIn('/%/_', compiled.params.values())
            self.assertIn('"TenThuoc" DESC, "Thuoc"."MaThuoc" ASC', sql)
            self.assertIn('LIMIT', sql)
            self.assertIn('OFFSET', sql)
            self.assertIn(5, compiled.params.values())

    def test_reference_query_covers_every_foreign_key(self):
        from app.models.thuoc import Thuoc
        expected = {table.name for table in Thuoc.metadata.tables.values()
                    for fk in table.foreign_keys if fk.column.table is Thuoc.__table__}
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = True
            self.assertTrue(repository.has_references(3))
            sql = str(self.compile(execute.call_args.args[0]))
            self.assertEqual({model.__tablename__ for model in repository.REFERENCE_MODELS}, expected)
            for table in expected:
                self.assertIn('FROM "' + table + '"', sql)
            self.assertEqual(sql.count('EXISTS'), len(expected))

    def test_delete_parent_only(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.remove(3)
            sql = str(self.compile(execute.call_args.args[0]))
            self.assertIn('DELETE FROM "Thuoc"', sql)
            self.assertNotIn('CASCADE', sql)

    def test_for_update_lock(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.find_by_id(3, for_update=True)
            self.assertIn('FOR UPDATE', str(self.compile(execute.call_args.args[0])))

    def test_create_and_update_flush_without_commit(self):
        with patch.object(repository.db.session, 'add') as add, \
                patch.object(repository.db.session, 'flush') as flush, \
                patch.object(repository.db.session, 'commit') as commit:
            product = repository.create(dict(valid_data(), PhanLoai=False))
            add.assert_called_once_with(product)
            repository.update(product, dict(valid_data(), TenThuoc='Updated', PhanLoai=True))
            self.assertEqual(product.TenThuoc, 'Updated')
            self.assertIs(product.PhanLoai, True)
            self.assertEqual(flush.call_count, 2)
            commit.assert_not_called()


if __name__ == '__main__':
    unittest.main()
