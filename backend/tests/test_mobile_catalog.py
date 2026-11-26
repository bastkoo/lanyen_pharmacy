"""Adapter công khai Mobile dùng chung service; không chạm dữ liệu thật."""
import unittest
from unittest.mock import patch

from app import create_app
from app.services.product_service import ProductError


class MobileCatalogTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'catalog-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'APP_ENV': 'development', 'OTP_DEV_ENABLED': True,
            'SESSION_COOKIE_SECURE': False,
            'AUTH_ALLOWED_ORIGINS': ['http://127.0.0.1:5500'],
            'MOBILE_AUTH_ALLOWED_ORIGINS': ['http://127.0.0.1:5510'],
        })
        self.client = self.app.test_client()

    def test_all_read_routes_reuse_existing_services(self):
        cases = [
            ('categories', 'category_service.list_categories', {'items': [], 'page': 1, 'pages': 0, 'total': 0}),
            ('products', 'product_service.list_public_products', {'items': [], 'page': 1, 'pages': 0, 'total': 0}),
            ('products/1', 'product_service.get_public_product', {'MaThuoc': 1}),
            ('promotions', 'public_promotion_service.list_programs', {'items': [], 'page': 1, 'pages': 0, 'total': 0}),
            ('promotions/1/products', 'public_promotion_service.list_products', {'items': [], 'page': 1, 'pages': 0, 'total': 0}),
        ]
        for path, target, data in cases:
            with self.subTest(path=path), patch('app.services.' + target, return_value=data) as service:
                mobile = self.client.get('/api/mobile/catalog/' + path,
                    headers={'Origin': 'http://127.0.0.1:5510'})
                web = self.client.get('/api/' + path)
                self.assertEqual(mobile.status_code, 200)
                self.assertEqual(mobile.json, web.json)
                self.assertEqual(mobile.headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:5510')
                self.assertNotIn('Set-Cookie', mobile.headers)
                self.assertEqual(service.call_count, 2)

    def test_cors_scoped_to_mobile_and_allowlist(self):
        with patch('app.services.category_service.list_categories', return_value={'items': []}):
            allowed = self.client.get('/api/mobile/catalog/categories', headers={'Origin': 'http://127.0.0.1:5510'})
            blocked = self.client.get('/api/mobile/catalog/categories', headers={'Origin': 'https://outside.example'})
            old = self.client.get('/api/categories', headers={'Origin': 'http://127.0.0.1:5510'})
        self.assertEqual(allowed.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5510')
        self.assertNotIn('Access-Control-Allow-Origin', blocked.headers)
        self.assertNotIn('Access-Control-Allow-Origin', old.headers)
        preflight = self.client.options('/api/mobile/catalog/products', headers={
            'Origin': 'http://127.0.0.1:5510', 'Access-Control-Request-Method': 'GET'})
        self.assertEqual(preflight.status_code, 200)
        self.assertEqual(preflight.headers['Access-Control-Allow-Methods'], 'GET, OPTIONS')
        self.assertEqual(self.client.post('/api/mobile/catalog/products', json={}).status_code, 405)

    def test_validation_and_service_errors_are_preserved(self):
        self.assertEqual(self.client.get('/api/mobile/catalog/products?page=0').status_code, 400)
        self.assertEqual(self.client.get('/api/mobile/catalog/products?search=a&search=b').status_code, 400)
        with patch('app.services.product_service.get_public_product', side_effect=ProductError('PRODUCT_NOT_FOUND', 404)):
            response = self.client.get('/api/mobile/catalog/products/99')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json, {'code': 'PRODUCT_NOT_FOUND'})
        self.assertEqual(response.headers['Cache-Control'], 'no-store')


if __name__ == '__main__':
    unittest.main()
