"""Giỏ JWT: kiểm tra chủ giỏ, CORS và tái sử dụng nghiệp vụ, không ghi DB thật."""
import unittest
from types import SimpleNamespace as NS
from unittest.mock import patch

import fakeredis
from app import create_app
from app.services import mobile_auth_service
from app.services.otp_service import AuthError


class MobileCartTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'mobile-cart-test-' * 3,
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

    def mock(self, path, **kwargs):
        patcher = patch(path, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def test_get_uses_jwt_owner_not_cookie_and_does_not_write_session(self):
        with self.client.session_transaction() as cookie:
            cookie['user_id'] = 999
        self.mock('app.services.cart_service.owner', side_effect=AssertionError('Web owner forbidden'))
        items = self.mock('app.services.cart_service.carts.list_items', return_value=[])
        self.mock('app.services.cart_service.carts.catalog_details', return_value={})
        response = self.client.get('/api/mobile/cart', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json['authenticated'])
        self.assertEqual(response.json['items'], [])
        items.assert_called_once_with(42)
        self.assertNotIn('Set-Cookie', response.headers)
        self.assertEqual(response.headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:5510')

    def test_add_delegates_stock_consultation_and_owner_to_existing_service(self):
        add = self.mock('app.services.cart_service.add_database')
        response = self.client.post('/api/mobile/cart/items', headers=self.headers, json={'MaThuoc': 7, 'MaDonGia': 8})
        self.assertEqual(response.json, {'code': 'CART_ITEM_ADDED'})
        add.assert_called_once_with(42, [(7, 8, 1)], check_stock=True)
        self.assertNotIn('Set-Cookie', response.headers)

    def test_rejects_invalid_payload_foreign_owner_and_service_errors(self):
        add = self.mock('app.services.cart_service.add_database')
        for body in ({'MaThuoc': 7}, {'MaThuoc': 7, 'MaDonGia': 8, 'MaNguoiDung': 999},
                     {'MaThuoc': 7, 'MaDonGia': True}, {'MaThuoc': 7, 'MaDonGia': 0}):
            self.assertEqual(self.client.post('/api/mobile/cart/items', headers=self.headers, json=body).status_code, 400)
        add.assert_not_called()
        self.mock('app.services.cart_service.db.session.rollback')
        for code in ('OUT_OF_STOCK', 'CONSULTATION_REQUIRED'):
            add.side_effect = AuthError(code, 409)
            result = self.client.post('/api/mobile/cart/items', headers=self.headers, json={'MaThuoc': 7, 'MaDonGia': 8})
            self.assertEqual(result.status_code, 409)
            self.assertEqual(result.json['code'], code)

    def test_bearer_customer_required_and_preflight_does_not_authenticate(self):
        add = self.mock('app.services.cart_service.add_database')
        self.assertEqual(self.client.get('/api/mobile/cart').status_code, 401)
        self.assertEqual(self.client.get('/api/mobile/cart', headers={'Authorization': 'Bearer invalid'}).status_code, 401)
        self.assertEqual(self.client.get('/api/mobile/cart', headers={'Authorization': 'Bearer ' + self.tokens['refresh_token']}).status_code, 401)
        self.user.VaiTro = 1
        self.assertEqual(self.client.post('/api/mobile/cart/items', headers=self.headers, json={'MaThuoc': 7, 'MaDonGia': 8}).status_code, 403)
        add.assert_not_called()
        response = self.client.options('/api/mobile/cart/items', headers={'Origin': 'http://127.0.0.1:5510',
            'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization, Content-Type'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization')


if __name__ == '__main__':
    unittest.main()
