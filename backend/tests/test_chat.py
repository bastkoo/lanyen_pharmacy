"""Chat workflow and consultation permissions. Never connect to a real database."""
import unittest
from io import BytesIO
from types import SimpleNamespace as NS
from unittest.mock import patch
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.services import chat_service as service, consultation_service as consultation
from app.services.auth_service import AuthError
from app.repositories.chat_repository import pending_count as real_pending_count
from sqlalchemy.dialects import postgresql


class ChatTests(unittest.TestCase):
    def mock(self, path, **kwargs):
        context = patch(path, **kwargs); result = context.start(); self.addCleanup(context.stop); return result

    def setUp(self):
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'chat-tests-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': []})
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.actor = NS(MaNguoiDung=12, VaiTro=0, TrangThai=False)
        self.mock('app.services.auth_service.users.find_by_id', side_effect=lambda _: self.actor)
        self.thread = NS(MaTinNhan=1, NguoiGui=12, MaNhanVien=None, TrangThai=0)
        self.messages = []
        self.find = self.mock('app.repositories.chat_repository.thread', side_effect=lambda *a, **k: self.thread)
        self.mock('app.repositories.chat_repository.active_customer', side_effect=lambda _: self.thread if self.thread.TrangThai != 2 else None)
        self.create = self.mock('app.repositories.chat_repository.create_thread', side_effect=self.new_thread)
        self.mock('app.repositories.chat_repository.customer_payloads', side_effect=lambda _: self.messages)
        self.mock('app.repositories.chat_repository.thread_payloads', side_effect=lambda _: self.messages)
        self.add = self.mock('app.repositories.chat_repository.add', side_effect=self.add_message)
        self.mock('app.repositories.chat_repository.messages', side_effect=lambda **kw: [(m, 1 if m.NguoiGui == 8 else 0) for m in self.messages])
        self.mock('app.repositories.chat_repository.queue', return_value=([(self.thread, NS(HoTen='Khách', SDT='0900000000'))], 1))
        self.mock('app.repositories.chat_repository.unread', return_value=2)
        self.mark = self.mock('app.repositories.chat_repository.mark_read')
        self.mock('app.repositories.chat_repository.is_staff_message', side_effect=lambda m: m.NguoiGui == 8)
        self.mock('app.repositories.gio_thuoc_repository.lock_user', return_value=self.actor)
        self.product = NS(MaThuoc=7, TenThuoc='Thuốc', HinhAnh='https://example.com/a.jpg', PhanLoai=True)
        self.unit = NS(MaDonGia=3, DonViTinh='Hộp', SoLuongQuyDoi=10, GiaBan=10000)
        self.mock('app.repositories.gio_thuoc_repository.catalog_details', return_value={(7, 3): (self.product, self.unit)})
        self.mock('app.repositories.gio_thuoc_repository.list_items', return_value=[])
        self.mock('app.services.chat_service.require_unit', return_value=self.unit)
        self.stock = self.mock('app.services.chat_service.usable_stock', return_value={7: 100})
        self.cart_add = self.mock('app.services.chat_service.add_database')
        self.quote = self.mock('app.services.chat_service.get_cart', return_value={'code': 'CART_LISTED', 'items': [{'MaDonGia': 3, 'GiaBan': 9000, 'ThanhTien': 9000, 'ConHang': True}], 'total': 9000})
        self.image = self.mock('app.services.chat_service.validate_product_image_url')
        self.commit = self.mock('app.extensions.db.session.commit')
        self.rollback = self.mock('app.extensions.db.session.rollback')
        self.client = self.app.test_client()
        with self.client.session_transaction() as state: state.update(user_id=12, csrf_token='csrf')

    def new_thread(self, user):
        self.thread = NS(MaTinNhan=2, NguoiGui=user, MaNhanVien=None, TrangThai=0)
        return self.thread

    def add_message(self, thread, sender, content, at, sender_type):
        value = NS(MaNoiDung=len(self.messages)+1, MaTinNhan=thread, NguoiGui=sender, LoaiNguoiGui=sender_type, NoiDung=content, ThoiGianGui=at, DaDoc=False)
        self.messages.append(value); return value

    def post(self, path='/messages', body=None):
        return self.client.post('/api/chat' + path, json=body if body is not None else {}, headers={'X-CSRF-Token': 'csrf'})

    def send(self, kind='text', request_id='00000000-0000-4000-8000-000000000001', **content):
        return self.post('/threads/1/messages' if self.actor.VaiTro == 1 else '/messages',
                         dict(kind=kind, request_id=request_id, **(content or {'text': 'Xin tư vấn'})))

    def staff(self, actor_id=8):
        self.actor = NS(MaNguoiDung=actor_id, VaiTro=1, TrangThai=False)

    def test_customer_text_and_retry_after_finish_create_no_duplicates(self):
        first = self.send()
        self.assertEqual(first.status_code, 200)
        self.thread.TrangThai = 2
        self.assertEqual(self.send().json, first.json)
        self.assertEqual(len(self.messages), 1); self.create.assert_not_called()
        self.assertEqual(self.send(request_id='00000000-0000-4000-8000-000000000002').status_code, 200)
        self.create.assert_called_once_with(12)
        self.assertEqual(self.messages[-1].MaTinNhan, 2)

    def test_request_id_cannot_be_reused_with_different_content(self):
        self.send()
        self.assertEqual(self.send(text='Changed').json['code'], 'CHAT_REQUEST_CHANGED')
        self.assertEqual(len(self.messages), 1)

    def test_claim_exclusive_access_and_finish(self):
        self.staff()
        self.assertEqual(self.client.get('/api/chat/threads/1/messages').status_code, 200)
        self.assertEqual(self.send().json['code'], 'CHAT_NOT_ASSIGNED')
        self.assertEqual(self.post('/threads/1/claim').status_code, 200)
        self.assertEqual(self.thread.MaNhanVien, 8)
        self.assertEqual(self.send().json['message']['sender'], 'Dược sĩ')
        self.staff(9)
        for path in ['/threads/1/claim', '/threads/1/finish', '/threads/1/read']:
            self.assertEqual(self.post(path, {'last_id': '1'} if path.endswith('/read') else {}).status_code, 404)
        self.assertEqual(self.client.get('/api/chat/threads/1/messages').status_code, 404)
        self.assertEqual(self.send().status_code, 404)
        self.staff()
        self.assertEqual(self.post('/threads/1/finish').status_code, 200)
        self.assertEqual(self.thread.TrangThai, 2)
        self.assertEqual(self.client.get('/api/chat/threads/1/messages').status_code, 404)
        self.actor.VaiTro = 0; self.actor.MaNguoiDung = 12
        self.assertEqual(self.client.get('/api/chat/messages').status_code, 200)

    def test_customer_cannot_forge_offers(self):
        response = self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3)])
        self.assertEqual(response.status_code, 403); self.add.assert_not_called()

    def test_product_request_and_offer_snapshots_are_server_owned(self):
        response = self.send('product', items=[dict(MaThuoc=7, MaDonGia=3)])
        self.assertEqual(response.json['message']['items'][0]['TenThuoc'], 'Thuốc')
        self.assertNotIn('request_id', response.json['message'])
        self.staff(); self.post('/threads/1/claim')
        response = self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3)])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3)]).status_code, 200)

    def test_offer_remains_usable_after_finish_and_requires_owner(self):
        self.staff(); self.post('/threads/1/claim'); self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3)])
        self.post('/threads/1/finish'); self.actor.VaiTro = 0; self.actor.MaNguoiDung = 12
        self.quote.reset_mock()
        self.assertEqual(self.post('/offers/1/cart').status_code, 200)
        self.quote.assert_called_once_with(entries=[(7, 3, 1)])
        self.cart_add.assert_called_once_with(12, [(7, 3, 1)], check_stock=True)
        with self.app.app_context(): consultation.require_authorization(12, [(7, 3)])
        with patch('app.repositories.chat_repository.customer_payloads', return_value=[]):
            self.assertEqual(self.post('/offers/1/cart').status_code, 404)
            with self.app.app_context(), self.assertRaises(AuthError): consultation.require_authorization(99, [(7, 3)])

    def test_no_authorization_from_customer_product_or_forged_text(self):
        self.send('product', items=[dict(MaThuoc=7, MaDonGia=3)])
        with self.app.app_context(), self.assertRaises(AuthError): consultation.require_authorization(12, [(7, 3)])
        self.assertEqual(self.post('/offers/1/cart').status_code, 404)
        with self.app.app_context(), self.assertRaises(AuthError): consultation.require_authorization(None, [(7, 3)])

    def test_unread_read_scope_and_visibility(self):
        self.assertEqual(self.client.get('/api/chat/unread').json['count'], 2)
        self.assertEqual(self.post('/read', {'last_id': '3'}).status_code, 200)
        self.mark.assert_called_with(12, 3, user_id=12, thread_id=None)
        self.assertEqual(self.post('/read', {'last_id': '9223372036854775808'}).status_code, 400)
        self.assertEqual(self.client.get('/api/chat/threads').status_code, 403)
        self.staff(); self.assertEqual(self.client.get('/api/chat/unread').status_code, 403)
        self.assertEqual(self.client.get('/api/chat/threads').json['total'], 1)

    def test_image_uses_dedicated_cloudinary_folder(self):
        self.assertEqual(self.send('image', url='https://res.cloudinary.com/demo/image.jpg').status_code, 200)
        self.image.assert_called_with('https://res.cloudinary.com/demo/image.jpg', folder=service.CHAT_FOLDER)

    def test_image_upload_permissions_and_validation(self):
        upload = self.mock('app.services.chat_service.upload_image', return_value={'url': 'https://example.com/chat.png'})
        def send():
            path = '/api/chat/threads/1/images' if self.actor.VaiTro == 1 else '/api/chat/images'
            return self.client.post(path, data={'image': (BytesIO(b'image'), 'chat.png', 'image/png')}, headers={'X-CSRF-Token': 'csrf'})
        self.assertEqual(send().status_code, 200)
        self.assertEqual(upload.call_args.args[1], service.CHAT_FOLDER)
        self.staff(); self.assertEqual(send().status_code, 409)
        self.post('/threads/1/claim'); self.assertEqual(send().status_code, 200)
        self.staff(9); self.assertEqual(send().status_code, 404)

    def test_auth_csrf_invalid_payload_and_internal_error(self):
        for body in [dict(kind='text', text=' '), dict(kind='image', text='bad'), dict(kind='offer', items=[]), dict(kind='text', text='test', actor=8)]:
            self.assertEqual(self.post('/messages', body).status_code, 400)
        self.assertEqual(self.client.post('/api/chat/messages', json={}).status_code, 403)
        self.actor.VaiTro = 2
        self.assertEqual(self.client.get('/api/chat/messages').status_code, 403)
        self.actor.VaiTro = 0
        self.add.side_effect = SQLAlchemyError('private error')
        self.assertEqual(self.send().json, {'code': 'DATABASE_UNAVAILABLE'})
        self.rollback.assert_called()
        with self.client.session_transaction() as state: state.clear()
        self.assertEqual(self.client.get('/api/chat/messages').status_code, 401)

    def test_purchase_rechecks_current_stock_before_any_cart_write(self):
        self.staff(); self.post('/threads/1/claim'); self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3)])
        self.actor.VaiTro = 0; self.actor.MaNguoiDung = 12; self.stock.return_value = {7: 9}
        self.assertEqual(self.post('/offers/1/cart').json['code'], 'OUT_OF_STOCK'); self.cart_add.assert_not_called()

    def test_unrelated_cart_item_does_not_block_an_offer_purchase(self):
        self.staff(); self.post('/threads/1/claim'); self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3)])
        self.actor.VaiTro = 0; self.actor.MaNguoiDung = 12
        self.stock.reset_mock()
        self.mock('app.repositories.gio_thuoc_repository.list_items', return_value=[NS(MaThuoc=99, MaDonGia=999, SoLuong=1)])
        self.assertEqual(self.post('/offers/1/cart').status_code, 200)
        self.stock.assert_called_once_with([7])

    def test_offer_quantity_price_snapshot_and_purchase_quantity(self):
        self.staff(); self.post('/threads/1/claim')
        self.quote.return_value = {'items': [{'MaDonGia': 3, 'GiaBan': 9000, 'ThanhTien': 28000, 'SoLuongKhuyenMai': 2, 'ConHang': True}], 'total': 28000}
        first = self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3, SoLuong=3)])
        self.assertEqual(first.status_code, 200)
        item = first.json['message']['items'][0]
        self.assertEqual((item['SoLuong'], item['DonGia'], item['ThanhTien']), (3, '9000', '28000'))
        self.quote.assert_called_with(entries=[(7, 3, 3)])
        self.quote.return_value['items'][0]['ThanhTien'] = 29000
        self.quote.return_value['total'] = 29000
        self.assertEqual(self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3, SoLuong=3)]).json, first.json)
        self.assertEqual(self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3, SoLuong=2)]).json['code'], 'CHAT_REQUEST_CHANGED')
        self.actor.VaiTro = 0; self.actor.MaNguoiDung = 12
        self.assertEqual(self.post('/offers/1/cart').json['total'], '29000')
        self.cart_add.assert_called_once_with(12, [(7, 3, 3)], check_stock=True)

    def test_invalid_offer_quantities_and_client_prices_are_rejected(self):
        self.staff(); self.post('/threads/1/claim')
        for quantity in (0, -1, 1.5, True, '3', 2147483648):
            self.assertEqual(self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3, SoLuong=quantity)]).status_code, 400)
        self.assertEqual(self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3, DonGia=1)]).status_code, 400)
        self.add.assert_not_called()

    def test_no_offer_sent_if_out_of_stock_or_combined_units_exceed_stock(self):
        self.staff(); self.post('/threads/1/claim'); self.stock.return_value = {7: 0}
        self.assertEqual(self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3)]).json['code'], 'OUT_OF_STOCK')
        self.stock.return_value = {7: 29}
        self.assertEqual(self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3, SoLuong=3)]).json['code'], 'OUT_OF_STOCK')
        second_unit = NS(DonViTinh='Viên', SoLuongQuyDoi=5, GiaBan=5000)
        self.mock('app.services.chat_service.require_unit', side_effect=lambda product, unit: self.unit if unit == 3 else second_unit)
        self.mock('app.repositories.gio_thuoc_repository.catalog_details', return_value={(7, 3): (self.product, self.unit), (7, 4): (self.product, second_unit)})
        self.stock.return_value = {7: 34}
        self.assertEqual(self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3, SoLuong=3), dict(MaThuoc=7, MaDonGia=4)]).json['code'], 'OUT_OF_STOCK')
        self.add.assert_not_called()

    def test_direct_offer_quote_never_reads_or_mutates_cart(self):
        self.staff(); self.post('/threads/1/claim'); self.send('offer', items=[dict(MaThuoc=7, MaDonGia=3)])
        self.post('/threads/1/finish'); self.actor.VaiTro = 0; self.actor.MaNguoiDung = 12
        listing = self.mock('app.repositories.gio_thuoc_repository.list_items')
        result = self.client.get('/api/chat/offers/1/quote')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json['code'], 'CART_LISTED')
        self.quote.assert_called_with(entries=[(7, 3, 1)], lock_promotions=False)
        listing.assert_not_called(); self.cart_add.assert_not_called()
        with patch('app.repositories.chat_repository.customer_payloads', return_value=[]):
            self.assertEqual(self.client.get('/api/chat/offers/1/quote').status_code, 404)
            result = self.post('/offers/1/checkout', dict(PhuongThucThanhToan=0, HinhThucNhanHang='pickup', GhiChu='', TongThanhToan='9000'))
            self.assertEqual(result.status_code, 404)

    def test_pending_count_is_shared_by_all_employees_and_forbidden_to_other_roles(self):
        pending = self.mock('app.repositories.chat_repository.pending_count', return_value=7)
        for employee_id in (8, 9):
            self.staff(employee_id)
            self.assertEqual(self.client.get('/api/chat/threads/pending-count').json['count'], 7)
        self.assertEqual(pending.call_count, 2)
        self.assertEqual(self.client.get('/api/chat/threads/pending-count?search=x').status_code, 400)
        for role in (0, 2):
            self.actor.VaiTro = role
            self.assertEqual(self.client.get('/api/chat/threads/pending-count').status_code, 403)

    def test_pending_count_query_counts_distinct_waiting_customers_not_messages(self):
        execute = self.mock('app.extensions.db.session.execute')
        execute.return_value.scalar_one.return_value = 3
        with self.app.app_context():
            self.assertEqual(real_pending_count(), 3)
        sql = str(execute.call_args.args[0].compile(dialect=postgresql.dialect(), compile_kwargs={'literal_binds': True}))
        self.assertIn('count(distinct("TinNhan"."NguoiGui"))', sql)
        self.assertIn('"TrangThai" = 0', sql)
        self.assertIn('"MaNhanVien" IS NULL', sql)


if __name__ == '__main__': unittest.main()
