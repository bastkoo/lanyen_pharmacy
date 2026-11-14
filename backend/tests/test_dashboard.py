"""Dashboard unit tests; repositories mocked, PostgreSQL connections forbidden."""
import unittest
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.repositories import dashboard_repository as repository


BASE = '/api/manager/dashboard'
TODAY = date(2026, 11, 14)


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'dashboard-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': [],
        })
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.user = SimpleNamespace(MaNguoiDung=12, VaiTro=2, TrangThai=False)
        self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', return_value=self.user)
        self.start_patch('app.services.dashboard_service.current_date', return_value=TODAY)
        self.counts = self.start_patch('app.repositories.dashboard_repository.counts',
                                      return_value={'orders': 3, 'customers': 9, 'revenue': 250000})
        self.orders = self.start_patch('app.repositories.dashboard_repository.recent_orders', return_value=[])
        self.series = self.start_patch('app.repositories.dashboard_repository.revenue_series', return_value=[])
        self.rollback = self.start_patch('app.repositories.thuoc_repository.rollback')
        self.client = self.app.test_client()
        with self.client.session_transaction() as state:
            state['user_id'] = 12

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        value = patcher.start()
        self.addCleanup(patcher.stop)
        return value

    def test_summary_real_contract_formula_and_period(self):
        response = self.client.get(BASE + '/summary?days=7')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['orders'], 3)
        self.assertEqual(response.json['customers'], 9)
        self.assertEqual(response.json['revenue']['amount'], '250000')
        self.assertEqual(response.json['revenue']['order_status'], 3)
        self.assertEqual(response.json['revenue']['payment_status'], 1)
        self.assertEqual(response.json['period']['timezone'], 'Asia/Ho_Chi_Minh')
        self.counts.assert_called_once_with(datetime(2026, 11, 8), datetime(2026, 11, 15))
        self.assertEqual(response.headers['Cache-Control'], 'no-store')

    def test_empty_database_zero_counts_and_revenue(self):
        self.counts.return_value = dict(orders=0, customers=0, revenue=0)
        response = self.client.get(BASE + '/summary')
        self.assertEqual(response.json['revenue']['amount'], '0')
        self.assertEqual(response.json['orders'], 0)
        self.assertEqual(response.json['customers'], 0)

    def test_large_money_serialized_without_float_loss(self):
        self.counts.return_value['revenue'] = 9007199254740993123
        self.assertEqual(self.client.get(BASE + '/summary').json['revenue']['amount'], '9007199254740993123')

    def test_dense_revenue_series_missing_days_are_zero(self):
        self.series.return_value = [dict(day=date(2026, 11, 8), amount=100000), dict(day=TODAY, amount=50000)]
        response = self.client.get(BASE + '/revenue?days=7')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json['has_data'])
        self.assertEqual(len(response.json['items']), 7)
        self.assertEqual(response.json['items'][0], {'date': '2026-11-08', 'amount': '100000'})
        self.assertEqual(response.json['items'][1]['amount'], '0')
        self.assertEqual(response.json['items'][-1]['amount'], '50000')
        self.assertEqual(response.json['total'], '150000')

    def test_no_orders_no_simulated_revenue(self):
        response = self.client.get(BASE + '/revenue')
        self.assertFalse(response.json['has_data'])
        self.assertEqual(response.json['total'], '0')
        self.assertEqual(len(response.json['items']), 30)
        self.assertTrue(all(point['amount'] == '0' for point in response.json['items']))

    def test_recent_orders_only_public_dashboard_fields(self):
        self.orders.return_value = [dict(MaDonHang=9007199254740993123, NgayDat=datetime(2026, 11, 14, 14, 30),
                                        TongThanhToan=9007199254740993123, TrangThaiDonHang=3)]
        response = self.client.get(BASE + '/recent-orders?days=7&limit=2')
        row = response.json['items'][0]
        self.assertEqual(set(row), {'MaDonHang', 'NgayDat', 'TongThanhToan', 'TrangThaiDonHang', 'TenTrangThai'})
        self.assertEqual(row['TenTrangThai'], 'Hoàn thành')
        self.assertEqual(row['TongThanhToan'], '9007199254740993123')
        self.assertEqual(row['MaDonHang'], '9007199254740993123')
        self.orders.assert_called_once_with(datetime(2026, 11, 8), datetime(2026, 11, 15), 2)

    def test_empty_recent_orders(self):
        self.assertEqual(self.client.get(BASE + '/recent-orders').json['items'], [])

    def test_periods_and_invalid_queries(self):
        for days in (7, 30, 90):
            response = self.client.get(BASE + f'/summary?days={days}')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['period']['days'], days)
        for endpoint in ('summary', 'revenue', 'recent-orders'):
            for query in ('days=0', 'days=8', 'days=7.5', 'days=abc', 'days=7&days=30', 'extra=1'):
                self.assertEqual(self.client.get(BASE + '/' + endpoint + '?' + query).status_code, 400)
        for value in ('0', '21', 'bad', '1.5'):
            self.assertEqual(self.client.get(BASE + '/recent-orders?limit=' + value).status_code, 400)

    def test_anonymous_and_roles(self):
        with self.client.session_transaction() as state:
            state.clear()
        for endpoint in ('summary', 'revenue', 'recent-orders'):
            self.assertEqual(self.client.get(BASE + '/' + endpoint).status_code, 401)
        with self.client.session_transaction() as state:
            state['user_id'] = 12
        for role in (0, 1, 99):
            self.user.VaiTro = role
            for endpoint in ('summary', 'revenue', 'recent-orders'):
                self.assertEqual(self.client.get(BASE + '/' + endpoint).status_code, 403)
        self.counts.assert_not_called()

    def test_locked_account(self):
        self.user.TrangThai = True
        self.assertEqual(self.client.get(BASE + '/summary').json['code'], 'ACCOUNT_LOCKED')
        self.assertEqual(self.client.get(BASE + '/summary').status_code, 401)

    def test_read_only_methods(self):
        for method in ('POST', 'PUT', 'DELETE', 'PATCH'):
            self.assertEqual(self.client.open(BASE + '/summary', method=method).status_code, 405)

    def test_database_failures_safe(self):
        for mocked, endpoint in ((self.counts, 'summary'), (self.series, 'revenue'), (self.orders, 'recent-orders')):
            mocked.side_effect = SQLAlchemyError('private credentials SQL traceback')
            response = self.client.get(BASE + '/' + endpoint)
            self.assertEqual(response.status_code, 503)
            self.assertNotIn('private', response.get_data(as_text=True))
        self.assertEqual(self.rollback.call_count, 3)


class DashboardRepositoryTests(unittest.TestCase):
    def test_counts_case_formula_no_order_item_join(self):
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.mappings.return_value.one.return_value = dict(orders=0, customers=0, revenue=0)
            repository.counts(datetime(2026, 11, 8), datetime(2026, 11, 15))
            compiled = execute.call_args.args[0].compile(dialect=postgresql.dialect())
            sql = str(compiled)
            self.assertIn('CASE WHEN', sql)
            self.assertIn('"TrangThaiDonHang" =', sql)
            self.assertIn('"TrangThaiThanhToan" =', sql)
            self.assertIn('"TongThanhToan"', sql)
            self.assertIn('"VaiTro" =', sql)
            self.assertIn('"NgayDat" >=', sql)
            self.assertIn('"NgayDat" <', sql)
            self.assertNotIn('ChiTietDonHang', sql)
            for value in (0, 1, 3): self.assertIn(value, compiled.params.values())

    def test_recent_query_limits_fields_and_stable_order(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.recent_orders(datetime(2026, 11, 8), datetime(2026, 11, 15), 5)
            sql = str(execute.call_args.args[0].compile(dialect=postgresql.dialect()))
            self.assertIn('"NgayDat" DESC', sql)
            self.assertIn('"MaDonHang" DESC', sql)
            self.assertIn('LIMIT', sql)
            for private in ('MaNguoiMua', 'GhiChu', 'MaNhanVien', 'SDT', 'HoTen'): self.assertNotIn(private, sql)

    def test_revenue_grouping_and_exact_status_filters(self):
        with patch.object(repository.db.session, 'execute') as execute:
            repository.revenue_series(datetime(2026, 11, 8), datetime(2026, 11, 15))
            compiled = execute.call_args.args[0].compile(dialect=postgresql.dialect())
            self.assertIn('GROUP BY date(', str(compiled))
            self.assertIn('sum("DonHang"."TongThanhToan")', str(compiled))
            self.assertIn(3, compiled.params.values())
            self.assertIn(1, compiled.params.values())


if __name__ == '__main__':
    unittest.main()
