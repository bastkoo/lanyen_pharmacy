import unittest
from datetime import date
from decimal import Decimal
from types import SimpleNamespace as NS
from unittest.mock import patch

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.services.sale_pricing import smallest_price, sale_price, cart_prices


def unit(unit_id=8, price=9000, conversion=10):
    return NS(MaDonGia=unit_id, MaThuoc=7, DonViTinh='Vỉ', GiaBan=price, SoLuongQuyDoi=conversion)


def detail(program_id=1, percent=True, discount='10', quantity=100):
    return NS(MaChuongTrinh=program_id, MaThuoc=7, LoaiGiamGia=percent,
              GiaTriGiam=Decimal(discount), SoLuong=quantity)


def program(program_id=1):
    return NS(MaChuongTrinh=program_id, TenChuongTrinh='Ưu đãi tháng 11',
              NgayBatDau=date(2026, 11, 17), NgayKetThuc=date(2026, 11, 20))


class PricingTests(unittest.TestCase):
    def test_percentage_is_calculated_on_smallest_unit_then_scaled(self):
        base = smallest_price([unit(), unit(9, 1000, 1)])
        self.assertEqual(base, Decimal(1000))
        self.assertEqual(sale_price(unit(), detail(), base), 8000)
        self.assertNotEqual(sale_price(unit(), detail(), base), 8100)

    def test_direct_discount_rounding_free_price_and_unconfigured_small_unit(self):
        self.assertEqual(sale_price(unit(price=1000), detail(percent=False, discount='0.05'), Decimal(100)), 1000)
        self.assertEqual(sale_price(unit(price=1000), detail(percent=False, discount='0.15'), Decimal(100)), 999)
        self.assertEqual(sale_price(unit(), detail(percent=False, discount='1000'), Decimal(1000)), 0)
        self.assertEqual(smallest_price([unit(price=9000, conversion=10)]), Decimal(900))
        self.assertIsNone(sale_price(unit(conversion=0), detail(), Decimal(1000)))

    def test_best_program_is_not_stacked_and_quota_counts_smallest_units(self):
        selected, base = unit(), unit(9, 1000, 1)
        offers = [(detail(1, quantity=10), program(1)), (detail(2, discount='20', quantity=20), program(2))]
        result = cart_prices([(7, 8, 3)], {(7, 8): (NS(), selected)}, [selected, base], offers)[0]
        self.assertEqual(result['KhuyenMai']['MaChuongTrinh'], 2)
        self.assertEqual(result['GiaBan'], 7000)
        self.assertEqual(result['SoLuongKhuyenMai'], 2)
        self.assertEqual(result['ThanhTien'], 23000)
        self.assertEqual(offers[1][0].SoLuong, 20, 'Quoting must not mutate the database quota')

    def test_quota_is_shared_between_units_and_recomputed_on_every_quote(self):
        selected, base = unit(), unit(9, 1000, 1)
        catalog = {(7, 8): (NS(), selected), (7, 9): (NS(), base)}
        entries = [(7, 8, 1), (7, 9, 10)]
        offers = [(detail(quantity=15), program())]
        for _ in range(2):
            result = cart_prices(entries, catalog, [selected, base], offers)
            self.assertEqual([line['SoLuongKhuyenMai'] for line in result], [1, 5])
            self.assertEqual([line['ThanhTien'] for line in result], [8000, 9500])

    def test_insufficient_quota_zero_discount_and_unavailable_units(self):
        selected, base = unit(), unit(9, 1000, 1)
        for offer in (detail(quantity=9), detail(percent=False, discount='0')):
            result = cart_prices([(7, 8, 1)], {(7, 8): (NS(), selected)}, [selected, base], [(offer, program())])[0]
            self.assertIsNone(result['KhuyenMai'])
            self.assertEqual(result['ThanhTien'], 9000)
        self.assertEqual(cart_prices([(7, 8, 1)], {}, [], []), [None])


class PublicPromotionTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'public-promotions-test-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example']})
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.mock('app.services.public_promotion_service.current_date', return_value=date(2026, 11, 17))
        self.program = program()
        self.offer = detail()
        self.product = NS(MaThuoc=7, MaLoaiThuoc=1, TenThuoc='Paracetamol',
                          QuyCachDongGoi='Hộp 2 vỉ x 10 viên', HinhAnh=None, KeDon=False)
        from app.repositories.chuong_trinh_khuyen_mai_repository import list_public
        self.original_list = list_public
        self.list = self.mock('app.repositories.chuong_trinh_khuyen_mai_repository.list_public', return_value=([self.program], 1))
        self.find = self.mock('app.repositories.chuong_trinh_khuyen_mai_repository.find_by_id', return_value=self.program)
        self.records = self.mock('app.repositories.chi_tiet_khuyen_mai_repository.public_products', return_value=([(self.product, self.offer)], 1))
        self.units = self.mock('app.repositories.don_vi_gia_thuoc_repository.public_units', return_value=[unit(), unit(9, 1000, 1)])
        self.stock = self.mock('app.services.public_promotion_service.usable_stock', return_value={7: 25})
        self.rollback = self.mock('app.repositories.thuoc_repository.rollback')
        self.client = self.app.test_client()

    def mock(self, name, **kwargs):
        patcher = patch(name, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def test_public_list_and_products_are_read_only_without_login(self):
        listed = self.client.get('/api/promotions').json
        self.assertEqual(listed['items'][0]['TrangThai'], 'ACTIVE')
        self.list.assert_called_once_with(date(2026, 11, 17), 1, 12)
        response = self.client.get('/api/promotions/1/products')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        item = response.json['items'][0]
        self.assertEqual(item['DonViGia'][0]['GiaKhuyenMai'], 8000)
        self.assertEqual(item['DonViGia'][0]['SoLuongKhuyenMai'], 2)
        self.assertEqual(item['KhuyenMai']['SoLuong'], 100)
        self.assertNotIn('SoLuongQuyDoi', item['DonViGia'][0])
        self.units.assert_called_once_with([7])
        for path in ('/api/promotions', '/api/promotions/1/products'):
            self.assertEqual(self.client.post(path, json={}).status_code, 405)

    def test_upcoming_preview_empty_quota_and_ended_or_missing_program(self):
        self.program.NgayBatDau = date(2026, 11, 18)
        self.offer.SoLuong = 0
        result = self.client.get('/api/promotions/1/products').json
        self.assertEqual(result['promotion']['TrangThai'], 'UPCOMING')
        self.assertEqual(result['items'][0]['DonViGia'][0]['SoLuongKhuyenMai'], 0)
        self.program.NgayKetThuc = date(2026, 11, 16)
        self.assertEqual(self.client.get('/api/promotions/1/products').status_code, 404)
        self.find.return_value = None
        self.assertEqual(self.client.get('/api/promotions/1/products').json['code'], 'PROMOTION_NOT_FOUND')

    def test_upcoming_quota_does_not_depend_on_current_inventory(self):
        self.program.NgayBatDau = date(2026, 11, 18)
        self.offer.SoLuong = 25
        for stock in ({}, {7: 0}, {7: 5}, {7: 100}):
            self.stock.return_value = stock
            result = self.client.get('/api/promotions/1/products').json['items'][0]
            self.assertEqual([unit['SoLuongKhuyenMai'] for unit in result['DonViGia']], [2, 25])
            self.assertEqual(result['KhuyenMai']['SoLuong'], 25)
        self.stock.return_value = {}
        self.program.NgayBatDau = date(2026, 11, 17)
        result = self.client.get('/api/promotions/1/products').json['items'][0]
        self.assertEqual([unit['SoLuongKhuyenMai'] for unit in result['DonViGia']], [0, 0])

    def test_upcoming_quantity_smaller_than_conversion_still_shows_zero_large_units(self):
        self.program.NgayBatDau = date(2026, 11, 18)
        self.offer.SoLuong = 5
        self.stock.return_value = {}
        result = self.client.get('/api/promotions/1/products').json['items'][0]
        self.assertEqual([unit['SoLuongKhuyenMai'] for unit in result['DonViGia']], [0, 5])

    def test_invalid_query_empty_and_database_failure(self):
        for path in ('/api/promotions', '/api/promotions/1/products'):
            for query in ('page=0', 'per_page=101', 'page=1&page=2', 'unknown=1'):
                self.assertEqual(self.client.get(path + '?' + query).status_code, 400)
        self.list.return_value = ([], 0)
        self.assertEqual(self.client.get('/api/promotions').json['pages'], 0)
        self.list.side_effect = SQLAlchemyError('private secret')
        response = self.client.get('/api/promotions')
        self.assertEqual((response.status_code, response.json), (503, {'code': 'DATABASE_UNAVAILABLE'}))
        self.rollback.assert_called_once()

    def test_repository_date_scope_sort_and_active_quota_query(self):
        from app.repositories import chuong_trinh_khuyen_mai_repository as repository
        from app.repositories import chi_tiet_khuyen_mai_repository as detail_repository
        with self.app.app_context(), patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalar_one.return_value = 0
            execute.return_value.scalars.return_value.all.return_value = []
            self.original_list(date(2026, 11, 17), 1, 10)
            sql = str(execute.call_args.args[0].compile(dialect=postgresql.dialect()))
            self.assertIn('"NgayKetThuc" >=', sql)
            self.assertIn('ORDER BY "ChuongTrinhKhuyenMai"."NgayBatDau"', sql)
            detail_repository.active_for_products([7], date(2026, 11, 17))
            sql = str(execute.call_args.args[0].compile(dialect=postgresql.dialect()))
            self.assertIn('"NgayBatDau" <=', sql)
            self.assertIn('"NgayKetThuc" >=', sql)
            self.assertIn('"SoLuong" >', sql)
            detail_repository.active_for_products([7], date(2026, 11, 17), for_update=True)
            statement = execute.call_args.args[0]
            sql = str(statement.compile(dialect=postgresql.dialect()))
            self.assertIn('FOR UPDATE OF "ChiTietKhuyenMai"', sql)
            self.assertTrue(statement.get_execution_options()['populate_existing'])
