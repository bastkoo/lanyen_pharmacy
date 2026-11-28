"""Điểm danh/lịch sử dùng Redis và repositories giả; cấm ghi DB thật."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Lock
from types import SimpleNamespace as NS
from unittest.mock import MagicMock, patch

import fakeredis
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.services import mobile_auth_service, mobile_rewards_service as service


class MobileRewardsTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'rewards-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'APP_ENV': 'development', 'OTP_DEV_ENABLED': True, 'SESSION_COOKIE_SECURE': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
            'MOBILE_AUTH_ALLOWED_ORIGINS': ['http://127.0.0.1:5510'],
        })
        self.app.extensions['otp_redis'] = fakeredis.FakeRedis(decode_responses=True)
        self.user = NS(MaNguoiDung=42, HoTen='An', VaiTro=0, TrangThai=False,
                       SDT='+84901234567', Email=None, AnhDaiDien=None)
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.mock('app.services.auth_service.users.find_by_id', return_value=self.user)
        with self.app.app_context():
            self.tokens = mobile_auth_service.authenticated(self.user)
        self.client = self.app.test_client()
        self.headers = {'Authorization': 'Bearer ' + self.tokens['access_token'], 'Origin': 'http://127.0.0.1:5510'}
        self.now = self.mock('app.services.mobile_rewards_service.vietnam_now', return_value=datetime(2026, 11, 28, 14, 0))

    def mock(self, path, **kwargs):
        patcher = patch(path, **kwargs)
        value = patcher.start()
        self.addCleanup(patcher.stop)
        return value

    def test_read_balance_history_and_week_use_jwt_owner_and_vietnam_dates(self):
        rows = [NS(MaDiemThuong=1, SoDiem=5, LoaiGiaoDich=True,
                   LyDo='Điểm danh hằng ngày', ThoiGianTichDiem=datetime(2026, 11, 23, 10))]
        history = self.mock('app.services.mobile_rewards_service.points.list_owned', return_value=(rows, 9007199254740993, 1))
        self.mock('app.services.mobile_rewards_service.points.check_ins_between', return_value=[datetime(2026, 11, 23, 10)])
        with self.client.session_transaction() as cookie:
            cookie['user_id'] = 999
        response = self.client.get('/api/mobile/rewards?page=1', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json
        self.assertEqual(data['balance'], '9007199254740993')
        self.assertEqual(data['items'][0]['ThoiGianTichDiem'], '2026-11-23T10:00:00+07:00')
        self.assertEqual(data['week_start'], '2026-11-23')
        self.assertEqual([day['status'] for day in data['days']], ['claimed', 'missed', 'missed', 'missed', 'missed', 'today', 'upcoming'])
        self.assertEqual([day['reward'] for day in data['days']], [5, 5, 5, 5, 5, 5, 10])
        self.assertEqual(data['next_refresh_at'], '2026-11-29T00:00:00+07:00')
        history.assert_called_once_with(42, 1, 20)
        self.assertNotIn('Set-Cookie', response.headers)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:5510')

    def ledger(self):
        dates = []
        lock = self.mock('app.services.mobile_rewards_service.users.lock_by_id', return_value=self.user)
        lookup = self.mock('app.services.mobile_rewards_service.points.check_ins_between',
                           side_effect=lambda user, start, end: [d for d in dates if start <= d < end])
        create = self.mock('app.services.mobile_rewards_service.points.create_check_in',
                           side_effect=lambda user, amount, stamp: dates.append(stamp))
        commit = self.mock('app.services.mobile_rewards_service.db.session.commit')
        return dates, lock, lookup, create, commit

    def test_daily_reward_is_idempotent_and_sunday_gets_ten(self):
        dates, lock, lookup, create, commit = self.ledger()
        response = self.client.post('/api/mobile/rewards/check-in', headers=self.headers, json={})
        self.assertEqual(response.json['awarded'], '5')
        self.assertEqual(self.client.post('/api/mobile/rewards/check-in', headers=self.headers, json={}).json['awarded'], '0')
        self.now.return_value = datetime(2026, 11, 29, 23, 59, 59)
        self.assertEqual(self.client.post('/api/mobile/rewards/check-in', headers=self.headers, json={}).json['awarded'], '10')
        self.assertEqual(len(dates), 2)
        self.assertEqual([call.args[1] for call in create.call_args_list], [5, 10])
        self.now.return_value = datetime(2026, 11, 30, 0, 0)
        with self.app.app_context():
            week = service.week_status(42, self.now.return_value)
        self.assertEqual(week['week_start'], '2026-11-30')
        self.assertEqual([d['status'] for d in week['days']], ['today'] + ['upcoming'] * 6)
        self.assertEqual(len(dates), 2)  # Sang tuần không xóa lịch sử cũ.
        self.assertEqual(self.client.post('/api/mobile/rewards/check-in', headers=self.headers, json={}).json['awarded'], '5')

    def test_date_is_read_after_acquiring_the_account_lock(self):
        self.ledger()
        def locked(user):
            self.now.return_value = datetime(2026, 11, 30, 0, 0)
            return self.user
        self.mock('app.services.mobile_rewards_service.users.lock_by_id', side_effect=locked)
        self.now.return_value = datetime(2026, 11, 29, 23, 59, 59)
        result = self.client.post('/api/mobile/rewards/check-in', headers=self.headers, json={})
        self.assertEqual(result.json['date'], '2026-11-30')
        self.assertEqual(result.json['awarded'], '5')

    def test_parallel_devices_cannot_award_twice_under_the_same_account_lock(self):
        dates, lock, lookup, create, commit = self.ledger()
        gate = Lock()
        def locked(user):
            gate.acquire(timeout=5)
            return self.user
        lock.side_effect = locked
        commit.side_effect = gate.release
        def claim():
            with self.app.app_context():
                return service.check_in(42)['awarded']
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: claim(), range(2)))
        self.assertEqual(sorted(results), ['0', '5'])
        self.assertEqual(create.call_count, 1)
        self.assertEqual(len(dates), 1)

    def test_jwt_role_lock_validation_and_cors(self):
        check = self.mock('app.services.mobile_rewards_service.check_in')
        self.assertEqual(self.client.get('/api/mobile/rewards').status_code, 401)
        self.assertEqual(self.client.get('/api/mobile/rewards', headers={'Authorization': 'Bearer ' + self.tokens['refresh_token']}).status_code, 401)
        for body in ({'SoDiem': 100}, {'date': '2026-11-22'}, {'MaNguoiDung': 999}):
            self.assertEqual(self.client.post('/api/mobile/rewards/check-in', headers=self.headers, json=body).status_code, 400)
        for query in ('page=0', 'page=1&page=2', 'owner=999', 'page=nope'):
            self.assertEqual(self.client.get('/api/mobile/rewards?' + query, headers=self.headers).status_code, 400)
        check.assert_not_called()
        self.user.VaiTro = 1
        self.assertEqual(self.client.post('/api/mobile/rewards/check-in', headers=self.headers, json={}).status_code, 403)
        self.user.VaiTro = 0
        self.user.TrangThai = True
        self.assertEqual(self.client.get('/api/mobile/rewards', headers=self.headers).status_code, 403)
        response = self.client.options('/api/mobile/rewards/check-in', headers={'Origin': 'http://127.0.0.1:5510', 'Access-Control-Request-Method': 'POST'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization')
        self.assertNotIn('Access-Control-Allow-Origin', self.client.options('/api/mobile/rewards', headers={'Origin': 'https://outside.example'}).headers)

    def test_database_error_rolls_back_without_success_response(self):
        self.ledger()
        self.mock('app.services.mobile_rewards_service.points.create_check_in', side_effect=SQLAlchemyError())
        rollback = self.mock('app.services.mobile_rewards_service.db.session.rollback')
        response = self.client.post('/api/mobile/rewards/check-in', headers=self.headers, json={})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json, {'code': 'DATABASE_UNAVAILABLE'})
        rollback.assert_called_once()

    def test_repository_query_separates_checkin_from_order_points(self):
        from app.repositories import diem_thuong_repository as points
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        start = datetime(2026, 11, 23)
        with self.app.app_context(), patch.object(points.db.session, 'execute', return_value=result) as execute:
            points.check_ins_between(42, start, start + timedelta(days=7))
            compiled = execute.call_args.args[0].compile()
            self.assertIn('Điểm danh hằng ngày', compiled.params.values())
            self.assertIn(42, compiled.params.values())
            self.assertIn(start, compiled.params.values())
            self.assertIn(start + timedelta(days=7), compiled.params.values())
            self.assertIn('LoaiGiaoDich', str(compiled))


if __name__ == '__main__':
    unittest.main()
