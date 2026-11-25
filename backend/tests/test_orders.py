"""Order and SePay tests with mocked repositories; never access real databases."""
import unittest
import runpy
from urllib.parse import urlsplit, parse_qs
from datetime import datetime
from types import SimpleNamespace as NS
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.services import order_service
from app.services import sepay_gateway_service as gateway
from app.services.auth_service import AuthError
from app.repositories import don_hang_repository
from app.repositories.don_hang_repository import create as persist_order


class OrderTests(unittest.TestCase):
    def mock(self, name, **kwargs):
        patcher = patch(name, **kwargs)
        value = patcher.start()
        self.addCleanup(patcher.stop)
        return value

    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'order-tests-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example'], 'SEPAY_BANK': 'VCB',
            'SEPAY_ACCOUNT_NUMBER': '123456', 'SEPAY_ACCOUNT_NAME': 'LAN YEN',
            'SEPAY_WEBHOOK_API_KEY': 'test-key',
            'SEPAY_ENV': 'sandbox', 'SEPAY_MERCHANT_ID': 'SP-TEST-EXAMPLE',
            'SEPAY_SECRET_KEY': 'gateway-test-secret', 'SEPAY_IPN_SECRET_KEY': 'ipn-test-secret',
            'SEPAY_CHECKOUT_URL': gateway.CHECKOUT_URL, 'SEPAY_API_BASE_URL': gateway.API_BASE_URL,
            'SEPAY_SUCCESS_URL': '', 'SEPAY_ERROR_URL': '', 'SEPAY_CANCEL_URL': '',
            'SEPAY_FRONTEND_ORIGIN': 'https://shop.example',
            'SEPAY_PRODUCTION_ENABLED': False,
            'SEPAY_SANDBOX_MERCHANT_ID': '', 'SEPAY_SANDBOX_SECRET_KEY': '', 'SEPAY_SANDBOX_IPN_SECRET_KEY': '',
            'SEPAY_PRODUCTION_MERCHANT_ID': '', 'SEPAY_PRODUCTION_SECRET_KEY': '', 'SEPAY_PRODUCTION_IPN_SECRET_KEY': '',
            'SEPAY_SANDBOX_CHECKOUT_URL': gateway.CHECKOUT_URL, 'SEPAY_SANDBOX_API_BASE_URL': gateway.API_BASE_URL,
            'SEPAY_PRODUCTION_CHECKOUT_URL': gateway.ENVIRONMENTS['production'][0],
            'SEPAY_PRODUCTION_API_BASE_URL': gateway.ENVIRONMENTS['production'][1],
        })
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real database forbidden'))
        self.mock('app.services.order_expiry_service.vietnam_now', return_value=datetime(2026, 11, 18, 10))
        self.user = NS(MaNguoiDung=12, VaiTro=0, TrangThai=False, HoTen='An', SDT='0900000000')
        self.mock('app.services.auth_service.users.find_by_id', return_value=self.user)
        self.mock('app.services.order_service.carts.lock_user', return_value=self.user)
        self.consultation_product = NS(PhanLoai=False)
        self.mock('app.services.order_service.carts.catalog_details', return_value={(7, 8): (self.consultation_product, None)})
        self.records = self.mock('app.services.order_service.carts.list_items', return_value=[NS(MaDonGia=8)])
        self.quote = self.mock('app.services.order_service.get_cart', return_value={
            'total': 32000, 'items': [dict(MaThuoc=7, MaDonGia=8, SoLuong=3, GiaBan=10000,
                                         ConHang=True, ThanhTien=32000)]})
        self.mock('app.services.order_service.require_unit', return_value=NS(GiaBan=12000, SoLuongQuyDoi=10))
        self.stock = self.mock('app.services.order_service.usable_stock', return_value={7: 100})
        self.deduct = self.mock('app.services.order_service.deduct_order_stock',
                                return_value=[dict(MaLo='5', MaThuoc=7, SoLuong=30)])
        self.promotion_detail = self.mock('app.services.order_service.promotion_items.find_by_id', return_value=None)
        self.mock('app.services.order_service.addresses.list_owned', return_value=[
            NS(MaDiaChi=9, DiaChiCuThe='Nhà 1', PhuongXa='Vỹ Dạ', TinhThanh='Huế')])
        self.create = self.mock('app.services.order_service.orders.create',
                                side_effect=lambda values, items: NS(MaDonHang=45, **values))
        self.find = self.mock('app.services.order_service.orders.find', return_value=None)
        self.remove = self.mock('app.services.order_service.carts.remove')
        self.commit = self.mock('app.services.order_service.db.session.commit')
        self.rollback = self.mock('app.services.order_service.db.session.rollback')
        self.points_balance = self.mock('app.services.order_service.points.balance', return_value=25)
        self.points_debit = self.mock('app.services.order_service.points.debit')
        self.mock('app.services.order_service.points.order_award', return_value=None)
        self.client = self.app.test_client()
        with self.client.session_transaction() as state:
            state.update(user_id=12, csrf_token='test-csrf')
        self.values = dict(MaDonGia=[8], PhuongThucThanhToan=0, HinhThucNhanHang='delivery',
                           MaDiaChi='9', GhiChu='Gọi trước', TongThanhToan='32000')

    def post(self, **changes):
        return self.client.post('/api/orders', json={**self.values, **changes},
                                headers={'X-CSRF-Token': 'test-csrf'})

    def test_checkout_cannot_bypass_required_consultation(self):
        self.consultation_product.PhanLoai = True
        self.mock('app.repositories.chat_repository.customer_payloads', return_value=[])
        response = self.post()
        self.assertEqual(response.json['code'], 'CONSULTATION_REQUIRED')
        self.create.assert_not_called(); self.deduct.assert_not_called()

    def test_counter_cash_reuses_checkout_stock_redemption_and_promotion_transaction(self):
        quota = NS(SoLuong=50); self.promotion_detail.return_value = quota
        self.quote.return_value['items'][0].update(KhuyenMai={'MaChuongTrinh':6}, SoLuongKhuyenMai=2)
        award = self.mock('app.services.order_service.points.award')
        values = {**self.values, 'HinhThucNhanHang':'pickup', 'DoiDiem':True, 'TongThanhToan':'31750'}
        context = {'actor':8, 'id':'fixture', 'fingerprint':'fixture'}
        with self.app.app_context():
            result = order_service.create(self.user, values, counter=context, entries=[(7,8,3)])
        self.assertEqual((result['TrangThaiDonHang'],result['TrangThaiThanhToan']), (3,1))
        self.quote.assert_called_once_with({8}, lock_promotions=True, entries=[(7,8,3)])
        self.deduct.assert_called_once_with({7:30})
        self.assertEqual(quota.SoLuong, 30)
        self.points_debit.assert_called_once()
        self.assertEqual(award.call_args.args[:3], (12,31,45))
        self.records.assert_not_called(); self.remove.assert_not_called()
        self.assertTrue(self.create.call_args.args[0]['KenhDatHang'])

    def test_counter_qr_waits_for_payment_and_zero_cash_never_awards(self):
        award = self.mock('app.services.order_service.points.award')
        with self.app.app_context():
            result = order_service.create(self.user, {**self.values, 'HinhThucNhanHang':'pickup', 'PhuongThucThanhToan':1},
                counter={'actor':8}, entries=[(7,8,3)])
            self.assertEqual((result['TrangThaiDonHang'],result['TrangThaiThanhToan']), (0,0))
            award.assert_not_called()
            for total in (0, 999):
                self.quote.return_value['total'] = total
                result = order_service.create(self.user, {**self.values, 'HinhThucNhanHang':'pickup', 'TongThanhToan':str(total)},
                    counter={'actor':8}, entries=[(7,8,3)])
                self.assertEqual(result['TrangThaiDonHang'], 3)
                award.assert_not_called()

    def test_counter_gateway_return_keeps_staff_workspace_without_marking_paid(self):
        order = self.order(PhuongThucThanhToan=1, TrangThaiDonHang=0, TrangThaiThanhToan=0,
                           MoiTruongThanhToan='sandbox')
        self.find.return_value = order
        with self.app.app_context(), patch.dict(self.app.config, {'SEPAY_SUCCESS_URL':'https://api.example/api/payments/sepay/return'}):
            result = gateway.initialize(12, 45, employee=True)
        self.assertIn('workspace=employee', result['fields']['success_url'])
        self.assertIn('order=45', result['fields']['success_url'])
        response = self.client.get('/api/payments/sepay/return?order=45&workspace=employee')
        self.assertEqual(response.status_code, 303)
        self.assertTrue(response.location.endswith('/pages/employee/index.html?bill=45#counter'))
        self.assertEqual(order.TrangThaiThanhToan, 0)

    def cancellation_fixture(self, status=1, points=25):
        snapshot = dict(version=1, points=points, batches=[dict(MaLo='5', MaThuoc=7, SoLuong=30)],
                        promotions=[dict(MaChuongTrinh=6, MaThuoc=7, SoLuong=20)])
        order = self.order(TrangThaiDonHang=status, DoiDiem=points > 0, DuLieuHoanTra=snapshot)
        self.find.return_value = order
        batch = NS(SoLuongNhap=100, SoLuongTon=70)
        self.batch_find = self.mock('app.services.order_service.batches.find_by_id', return_value=batch)
        quota = NS(SoLuong=40)
        self.promotion_detail.return_value = quota
        self.refund = self.mock('app.services.order_service.points.refund')
        return order, batch, quota

    def cancel(self, order_id=45, **kwargs):
        return self.client.post(f'/api/orders/{order_id}/cancel', json={},
            headers={'X-CSRF-Token': 'test-csrf'}, **kwargs)

    def test_cancel_restores_exact_stock_promotions_points_once(self):
        order, batch, quota = self.cancellation_fixture()
        response = self.cancel()
        self.assertEqual((response.status_code, response.json['code']), (200, 'ORDER_CANCELLED'))
        self.assertEqual((order.TrangThaiDonHang, batch.SoLuongTon, quota.SoLuong), (4, 100, 60))
        self.find.assert_called_once_with(45, lock=True)
        self.batch_find.assert_called_once_with(7, 5, for_update=True)
        self.promotion_detail.assert_called_once_with(6, 7, for_update=True)
        self.assertEqual(self.refund.call_args.args[:3], (12, 25, 45))
        self.assertEqual(self.cancel().json['code'], 'ORDER_NOT_CANCELLABLE')
        self.refund.assert_called_once()
        self.commit.assert_called_once()
        self.assertEqual((batch.SoLuongTon, quota.SoLuong), (100, 60))

    def test_cancel_status_zero_without_points_and_paid_status_one(self):
        order, batch, quota = self.cancellation_fixture(status=0, points=0)
        self.assertEqual(self.cancel().status_code, 200)
        self.refund.assert_not_called()
        order.TrangThaiDonHang = 1; order.TrangThaiThanhToan = 1
        batch.SoLuongTon = 70; quota.SoLuong = 40
        self.assertEqual(self.cancel().status_code, 200)
        self.assertEqual(order.TrangThaiThanhToan, 1, 'Cancellation does not invent a cash refund')

    def test_cancel_rejects_other_owners_and_non_cancellable_states(self):
        order, batch, quota = self.cancellation_fixture()
        order.MaNguoiMua = 99
        self.assertEqual(self.cancel().status_code, 404)
        order.MaNguoiMua = 12
        for status in [2, 3, 4, 5]:
            order.TrangThaiDonHang = status
            self.assertEqual(self.cancel().json['code'], 'ORDER_NOT_CANCELLABLE')
        self.refund.assert_not_called()
        self.commit.assert_not_called()
        self.assertEqual((batch.SoLuongTon, quota.SoLuong), (70, 40))

    def test_cancel_legacy_missing_resources_and_bad_snapshot_need_review(self):
        order, batch, quota = self.cancellation_fixture()
        saved = order.DuLieuHoanTra
        for value in [None, {}, {**saved, 'batches': []}, {**saved, 'points': -1},
                      {**saved, 'batches': saved['batches'] * 2}, {**saved, 'promotions': [{}]}]:
            order.DuLieuHoanTra = value
            self.assertEqual(self.cancel().json['code'], 'ORDER_REFUND_REVIEW_REQUIRED')
        order.DuLieuHoanTra = saved
        self.batch_find.return_value = None
        self.assertEqual(self.cancel().json['code'], 'ORDER_REFUND_REVIEW_REQUIRED')
        self.batch_find.return_value = batch
        self.promotion_detail.return_value = None
        self.assertEqual(self.cancel().json['code'], 'ORDER_REFUND_REVIEW_REQUIRED')
        self.assertEqual((order.TrangThaiDonHang, batch.SoLuongTon, quota.SoLuong), (1, 70, 40))
        self.refund.assert_not_called()
        self.commit.assert_not_called()

    def test_cancel_auth_csrf_and_request_whitelist(self):
        self.cancellation_fixture()
        url = '/api/orders/45/cancel'
        self.assertEqual(self.client.post(url, json={}).status_code, 403)
        self.assertEqual(self.client.post(url, json={'TrangThaiDonHang': 4}, headers={'X-CSRF-Token': 'test-csrf'}).status_code, 400)
        self.assertEqual(self.cancel(9223372036854775808).status_code, 404)
        with self.client.session_transaction() as state:
            state.pop('user_id')
        self.assertEqual(self.cancel().status_code, 401)
        self.commit.assert_not_called()

    def test_cancel_database_error_rolls_back_all_refunds(self):
        self.cancellation_fixture()
        self.refund.side_effect = SQLAlchemyError('private')
        response = self.cancel()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.text)
        self.rollback.assert_called_once()
        self.commit.assert_not_called()

    def test_create_persists_allocations_needed_for_later_cancellation(self):
        self.quote.return_value['items'][0].update(KhuyenMai={'MaChuongTrinh': 6}, SoLuongKhuyenMai=2)
        self.promotion_detail.return_value = NS(SoLuong=100)
        self.assertEqual(self.post(DoiDiem=True, TongThanhToan='31750').status_code, 201)
        snapshot = self.create.call_args.args[0]['DuLieuHoanTra']
        self.assertEqual(snapshot, dict(version=1, points=25,
            batches=[dict(MaLo='5', MaThuoc=7, SoLuong=30)],
            lines=[dict(MaDonGia=8, conversion=10, amount=31750)],
            promotions=[dict(MaChuongTrinh=6, MaThuoc=7, SoLuong=20)]))

    def test_redeem_points_discounts_and_debits_in_order_transaction(self):
        response = self.post(DoiDiem=True, TongThanhToan='31750')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json['order']['DoiDiem'])
        self.assertEqual(response.json['order']['TongThanhToan'], '31750')
        self.assertEqual(response.json['order']['TienGiamGia'], '4250')
        self.points_balance.assert_called_once_with(12)
        self.points_debit.assert_called_once_with(12, 25, 45, self.create.call_args.args[0]['NgayDat'])
        self.commit.assert_called_once()

    def test_no_redemption_does_not_read_or_debit_points(self):
        response = self.post()
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json['order']['DoiDiem'])
        self.points_balance.assert_not_called()
        self.points_debit.assert_not_called()

    def test_redeem_caps_at_whole_coins_and_preserves_remainder(self):
        self.points_balance.return_value = 5000
        self.quote.return_value['total'] = 32055
        response = self.post(DoiDiem=True, TongThanhToan='5')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json['order']['TongThanhToan'], '5')
        self.assertEqual(self.points_debit.call_args.args[1], 3205)

    def test_redemption_rejects_unavailable_changed_balance_and_invalid_boolean(self):
        for balance in [0, -2]:
            self.points_balance.return_value = balance
            response = self.post(DoiDiem=True)
            self.assertEqual((response.status_code, response.json['code']), (409, 'POINTS_UNAVAILABLE'))
        self.points_balance.return_value = 20
        response = self.post(DoiDiem=True, TongThanhToan='31750')
        self.assertEqual(response.json['code'], 'QUOTE_CHANGED')
        for flag in [0, 1, 'true', 'false', None, [], {}]:
            self.assertEqual(self.post(DoiDiem=flag).status_code, 400)
        self.points_debit.assert_not_called()
        self.create.assert_not_called()
        self.commit.assert_not_called()

    def test_full_redemption_allows_cod_but_rejects_zero_amount_qr(self):
        self.points_balance.return_value = 5000
        response = self.post(DoiDiem=True, TongThanhToan='0', PhuongThucThanhToan=1)
        self.assertEqual(response.json['code'], 'QR_AMOUNT_INVALID')
        self.points_debit.assert_not_called()
        response = self.post(DoiDiem=True, TongThanhToan='0')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.points_debit.call_args.args[1], 3200)

    def test_redemption_failure_rolls_back_order_and_never_commits(self):
        self.points_debit.side_effect = SQLAlchemyError('private')
        response = self.post(DoiDiem=True, TongThanhToan='31750')
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.text)
        self.rollback.assert_called_once()
        self.commit.assert_not_called()

    def test_direct_reorder_redemption_preserves_cart(self):
        detail, _ = self.reorder_fixture()
        values = {key: value for key, value in self.values.items() if key != 'MaDonGia'}
        response = self.client.post('/api/orders/45/reorder/checkout',
            json={**values, 'MaChiTiet': [str(detail.MaChiTiet)], 'DoiDiem': True, 'TongThanhToan': '31750'},
            headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json['order']['DoiDiem'])
        self.points_debit.assert_called_once()
        self.records.assert_not_called()
        self.remove.assert_not_called()

    def test_direct_chat_checkout_preserves_cart_for_cod_and_qr(self):
        quote_offer = self.mock('app.services.chat_service.quote_offer', return_value=self.quote.return_value)
        values = {key: value for key, value in self.values.items() if key != 'MaDonGia'}
        for cart_quantity in (None, 99):
            existing = NS(MaThuoc=7, MaDonGia=8, SoLuong=cart_quantity)
            self.records.return_value = [] if cart_quantity is None else [existing]
            for method in (0, 1):
                response = self.client.post('/api/chat/offers/21/checkout', json={**values, 'PhuongThucThanhToan': method}, headers={'X-CSRF-Token': 'test-csrf'})
                self.assertEqual(response.status_code, 201)
                self.assertEqual(self.create.call_args.args[1][0]['SoLuong'], 3)
                self.assertEqual(existing.SoLuong, cart_quantity)
        quote_offer.assert_called_with(self.user, 21, lock_promotions=True)
        self.records.assert_not_called(); self.remove.assert_not_called(); self.quote.assert_not_called()
        result = self.client.post('/api/chat/offers/21/checkout', json={**values, 'MaDonGia': [8]}, headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual(result.status_code, 400)

    def order(self, **changes):
        return NS(**{**dict(MaDonHang=45, MaNguoiMua=12, TongTien=36000, TienGiamGia=4000,
                           TongThanhToan=32000, PhuongThucThanhToan=1,
                           MoiTruongThanhToan='sandbox',
                           TrangThaiThanhToan=0, TrangThaiDonHang=0), **changes})

    def webhook(self, key='Apikey test-key', **changes):
        return self.client.post('/api/payments/sepay/webhook', json={
            'id': 99, 'transferType': 'in', 'accountNumber': '123456',
            'content': 'chuyen tien LYDH45', 'transferAmount': 32000, **changes},
            headers={'Authorization': key})

    def test_order_list_filters_are_owned_and_processing_count_is_global(self):
        listing = self.mock('app.services.order_service.orders.list_owned', return_value=([], 0, 17, {}))
        for name, statuses in [('all', None), ('processing', (0, 1)), ('shipping', (2,)),
                               ('delivered', (3,)), ('cancelled', (4,)), ('returns', (5,))]:
            with self.subTest(name=name):
                response = self.client.get('/api/orders', query_string={'status': name, 'page': 2})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json['processing_count'], 17)
                self.assertEqual(response.json['items'], [])
                listing.assert_called_with(12, statuses, 2, 10)
        self.commit.assert_not_called()
        self.deduct.assert_not_called()

    def test_order_list_rejects_invalid_queries_and_other_roles(self):
        listing = self.mock('app.services.order_service.orders.list_owned')
        for query in ['status=unknown', 'page=0', 'page=-1', 'page=2147483648',
                      'per_page=51', 'per_page=0', 'status=all&status=shipping', 'MaNguoiMua=99']:
            with self.subTest(query=query):
                self.assertEqual(self.client.get('/api/orders?' + query).status_code, 400)
        listing.assert_not_called()
        self.user.VaiTro = 99
        self.assertEqual(self.client.get('/api/orders').status_code, 403)
        self.user.VaiTro = 0
        with self.client.session_transaction() as state:
            state.clear()
        self.assertEqual(self.client.get('/api/orders').status_code, 401)

    def test_order_list_pay_button_only_for_classified_pending_unpaid_qr(self):
        cases = [({}, True), ({'TrangThaiDonHang': 1}, False), ({'TrangThaiDonHang': 2}, False),
                 ({'TrangThaiDonHang': 3}, False), ({'TrangThaiDonHang': 4}, False),
                 ({'TrangThaiDonHang': 5}, False), ({'TrangThaiThanhToan': 1}, False),
                 ({'PhuongThucThanhToan': 0}, False), ({'MoiTruongThanhToan': None}, False),
                 ({'MoiTruongThanhToan': 'production'}, True)]
        listing = self.mock('app.services.order_service.orders.list_owned')
        for changes, expected in cases:
            with self.subTest(changes=changes):
                order = self.order(NgayDat=datetime(2026, 11, 18, 9), GhiChu='Người nhận: An\nGiao tận nơi: Huế', **changes)
                detail = NS(MaChiTiet=100, MaThuoc=7, MaDonGia=8, SoLuong=3, DonGia=12000)
                second = NS(MaChiTiet=101, MaThuoc=9, MaDonGia=10, SoLuong=2, DonGia=10000)
                listing.return_value = ([order], 1, 1, {45: [
                    (detail, NS(TenThuoc='Vitamin', HinhAnh=None), NS(DonViTinh='Hộp')),
                    (second, NS(TenThuoc='Vitamin B', HinhAnh=None), NS(DonViTinh='Vỉ'))]})
                response = self.client.get('/api/orders')
                self.assertEqual(response.status_code, 200)
                value = response.json['items'][0]
                self.assertEqual(value['can_pay'], expected)
                self.assertEqual(value['MaDonHang'], '45')
                self.assertEqual(value['preview']['ThanhTien'], '36000')
                self.assertEqual(value['TongThanhToan'], '32000')
                self.assertEqual(value['item_count'], 2)
                self.assertEqual([item['MaThuoc'] for item in value['items']], [7, 9])
                self.assertEqual(value['items'][1]['ThanhTien'], '20000')
                self.assertEqual(value['HinhThucNhanHang'], 'delivery')
        self.commit.assert_not_called()
        self.deduct.assert_not_called()

    def test_order_list_repository_queries_compile_and_scope_owner(self):
        from unittest.mock import MagicMock
        from sqlalchemy.dialects import postgresql
        execute = self.mock('app.repositories.don_hang_repository.db.session.execute')
        responses = [MagicMock() for _ in range(4)]
        responses[0].scalar_one.return_value = 1
        responses[1].scalar_one.return_value = 7
        responses[2].scalars.return_value.all.return_value = [NS(MaDonHang=45)]
        first = NS(MaDonHang=45, MaChiTiet=100)
        second = NS(MaDonHang=45, MaChiTiet=101)
        responses[3].all.return_value = [(first, None, None), (second, None, None)]
        execute.side_effect = responses
        with self.app.app_context():
            result = don_hang_repository.list_owned(12, (0, 1), 2, 10)
        self.assertEqual(result[1:3], (1, 7))
        self.assertEqual([line[0].MaChiTiet for line in result[3][45]], [100, 101])
        statements = [call.args[0].compile(dialect=postgresql.dialect()) for call in execute.call_args_list]
        for statement in statements[:3]:
            self.assertIn('MaNguoiMua', str(statement))
            self.assertIn(12, statement.params.values())
        self.assertIn('JOIN', str(statements[3]))
        self.assertIn([45], statements[3].params.values())

    def test_cod_saves_authoritative_totals_details_and_delivery_snapshot(self):
        result = self.post()
        self.assertEqual(result.status_code, 201)
        order = result.json['order']
        self.assertEqual((order['PhuongThucThanhToan'], order['TrangThaiDonHang'], order['TrangThaiThanhToan']), (0, 1, 0))
        self.assertEqual((order['TongTien'], order['TienGiamGia'], order['TongThanhToan']), ('36000', '4000', '32000'))
        values, items = self.create.call_args.args
        self.assertIn('Nhà 1', values['GhiChu'])
        self.assertIn('Gọi trước', values['GhiChu'])
        self.assertFalse(values['KenhDatHang'])
        self.assertIsNone(values['MoiTruongThanhToan'])
        self.assertEqual(items, [dict(MaThuoc=7, MaDonGia=8, SoLuong=3, DonGia=12000)])
        self.remove.assert_called_once()
        self.commit.assert_called_once()
        self.deduct.assert_called_once_with({7: 30})
        self.records.return_value = []
        self.assertEqual(self.post().json['code'], 'CART_CHANGED')
        self.assertEqual(self.create.call_count, 1)
        self.assertEqual(self.deduct.call_count, 1)
        self.promotion_detail.assert_not_called()

    def test_cod_consumes_only_discounted_quantity_in_base_units(self):
        quota = NS(SoLuong=50)
        self.promotion_detail.return_value = quota
        self.quote.return_value['items'][0].update(KhuyenMai={'MaChuongTrinh': 6}, SoLuongKhuyenMai=2)
        self.assertEqual(self.post().status_code, 201)
        self.quote.assert_called_once_with({8}, lock_promotions=True)
        self.promotion_detail.assert_called_once_with(6, 7, for_update=True)
        self.assertEqual(quota.SoLuong, 30)
        self.commit.assert_called_once()

    def test_multiple_units_share_quota_and_full_price_lines_do_not_consume(self):
        quota = NS(SoLuong=30)
        self.promotion_detail.return_value = quota
        self.records.return_value = [NS(MaDonGia=8), NS(MaDonGia=9)]
        self.quote.return_value['items'][0].update(KhuyenMai={'MaChuongTrinh': 6}, SoLuongKhuyenMai=1)
        self.quote.return_value['items'].append(dict(MaThuoc=7, MaDonGia=9, SoLuong=1,
            GiaBan=12000, ThanhTien=12000, ConHang=True, KhuyenMai={'MaChuongTrinh': 6}, SoLuongKhuyenMai=1))
        self.quote.return_value['total'] += 12000
        self.assertEqual(self.post(MaDonGia=[8, 9], TongThanhToan='44000').status_code, 201)
        self.assertEqual(sum(line['amount'] for line in self.create.call_args.args[0]['DuLieuHoanTra']['lines']), 44000)
        self.assertEqual(quota.SoLuong, 10)
        self.promotion_detail.assert_called_once_with(6, 7, for_update=True)

    def test_insufficient_or_removed_quota_rolls_back_before_stock_or_order(self):
        self.quote.return_value['items'][0].update(KhuyenMai={'MaChuongTrinh': 6}, SoLuongKhuyenMai=2)
        for quota in [None, NS(SoLuong=19)]:
            with self.subTest(quota=quota):
                self.promotion_detail.return_value = quota
                response = self.post()
                self.assertEqual((response.status_code, response.json['code']), (409, 'QUOTE_CHANGED'))
        self.deduct.assert_not_called()
        self.create.assert_not_called()
        self.commit.assert_not_called()
        self.assertEqual(self.rollback.call_count, 2)

    def test_changed_quote_does_not_consume_promotion(self):
        self.quote.return_value['items'][0].update(KhuyenMai={'MaChuongTrinh': 6}, SoLuongKhuyenMai=2)
        self.assertEqual(self.post(TongThanhToan='1').status_code, 409)
        self.promotion_detail.assert_not_called()
        self.commit.assert_not_called()

    def test_order_write_failure_rolls_back_quota_and_stock_transaction(self):
        self.promotion_detail.return_value = NS(SoLuong=30)
        self.quote.return_value['items'][0].update(KhuyenMai={'MaChuongTrinh': 6}, SoLuongKhuyenMai=1)
        self.create.side_effect = SQLAlchemyError('private')
        response = self.post()
        self.assertEqual((response.status_code, response.json['code']), (503, 'DATABASE_UNAVAILABLE'))
        self.rollback.assert_called_once()
        self.commit.assert_not_called()

    def test_qr_waits_and_does_not_expose_secret(self):
        result = self.post(PhuongThucThanhToan=1, HinhThucNhanHang='pickup', MaDiaChi=None)
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json['order']['TrangThaiDonHang'], 0)
        self.assertNotIn('payment', result.json['order'])
        self.assertEqual(result.json['order']['TrangThaiThanhToan'], 0)
        self.assertNotIn('test-key', result.text)
        self.assertIn('126 Dương Văn An', self.create.call_args.args[0]['GhiChu'])
        self.assertEqual(self.create.call_args.args[0]['MoiTruongThanhToan'], 'sandbox')
        self.deduct.assert_called_once_with({7: 30})

    def test_qr_debits_on_completion_and_never_again_on_initialize_or_repeated_ipn(self):
        quota = NS(SoLuong=30)
        self.promotion_detail.return_value = quota
        self.quote.return_value['items'][0].update(KhuyenMai={'MaChuongTrinh': 6}, SoLuongKhuyenMai=1)
        self.assertEqual(self.post(PhuongThucThanhToan=1).status_code, 201)
        self.assertEqual(quota.SoLuong, 20)
        self.deduct.assert_called_once_with({7: 30})
        self.find.return_value = self.order()
        self.assertEqual(self.initialize().status_code, 200)
        self.assertEqual(self.ipn().status_code, 200)
        self.assertEqual(self.ipn().status_code, 200)
        self.deduct.assert_called_once_with({7: 30})
        self.assertEqual(self.find.return_value.TrangThaiDonHang, 1)
        self.assertEqual(quota.SoLuong, 20)
        self.promotion_detail.assert_called_once_with(6, 7, for_update=True)

    def test_live_stock_shortage_after_quote_rolls_back_without_order_or_cart_removal(self):
        self.deduct.side_effect = AuthError('OUT_OF_STOCK', 409)
        result = self.post()
        self.assertEqual((result.status_code, result.json['code']), (409, 'OUT_OF_STOCK'))
        self.create.assert_not_called()
        self.remove.assert_not_called()
        self.commit.assert_not_called()
        self.rollback.assert_called_once()

    def test_commit_failure_rolls_back_the_stock_order_and_cart_transaction(self):
        self.commit.side_effect = SQLAlchemyError('internal commit failure')
        self.assertEqual(self.post().json['code'], 'DATABASE_UNAVAILABLE')
        self.deduct.assert_called_once_with({7: 30})
        self.rollback.assert_called_once()

    def test_missing_payment_config_cannot_create_qr_but_cod_works(self):
        self.app.config['SEPAY_SECRET_KEY'] = ''
        self.assertEqual(self.post(PhuongThucThanhToan=1).json['code'], 'GATEWAY_NOT_CONFIGURED')
        self.create.assert_not_called()
        self.assertEqual(self.post().status_code, 201)

    def test_quote_stock_address_and_cart_failures_do_not_write(self):
        for change, expected in [({'TongThanhToan': '1'}, 'QUOTE_CHANGED'),
                                 ({'MaDiaChi': '10'}, 'ADDRESS_NOT_FOUND'),
                                 ({'MaDonGia': [99]}, 'CART_CHANGED')]:
            self.assertEqual(self.post(**change).json['code'], expected)
        self.stock.return_value = {7: 29}
        self.assertEqual(self.post().json['code'], 'OUT_OF_STOCK')
        self.create.assert_not_called()
        self.commit.assert_not_called()

    def test_combined_product_units_cannot_exceed_stock(self):
        self.records.return_value = [NS(MaDonGia=8), NS(MaDonGia=9)]
        self.quote.return_value['items'].append(dict(MaThuoc=7, MaDonGia=9, SoLuong=8, GiaBan=12000, ThanhTien=96000, ConHang=True))
        self.assertEqual(self.post(MaDonGia=[8, 9]).json['code'], 'OUT_OF_STOCK')
        self.create.assert_not_called()

    def test_validation_rejects_injected_prices_status_and_owner(self):
        for changes in [{'MaNguoiMua': 99}, {'TrangThaiThanhToan': 1}, {'DonGia': 1}, {'MoiTruongThanhToan': 'production'},
                        {'MaDonGia': [8, 8]}, {'MaDonGia': []}, {'PhuongThucThanhToan': True},
                        {'PhuongThucThanhToan': 2}, {'GhiChu': 'x' * 2001}, {'TongThanhToan': 1}]:
            self.assertEqual(self.post(**changes).status_code, 400, changes)
        self.create.assert_not_called()

    def test_csrf_customer_role_and_ownership(self):
        self.assertEqual(self.client.post('/api/orders', json=self.values).status_code, 403)
        self.user.VaiTro = 99
        self.assertEqual(self.post().status_code, 403)
        self.user.VaiTro = 0
        self.find.return_value = self.order(MaNguoiMua=99)
        self.assertEqual(self.client.get('/api/orders/45').status_code, 404)
        with self.client.session_transaction() as state:
            state.pop('user_id')
        self.assertEqual(self.post().status_code, 401)

    def test_manager_can_create_own_cod_and_qr_orders(self):
        self.user.VaiTro = 2
        for method, status in [(0, 1), (1, 0)]:
            with self.subTest(method=method):
                response = self.post(PhuongThucThanhToan=method)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json['order']['TrangThaiDonHang'], status)
                self.assertEqual(self.create.call_args.args[0]['MaNguoiMua'], 12)
        self.assertEqual(self.client.post('/api/orders', json=self.values).status_code, 403)

    def test_manager_reads_only_own_list_detail_status_and_checkout(self):
        self.user.VaiTro = 2
        order = self.order(NgayDat=datetime(2026, 11, 18, 9), GhiChu='')
        listing = self.mock('app.services.order_service.orders.list_owned', return_value=([order], 1, 1, {}))
        self.mock('app.services.order_service.orders.detail_items', return_value=[])
        self.find.return_value = order
        self.assertEqual(self.client.get('/api/orders').status_code, 200)
        listing.assert_called_once_with(12, None, 1, 10)
        for path in ['/api/orders/45', '/api/orders/45/detail']:
            self.assertEqual(self.client.get(path).status_code, 200)
        self.commit.assert_not_called()
        self.assertEqual(self.initialize().status_code, 200)
        self.commit.reset_mock()
        self.find.return_value = self.order(MaNguoiMua=99)
        for path in ['/api/orders/45', '/api/orders/45/detail']:
            self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.initialize().status_code, 404)
        self.commit.assert_not_called()

    def test_locked_manager_cannot_create_order(self):
        self.user.VaiTro = 2
        self.user.TrangThai = True
        self.assertEqual(self.post().status_code, 403)
        self.create.assert_not_called()

    def test_employee_can_buy_read_and_pay_only_own_orders(self):
        self.user.VaiTro = 1
        for method, status in [(0, 1), (1, 0)]:
            with self.subTest(method=method):
                response = self.post(PhuongThucThanhToan=method)
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.json['order']['TrangThaiDonHang'], status)
                self.assertEqual(self.create.call_args.args[0]['MaNguoiMua'], 12)
        self.assertEqual(self.client.post('/api/orders', json=self.values).status_code, 403)
        self.commit.reset_mock()
        order = self.order(NgayDat=datetime(2026, 11, 18, 9), GhiChu='')
        listing = self.mock('app.services.order_service.orders.list_owned', return_value=([order], 1, 1, {}))
        self.mock('app.services.order_service.orders.detail_items', return_value=[])
        self.find.return_value = order
        self.assertEqual(self.client.get('/api/orders').status_code, 200)
        listing.assert_called_once_with(12, None, 1, 10)
        for path in ['/api/orders/45', '/api/orders/45/detail']:
            self.assertEqual(self.client.get(path).status_code, 200)
        self.commit.assert_not_called()
        self.assertEqual(self.initialize().status_code, 200)
        self.commit.reset_mock()
        self.find.return_value = self.order(MaNguoiMua=99)
        for path in ['/api/orders/45', '/api/orders/45/detail']:
            self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.initialize().status_code, 404)
        self.commit.assert_not_called()

    def test_locked_employee_cannot_create_order(self):
        self.user.VaiTro = 1
        self.user.TrangThai = True
        self.assertEqual(self.post().status_code, 403)
        self.create.assert_not_called()

    def reorder_fixture(self, status=3):
        self.find.return_value = self.order(TrangThaiDonHang=status)
        unit = NS(GiaBan=15000, SoLuongQuyDoi=10, DonViTinh='Vỉ')
        detail = NS(MaChiTiet=9007199254741001, MaThuoc=7, MaDonGia=8, SoLuong=3, DonGia=12000)
        self.mock('app.services.order_service.orders.detail_items', return_value=[
            (detail, NS(TenThuoc='Vitamin', HinhAnh=None), unit)])
        self.records.return_value = []
        return detail, unit

    def test_reorder_options_current_price_and_stock_without_mutation(self):
        detail, unit = self.reorder_fixture()
        for status in [3, 4]:
            self.find.return_value.TrangThaiDonHang = status
            response = self.client.get('/api/orders/45/reorder')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['items'][0]['GiaBan'], '15000')
            self.assertEqual(response.json['items'][0]['MaChiTiet'], str(detail.MaChiTiet))
            self.assertTrue(response.json['items'][0]['ConHang'])
        self.stock.return_value = {7: 29}
        self.assertFalse(self.client.get('/api/orders/45/reorder').json['items'][0]['ConHang'])
        self.commit.assert_not_called()
        self.deduct.assert_not_called()

    def test_reorder_rejects_entire_order_with_consultation_product(self):
        detail, unit = self.reorder_fixture()
        self.mock('app.services.order_service.orders.detail_items', return_value=[
            (detail, NS(TenThuoc='Thuốc', HinhAnh=None, PhanLoai=True), unit)])
        for status in (3, 4):
            self.find.return_value.TrangThaiDonHang = status
            self.assertEqual(self.client.get('/api/orders/45/reorder').json['code'], 'CONSULTATION_REQUIRED')
            self.assertEqual(self.client.post('/api/orders/45/reorder', json={'MaChiTiet': [str(detail.MaChiTiet)]}, headers={'X-CSRF-Token': 'test-csrf'}).status_code, 409)
        self.create.assert_not_called(); self.commit.assert_not_called()

    def test_direct_reorder_quote_and_checkout_leave_existing_cart_untouched(self):
        detail, _ = self.reorder_fixture()
        existing = NS(MaThuoc=7, MaDonGia=8, SoLuong=99)
        self.records.return_value = [existing]
        body = {'MaChiTiet': [str(detail.MaChiTiet)]}
        headers = {'X-CSRF-Token': 'test-csrf'}
        response = self.client.post('/api/orders/45/reorder/quote', json=body, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.quote.assert_called_once_with(entries=[(7, 8, 3)], lock_promotions=False)
        self.commit.assert_not_called()
        self.deduct.assert_not_called()
        self.records.assert_not_called()
        self.quote.reset_mock()
        values = {key: value for key, value in self.values.items() if key != 'MaDonGia'}
        response = self.client.post('/api/orders/45/reorder/checkout', json={**values, **body}, headers=headers)
        self.assertEqual(response.status_code, 201)
        self.quote.assert_called_once_with(entries=[(7, 8, 3)], lock_promotions=True)
        self.records.assert_not_called()
        self.remove.assert_not_called()
        self.assertEqual(existing.SoLuong, 99)
        self.assertEqual(self.create.call_args.args[1][0]['SoLuong'], 3)
        self.commit.assert_called_once()
        self.deduct.assert_called_once_with({7: 30})

    def test_direct_reorder_rejects_other_owners_invalid_lines_and_missing_csrf(self):
        detail, _ = self.reorder_fixture()
        values = {key: value for key, value in self.values.items() if key != 'MaDonGia'}
        for suffix, body in [('quote', {}), ('checkout', values)]:
            url = f'/api/orders/45/reorder/{suffix}'
            valid = {**body, 'MaChiTiet': [str(detail.MaChiTiet)]}
            self.assertEqual(self.client.post(url, json=valid).status_code, 403)
            headers = {'X-CSRF-Token': 'test-csrf'}
            for ids in [[], ['1'], [str(detail.MaChiTiet)] * 2]:
                self.assertEqual(self.client.post(url, json={**body, 'MaChiTiet': ids}, headers=headers).status_code, 400)
            self.find.return_value.MaNguoiMua = 99
            self.assertEqual(self.client.post(url, json=valid, headers=headers).status_code, 404)
            self.find.return_value.MaNguoiMua = 12
            self.find.return_value.TrangThaiDonHang = 1
            self.assertEqual(self.client.post(url, json=valid, headers=headers).status_code, 409)
            self.find.return_value.TrangThaiDonHang = 3
        self.create.assert_not_called()
        self.remove.assert_not_called()
        self.commit.assert_not_called()

    def test_direct_reorder_changed_quote_and_stock_do_not_create_order(self):
        detail, _ = self.reorder_fixture()
        values = {key: value for key, value in self.values.items() if key != 'MaDonGia'}
        values['MaChiTiet'] = [str(detail.MaChiTiet)]
        url = '/api/orders/45/reorder/checkout'
        headers = {'X-CSRF-Token': 'test-csrf'}
        response = self.client.post(url, json={**values, 'TongThanhToan': '1'}, headers=headers)
        self.assertEqual(response.json['code'], 'QUOTE_CHANGED')
        self.stock.return_value = {7: 29}
        response = self.client.post(url, json=values, headers=headers)
        self.assertEqual(response.json['code'], 'OUT_OF_STOCK')
        self.create.assert_not_called()
        self.remove.assert_not_called()
        self.commit.assert_not_called()

    def test_reorder_selected_lines_additive_using_saved_quantity(self):
        detail, unit = self.reorder_fixture()
        existing = NS(MaThuoc=7, MaDonGia=8, SoLuong=2)
        self.records.return_value = [existing]
        self.mock('app.services.cart_service.require_unit', return_value=unit)
        response = self.client.post('/api/orders/45/reorder', json={'MaChiTiet': [str(detail.MaChiTiet)]},
                                    headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {'code': 'ORDER_REORDERED', 'unit_ids': [8]})
        self.assertEqual(existing.SoLuong, 5)
        self.assertEqual(detail.SoLuong, 3)
        self.commit.assert_called_once()
        self.create.assert_not_called()
        self.deduct.assert_not_called()
        self.promotion_detail.assert_not_called()

    def test_reorder_stock_shortage_does_not_partially_add_cart(self):
        detail, _ = self.reorder_fixture()
        existing = NS(MaThuoc=7, MaDonGia=8, SoLuong=8)
        self.records.return_value = [existing]
        self.assertEqual(self.client.post('/api/orders/45/reorder',
            json={'MaChiTiet': [str(detail.MaChiTiet)]}, headers={'X-CSRF-Token': 'test-csrf'}).json['code'], 'OUT_OF_STOCK')
        self.assertEqual(existing.SoLuong, 8)
        self.commit.assert_not_called()
        self.rollback.assert_called_once()

    def test_reorder_selection_omits_unavailable_lines_and_failure_rolls_back(self):
        detail, unit = self.reorder_fixture()
        other = NS(MaChiTiet=9007199254741002, MaThuoc=9, MaDonGia=10, SoLuong=1, DonGia=10000)
        order_service.orders.detail_items.return_value.append((other, None, None))
        add = self.mock('app.services.order_service.add_database')
        response = self.client.post('/api/orders/45/reorder', json={'MaChiTiet': [str(detail.MaChiTiet)]},
                                    headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual(response.status_code, 200)
        add.assert_called_once_with(12, [(7, 8, 3)], check_stock=True)
        add.reset_mock()
        response = self.client.post('/api/orders/45/reorder',
            json={'MaChiTiet': [str(detail.MaChiTiet), str(other.MaChiTiet)]}, headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual(response.status_code, 404)
        add.assert_not_called()
        add.side_effect = SQLAlchemyError('private')
        response = self.client.post('/api/orders/45/reorder', json={'MaChiTiet': [str(detail.MaChiTiet)]},
                                    headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual((response.status_code, response.json['code']), (503, 'DATABASE_UNAVAILABLE'))
        self.assertEqual(self.rollback.call_count, 2)
        self.commit.assert_not_called()

    def test_reorder_rejects_wrong_owner_nonterminal_and_unknown_lines(self):
        detail, _ = self.reorder_fixture()
        headers = {'X-CSRF-Token': 'test-csrf'}
        self.find.return_value.MaNguoiMua = 99
        self.assertEqual(self.client.get('/api/orders/45/reorder').status_code, 404)
        self.assertEqual(self.client.post('/api/orders/45/reorder', json={'MaChiTiet': [str(detail.MaChiTiet)]}, headers=headers).status_code, 404)
        self.find.return_value.MaNguoiMua = 12
        for status in [0, 1, 2, 5]:
            self.find.return_value.TrangThaiDonHang = status
            self.assertEqual(self.client.get('/api/orders/45/reorder').status_code, 409)
            self.assertEqual(self.client.post('/api/orders/45/reorder', json={'MaChiTiet': [str(detail.MaChiTiet)]}, headers=headers).status_code, 409)
        self.find.return_value.TrangThaiDonHang = 3
        self.assertEqual(self.client.post('/api/orders/45/reorder', json={'MaChiTiet': ['99']}, headers=headers).status_code, 400)
        self.commit.assert_not_called()

    def test_reorder_schema_csrf_and_anonymous_boundaries(self):
        self.reorder_fixture()
        for body in [{'MaChiTiet': []}, {'MaChiTiet': ['1', '1']}, {'MaChiTiet': [1]},
                     {'MaChiTiet': ['1'], 'SoLuong': 1}, {'MaChiTiet': ['1'], 'MaNguoiMua': 99}]:
            self.assertEqual(self.client.post('/api/orders/45/reorder', json=body,
                headers={'X-CSRF-Token': 'test-csrf'}).status_code, 400)
        self.assertEqual(self.client.post('/api/orders/45/reorder', json={'MaChiTiet': ['1']}).status_code, 403)
        with self.client.session_transaction() as state:
            state.clear()
        self.assertEqual(self.client.get('/api/orders/45/reorder').status_code, 401)
        self.commit.assert_not_called()

    def test_database_failure_rolls_back_cart_and_order_transaction(self):
        self.create.side_effect = SQLAlchemyError('private database details')
        result = self.post()
        self.assertEqual((result.status_code, result.json['code']), (503, 'DATABASE_UNAVAILABLE'))
        self.assertNotIn('private', result.text)
        self.rollback.assert_called_once()
        self.remove.assert_not_called()

    def test_webhook_requires_key_and_rejects_malformed_amounts(self):
        for key in ['', 'Bearer test-key', 'Apikey wrong']:
            self.assertEqual(self.webhook(key=key).status_code, 401)
        for amount in ['NaN', 'Infinity', -1, '123.1', True]:
            self.assertEqual(self.webhook(transferAmount=amount).status_code, 400)
        self.commit.assert_not_called()

    def test_webhook_wrong_account_direction_reference_and_underpayment(self):
        order = self.order()
        self.find.return_value = order
        for changes in [{'transferType': 'out'}, {'accountNumber': 'other'}, {'content': 'LYDH45 LYDH46'},
                        {'content': 'LYDH450foo'}, {'transferAmount': 31999}]:
            self.assertEqual(self.webhook(**changes).status_code, 200)
            self.assertEqual(order.TrangThaiThanhToan, 0)
        self.commit.assert_not_called()

    def test_webhook_success_and_retries_are_idempotent(self):
        order = self.order(MoiTruongThanhToan=None)
        self.find.return_value = order
        self.assertEqual(self.webhook().json, {'success': True})
        self.assertEqual((order.TrangThaiThanhToan, order.TrangThaiDonHang), (1, 1))
        self.find.assert_called_with(45, lock=True)
        self.assertEqual(self.webhook().json, {'success': True})
        self.commit.assert_called_once()

    def test_cancelled_cod_or_paid_orders_cannot_be_credited(self):
        for changes in [{'TrangThaiDonHang': 4}, {'PhuongThucThanhToan': 0}, {'TrangThaiThanhToan': 1}]:
            self.find.return_value = self.order(**changes)
            self.assertEqual(self.webhook().status_code, 200)
        self.commit.assert_not_called()

    def test_repository_persists_order_and_detail_foreign_key(self):
        with self.app.app_context():
            added = []
            with patch.object(don_hang_repository.db.session, 'add', side_effect=added.append), \
                    patch.object(don_hang_repository.db.session, 'flush', side_effect=lambda: setattr(added[0], 'MaDonHang', 45)):
                order = persist_order(dict(MaNguoiMua=12), [
                    dict(MaThuoc=7, MaDonGia=8, SoLuong=3, DonGia=12000)])
            self.assertEqual(order.MaDonHang, 45)
            self.assertEqual(added[1].MaDonHang, 45)
            self.assertEqual(added[1].DonGia, 12000)

    def initialize(self, order_id=45, **kwargs):
        return self.client.post(f'/api/orders/{order_id}/payment', headers={'X-CSRF-Token': 'test-csrf'}, **kwargs)

    def ipn_body(self):
        return dict(timestamp=1795000000, notification_type='ORDER_PAID', customer={'customer_id': '12'},
                    order=dict(order_invoice_number='LYSGTEST45', order_status='CAPTURED',
                               order_amount='32000.00', order_currency='VND'),
                    transaction=dict(transaction_id='test-transaction-1', payment_method='BANK_TRANSFER',
                                     transaction_type='PAYMENT', transaction_status='APPROVED',
                                     transaction_amount='32000', transaction_currency='VND'))

    def ipn(self, body=None, key='ipn-test-secret'):
        return self.client.post('/api/payments/sepay/ipn', json=self.ipn_body() if body is None else body,
                                headers={'X-Secret-Key': key})

    def test_gateway_initialize_sandbox_signed_form_and_no_order_mutation(self):
        order = self.order()
        before = vars(order).copy()
        self.find.return_value = order
        response = self.initialize()
        self.assertEqual(response.status_code, 200)
        payment = response.json['payment']
        self.assertEqual((payment['action'], payment['method']), (gateway.CHECKOUT_URL, 'POST'))
        fields = payment['fields']
        self.assertEqual(fields['merchant'], 'SP-TEST-EXAMPLE')
        self.assertEqual(fields['order_invoice_number'], 'LYSGTEST45')
        self.assertEqual(fields['order_amount'], '32000')
        self.assertEqual(fields['customer_id'], '12')
        self.assertEqual((fields['payment_method'], fields['currency'], fields['operation']), ('BANK_TRANSFER', 'VND', 'PURCHASE'))
        self.assertEqual(vars(order), before)
        self.assertNotIn('gateway-test-secret', response.text)
        self.assertNotIn('ipn-test-secret', response.text)
        self.find.assert_called_with(45, lock=True)
        self.create.assert_not_called()
        self.remove.assert_not_called()
        repeated = self.initialize().json['payment']
        self.assertEqual(repeated, payment)

    def test_gateway_signature_fixed_order_unicode_empty_values_and_raw_digest_base64(self):
        # Golden vector independently computed using Node crypto, not this signer.
        fields = dict(cancel_url='https://example.test/cancel', signature='ignored',
                      error_url='https://example.test/error', success_url='https://example.test/success',
                      order_invoice_number='INV_20231201_001', customer_id='0', payment_method='',
                      order_description='Thanh toán đơn hàng #12345', operation='PURCHASE',
                      currency='VND', merchant='MERCHANT_123', order_amount='100000', extra='ignored')
        self.assertEqual(gateway.sign_fields(fields, 'gateway-test-secret'),
                         '+lQvJ5mXt4WZpVghTIx7KZX3q8aCMdV29Vlyo9iKZFk=')

    def test_gateway_form_callback_urls_are_server_configured_and_signed(self):
        self.find.return_value = self.order()
        with patch.dict(self.app.config, {'SEPAY_SUCCESS_URL': 'https://example.test/success',
                                         'SEPAY_ERROR_URL': 'https://example.test/error',
                                         'SEPAY_CANCEL_URL': 'https://example.test/cancel'}):
            fields = self.initialize().json['payment']['fields']
            self.assertEqual(fields['success_url'], 'https://example.test/success?order=45')
            self.assertEqual(fields['error_url'], 'https://example.test/error?order=45')
            self.assertEqual(fields['cancel_url'], 'https://example.test/cancel?order=45')
            self.assertEqual(fields['signature'], gateway.sign_fields(fields, 'gateway-test-secret'))

    def test_gateway_config_missing_wrong_merchant_and_production_rejected(self):
        self.find.return_value = self.order()
        for key, value, code in [
            ('SEPAY_MERCHANT_ID', '', 'GATEWAY_NOT_CONFIGURED'),
            ('SEPAY_SECRET_KEY', '', 'GATEWAY_NOT_CONFIGURED'),
            ('SEPAY_IPN_SECRET_KEY', '', 'GATEWAY_NOT_CONFIGURED'),
            ('SEPAY_MERCHANT_ID', 'SP-LIVE-EXAMPLE', 'GATEWAY_CONFIG_INVALID'),
            ('SEPAY_MERCHANT_ID', 'SP-TEST-', 'GATEWAY_CONFIG_INVALID'),
            ('SEPAY_ENV', 'production', 'GATEWAY_PRODUCTION_DISABLED'),
            ('SEPAY_CHECKOUT_URL', 'https://pay.sepay.vn/v1/checkout/init', 'GATEWAY_CONFIG_INVALID'),
            ('SEPAY_API_BASE_URL', 'https://pgapi.sepay.vn', 'GATEWAY_CONFIG_INVALID'),
            ('SEPAY_SUCCESS_URL', 'javascript:alert(1)', 'GATEWAY_CONFIG_INVALID')]:
            with patch.dict(self.app.config, {key: value}):
                result = self.initialize()
                self.assertEqual((result.status_code, result.json['code']), (503, code))
        self.commit.assert_not_called()

    def test_gateway_owned_pending_online_order_only(self):
        for change, code in [({'MaNguoiMua': 99}, 'ORDER_NOT_FOUND'),
                             ({'TrangThaiThanhToan': 1}, 'ORDER_ALREADY_PAID'),
                             ({'TrangThaiDonHang': 4}, 'ORDER_NOT_PAYABLE'),
                             ({'PhuongThucThanhToan': 0}, 'ORDER_PAYMENT_METHOD_INVALID'),
                             ({'TongThanhToan': 0}, 'QR_AMOUNT_INVALID')]:
            self.find.return_value = self.order(**change)
            self.assertEqual(self.initialize().json['code'], code)
        self.find.return_value = None
        self.assertEqual(self.initialize().status_code, 404)
        self.assertEqual(self.initialize(9223372036854775808).status_code, 404)
        self.commit.assert_not_called()

    def test_gateway_csrf_role_and_client_parameters(self):
        self.find.return_value = self.order()
        self.assertEqual(self.client.post('/api/orders/45/payment').status_code, 403)
        self.user.VaiTro = 99
        self.assertEqual(self.initialize().status_code, 403)
        self.user.VaiTro = 0
        self.assertEqual(self.initialize(json={'order_amount': '1'}).status_code, 400)
        self.assertEqual(self.initialize(query_string={'success_url': 'https://evil.test'}).status_code, 400)
        self.commit.assert_not_called()

    def test_gateway_ipn_valid_without_browser_session_and_duplicate_does_not_rewind_order(self):
        order = self.order()
        self.find.return_value = order
        with self.client.session_transaction() as state:
            state.clear()
        self.assertEqual(self.ipn().json, {'success': True})
        self.assertEqual((order.TrangThaiDonHang, order.TrangThaiThanhToan), (1, 1))
        order.TrangThaiDonHang = 2
        self.assertEqual(self.ipn().status_code, 200)
        self.assertEqual(order.TrangThaiDonHang, 2)
        self.find.assert_called_with(45, lock=True)

    def test_gateway_ipn_wrong_auth_header_or_key_rejected(self):
        for key in ['', 'wrong', 'gateway-test-secret']:
            self.assertEqual(self.ipn(key=key).status_code, 401)
        result = self.client.post('/api/payments/sepay/ipn', json=self.ipn_body(),
                                  headers={'Authorization': 'Apikey test-key'})
        self.assertEqual(result.status_code, 401)
        self.find.assert_not_called()
        self.commit.assert_not_called()

    def test_gateway_ipn_wrong_invoice_amount_and_currency_rejected(self):
        order = self.order()
        self.find.return_value = order
        for section, field, value, code in [
            ('order', 'order_invoice_number', 'LYDH45', 'IPN_ORDER_MISMATCH'),
            ('order', 'order_invoice_number', 'LYSGTEST045', 'IPN_ORDER_MISMATCH'),
            ('order', 'order_invoice_number', 'LYSGTEST9223372036854775808', 'IPN_ORDER_MISMATCH'),
            ('order', 'order_amount', '31999.00', 'IPN_AMOUNT_MISMATCH'),
            ('transaction', 'transaction_amount', '32001', 'IPN_AMOUNT_MISMATCH'),
            ('transaction', 'transaction_amount', '32000.01', 'IPN_AMOUNT_MISMATCH'),
            ('transaction', 'transaction_amount', 'NaN', 'IPN_AMOUNT_MISMATCH'),
            ('transaction', 'transaction_amount', True, 'IPN_AMOUNT_MISMATCH'),
            ('order', 'order_currency', 'USD', 'IPN_CURRENCY_MISMATCH'),
            ('transaction', 'transaction_currency', 'USD', 'IPN_CURRENCY_MISMATCH')]:
            body = self.ipn_body(); body[section][field] = value
            self.assertEqual(self.ipn(body).json['code'], code)
        self.find.return_value = None
        self.assertEqual(self.ipn().status_code, 404)
        self.assertEqual(order.TrangThaiThanhToan, 0)
        self.commit.assert_not_called()

    def test_gateway_failed_void_or_wrong_method_ipn_never_credits_order(self):
        for section, field, value in [('order', 'order_status', 'CANCELLED'),
                                       ('transaction', 'transaction_status', 'DECLINED'),
                                       ('transaction', 'transaction_type', 'REFUND'),
                                       ('transaction', 'payment_method', 'CARD')]:
            body = self.ipn_body(); body[section][field] = value
            self.assertEqual(self.ipn(body).json, {'success': True})
        body = self.ipn_body(); body['notification_type'] = 'TRANSACTION_VOID'
        self.assertEqual(self.ipn(body).status_code, 200)
        self.find.assert_not_called()
        self.commit.assert_not_called()

    def test_gateway_ipn_cannot_credit_another_customers_equal_value_order(self):
        self.find.return_value = self.order(MaNguoiMua=99)
        self.assertEqual(self.ipn().json['code'], 'IPN_ORDER_MISMATCH')
        self.assertEqual(self.find.return_value.TrangThaiThanhToan, 0)
        self.commit.assert_not_called()

    def test_gateway_cancelled_or_cod_local_order_cannot_be_paid_by_ipn(self):
        for changes, code in [({'TrangThaiDonHang': 4}, 'ORDER_NOT_PAYABLE'),
                              ({'PhuongThucThanhToan': 0}, 'ORDER_PAYMENT_METHOD_INVALID')]:
            self.find.return_value = self.order(**changes)
            self.assertEqual(self.ipn().json['code'], code)
        self.commit.assert_not_called()

    def test_gateway_ipn_database_failure_returns_retryable_error(self):
        order = self.order()
        self.find.return_value = order
        self.commit.side_effect = SQLAlchemyError('private error')
        response = self.ipn()
        self.assertEqual((response.status_code, response.json['code']), (503, 'DATABASE_UNAVAILABLE'))
        self.assertNotIn('private', response.text)
        self.rollback.assert_called_once()

    def test_gateway_callbacks_and_status_reads_cannot_mark_order_paid(self):
        order = self.order()
        self.find.return_value = order
        result = self.client.get('/api/orders/45?status=success&paid=1')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(order.TrangThaiThanhToan, 0)
        self.assertEqual(self.client.get('/api/payments/sepay/ipn?status=success').status_code, 405)
        self.assertEqual(self.client.get('/api/payments/sepay/success?order=45').status_code, 404)
        self.commit.assert_not_called()

    def test_gateway_only_configuration_can_create_and_read_qr_order(self):
        with patch.dict(self.app.config, {'SEPAY_BANK': '', 'SEPAY_ACCOUNT_NUMBER': '', 'SEPAY_WEBHOOK_API_KEY': ''}):
            self.assertEqual(self.post(PhuongThucThanhToan=1).status_code, 201)
            self.find.return_value = self.order()
            result = self.client.get('/api/orders/45')
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json['order']['TrangThaiThanhToan'], 0)
            self.assertNotIn('payment', result.json['order'])

    def test_legacy_read_and_webhook_work_when_gateway_not_configured(self):
        with patch.dict(self.app.config, {'SEPAY_SECRET_KEY': '', 'SEPAY_MERCHANT_ID': ''}):
            self.find.return_value = self.order(MoiTruongThanhToan=None)
            result = self.client.get('/api/orders/45')
            self.assertIn('qr.sepay.vn/img?', result.json['order']['payment']['qr_url'])
            self.assertEqual(self.webhook().status_code, 200)
            self.assertEqual(self.find.return_value.TrangThaiThanhToan, 1)

    def test_gateway_ipn_bad_json_and_nested_objects(self):
        self.assertEqual(self.client.post('/api/payments/sepay/ipn', data='bad').status_code, 415)
        for body in [[], {'notification_type': 'ORDER_PAID'},
                     {'notification_type': 'ORDER_PAID', 'order': [], 'transaction': {} }]:
            self.assertIn(self.ipn(body).status_code, [400, 409])
        self.commit.assert_not_called()

    def test_gateway_diagnostic_logs_omit_keys_signature_and_payload(self):
        self.find.return_value = self.order()
        with self.assertLogs(self.app.logger, level='INFO') as captured:
            self.assertEqual(self.initialize().status_code, 200)
            self.assertEqual(self.ipn(key='wrong-key').status_code, 401)
            self.assertEqual(self.ipn().status_code, 200)
        messages = '\n'.join(captured.output)
        for forbidden in ['gateway-test-secret', 'ipn-test-secret', 'wrong-key', 'signature', 'transaction_amount']:
            self.assertNotIn(forbidden, messages)
        self.assertIn('sepay_initialize order_id=45 status=200', messages)
        self.assertIn('code=INVALID_IPN_KEY', messages)
        self.assertIn('code=PAID', messages)

    def production_config(self):
        return dict(SEPAY_ENV='production', SEPAY_PRODUCTION_ENABLED=True,
                    SEPAY_PRODUCTION_MERCHANT_ID='MERCHANT_PRODUCTION_TEST',
                    SEPAY_PRODUCTION_SECRET_KEY='spsk_live_fake_test_only',
                    SEPAY_PRODUCTION_IPN_SECRET_KEY='production-ipn-fake-only')

    def test_shared_database_production_form_and_ipn_require_saved_environment(self):
        self.find.return_value = self.order(MoiTruongThanhToan='production')
        with patch.dict(self.app.config, self.production_config()):
            response = self.initialize()
            self.assertEqual(response.status_code, 200)
            payment = response.json['payment']
            self.assertEqual(payment['environment'], 'production')
            self.assertEqual(payment['action'], 'https://pay.sepay.vn/v1/checkout/init')
            self.assertEqual(payment['fields']['order_invoice_number'], 'LYSGLIVE45')
            self.assertEqual(payment['fields']['signature'], gateway.sign_fields(payment['fields'], 'spsk_live_fake_test_only'))
            body = self.ipn_body(); body['order']['order_invoice_number'] = 'LYSGLIVE45'
            self.assertEqual(self.ipn(body, key='production-ipn-fake-only').status_code, 200)
            self.assertEqual(self.find.return_value.TrangThaiThanhToan, 1)
            self.find.return_value.TrangThaiDonHang = 2
            self.assertEqual(self.ipn(body, key='production-ipn-fake-only').status_code, 200)
            self.assertEqual(self.find.return_value.TrangThaiDonHang, 2)
            self.assertEqual(self.post(PhuongThucThanhToan=1).status_code, 201)
            self.assertEqual(self.create.call_args.args[0]['MoiTruongThanhToan'], 'production')

    def test_cross_environment_ipn_rejected_even_with_colliding_order_ids(self):
        for production in (False, True):
            config = {**self.production_config(), 'SEPAY_ENV': 'production' if production else 'sandbox'}
            self.find.return_value = self.order(MoiTruongThanhToan='production' if production else 'sandbox')
            with patch.dict(self.app.config, config):
                body = self.ipn_body()
                body['order']['order_invoice_number'] = 'LYSGTEST45' if production else 'LYSGLIVE45'
                # Authenticate correctly for the incoming event, yet refuse to
                # credit a local order bound to the other environment.
                event_key = 'ipn-test-secret' if production else 'production-ipn-fake-only'
                self.assertEqual(self.ipn(body, key=event_key).json['code'], 'ORDER_PAYMENT_ENVIRONMENT_MISMATCH')
                wrong_key = 'production-ipn-fake-only' if production else 'ipn-test-secret'
                self.assertEqual(self.ipn(body, key=wrong_key).status_code, 401)
                self.assertEqual(self.find.return_value.TrangThaiThanhToan, 0)
        self.commit.assert_not_called()

    def test_old_unclassified_order_cannot_initialize_or_receive_gateway_ipn(self):
        order = self.order(MoiTruongThanhToan=None)
        self.find.return_value = order
        self.assertEqual(self.initialize().json['code'], 'ORDER_PAYMENT_ENVIRONMENT_UNKNOWN')
        self.assertEqual(self.ipn().json['code'], 'ORDER_PAYMENT_ENVIRONMENT_UNKNOWN')
        self.assertIsNone(order.MoiTruongThanhToan)
        self.commit.assert_not_called()

    def test_saved_environment_does_not_change_when_config_switches(self):
        order = self.order()
        self.find.return_value = order
        with patch.dict(self.app.config, self.production_config()):
            self.assertEqual(self.initialize().json['code'], 'ORDER_PAYMENT_ENVIRONMENT_MISMATCH')
            result = self.client.get('/api/orders/45')
            self.assertEqual(result.json['order']['payment_environment'], 'sandbox')
            # Late Sandbox IPN is authenticated with Sandbox key even after the
            # storefront has switched to Production.
            self.assertEqual(self.ipn().status_code, 200)
            self.assertEqual(order.TrangThaiThanhToan, 1)
            self.assertEqual(order.MoiTruongThanhToan, 'sandbox')

    def test_production_ipn_can_settle_existing_order_after_new_payments_disabled(self):
        self.find.return_value = self.order(MoiTruongThanhToan='production')
        with patch.dict(self.app.config, {**self.production_config(), 'SEPAY_ENV': 'sandbox', 'SEPAY_PRODUCTION_ENABLED': False}):
            body = self.ipn_body(); body['order']['order_invoice_number'] = 'LYSGLIVE45'
            self.assertEqual(self.ipn(body, key='production-ipn-fake-only').status_code, 200)
            self.assertEqual(self.find.return_value.TrangThaiThanhToan, 1)

    def test_bank_webhook_cannot_credit_gateway_bound_order(self):
        self.find.return_value = self.order()
        self.assertEqual(self.webhook().status_code, 200)
        self.assertEqual(self.find.return_value.TrangThaiThanhToan, 0)
        self.commit.assert_not_called()

    def test_production_cannot_fallback_to_sandbox_keys(self):
        for change, expected in [
            ({'SEPAY_PRODUCTION_SECRET_KEY': ''}, 'GATEWAY_NOT_CONFIGURED'),
            ({'SEPAY_PRODUCTION_MERCHANT_ID': 'SP-TEST-EXAMPLE'}, 'GATEWAY_CONFIG_INVALID'),
            ({'SEPAY_PRODUCTION_SECRET_KEY': 'spsk_test_fake'}, 'GATEWAY_CONFIG_INVALID'),
            ({'SEPAY_PRODUCTION_IPN_SECRET_KEY': 'ipn-test-secret'}, 'GATEWAY_ENVIRONMENT_COLLISION'),
            ({'SEPAY_PRODUCTION_CHECKOUT_URL': gateway.CHECKOUT_URL}, 'GATEWAY_CONFIG_INVALID')]:
            with patch.dict(self.app.config, {**self.production_config(), **change}):
                self.assertEqual(self.initialize().json['code'], expected)
        self.find.assert_not_called()

    def test_new_sandbox_group_overrides_legacy_without_mixing_partial_groups(self):
        self.find.return_value = self.order()
        with patch.dict(self.app.config, {'SEPAY_SANDBOX_MERCHANT_ID': 'SP-TEST-NEW'}):
            self.assertEqual(self.initialize().json['code'], 'GATEWAY_NOT_CONFIGURED')
        with patch.dict(self.app.config, {'SEPAY_SANDBOX_MERCHANT_ID': 'SP-TEST-NEW',
                                         'SEPAY_SANDBOX_SECRET_KEY': 'new-sandbox-secret',
                                         'SEPAY_SANDBOX_IPN_SECRET_KEY': 'new-sandbox-ipn'}):
            payment = self.initialize().json['payment']
            self.assertEqual(payment['environment'], 'sandbox')
            self.assertEqual(payment['fields']['merchant'], 'SP-TEST-NEW')
            self.assertEqual(payment['fields']['signature'], gateway.sign_fields(payment['fields'], 'new-sandbox-secret'))

    def test_cod_works_when_production_payments_are_disabled(self):
        with patch.dict(self.app.config, {'SEPAY_ENV': 'production', 'SEPAY_PRODUCTION_ENABLED': False}):
            self.assertEqual(self.post().status_code, 201)
            self.assertEqual(self.post(PhuongThucThanhToan=1).json['code'], 'GATEWAY_PRODUCTION_DISABLED')

    def test_payment_environment_never_changes_shared_database(self):
        values = dict(DATABASE_URL='postgresql+psycopg://unused@localhost/shared_db',
                      SEPAY_SANDBOX_DATABASE_URL='postgresql+psycopg://unused@localhost/ignored_sandbox',
                      SEPAY_PRODUCTION_DATABASE_URL='postgresql+psycopg://unused@localhost/ignored_production',
                      SEPAY_PRODUCTION_ENABLED='false')
        for env in ('sandbox', 'production'):
            with patch.dict('os.environ', {**values, 'SEPAY_ENV': env}):
                config = runpy.run_path('app/config/config.py')['Config']
                self.assertEqual(config.SQLALCHEMY_DATABASE_URI, values['DATABASE_URL'])
                self.assertFalse(config.SEPAY_PRODUCTION_ENABLED)

    def test_approved_migration_adds_only_nullable_environment_without_backfill(self):
        migration = runpy.run_path('migrations/versions/31ac74d9e206_add_order_payment_environment.py')
        self.assertEqual(migration['down_revision'], '7e66691b2041')
        with patch('alembic.op.add_column') as add, patch('alembic.op.execute') as execute:
            migration['upgrade']()
        add.assert_called_once()
        table, column = add.call_args.args
        self.assertEqual((table, column.name, column.type.length), ('DonHang', 'MoiTruongThanhToan', 10))
        self.assertTrue(column.nullable)
        self.assertIsNone(column.default)
        self.assertIsNone(column.server_default)
        execute.assert_not_called()

    def test_order_detail_is_owned_and_uses_saved_line_prices_and_receipt(self):
        self.find.return_value = self.order(NgayDat=datetime(2026, 11, 18, 9, 15), GhiChu='Người nhận: An · 0900000000\nGiao tận nơi: Nhà 1\nGọi trước')
        rows = self.mock('app.services.order_service.orders.detail_items', return_value=[(
            NS(MaChiTiet=9007199254741001, MaThuoc=7, MaDonGia=8, SoLuong=3, DonGia=12000),
            NS(TenThuoc='<b>Thuốc A</b>', HinhAnh='javascript:alert(1)'), NS(DonViTinh='Vỉ', GiaBan=999999))])
        result = self.client.get('/api/orders/45/detail')
        self.assertEqual((result.status_code, result.json['code']), (200, 'ORDER_DETAIL'))
        detail = result.json['order']
        self.assertEqual(detail['NgayDat'], '2026-11-18T09:15:00')
        self.assertIn('Gọi trước', detail['GhiChu'])
        self.assertEqual(detail['items'][0]['MaChiTiet'], '9007199254741001')
        self.assertEqual(detail['items'][0]['DonGia'], '12000')
        self.assertEqual(detail['items'][0]['ThanhTien'], '36000')
        rows.assert_called_once_with(45)
        self.commit.assert_not_called()
        self.deduct.assert_not_called()

    def test_order_detail_does_not_query_items_for_another_owner(self):
        self.find.return_value = self.order(MaNguoiMua=99)
        rows = self.mock('app.services.order_service.orders.detail_items')
        self.assertEqual(self.client.get('/api/orders/45/detail').status_code, 404)
        self.assertEqual(self.client.get('/api/orders/9223372036854775808/detail').status_code, 404)
        rows.assert_not_called()

    def test_browser_return_redirects_only_to_allowed_frontend_without_payment_update(self):
        result = self.client.get('/api/payments/sepay/return?order=45&status=success&next=https://evil.example')
        self.assertEqual(result.status_code, 303)
        self.assertEqual(result.headers['Location'], 'https://shop.example/pages/customer/order-detail.html?order=45')
        self.commit.assert_not_called()
        self.deduct.assert_not_called()
        self.find.assert_not_called()
        for query in ['', '?order=0', '?order=-1', '?order=9223372036854775808', '?order=' + '9' * 5000]:
            self.assertEqual(self.client.get('/api/payments/sepay/return' + query).status_code, 400)
        with patch.dict(self.app.config, {'SEPAY_FRONTEND_ORIGIN': 'https://evil.example'}):
            self.assertEqual(self.client.get('/api/payments/sepay/return?order=45').status_code, 503)

    def test_payment_callbacks_preserve_allowed_storefront_origin_and_session(self):
        self.find.return_value = self.order()
        origins = ['http://localhost:5500', 'http://127.0.0.1:5500']
        callbacks = {f'SEPAY_{name}_URL': 'https://api.example/api/payments/sepay/return'
                     for name in ('SUCCESS', 'ERROR', 'CANCEL')}
        with patch.dict(self.app.config, {**callbacks, 'AUTH_ALLOWED_ORIGINS': origins,
                                         'SEPAY_FRONTEND_ORIGIN': origins[0]}):
            for origin in origins:
                response = self.client.post('/api/orders/45/payment',
                    headers={'Origin': origin, 'X-CSRF-Token': 'test-csrf'})
                self.assertEqual(response.status_code, 200)
                fields = response.json['payment']['fields']
                self.assertEqual(fields['signature'], gateway.sign_fields(fields, 'gateway-test-secret'))
                for name in ('success_url', 'error_url', 'cancel_url'):
                    url = urlsplit(fields[name])
                    query = parse_qs(url.query)
                    self.assertNotIn('frontend_origin', query)
                    if origin == origins[0]:
                        self.assertNotIn('storefront', query)
                    else:
                        self.assertEqual(query['storefront'], [gateway.storefront_key(origin)])
                    self.assertNotIn('localhost', fields[name])
                    self.assertNotIn('127.0.0.1', fields[name])
                    result = self.client.get(url.path + '?' + url.query)
                    self.assertEqual(result.status_code, 303)
                    self.assertEqual(result.location, origin + '/pages/customer/order-detail.html?order=45')
                    with self.client.session_transaction() as state:
                        self.assertEqual(state['user_id'], 12)
            for value in ['https://evil.example', 'http://localhost:5500.evil.example',
                          'http://localhost:5500/path', '']:
                result = self.client.get('/api/payments/sepay/return',
                    query_string={'order': '45', 'frontend_origin': value})
                self.assertEqual(result.status_code, 400)
            self.assertEqual(self.client.get('/api/payments/sepay/return?order=45'
                '&frontend_origin=http://localhost:5500&frontend_origin=http://127.0.0.1:5500').status_code, 400)
        self.deduct.assert_not_called()
        self.create.assert_not_called()

    def test_storefront_selector_rejects_unknown_duplicate_and_conflicting_origins(self):
        selector = gateway.storefront_key('https://shop.example')
        for query in [
            {'order': '45', 'storefront': 'not-configured'},
            {'order': '45', 'storefront': ['invalid', selector]},
            {'order': '45', 'storefront': selector, 'frontend_origin': 'https://shop.example'},
        ]:
            self.assertEqual(self.client.get('/api/payments/sepay/return', query_string=query).status_code, 400)
        self.commit.assert_not_called()
        self.find.assert_not_called()

    def test_render_callbacks_keep_configured_public_urls_in_both_gateway_environments(self):
        frontend = 'https://lanyenpharmacy.onrender.com'
        callback = 'https://lanyenpharmacy-api.onrender.com/api/payments/sepay/return'
        for environment in ('sandbox', 'production'):
            config = self.production_config() if environment == 'production' else {'SEPAY_ENV': 'sandbox'}
            prefix = 'SEPAY_PRODUCTION_' if environment == 'production' else 'SEPAY_'
            config.update({prefix + name + '_URL': callback for name in ('SUCCESS', 'ERROR', 'CANCEL')})
            config.update(APP_ENV='production', SEPAY_FRONTEND_ORIGIN=frontend,
                          AUTH_ALLOWED_ORIGINS=[frontend, 'http://localhost:5500'])
            self.find.return_value = self.order(MoiTruongThanhToan=environment)
            with patch.dict(self.app.config, config):
                for origin in (frontend, 'http://localhost:5500'):
                    result = self.client.post('/api/orders/45/payment',
                        headers={'Origin': origin, 'X-CSRF-Token': 'test-csrf'})
                    self.assertEqual(result.status_code, 200)
                    payment = result.json['payment']
                    self.assertEqual(payment['action'], gateway.ENVIRONMENTS[environment][0])
                    fields = payment['fields']
                    for name in ('success_url', 'error_url', 'cancel_url'):
                        self.assertEqual(fields[name], callback + '?order=45')
                    secret = config.get('SEPAY_PRODUCTION_SECRET_KEY', 'gateway-test-secret')
                    self.assertEqual(fields['signature'], gateway.sign_fields(fields, secret))
                redirect = self.client.get('/api/payments/sepay/return?order=45')
                self.assertEqual(redirect.location, frontend + '/pages/customer/order-detail.html?order=45')
        self.deduct.assert_not_called()
        self.create.assert_not_called()


if __name__ == '__main__':
    unittest.main()
