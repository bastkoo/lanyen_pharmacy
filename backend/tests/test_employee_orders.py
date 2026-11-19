"""Employee processing and expiry tests: database access is forbidden."""
import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace as NS
from unittest.mock import patch, Mock
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.services import employee_order_service as service, order_expiry_service as expiry, order_service
from app.services import counter_order_service as counter
from app.services.auth_service import AuthError
from app.repositories import don_hang_repository as repository
from app.repositories.don_hang_repository import employee_list as real_employee_list


class EmployeeOrderTests(unittest.TestCase):
    def mock(self, target, **kwargs):
        context = patch(target, **kwargs); result = context.start(); self.addCleanup(context.stop); return result

    def setUp(self):
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'employee-order-tests-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': []})
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.now = datetime(2026, 11, 19, 12)
        self.mock('app.services.order_expiry_service.vietnam_now', return_value=self.now)
        self.actor = NS(MaNguoiDung=8, VaiTro=1, TrangThai=False)
        self.customer = NS(MaNguoiDung=12, HoTen='Khách hàng', SDT='0900000000')
        self.customer.VaiTro = 0; self.customer.TrangThai = False
        self.mock('app.services.auth_service.users.find_by_id', return_value=self.actor)
        self.mock('app.services.employee_order_service.carts.lock_user', return_value=self.customer)
        self.order = NS(MaDonHang=45, MaNguoiMua=12, MaNhanVien=None, TongTien=30000, TienGiamGia=4450,
            TongThanhToan=25550, TrangThaiDonHang=1, TrangThaiThanhToan=0, PhuongThucThanhToan=0,
            MoiTruongThanhToan=None, DoiDiem=True, NgayDat=self.now-timedelta(hours=1), GhiChu='Địa chỉ đã lưu',
            DuLieuHoanTra={'version': 1, 'points': 20, 'batches': [{'MaLo': '5', 'MaThuoc': 7, 'SoLuong': 3}],
                          'promotions': [{'MaChuongTrinh': 6, 'MaThuoc': 7, 'SoLuong': 2}]})
        self.order.KenhDatHang = False
        self.find = self.mock('app.services.employee_order_service.orders.find', side_effect=lambda *args, **kwargs: self.order)
        self.mock('app.services.employee_order_service.orders.customer', return_value=self.customer)
        self.listing = self.mock('app.services.employee_order_service.orders.employee_list', return_value=([(self.order, self.customer)], 1))
        self.lines = self.mock('app.services.order_service.orders.detail_items', return_value=[(
            NS(MaChiTiet=1, MaThuoc=7, MaDonGia=3, SoLuong=3, DonGia=10000), NS(TenThuoc='Thuốc', HinhAnh=None, MaVach='0893000000123'), NS(DonViTinh='Viên'))])
        self.awards = []
        self.award = self.mock('app.services.employee_order_service.points.award', side_effect=lambda user, quantity, order, timestamp: self.awards.append(quantity))
        self.mock('app.services.order_service.points.order_award', side_effect=lambda *args: self.awards[-1] if self.awards else None)
        self.refund = self.mock('app.services.order_service.points.refund')
        self.batch = NS(SoLuongNhap=10, SoLuongTon=7)
        self.quota = NS(SoLuong=5)
        self.mock('app.services.order_service.batches.find_by_id', return_value=self.batch)
        self.mock('app.services.order_service.promotion_items.find_by_id', return_value=self.quota)
        self.commit = self.mock('app.extensions.db.session.commit')
        self.rollback = self.mock('app.extensions.db.session.rollback')
        self.client = self.app.test_client()
        with self.client.session_transaction() as session: session.update(user_id=8, csrf_token='csrf')

    def update(self, source, target, **extra):
        return self.client.post('/api/employee/orders/45/status', json=dict(from_status=source, to_status=target, **extra), headers={'X-CSRF-Token': 'csrf'})

    def test_list_search_and_detail_are_employee_only(self):
        result = self.client.get('/api/employee/orders?status=1&search=0900')
        self.assertEqual(result.status_code, 200)
        self.listing.assert_called_once_with('1', '0900', 1, 20)
        self.assertEqual(result.json['items'][0]['KhachHang']['SDT'], '0900000000')
        detail = self.client.get('/api/employee/orders/45').json['order']
        self.assertEqual(detail['items'][0]['TenThuoc'], 'Thuốc')
        self.assertTrue(detail['CanPrint'])
        self.assertEqual(detail['items'][0]['MaVach'], '0893000000123')
        self.assertIsNone(detail['XuDaCong'])
        for role in [0, 2]:
            self.actor.VaiTro = role
            for path in ['/api/employee/orders', '/api/employee/orders/45']:
                self.assertEqual(self.client.get(path).status_code, 403)
            self.assertEqual(self.update(1, 2).status_code, 403)
            self.assertEqual(self.client.post('/api/employee/orders/45/cancel', json={}, headers={'X-CSRF-Token':'csrf'}).status_code, 403)
        self.award.assert_not_called()

    def test_barcode_is_employee_only_and_print_is_processing_only(self):
        with self.app.app_context():
            self.assertNotIn('MaVach', order_service.read_detail(12, 45)['items'][0])
            for state in range(6):
                self.order.TrangThaiDonHang = state
                self.assertEqual(service.detail(45)['CanPrint'], state == 1)
            detail, product, unit = self.lines.return_value[0]
            self.lines.return_value = [(detail, None, unit)]
            self.assertIsNone(service.detail(45)['items'][0]['MaVach'])

    def test_allowed_transitions_counter_payment_cod_and_exactly_once_award(self):
        self.order.TrangThaiDonHang = 0; self.order.PhuongThucThanhToan = 1
        result = self.update(0, 1)
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json['order']['CanPrint'])
        self.assertEqual(self.order.TrangThaiThanhToan, 1)
        self.assertEqual(self.order.MaNhanVien, 8)
        self.award.assert_not_called()
        result = self.update(1, 2)
        self.assertFalse(result.json['order']['CanPrint'])
        self.award.assert_not_called()
        self.order.PhuongThucThanhToan = 0; self.order.TrangThaiThanhToan = 0
        result = self.update(2, 3)
        self.assertEqual((result.status_code, self.order.TrangThaiThanhToan), (200, 1))
        self.assertEqual(result.json['order']['XuDaCong'], '255')
        self.assertEqual(self.awards, [255])
        self.assertEqual(self.update(2, 3).json['code'], 'ORDER_STATE_CHANGED')
        self.assertEqual(self.awards, [255])

    def test_skipped_stale_invalid_or_missing_csrf_requests_cannot_mutate(self):
        self.assertEqual(self.update(0, 3).json['code'], 'INVALID_TRANSITION')
        self.assertEqual(self.update(0, 1).json['code'], 'ORDER_STATE_CHANGED')
        self.assertEqual(self.update(1, 2, MaNguoiMua=99).status_code, 400)
        self.assertEqual(self.update(True, 2).status_code, 400)
        self.assertEqual(self.client.post('/api/employee/orders/45/status', json={'from_status':1,'to_status':2}).status_code, 403)
        for query in ['?status=3','?search=%25','?page=0','?status=1&status=2','?user=99']:
            self.assertEqual(self.client.get('/api/employee/orders'+query).status_code, 400)
        self.commit.assert_not_called()

    def test_database_failure_rolls_back_award_and_state(self):
        self.order.TrangThaiDonHang = 2; self.award.side_effect = SQLAlchemyError('private')
        response = self.update(2, 3)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.text)
        self.commit.assert_not_called(); self.rollback.assert_called()

    def test_zero_value_delivered_order_does_not_create_reward_transaction(self):
        self.order.TrangThaiDonHang = 2; self.order.TongThanhToan = 0
        result = self.update(2, 3)
        self.assertEqual(result.status_code, 200)
        self.award.assert_not_called()
        self.assertIsNone(result.json['order']['XuDaCong'])

    def test_pending_count_and_completed_list_permissions_and_filters(self):
        self.mock('app.services.employee_order_service.orders.pending_count', return_value=7)
        self.assertEqual(self.client.get('/api/employee/orders/pending-count').json['count'], 7)
        self.assertEqual(self.client.get('/api/employee/orders/completed').status_code, 200)
        self.listing.assert_called_with('3', '', 1, 20)
        self.actor.VaiTro = 0
        for path in ['pending-count', 'completed', 'counter/customer?phone=0900000000', 'counter/pending', 'counter/45']:
            self.assertEqual(self.client.get('/api/employee/orders/' + path).status_code, 403)

    def test_counter_lookup_new_existing_and_unavailable_customer(self):
        lookup = self.mock('app.services.counter_order_service.users.find_by_phone', return_value=self.customer)
        self.mock('app.services.counter_order_service.points.balance', return_value=100)
        result = self.client.get('/api/employee/orders/counter/customer?phone=0900000000')
        self.assertEqual((result.status_code, result.json['SoXu']), (200, '100'))
        lookup.assert_called_with('+84900000000')
        for role in (0, 1, 2):
            self.customer.VaiTro = role
            self.assertEqual(self.client.get('/api/employee/orders/counter/customer?phone=0900000000').status_code, 200)
        lookup.return_value = None
        self.assertFalse(self.client.get('/api/employee/orders/counter/customer?phone=0900000000').json['exists'])
        lookup.return_value = self.customer; self.customer.TrangThai = True
        self.assertEqual(self.client.get('/api/employee/orders/counter/customer?phone=0900000000').status_code, 409)
        self.assertEqual(self.client.get('/api/employee/orders/counter/customer?phone=bad').status_code, 400)

    def test_counter_quote_uses_promotion_total_and_caps_redemption_before_award(self):
        self.mock('app.services.counter_order_service.users.find_by_phone', return_value=self.customer)
        self.mock('app.services.counter_order_service.points.balance', return_value=1000)
        cart = self.mock('app.services.counter_order_service.get_cart', return_value={
            'total':25550, 'items':[dict(MaThuoc=7,MaDonGia=3,SoLuong=3,GiaBan=7500,GiaGoc=10000,ThanhTien=25550,ConHang=True)]})
        values = dict(SDT='0900000000',DoiDiem=True,items=[dict(MaThuoc=7,MaDonGia=3,SoLuong=3)])
        with self.app.app_context():
            result=counter.quote(values)
            self.assertEqual((result['TongTien'],result['TongThanhToan'],result['XuSuDung'],result['XuSeCong']), ('30000','50',255,'0'))
            cart.assert_called_once_with(entries=[(7,3,3)])
            cart.return_value['items'][0]['ConHang']=False
            with self.assertRaises(AuthError) as error: counter.quote(values)
            self.assertEqual(error.exception.code,'OUT_OF_STOCK')
        self.award.assert_not_called(); self.commit.assert_not_called()

    def test_counter_quote_without_phone_prices_items_without_customer_or_coins(self):
        lookup = self.mock('app.services.counter_order_service.users.find_by_phone')
        balance = self.mock('app.services.counter_order_service.points.balance')
        self.mock('app.services.counter_order_service.get_cart', return_value={
            'total':8000,'items':[dict(MaThuoc=7,MaDonGia=3,SoLuong=1,GiaBan=8000,GiaGoc=10000,ThanhTien=8000,ConHang=True)]})
        response = self.client.post('/api/employee/orders/counter/quote', json={
            'items':[dict(MaThuoc=7,MaDonGia=3,SoLuong=1)],'DoiDiem':False}, headers={'X-CSRF-Token':'csrf'})
        self.assertEqual(response.status_code,200)
        self.assertEqual((response.json['TongTien'],response.json['TongThanhToan'],response.json['SoXu']),('10000','8000','0'))
        lookup.assert_not_called(); balance.assert_not_called(); self.commit.assert_not_called()

    def test_counter_catalog_prices_each_unit_with_available_promotion_quota(self):
        product = NS(MaThuoc=7, MaLoaiThuoc=1, TenThuoc='Thuốc', HinhAnh=None, MaVach='0893000000123')
        listing = self.mock('app.services.counter_order_service.products.list_products', return_value=([product], 1))
        self.mock('app.services.counter_order_service.units.public_units', return_value=[
            NS(MaThuoc=7,MaDonGia=3,DonViTinh='Viên',GiaBan=10000,SoLuongQuyDoi=1),
            NS(MaThuoc=7,MaDonGia=4,DonViTinh='Hộp',GiaBan=100000,SoLuongQuyDoi=10)])
        self.mock('app.services.counter_order_service.usable_stock', return_value={7:100})
        offer = NS(MaThuoc=7,MaChuongTrinh=6,SoLuong=2,LoaiGiamGia=False,GiaTriGiam=2000)
        self.mock('app.services.counter_order_service.promotions.active_for_products', return_value=[(offer,NS(MaChuongTrinh=6,TenChuongTrinh='Ưu đãi'))])
        with self.app.app_context():
            result = counter.catalog(dict(search='0893',category_id=1,page=1,per_page=12,sort_order='asc'))
        self.assertEqual(result['items'][0]['MaVach'],'0893000000123')
        single, box = result['items'][0]['DonViGia']
        self.assertEqual((single['GiaBan'],single['GiaKhuyenMai']),(10000,8000))
        self.assertIsNone(box['GiaKhuyenMai'], 'Not enough promotion quota for a box')
        listing.assert_called_once_with(search='0893',category_id=1,page=1,per_page=12,sort_order='asc',sort_by='TenThuoc')
        self.actor.VaiTro=0
        self.assertEqual(self.client.get('/api/employee/orders/counter/products').status_code,403)

    def test_counter_qr_completion_requires_verified_payment_and_awards_once(self):
        self.order.KenhDatHang = True; self.order.TrangThaiDonHang = 0
        self.mock('app.services.counter_order_service.users.lock_by_id', return_value=self.customer)
        def complete():
            return self.client.post('/api/employee/orders/counter/45/complete', json={}, headers={'X-CSRF-Token':'csrf'})
        self.assertEqual(complete().json['code'], 'PAYMENT_PENDING')
        self.award.assert_not_called()
        self.order.TrangThaiDonHang = 1; self.order.TrangThaiThanhToan = 1
        result = complete()
        self.assertEqual((result.status_code, result.json['order']['CanPrint']), (200, True))
        self.assertEqual(self.awards, [255])
        self.assertEqual(complete().status_code, 200)
        self.assertEqual(self.awards, [255])
        self.assertEqual(self.client.post('/api/employee/orders/counter/45/complete', json={}).status_code, 403)

    def test_counter_zero_completion_and_online_history_print_scope(self):
        self.order.TrangThaiDonHang = 3
        self.assertTrue(self.client.get('/api/employee/orders/counter/45').json['order']['CanPrint'])
        self.order.TrangThaiDonHang = 2
        self.assertEqual(self.client.get('/api/employee/orders/counter/45').status_code, 404)
        self.order.KenhDatHang = True; self.order.TrangThaiDonHang = 1
        self.order.TrangThaiThanhToan = 1; self.order.TongThanhToan = 0
        self.mock('app.services.counter_order_service.users.lock_by_id', return_value=self.customer)
        with self.app.app_context():
            self.assertTrue(counter.complete(self.actor, 45)['CanPrint'])
        self.award.assert_not_called()

    def test_counter_request_retry_returns_existing_without_new_stock_write(self):
        import uuid
        data = dict(SDT='0900000000', HoTen='Mới', items=[dict(MaThuoc=7, MaDonGia=3, SoLuong=1)],
                    DoiDiem=False, TongThanhToan='10000', PhuongThucThanhToan=0, request_id=uuid.uuid4())
        request = self.mock('app.services.counter_order_service.orders.counter_request', return_value=None)
        self.mock('app.services.counter_order_service.users.find_by_phone', return_value=None)
        new_user = self.mock('app.services.counter_order_service.users.create_customer', return_value=self.customer)
        self.mock('app.services.counter_order_service.users.lock_by_id', return_value=self.customer)
        def persist(user, values, **kwargs):
            self.order.KenhDatHang = True; self.order.TrangThaiDonHang = 3
            self.order.DuLieuHoanTra['counter_request'] = kwargs['counter']
            return {'MaDonHang': '45'}
        create = self.mock('app.services.counter_order_service.order_service.create', side_effect=persist)
        with self.app.app_context():
            self.assertTrue(counter.create(self.actor, data)['CanPrint'])
            new_user.assert_called_once_with('+84900000000', 'Mới', commit=False)
            request.return_value = self.order
            self.assertTrue(counter.create(self.actor, data)['CanPrint'])
            create.assert_called_once()
            data['TongThanhToan'] = '20000'
            with self.assertRaises(AuthError) as error: counter.create(self.actor, data)
            self.assertEqual(error.exception.code, 'COUNTER_REQUEST_CHANGED')

    def test_counter_create_validates_body_and_requires_employee_csrf(self):
        import uuid
        data = dict(SDT='0900000000', HoTen='Khách', items=[dict(MaThuoc=7, MaDonGia=3, SoLuong=1)],
                    DoiDiem=False, TongThanhToan='10000', PhuongThucThanhToan=0, request_id=str(uuid.uuid4()))
        create = self.mock('app.services.counter_order_service.create', return_value={'MaDonHang':'45'})
        url = '/api/employee/orders/counter'
        def send(values): return self.client.post(url, json=values, headers={'X-CSRF-Token':'csrf'})
        self.assertEqual(send(data).status_code, 200)
        for bad in [{**data,'DoiDiem':'true'}, {**data,'items':[data['items'][0]]*2}, {**data,'items':[{**data['items'][0],'SoLuong':0}]}, {**data,'PhuongThucThanhToan':2}, {**data,'request_id':'bad'}, {**data,'MaNhanVien':8}]:
            self.assertEqual(send(bad).status_code, 400)
        create.assert_called_once()
        self.assertEqual(send({key:value for key,value in data.items() if key!='SDT'}).status_code,400)
        self.assertEqual(self.client.post(url,json=data).status_code, 403)
        self.actor.VaiTro=0
        self.assertEqual(send(data).status_code, 403)

    def test_employee_cancel_including_shipping_restores_allocations(self):
        self.order.TrangThaiDonHang = 2
        result = self.client.post('/api/employee/orders/45/cancel', json={}, headers={'X-CSRF-Token':'csrf'})
        self.assertEqual(result.status_code, 200)
        self.assertEqual((self.order.TrangThaiDonHang, self.batch.SoLuongTon, self.quota.SoLuong), (4, 10, 7))
        self.assertEqual(self.refund.call_args.args[:3], (12, 20, 45))
        self.assertEqual(self.order.MaNhanVien, 8)

    def test_expiry_boundary_cod_and_payment_race(self):
        self.order.TrangThaiDonHang = 0; self.order.PhuongThucThanhToan = 1
        self.order.NgayDat = self.now-timedelta(hours=24)
        self.assertFalse(expiry.overdue(self.order))
        self.order.NgayDat -= timedelta(seconds=1)
        self.assertTrue(expiry.overdue(self.order))
        self.assertEqual(self.update(0, 1).json['code'], 'ORDER_EXPIRED')
        with self.app.app_context():
            self.order.TrangThaiThanhToan = 1
            with self.assertRaises(AuthError) as error:
                order_service.cancel(12, 45, expired_before=self.now-timedelta(hours=24))
            self.assertEqual(error.exception.code, 'ORDER_NOT_EXPIRED')
        self.order.TrangThaiThanhToan = 0; self.order.PhuongThucThanhToan = 0
        self.assertFalse(expiry.overdue(self.order))

    def test_automatic_expiry_restores_inventory_points_and_quota(self):
        self.order.TrangThaiDonHang = 0; self.order.PhuongThucThanhToan = 1
        self.order.NgayDat = self.now-timedelta(hours=25)
        candidates = self.mock('app.services.order_expiry_service.orders.expired_candidates', side_effect=[[(45,12)], []])
        with self.app.app_context(): result = expiry.expire_due()
        self.assertEqual(result, {'cancelled':1,'review_required':0})
        self.assertEqual((self.order.TrangThaiDonHang, self.batch.SoLuongTon, self.quota.SoLuong), (4,10,7))
        self.assertEqual(candidates.call_args.args[1], 45)
        self.refund.assert_called_once()

    def test_legacy_expiry_requires_review_and_test_app_does_not_start_worker(self):
        self.order.TrangThaiDonHang=0; self.order.PhuongThucThanhToan=1; self.order.NgayDat=self.now-timedelta(hours=25); self.order.DuLieuHoanTra=None
        self.mock('app.services.order_expiry_service.orders.expired_candidates', side_effect=[[(45,12)], []])
        with self.app.app_context(): result = expiry.expire_due()
        self.assertEqual(result, {'cancelled':0,'review_required':1})
        self.assertEqual(self.order.TrangThaiDonHang, 0)
        self.refund.assert_not_called()
        with patch('app.services.order_expiry_service.Thread') as thread:
            expiry.start_worker(self.app); thread.assert_not_called()

    def test_repository_priority_and_phone_search_are_parameterized(self):
        aggregate=Mock(); aggregate.scalar_one.return_value=0
        rows=Mock(); rows.all.return_value=[]
        with self.app.app_context(), patch('app.extensions.db.session.execute', side_effect=[aggregate, rows]) as execute:
            self.assertEqual(real_employee_list('all','0900',1,20), ([],0))
            compiled=execute.call_args_list[1].args[0].compile(dialect=postgresql.dialect())
            self.assertIn('CASE',str(compiled)); self.assertIn('0900',compiled.params.values()); self.assertIn('SDT',str(compiled))
            self.assertIn('+84900', compiled.params.values())

    def test_expiry_cli_and_background_loop_work_without_an_open_page(self):
        with patch.object(expiry, 'expire_due', return_value={'cancelled':0,'review_required':0}) as sweep:
            result = self.app.test_cli_runner().invoke(args=['expire-unpaid-orders'])
            self.assertEqual(result.exit_code, 0)
            sweep.assert_called_once()
        event=Mock(); event.is_set.side_effect=[False,True]
        with patch.dict(self.app.config,{'TESTING':False}), patch.object(expiry,'Event',return_value=event), \
                patch.object(expiry,'Thread') as thread, patch.object(expiry,'expire_due',return_value={'cancelled':0,'review_required':0}) as sweep:
            expiry.start_worker(self.app); expiry.start_worker(self.app)
            thread.assert_called_once(); thread.return_value.start.assert_called_once()
            thread.call_args.kwargs['target']()
            sweep.assert_called_once(); event.wait.assert_called_once_with(60)

    def test_expiry_continues_after_review_and_payment_race_without_duplicate_refunds(self):
        candidates=self.mock('app.services.order_expiry_service.orders.expired_candidates',side_effect=[[(45,12),(46,13),(47,14)],[]])
        with self.app.app_context(), patch.object(order_service,'cancel',side_effect=[AuthError('ORDER_REFUND_REVIEW_REQUIRED',409),AuthError('ORDER_NOT_EXPIRED',409),{}]) as cancel:
            self.assertEqual(expiry.expire_due(), {'cancelled':1,'review_required':1})
            self.assertEqual(cancel.call_count,3)
            self.assertEqual(cancel.call_args.kwargs['expired_before'],self.now-timedelta(hours=24))
        self.refund.assert_not_called()
