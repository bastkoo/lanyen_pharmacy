"""Anonymous catalog API tests. Database reads are mocked; real connections forbidden."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError

from app import create_app


class PublicCatalogTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'public-catalog-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.categories = self.mock('app.repositories.loai_thuoc_repository.list_categories', return_value=([SimpleNamespace(MaLoaiThuoc=1, TenLoaiThuoc='Vitamin')], 1))
        self.find_category = self.mock('app.repositories.loai_thuoc_repository.find_by_id', return_value=SimpleNamespace(MaLoaiThuoc=1))
        self.product = SimpleNamespace(MaThuoc=7, MaLoaiThuoc=1, TenThuoc='Thuốc A', HinhAnh='https://example.com/image.png', MoTa='<b>Mô tả</b>', QuyCachDongGoi='Hộp 10 viên', NhaSanXuat='NSX', NuocSanXuat='Việt Nam', KeDon=True, NguongTonKho=5, MaVach='00123', PhanLoai=False)
        self.products = self.mock('app.repositories.thuoc_repository.list_products', return_value=([self.product], 1))
        self.mock('app.repositories.thuoc_repository.find_by_id', return_value=self.product)
        self.mock('app.repositories.chi_tiet_khuyen_mai_repository.active_for_products', return_value=[])
        self.find_category.return_value.TenLoaiThuoc = 'Vitamin'
        self.units = self.mock('app.repositories.don_vi_gia_thuoc_repository.public_units', return_value=[])
        self.stock = self.mock('app.services.inventory_service.usable_stock', return_value={7: 100})
        self.user = self.mock('app.repositories.nguoi_dung_repository.find_by_id')
        self.product_rollback = self.mock('app.repositories.thuoc_repository.rollback')
        self.category_rollback = self.mock('app.repositories.loai_thuoc_repository.rollback')
        self.writes = [self.mock(f'app.repositories.{repository}.{method}') for repository in ('thuoc_repository', 'loai_thuoc_repository') for method in ('create', 'update', 'remove', 'commit', 'lock_writes') if repository != 'thuoc_repository' or method != 'lock_writes']
        self.client = self.app.test_client()

    def mock(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        mocked = patcher.start()
        self.addCleanup(patcher.stop)
        return mocked

    def test_anonymous_categories_and_products_without_authentication(self):
        for path, code in (('/api/categories', 'CATEGORIES_LISTED'), ('/api/products', 'PRODUCTS_LISTED')):
            result = self.client.get(path)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json['code'], code)
            self.assertEqual(result.headers['Cache-Control'], 'no-store')
            self.assertEqual(result.headers['X-Content-Type-Options'], 'nosniff')
        self.categories.assert_called_once_with('', 1, 100)
        self.products.assert_called_once_with(search='', page=1, per_page=12, sort_by='TenThuoc', sort_order='asc')
        self.user.assert_not_called()
        for write in self.writes:
            write.assert_not_called()

    def test_public_product_projection_and_prescription_boolean(self):
        expected = {'MaThuoc', 'MaLoaiThuoc', 'TenThuoc', 'HinhAnh', 'MoTa', 'QuyCachDongGoi', 'NhaSanXuat', 'NuocSanXuat', 'KeDon', 'DonViGia'}
        for value in (True, False):
            self.product.KeDon = value
            item = self.client.get('/api/products').json['items'][0]
            self.assertEqual(set(item), expected)
            self.assertIs(item['KeDon'], value)
            self.assertEqual(item['QuyCachDongGoi'], 'Hộp 10 viên')

    def test_category_search_and_pagination_reuse_existing_query(self):
        response = self.client.get('/api/products?category_id=1&search=%20Thuốc%20&page=2&per_page=5')
        self.assertEqual(response.status_code, 200)
        self.find_category.assert_called_once_with(1)
        self.products.assert_called_once_with(search='Thuốc', category_id=1, page=2, per_page=5, sort_by='TenThuoc', sort_order='asc')
        self.assertEqual(response.json['page'], 2)
        self.assertEqual(response.json['per_page'], 5)

    def test_public_units_only_include_sale_fields_and_query_once_for_page(self):
        self.units.return_value = [SimpleNamespace(MaThuoc=7, MaDonGia=8, DonViTinh='Hộp', GiaBan=120000, SoLuongQuyDoi=100)]
        response = self.client.get('/api/products')
        self.assertEqual(response.json['items'][0]['DonViGia'], [
            {'MaDonGia': 8, 'DonViTinh': 'Hộp', 'GiaBan': 120000, 'ConHang': True}])
        self.units.assert_called_once_with([7])

    def test_public_detail_exposes_only_product_information_and_live_best_unit_offer(self):
        from datetime import date
        from decimal import Decimal
        for key in ('MaDuoc', 'MaVach', 'SoDangKy', 'DangBaoChe', 'CachDung', 'ChongChiDinh', 'BaoQuan'):
            setattr(self.product, key, 'Nội dung <b>nguyên văn</b>')
        self.units.return_value = [
            SimpleNamespace(MaThuoc=7, MaDonGia=8, DonViTinh='Vỉ', GiaBan=9000, SoLuongQuyDoi=10),
            SimpleNamespace(MaThuoc=7, MaDonGia=9, DonViTinh='Viên', GiaBan=1000, SoLuongQuyDoi=1)]
        offer = SimpleNamespace(MaChuongTrinh=3, MaThuoc=7, LoaiGiamGia=True, GiaTriGiam=Decimal('10'), SoLuong=10)
        program = SimpleNamespace(MaChuongTrinh=3, TenChuongTrinh='Ưu đãi', NgayBatDau=date(2000, 1, 1))
        with patch('app.repositories.chi_tiet_khuyen_mai_repository.active_for_products', return_value=[(offer, program)]):
            response = self.client.get('/api/products/7')
        self.assertEqual(response.status_code, 200)
        product = response.json['product']
        self.assertEqual(product['CachDung'], 'Nội dung <b>nguyên văn</b>')
        self.assertEqual(product['TenLoaiThuoc'], 'Vitamin')
        self.assertEqual(product['DonViGia'][0]['GiaKhuyenMai'], 8000)
        self.assertEqual(product['DonViGia'][1]['GiaKhuyenMai'], 900)
        self.assertNotIn('NguongTonKho', product)
        self.assertNotIn('SoLuongQuyDoi', product['DonViGia'][0])
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_public_detail_rejects_invalid_queries_and_missing_product(self):
        for query in ('promotion_id=0', 'promotion_id=1&promotion_id=2', 'unknown=1'):
            self.assertEqual(self.client.get('/api/products/7?' + query).status_code, 400)
        with patch('app.repositories.thuoc_repository.find_by_id', return_value=None):
            self.assertEqual(self.client.get('/api/products/7').json['code'], 'PRODUCT_NOT_FOUND')
        self.assertEqual(self.client.post('/api/products/7', json={}).status_code, 405)

    def test_public_detail_preserves_selected_upcoming_promotion(self):
        from datetime import timedelta
        from decimal import Decimal
        from app.services.inventory_service import current_date
        today = current_date()
        self.units.return_value = [SimpleNamespace(MaThuoc=7, MaDonGia=8, DonViTinh='Vỉ', GiaBan=9000, SoLuongQuyDoi=10)]
        program = SimpleNamespace(MaChuongTrinh=3, TenChuongTrinh='Sắp tới', NgayBatDau=today + timedelta(days=1), NgayKetThuc=today + timedelta(days=2))
        offer = SimpleNamespace(MaChuongTrinh=3, MaThuoc=7, LoaiGiamGia=False, GiaTriGiam=Decimal('100'), SoLuong=100)
        with patch('app.repositories.chuong_trinh_khuyen_mai_repository.find_by_id', return_value=program), \
                patch('app.repositories.chi_tiet_khuyen_mai_repository.find_by_id', return_value=offer):
            response = self.client.get('/api/products/7?promotion_id=3')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['product']['KhuyenMai']['TrangThai'], 'UPCOMING')
        self.assertEqual(response.json['product']['DonViGia'][0]['GiaKhuyenMai'], 8000)
        with patch('app.repositories.chuong_trinh_khuyen_mai_repository.find_by_id', return_value=program), \
                patch('app.repositories.chi_tiet_khuyen_mai_repository.find_by_id', return_value=None):
            self.assertEqual(self.client.get('/api/products/7?promotion_id=3').status_code, 404)

    def test_public_availability_depends_on_selected_unit_and_usable_batches(self):
        self.units.return_value = [
            SimpleNamespace(MaThuoc=7, MaDonGia=8, DonViTinh='Hộp', GiaBan=120000, SoLuongQuyDoi=100),
            SimpleNamespace(MaThuoc=7, MaDonGia=9, DonViTinh='Vỉ', GiaBan=12000, SoLuongQuyDoi=10)]
        for total, expected in ((0, [False, False]), (9, [False, False]), (10, [False, True]),
                                (20, [False, True]), (100, [True, True])):
            self.stock.return_value = {7: total} if total else {}
            result = self.client.get('/api/products').json
            self.assertEqual([unit['ConHang'] for unit in result['items'][0]['DonViGia']], expected)

    def test_missing_category_returns_not_found(self):
        self.find_category.return_value = None
        response = self.client.get('/api/products?category_id=999')
        self.assertEqual((response.status_code, response.json['code']), (404, 'CATEGORY_NOT_FOUND'))
        self.products.assert_not_called()

    def test_prescription_and_sort_combine_with_search_and_category(self):
        result = self.client.get('/api/products?category_id=1&search=A&ke_don=false&sort_order=desc')
        self.assertEqual(result.status_code, 200)
        self.products.assert_called_once_with(search='A', category_id=1, ke_don=False, page=1, per_page=12, sort_by='TenThuoc', sort_order='desc')

    def test_invalid_unknown_and_repeated_query_parameters(self):
        invalid = ('page=0', 'page=-1', 'page=a', 'page=2147483648', 'per_page=0', 'per_page=101', 'page=1&page=2', 'unknown=1', 'search=%00', 'search=' + 'a' * 256)
        for endpoint in ('categories', 'products'):
            for query in invalid:
                with self.subTest(endpoint=endpoint, query=query):
                    result = self.client.get(f'/api/{endpoint}?{query}')
                    self.assertEqual((result.status_code, result.json['code']), (400, 'INVALID_REQUEST'))
        for query in ('category_id=0', 'category_id=-1', 'category_id=x', 'category_id=1.5', 'category_id=2147483648', 'category_id=1&category_id=2', 'sort_by=NguongTonKho', 'sort_order=other', 'ke_don=0', 'ke_don=True', 'ke_don=false&ke_don=true'):
            self.assertEqual(self.client.get('/api/products?' + query).status_code, 400)
        self.products.assert_not_called()
        self.categories.assert_not_called()

    def test_public_endpoints_are_read_only_and_manager_writes_still_protected(self):
        for endpoint in ('categories', 'products'):
            for method in ('POST', 'PUT', 'PATCH', 'DELETE'):
                self.assertEqual(self.client.open('/api/' + endpoint, method=method).status_code, 405)
            self.assertEqual(self.client.get('/api/' + endpoint + '/7').status_code, 200 if endpoint == 'products' else 404)
            self.assertEqual(self.client.post('/api/manager/' + endpoint, json={}).status_code, 401)
            self.assertEqual(self.client.get('/api/manager/' + endpoint).status_code, 401)
        for write in self.writes:
            write.assert_not_called()

    def test_database_failures_are_safe_and_rolled_back(self):
        for endpoint, reader, rollback in (('categories', self.categories, self.category_rollback), ('products', self.products, self.product_rollback)):
            reader.side_effect = SQLAlchemyError('private database error')
            result = self.client.get('/api/' + endpoint)
            self.assertEqual((result.status_code, result.json), (503, {'code': 'DATABASE_UNAVAILABLE'}))
            self.assertNotIn('private', result.get_data(as_text=True))
            rollback.assert_called_once()

    def test_empty_catalog_and_explicit_origin_cors(self):
        self.products.return_value = ([], 0)
        response = self.client.get('/api/products', headers={'Origin': 'https://shop.example'})
        self.assertEqual(response.json['items'], [])
        self.assertEqual(response.json['pages'], 0)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'https://shop.example')
