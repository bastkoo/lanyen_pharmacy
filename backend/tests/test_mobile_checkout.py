"""Checkout Mobile và bridge SePay dùng repositories giả, không kết nối DB/dịch vụ thật."""
import unittest
from types import SimpleNamespace as NS
from uuid import uuid4
from unittest.mock import patch

import test_orders as fixtures
from app.services import mobile_checkout_service as service
from app.services import order_service, sepay_gateway_service as gateway
from app.services.auth_service import AuthError


class MobileCheckoutTests(unittest.TestCase):
    def setUp(self):
        self.fx = fixtures.OrderTests()
        self.fx.setUp()
        self.addCleanup(self.fx.doCleanups)
        self.mock = self.fx.mock
        self.app, self.client, self.user = self.fx.app, self.fx.client, self.fx.user
        self.headers = {'Authorization': 'Bearer fixture-token'}
        self.mock('app.services.mobile_auth_service.decode', return_value={'sub': '12'})
        self.mock('app.services.mobile_auth_service.active_user', return_value=self.user)
        self.previous = self.mock('app.services.order_service.orders.find_mobile_request', return_value=None)
        self.values = {**self.fx.values, 'request_id': str(uuid4())}

    def create(self, **changes):
        return self.client.post('/api/mobile/checkout/orders', headers=self.headers,
                                json={**self.values, **changes})

    def test_jwt_cart_owner_selected_units_and_durable_replay_debit_once(self):
        # Cookie của Web không được chọn chủ giỏ Mobile.
        with self.client.session_transaction() as cookie:
            cookie['user_id'] = 999
        response = self.create(DoiDiem=True, TongThanhToan='31750')
        self.assertEqual(response.status_code, 201, response.json)
        self.fx.quote.assert_called_once_with({8}, lock_promotions=True, owner_id=12)
        self.fx.points_debit.assert_called_once()
        self.fx.deduct.assert_called_once()
        values = self.fx.create.call_args.args[0]
        self.previous.return_value = NS(MaDonHang=45, **values)
        again = self.create(DoiDiem=True, TongThanhToan='31750')
        self.assertEqual(again.json, response.json)
        self.fx.create.assert_called_once()
        self.fx.points_debit.assert_called_once()
        self.fx.deduct.assert_called_once()
        changed = self.create(GhiChu='Changed')
        self.assertEqual(changed.status_code, 409)
        self.assertEqual(changed.json['code'], 'CHECKOUT_REQUEST_CONFLICT')

    def test_create_requires_jwt_and_customer_and_rejects_injected_fields(self):
        self.assertEqual(self.client.post('/api/mobile/checkout/orders', json=self.values).status_code, 401)
        self.user.VaiTro = 1
        self.assertEqual(self.create().status_code, 403)
        self.user.VaiTro = 0
        for changes in ({'MaNguoiMua': 99}, {'GiaBan': 1}, {'request_id': 'bad'}, {'MaDonGia': [8, 8]}, {'DoiDiem': 'true'}):
            self.assertEqual(self.create(**changes).status_code, 400)
        self.fx.create.assert_not_called()

    def test_quote_returns_decimal_money_and_applies_partial_promotion_and_points(self):
        cart = {'total': 32000, 'items': [dict(MaThuoc=7, MaDonGia=8, SoLuong=3, GiaBan=10000,
            GiaGoc=12000, ThanhTien=32000, ConHang=True, SoLuongKhuyenMai=2)]}
        lookup = self.mock('app.services.mobile_checkout_service.cart_service.get_cart', return_value=cart)
        authorize = self.mock('app.services.consultation_service.require_authorization')
        self.mock('app.services.mobile_checkout_service.points.balance', return_value=25)
        response = self.client.post('/api/mobile/checkout/quote', headers=self.headers,
                                    json={'MaDonGia': [8], 'DoiDiem': True})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual({key: response.json[key] for key in ('original', 'subtotal', 'total', 'points_discount')},
                         dict(original='36000', subtotal='32000', total='31750', points_discount='250'))
        self.assertEqual(response.json['items'][0]['SoLuongKhuyenMai'], 2)
        lookup.assert_called_once_with(selected_ids={8}, owner_id=12)
        authorize.assert_called_once_with(12, [(7, 8)])

    def test_quote_rejects_changed_cart_no_stock_and_consultation(self):
        lookup = self.mock('app.services.mobile_checkout_service.cart_service.get_cart', return_value={'items': [], 'total': 0})
        def read():
            return self.client.post('/api/mobile/checkout/quote', headers=self.headers, json={'MaDonGia': [8]})
        self.assertEqual(read().json['code'], 'CART_CHANGED')
        authorize = self.mock('app.services.consultation_service.require_authorization')
        lookup.return_value = {'total': 0, 'items': [dict(MaThuoc=7, MaDonGia=8, ConHang=False, ThanhTien=None)]}
        self.assertEqual(read().json['code'], 'OUT_OF_STOCK')
        authorize.side_effect = AuthError('CONSULTATION_REQUIRED', 409)
        self.assertEqual(read().json['code'], 'CONSULTATION_REQUIRED')

    def test_changed_price_and_unowned_address_do_not_create_or_deduct(self):
        self.assertEqual(self.create(TongThanhToan='1').json['code'], 'QUOTE_CHANGED')
        self.assertEqual(self.create(MaDiaChi='999').json['code'], 'ADDRESS_NOT_FOUND')
        self.fx.create.assert_not_called()
        self.fx.deduct.assert_not_called()

    def test_read_recovery_and_addresses_scope_jwt_owner(self):
        read = self.mock('app.services.order_service.read', return_value={'MaDonHang': '45'})
        addresses = self.mock('app.services.address_service.list_addresses', return_value=[])
        self.assertEqual(self.client.get('/api/mobile/checkout/orders/45', headers=self.headers).status_code, 200)
        read.assert_called_once_with(12, 45)
        self.client.get('/api/mobile/checkout/addresses', headers=self.headers)
        addresses.assert_called_once_with(12)
        self.previous.return_value = self.fx.order()
        response = self.client.get('/api/mobile/checkout/requests/' + self.values['request_id'], headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.previous.assert_called_once_with(12, self.values['request_id'])

    def test_address_mutations_delegate_owned_validation(self):
        values = dict(TinhThanh='Huế', PhuongXa='Vỹ Dạ', DiaChiCuThe='Nhà 1')
        create = self.mock('app.services.address_service.create_address', return_value={'MaDiaChi': '9', **values})
        update = self.mock('app.services.address_service.update_address', return_value={'MaDiaChi': '9', **values})
        self.assertEqual(self.client.post('/api/mobile/checkout/addresses', headers=self.headers, json=values).status_code, 201)
        self.assertEqual(self.client.post('/api/mobile/checkout/addresses/9/update', headers=self.headers, json=values).status_code, 200)
        create.assert_called_once_with(12, values)
        update.assert_called_once_with(12, 9, values)

    def test_payment_bridge_signed_expiring_ticket_and_escaped_html(self):
        initialize = self.mock('app.services.sepay_gateway_service.initialize', return_value={
            'action': 'https://pay-sandbox.sepay.vn/v1/checkout/init', 'fields': {'order_description': '\"<script>bad</script>', 'signature': 'fixture'}})
        response = self.client.post('/api/mobile/checkout/orders/45/payment', headers=self.headers, json={})
        self.assertEqual(response.status_code, 200)
        ticket = response.json['ticket']
        initialize.assert_called_once_with(12, 45, mobile=True)
        landing = self.client.get('/api/mobile/checkout/payment')
        self.assertIn('location.hash', landing.text)
        self.assertNotIn('fixture-token', landing.text)
        self.assertEqual(landing.headers['Referrer-Policy'], 'no-referrer')
        opened = self.client.post('/api/mobile/checkout/payment/open', data={'ticket': ticket})
        self.assertEqual(opened.status_code, 200)
        self.assertIn('&lt;script&gt;', opened.text)
        self.assertNotIn('<script>bad', opened.text)
        self.assertIn("form-action 'self' https://pay.sepay.vn", opened.headers['Content-Security-Policy'])
        self.assertEqual(opened.headers['Cache-Control'], 'no-store')
        self.assertEqual(self.client.post('/api/mobile/checkout/payment/open', data={'ticket': ticket + 'tampered'}).status_code, 401)
        with patch('itsdangerous.timed.TimestampSigner.get_timestamp', return_value=1):
            with self.app.app_context():
                expired = service.signer().dumps({'owner': 12, 'order': 45})
        self.assertEqual(self.client.post('/api/mobile/checkout/payment/open', data={'ticket': expired}).status_code, 401)

    def test_return_never_marks_paid_and_mobile_callback_does_not_change_web(self):
        order = self.fx.order()
        self.fx.find.return_value = order
        self.app.config.update(SEPAY_SUCCESS_URL='https://shop.example/api/payments/sepay/return?status=success')
        with self.app.app_context():
            web = gateway.initialize(12, 45)
            mobile = gateway.initialize(12, 45, mobile=True)
        self.assertIn('/api/payments/sepay/return?', web['fields']['success_url'])
        self.assertIn('/api/mobile/checkout/payment/return?', mobile['fields']['success_url'])
        response = self.client.get('/api/mobile/checkout/payment/return?order=45&status=paid')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(order.TrangThaiThanhToan, 0)
        self.fx.deduct.assert_not_called()
        self.fx.create.assert_not_called()


if __name__ == '__main__':
    unittest.main()
