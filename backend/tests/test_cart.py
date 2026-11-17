"""Cart API, ownership and login merge tests; production database access forbidden."""
import unittest
from types import SimpleNamespace as NS
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.controllers.auth_controller import authenticated
from app.services import cart_service


class CartTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'cart-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
        })
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.user = NS(MaNguoiDung=12, HoTen='An', SDT='+84901234567', VaiTro=0,
                       TrangThai=False, Email=None, AnhDaiDien=None)
        self.mock('app.services.auth_service.users.find_by_id', return_value=self.user)
        self.unit = NS(MaDonGia=8, MaThuoc=7, GiaBan=12000, DonViTinh='Vỉ', SoLuongQuyDoi=10)
        self.stock = self.mock('app.services.cart_service.usable_stock', return_value={7: 100})
        self.price_units = self.mock('app.services.cart_service.units.public_units', return_value=[self.unit])
        self.active_promotions = self.mock('app.services.cart_service.promotion_items.active_for_products', return_value=[])
        self.find_unit = self.mock('app.services.cart_service.units.find_by_id',
                                  side_effect=lambda p, u: self.unit if (p, u) == (7, 8) else None)
        self.lock = self.mock('app.services.cart_service.carts.lock_user', return_value=self.user)
        self.items = self.mock('app.services.cart_service.carts.list_items', return_value=[])
        self.create = self.mock('app.services.cart_service.carts.create',
                                side_effect=lambda u, p, d, q: NS(MaNguoiDung=u, MaThuoc=p, MaDonGia=d, SoLuong=q))
        self.remove = self.mock('app.services.cart_service.carts.remove')
        self.details = self.mock('app.services.cart_service.carts.catalog_details', return_value={
            (7, 8): (NS(TenThuoc='Thuốc A', QuyCachDongGoi='Hộp 10 vỉ'), self.unit)})
        self.commit = self.mock('app.services.cart_service.db.session.commit')
        self.rollback = self.mock('app.services.cart_service.db.session.rollback')
        self.client = self.app.test_client()
        self.csrf = self.client.get('/api/cart').json['csrf_token']

    def mock(self, path, **kwargs):
        patcher = patch(path, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def add(self, data=None, **headers):
        return self.client.post('/api/cart/items', json=data if data is not None else {'MaThuoc': 7, 'MaDonGia': 8},
                                headers={'X-CSRF-Token': self.csrf, **headers})

    def login_session(self):
        with self.client.session_transaction() as state:
            state['user_id'] = 12

    def test_guest_add_repeat_read_reload_and_delete_without_database_writes(self):
        self.assertEqual(self.add().status_code, 200)
        self.assertEqual(self.add().status_code, 200)
        result = self.client.get('/api/cart')
        self.assertEqual(result.json['items'][0]['SoLuong'], 2)
        self.assertEqual(result.json['total'], 24000)
        self.assertFalse(result.json['authenticated'])
        self.assertEqual(result.headers['Cache-Control'], 'no-store')
        with self.client.session_transaction() as state:
            self.assertEqual(state['guest_cart'], [[7, 8, 2]])
            self.assertNotIn('user_id', state)
        self.client.delete('/api/cart/items/8', headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(self.client.get('/api/cart').json['items'], [])
        self.commit.assert_not_called()
        self.create.assert_not_called()

    def test_unit_must_belong_to_product_and_client_cannot_supply_price_owner_or_quantity(self):
        for data in ({'MaThuoc': 9, 'MaDonGia': 8}, {'MaThuoc': 7, 'MaDonGia': 99}):
            self.assertEqual(self.add(data).status_code, 404)
        for data in ({}, {'MaThuoc': True, 'MaDonGia': 8}, {'MaThuoc': '7', 'MaDonGia': 8},
                     {'MaThuoc': 7, 'MaDonGia': 0}, {'MaThuoc': 7, 'MaDonGia': 8, 'GiaBan': 1},
                     {'MaThuoc': 7, 'MaDonGia': 8, 'MaNguoiDung': 999},
                     {'MaThuoc': 7, 'MaDonGia': 8, 'SoLuong': -1}):
            self.assertEqual(self.add(data).status_code, 400, data)
        self.assertEqual(self.client.post('/api/cart/items', data='bad', headers={'X-CSRF-Token': self.csrf}).status_code, 415)
        self.commit.assert_not_called()

    def test_csrf_and_origin_protection(self):
        self.assertEqual(self.client.post('/api/cart/items', json={'MaThuoc': 7, 'MaDonGia': 8}).status_code, 403)
        self.assertEqual(self.add(Origin='https://evil.example').status_code, 403)
        self.assertEqual(self.client.delete('/api/cart/items/8').status_code, 403)
        self.assertEqual(self.add(Origin='https://shop.example').status_code, 200)

    def test_no_usable_batches_or_insufficient_conversion_cannot_add_guest_or_account(self):
        for logged_in in (False, True):
            if logged_in:
                self.login_session()
            for totals in ({}, {7: 0}, {7: 9}):
                self.stock.return_value = totals
                response = self.add()
                self.assertEqual((response.status_code, response.json['code']), (409, 'OUT_OF_STOCK'))
        self.commit.assert_not_called()
        self.create.assert_not_called()

    def test_small_unit_can_be_added_but_large_unit_requires_its_full_conversion(self):
        self.stock.return_value = {7: 20}
        self.assertEqual(self.add().status_code, 200)
        self.unit.SoLuongQuyDoi = 100
        self.assertEqual(self.add().json['code'], 'OUT_OF_STOCK')
        self.unit.SoLuongQuyDoi = 20
        self.assertEqual(self.add().status_code, 200)

    def test_login_preserves_existing_guest_cart_even_if_stock_has_since_run_out(self):
        self.stock.return_value = {}
        with self.app.test_request_context():
            from flask import session
            session['guest_cart'] = [[7, 8, 2]]
            authenticated(self.user)
            self.assertNotIn('guest_cart', session)
            self.assertEqual(session['user_id'], 12)
        self.stock.assert_not_called()
        self.commit.assert_called_once()

    def test_logged_in_add_only_uses_current_owner_and_merges_same_unit(self):
        self.login_session()
        existing = NS(MaThuoc=7, MaDonGia=8, SoLuong=3)
        other_unit = NS(MaThuoc=7, MaDonGia=9, SoLuong=5)
        self.items.return_value = [existing, other_unit]
        self.assertEqual(self.add().status_code, 200)
        self.assertEqual(existing.SoLuong, 4)
        self.assertEqual(other_unit.SoLuong, 5)
        self.lock.assert_called_once_with(12)
        self.items.assert_called_once_with(12)
        self.commit.assert_called_once()
        self.create.assert_not_called()

    def test_logged_in_new_item_and_owned_removal(self):
        self.login_session()
        self.assertEqual(self.add().status_code, 200)
        self.create.assert_called_once_with(12, 7, 8, 1)
        item = NS(MaThuoc=7, MaDonGia=8, SoLuong=1)
        self.items.return_value = [item]
        self.assertTrue(self.client.get('/api/cart').json['authenticated'])
        self.client.delete('/api/cart/items/8', headers={'X-CSRF-Token': self.csrf})
        self.remove.assert_called_once_with(item)
        self.assertTrue(all(call.args == (12,) for call in self.items.call_args_list))

    def test_login_merges_before_session_rotation_exactly_once(self):
        existing = NS(MaThuoc=7, MaDonGia=8, SoLuong=3)
        self.items.return_value = [existing]
        with self.app.test_request_context():
            from flask import session
            session['guest_cart'] = [[7, 8, 2]]
            session['csrf_token'] = 'old'
            authenticated(self.user)
            self.assertEqual(existing.SoLuong, 5)
            self.assertNotIn('guest_cart', session)
            self.assertEqual(session['user_id'], 12)
            self.assertNotEqual(session['csrf_token'], 'old')
            authenticated(self.user)
            self.assertEqual(existing.SoLuong, 5)
            self.commit.assert_called_once()

    def test_failed_login_merge_keeps_guest_cart_and_does_not_authenticate(self):
        self.commit.side_effect = SQLAlchemyError('private connection information')
        with self.app.test_request_context():
            from flask import session
            session['guest_cart'] = [[7, 8, 2]]
            with self.assertRaises(cart_service.AuthError) as error:
                authenticated(self.user)
            self.assertEqual(error.exception.code, 'DATABASE_UNAVAILABLE')
            self.assertEqual(session['guest_cart'], [[7, 8, 2]])
            self.assertNotIn('user_id', session)
        self.rollback.assert_called_once()

    def test_invalid_unit_in_guest_merge_is_not_silently_dropped(self):
        with self.app.test_request_context():
            from flask import session
            session['guest_cart'] = [[7, 8, 2], [7, 99, 1]]
            with self.assertRaises(cart_service.AuthError):
                authenticated(self.user)
            self.assertEqual(len(session['guest_cart']), 2)
            self.assertNotIn('user_id', session)
        self.commit.assert_not_called()
        self.rollback.assert_called_once()

    def test_database_failure_returns_safe_error(self):
        self.login_session()
        self.commit.side_effect = SQLAlchemyError('private error')
        result = self.add()
        self.assertEqual((result.status_code, result.json), (503, {'code': 'DATABASE_UNAVAILABLE'}))
        self.rollback.assert_called_once()

    def test_quantity_and_cookie_limits_preserve_cart(self):
        with self.client.session_transaction() as state:
            state['guest_cart'] = [[7, 8, 2147483647]]
        self.assertEqual(self.add().json['code'], 'CART_QUANTITY_LIMIT')
        with self.client.session_transaction() as state:
            self.assertEqual(state['guest_cart'][0][2], 2147483647)
            state['guest_cart'] = [[i, i, 1] for i in range(100, 150)]
        self.assertEqual(self.add().json['code'], 'GUEST_CART_FULL')

    def test_unavailable_item_still_visible_and_removable(self):
        self.add()
        self.details.return_value = {}
        result = self.client.get('/api/cart').json
        self.assertEqual(len(result['items']), 1)
        self.assertIsNone(result['items'][0]['GiaBan'])
        self.assertEqual(result['total'], 0)
        self.assertEqual(self.client.delete('/api/cart/items/8', headers={'X-CSRF-Token': self.csrf}).status_code, 200)

    def test_cart_quotes_best_active_promotion_with_partial_quota_without_writes(self):
        from decimal import Decimal
        self.price_units.return_value = [self.unit, NS(MaThuoc=7, MaDonGia=9, DonViTinh='Viên', GiaBan=1000, SoLuongQuyDoi=1)]
        offer = NS(MaChuongTrinh=3, MaThuoc=7, LoaiGiamGia=True, GiaTriGiam=Decimal('10'), SoLuong=10)
        self.active_promotions.return_value = [(offer, NS(MaChuongTrinh=3, TenChuongTrinh='Giảm tháng 11'))]
        self.add()
        self.add()
        cart = self.client.get('/api/cart').json
        self.assertEqual(cart['items'][0]['GiaBan'], 11000)
        self.assertEqual(cart['items'][0]['GiaGoc'], 12000)
        self.assertEqual(cart['items'][0]['KhuyenMai']['LoaiGiamGia'], True)
        self.assertEqual(cart['items'][0]['KhuyenMai']['GiaTriGiam'], '10')
        self.assertEqual(cart['items'][0]['SoLuongKhuyenMai'], 1)
        self.assertEqual(cart['total'], 23000)
        self.assertEqual(offer.SoLuong, 10)
        self.commit.assert_not_called()

    def test_locked_user_cannot_read_or_write_account_cart(self):
        self.login_session()
        self.user.TrangThai = True
        self.assertEqual(self.client.get('/api/cart').status_code, 403)
        self.assertEqual(self.add().status_code, 403)
        self.lock.assert_not_called()
        self.commit.assert_not_called()

    def test_guest_quantity_update_and_stock_limit_preserve_session_on_failure(self):
        self.add()
        headers = {'X-CSRF-Token': self.csrf}
        result = self.client.put('/api/cart/items/8', json={'MaDonGia': 8, 'SoLuong': 3}, headers=headers)
        self.assertEqual(result.json['code'], 'CART_ITEM_UPDATED')
        self.assertEqual(self.client.get('/api/cart').json['items'][0]['SoLuong'], 3)
        self.stock.return_value = {7: 30}
        result = self.client.put('/api/cart/items/8', json={'MaDonGia': 8, 'SoLuong': 4}, headers=headers)
        self.assertEqual((result.status_code, result.json['code']), (409, 'OUT_OF_STOCK'))
        with self.client.session_transaction() as state:
            self.assertEqual(state['guest_cart'], [[7, 8, 3]])
        self.commit.assert_not_called()

    def test_unit_change_merges_destination_without_changing_product_or_owner(self):
        small = NS(MaThuoc=7, MaDonGia=9, DonViTinh='Viên', GiaBan=1000, SoLuongQuyDoi=1)
        self.find_unit.side_effect = lambda p, u: small if (p, u) == (7, 9) else None
        with self.client.session_transaction() as state:
            state['guest_cart'] = [[7, 8, 2], [7, 9, 5]]
        response = self.client.put('/api/cart/items/8', json={'MaDonGia': 9, 'SoLuong': 2}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(response.status_code, 200)
        with self.client.session_transaction() as state:
            self.assertEqual(state['guest_cart'], [[7, 9, 7]])
        self.login_session()
        source, target = NS(MaThuoc=7, MaDonGia=8, SoLuong=2), NS(MaThuoc=7, MaDonGia=9, SoLuong=5)
        self.items.return_value = [source, target]
        response = self.client.put('/api/cart/items/8', json={'MaDonGia': 9, 'SoLuong': 2}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(response.status_code, 200)
        self.assertEqual((source.MaDonGia, source.SoLuong), (9, 7))
        self.remove.assert_called_once_with(target)
        self.lock.assert_called_with(12)
        self.commit.assert_called_once()

    def test_update_validation_csrf_scoping_and_wrong_product_unit(self):
        self.add()
        headers = {'X-CSRF-Token': self.csrf}
        for data in ({'MaDonGia': 8, 'SoLuong': 0}, {'MaDonGia': 8, 'SoLuong': True},
                     {'MaDonGia': 8, 'SoLuong': '2'}, {'MaDonGia': 8, 'SoLuong': 2, 'MaNguoiDung': 99}):
            self.assertEqual(self.client.put('/api/cart/items/8', json=data, headers=headers).status_code, 400)
        self.assertEqual(self.client.put('/api/cart/items/8', json={'MaDonGia': 8, 'SoLuong': 2}).status_code, 403)
        self.assertEqual(self.client.put('/api/cart/items/99', json={'MaDonGia': 8, 'SoLuong': 2}, headers=headers).status_code, 404)
        self.assertEqual(self.client.put('/api/cart/items/8', json={'MaDonGia': 99, 'SoLuong': 2}, headers=headers).status_code, 404)

    def test_selected_quote_reallocates_promotion_quota_without_modifying_cart(self):
        from decimal import Decimal
        small = NS(MaThuoc=7, MaDonGia=9, DonViTinh='Viên', GiaBan=1000, SoLuongQuyDoi=1)
        self.price_units.return_value = [self.unit, small]
        product = NS(TenThuoc='A', QuyCachDongGoi='Hộp 10 vỉ')
        self.details.return_value = {(7, 8): (product, self.unit), (7, 9): (product, small)}
        self.active_promotions.return_value = [(NS(MaChuongTrinh=1, MaThuoc=7, LoaiGiamGia=True,
            GiaTriGiam=Decimal('10'), SoLuong=10), NS(MaChuongTrinh=1, TenChuongTrinh='Giảm 10%'))]
        with self.client.session_transaction() as state:
            state['guest_cart'] = [[7, 8, 1], [7, 9, 10]]
        response = self.client.post('/api/cart/quote', json={'MaDonGia': [9]}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['total'], 9000)
        self.assertEqual(response.json['items'][0]['SoLuongKhuyenMai'], 10)
        response = self.client.post('/api/cart/quote', json={'MaDonGia': [999]}, headers={'X-CSRF-Token': self.csrf})
        self.assertEqual(response.json['items'], [])
        with self.client.session_transaction() as state:
            self.assertEqual(state['guest_cart'], [[7, 8, 1], [7, 9, 10]])
        self.commit.assert_not_called()
        self.assertEqual(self.client.post('/api/cart/quote', json={'MaDonGia': [9]}).status_code, 403)
