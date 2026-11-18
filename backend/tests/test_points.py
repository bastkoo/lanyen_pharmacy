import unittest
from datetime import datetime
from types import SimpleNamespace as NS
from unittest.mock import Mock, patch

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.dialects import postgresql

from app import create_app
from app.repositories.diem_thuong_repository import list_owned as real_list_owned
from app.repositories import diem_thuong_repository as points
from app.services.points_service import redemption


class PointsTests(unittest.TestCase):
    def test_redemption_uses_whole_coins_and_never_exceeds_balance_or_total(self):
        self.assertEqual(redemption(25050, 300), (250, 25000))
        self.assertEqual(redemption(25050, 20), (20, 2000))
        for total, balance in [(99, 20), (0, 20), (25000, 0), (25000, -1)]:
            self.assertEqual(redemption(total, balance), (0, 0))

    def test_redemption_balance_query_scopes_owner_and_debit_uses_existing_ledger(self):
        result = Mock(); result.scalar_one.return_value = 25
        with self.app.app_context(), patch('app.extensions.db.session.execute', return_value=result) as execute:
            self.assertEqual(points.balance(12), 25)
            query = execute.call_args.args[0].compile(dialect=postgresql.dialect())
            self.assertIn(12, query.params.values())
            self.assertIn('BIGINT', str(query))
            self.assertIn('CASE', str(query))
        timestamp = datetime(2026, 11, 18, 10, 30)
        with self.app.app_context(), patch('app.extensions.db.session.add') as add:
            points.debit(12, 25, 45, timestamp)
        row = add.call_args.args[0]
        self.assertEqual((row.MaNguoiDung, row.SoDiem, row.LoaiGiaoDich), (12, 25, False))
        self.assertIn('#45', row.LyDo)
        self.assertEqual(row.ThoiGianTichDiem, timestamp)
        self.commit.assert_not_called()

    def setUp(self):
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'points-test-only-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example']})
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.user = NS(MaNguoiDung=12, HoTen='An', SDT='+84901234567', VaiTro=0, TrangThai=False, Email=None, AnhDaiDien=None)
        self.mock('app.services.auth_service.users.find_by_id', return_value=self.user)
        row = NS(MaDiemThuong=8, SoDiem=100, LoaiGiaoDich=True, LyDo='Tích điểm', ThoiGianTichDiem=datetime(2026, 11, 17, 10, 30), MaNguoiDung=12)
        self.list_owned = self.mock('app.services.points_service.points.list_owned', return_value=([row], 75, 21))
        self.rollback = self.mock('app.extensions.db.session.rollback')
        self.commit = self.mock('app.extensions.db.session.commit')
        self.client = self.app.test_client()
        with self.client.session_transaction() as state: state['user_id'] = 12

    def mock(self, target, **kwargs):
        patcher = patch(target, **kwargs); result = patcher.start(); self.addCleanup(patcher.stop); return result

    def test_own_points_balance_and_history_are_read_only_and_paginated(self):
        response = self.client.get('/api/auth/me/points?page=2&per_page=20')
        self.assertEqual(response.status_code, 200)
        self.list_owned.assert_called_once_with(12, 2, 20)
        self.assertEqual(response.json['balance'], 75); self.assertEqual(response.json['pages'], 2)
        self.assertNotIn('MaNguoiDung', response.json['items'][0])
        self.assertEqual(response.json['items'][0]['ThoiGianTichDiem'], '2026-11-17T10:30:00')
        self.assertEqual(response.headers['Cache-Control'], 'no-store'); self.commit.assert_not_called()

    def test_empty_ledger_and_query_boundaries(self):
        self.list_owned.return_value = ([], 0, 0)
        self.assertEqual(self.client.get('/api/auth/me/points').json['balance'], 0)
        for query in ['?MaNguoiDung=99', '?page=0', '?page=1&page=2', '?per_page=101', '?per_page=x']:
            self.assertEqual(self.client.get('/api/auth/me/points' + query).status_code, 400)
        self.assertEqual(self.client.post('/api/auth/me/points').status_code, 405)

    def test_auth_locked_and_database_errors_do_not_leak(self):
        self.list_owned.side_effect = SQLAlchemyError('private sql')
        response = self.client.get('/api/auth/me/points'); self.assertEqual(response.status_code, 503)
        self.assertNotIn('private sql', response.get_data(as_text=True)); self.rollback.assert_called()
        self.user.TrangThai = True
        self.assertEqual(self.client.get('/api/auth/me/points').status_code, 403)
        self.assertEqual(self.client.get('/api/auth/me/points').status_code, 401)

    def test_repository_scopes_both_queries_and_orders_latest_history(self):
        aggregate = Mock(); aggregate.one.return_value = (75, 21)
        history = Mock(); history.scalars.return_value.all.return_value = []
        with self.app.app_context(), patch('app.extensions.db.session.execute', side_effect=[aggregate, history]) as execute:
            self.assertEqual(real_list_owned(12, 2, 20), ([], 75, 21))
        for call in execute.call_args_list:
            query = call.args[0].compile(dialect=postgresql.dialect())
            self.assertIn('"MaNguoiDung"', str(query)); self.assertIn(12, query.params.values())
        total_sql = str(execute.call_args_list[0].args[0].compile(dialect=postgresql.dialect()))
        self.assertIn('BIGINT', total_sql); self.assertIn('CASE', total_sql)
        page_sql = str(execute.call_args_list[1].args[0].compile(dialect=postgresql.dialect()))
        self.assertIn('"ThoiGianTichDiem" DESC', page_sql); self.assertIn('LIMIT', page_sql)


if __name__ == '__main__': unittest.main()
