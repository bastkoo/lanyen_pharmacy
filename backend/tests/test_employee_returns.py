"""Return API and financial/inventory regressions. No database connections."""
import unittest
from types import SimpleNamespace as NS
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.dialects import postgresql

import test_employee_orders as fixtures
from app.services import employee_return_service as returns


class EmployeeReturnTests(unittest.TestCase):
    mock = fixtures.EmployeeOrderTests.mock

    def setUp(self):
        fixtures.EmployeeOrderTests.setUp(self)
        self.order.TrangThaiDonHang = 3
        self.order.TrangThaiThanhToan = 1
        self.batch_lookup = self.mock('app.services.employee_return_service.batches.find_by_id', return_value=self.batch)

    def submit(self, quantity=1, returned=0, request_id='00000000-0000-4000-8000-000000000001', **extra):
        return self.client.post('/api/employee/orders/45/returns', json=dict(
            MaChiTiet='1', SoLuong=quantity, DaTra=returned, request_id=request_id, **extra),
            headers={'X-CSRF-Token': 'csrf'})

    def test_partial_repeated_full_and_no_points_or_quota_changes(self):
        first = self.submit()
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json['receipt']['amount'], '8516')
        self.assertEqual(first.json['order']['items'][0]['ConLai'], 2)
        self.assertEqual(self.order.TrangThaiDonHang, 5)
        self.assertEqual(self.batch.SoLuongTon, 8)
        second = self.submit(2, 1, '00000000-0000-4000-8000-000000000002')
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json['receipt']['amount'], '17034')
        self.assertEqual(self.batch.SoLuongTon, 10)
        self.assertEqual(sum(int(row['amount']) for row in self.order.DuLieuHoanTra['returns']), 25550)
        self.assertEqual(self.order.TongThanhToan, 25550)
        self.assertEqual(self.quota.SoLuong, 5)
        self.award.assert_not_called(); self.refund.assert_not_called()
        self.assertEqual(self.submit(1, 3).status_code, 409)

    def test_retry_same_request_is_idempotent(self):
        first = self.submit()
        second = self.submit()
        self.assertEqual(first.json['receipt'], second.json['receipt'])
        self.assertEqual(self.batch.SoLuongTon, 8)
        self.commit.assert_called_once()
        self.assertEqual(self.submit(2).json['code'], 'RETURN_REQUEST_CONFLICT')

    def test_stale_tab_does_not_return_twice(self):
        self.submit()
        result = self.submit(1, 0, '00000000-0000-4000-8000-000000000002')
        self.assertEqual(result.json['code'], 'RETURN_QUANTITY_CHANGED')
        self.assertEqual(self.batch.SoLuongTon, 8)

    def test_original_fifo_order_across_multiple_batches_and_conversion(self):
        self.order.DuLieuHoanTra['batches'] = [dict(MaThuoc=7, MaLo='9', SoLuong=4), dict(MaThuoc=7, MaLo='5', SoLuong=2)]
        first, second = NS(SoLuongNhap=10, SoLuongTon=6), NS(SoLuongNhap=10, SoLuongTon=8)
        self.batch_lookup.side_effect = lambda product, batch, **kw: first if batch == 9 else second
        self.assertEqual(self.submit(1).status_code, 200)
        self.assertEqual((first.SoLuongTon, second.SoLuongTon), (8, 8))
        self.assertEqual(self.submit(2, 1, '00000000-0000-4000-8000-000000000002').status_code, 200)
        self.assertEqual((first.SoLuongTon, second.SoLuongTon), (10, 10))

    def test_snapshot_uses_historical_conversion_and_discount(self):
        self.order.DuLieuHoanTra['lines'] = [dict(MaDonGia=3, conversion=1, amount=25550)]
        self.lines.return_value[0][2].SoLuongQuyDoi = 100
        self.assertEqual(self.submit().json['receipt']['amount'], '8516')
        self.assertEqual(self.batch.SoLuongTon, 8)

    def test_multiple_units_use_snapshot_and_share_original_batches(self):
        self.lines.return_value = [
            (NS(MaChiTiet=1, MaThuoc=7, MaDonGia=3, SoLuong=2, DonGia=10000), None, None),
            (NS(MaChiTiet=2, MaThuoc=7, MaDonGia=4, SoLuong=1, DonGia=10000), None, None)]
        self.order.DuLieuHoanTra['lines'] = [dict(MaDonGia=3, conversion=1, amount=17033), dict(MaDonGia=4, conversion=1, amount=8517)]
        self.assertEqual(self.submit(2).json['receipt']['amount'], '17033')
        response = self.client.post('/api/employee/orders/45/returns', json=dict(MaChiTiet='2', SoLuong=1,
            DaTra=0, request_id='00000000-0000-4000-8000-000000000002'), headers={'X-CSRF-Token': 'csrf'})
        self.assertEqual(response.json['receipt']['amount'], '8517')
        self.assertEqual(self.batch.SoLuongTon, 10)

    def test_ambiguous_legacy_units_require_manual_review(self):
        self.lines.return_value.append((NS(MaChiTiet=2, MaThuoc=7, MaDonGia=4, SoLuong=1, DonGia=0), None, None))
        self.assertEqual(self.submit().json['code'], 'ORDER_REFUND_REVIEW_REQUIRED')
        self.commit.assert_not_called()

    def test_zero_paid_order_returns_stock_without_cash_or_coins(self):
        self.order.TongThanhToan = 0
        self.assertEqual(self.submit(3).json['receipt']['amount'], '0')
        self.assertEqual(self.batch.SoLuongTon, 10)
        self.award.assert_not_called(); self.refund.assert_not_called()

    def test_invalid_quantity_types_and_unknown_fields(self):
        for quantity in (0, -1, 4, True, 1.5, '1'):
            self.assertIn(self.submit(quantity).status_code, (400, 409))
        self.assertEqual(self.submit(extra='bad').status_code, 400)
        self.commit.assert_not_called()

    def test_unsupported_states_and_missing_data(self):
        for state in (0, 1, 2, 4):
            self.order.TrangThaiDonHang = state
            self.assertEqual(self.submit().json['code'], 'ORDER_NOT_RETURNABLE')
        self.order.TrangThaiDonHang = 3; self.order.DuLieuHoanTra = None
        self.assertEqual(self.submit().json['code'], 'ORDER_REFUND_REVIEW_REQUIRED')
        self.assertFalse(self.client.get('/api/employee/orders/45/returns').json['order']['CanReturn'])

    def test_legacy_returned_state_without_return_ledger_requires_review(self):
        self.order.TrangThaiDonHang = 5
        self.assertEqual(self.submit().json['code'], 'ORDER_REFUND_REVIEW_REQUIRED')
        self.commit.assert_not_called()

    def test_stock_inconsistency_does_not_modify_any_batch(self):
        self.batch.SoLuongTon = self.batch.SoLuongNhap
        self.assertEqual(self.submit().json['code'], 'ORDER_REFUND_REVIEW_REQUIRED')
        self.assertEqual(self.order.TrangThaiDonHang, 3)
        self.commit.assert_not_called(); self.rollback.assert_called()

    def test_commit_failure_rolls_back(self):
        self.commit.side_effect = SQLAlchemyError('private database error')
        response = self.submit()
        self.assertEqual(response.json, {'code': 'DATABASE_UNAVAILABLE'})
        self.rollback.assert_called()

    def test_employee_only_and_csrf(self):
        for role in (0, 2):
            self.actor.VaiTro = role
            self.assertEqual(self.submit().status_code, 403)
            self.assertEqual(self.client.get('/api/employee/orders/returns').status_code, 403)
            self.assertEqual(self.client.get('/api/employee/orders/45/returns').status_code, 403)
        self.actor.VaiTro = 1
        self.assertEqual(self.client.post('/api/employee/orders/45/returns', json={}).status_code, 403)
        self.commit.assert_not_called()

    def test_search_and_return_status_query(self):
        response = self.client.get('/api/employee/orders/returns?search=%230900-000&page=2')
        self.assertEqual(response.status_code, 200)
        self.listing.assert_called_with('returns', '0900000', 2, 20)
        self.assertEqual(self.client.get('/api/employee/orders/returns?status=2').status_code, 400)
        self.assertEqual(self.client.get('/api/employee/orders/returns?search=abc').status_code, 400)
        with self.app.app_context():
            execution = self.mock('app.extensions.db.session.execute')
            execution.return_value.scalar_one.return_value = 0
            execution.return_value.all.return_value = []
            fixtures.real_employee_list('returns', '0900', 1, 20)
            sql = str(execution.call_args_list[-1].args[0].compile(dialect=postgresql.dialect(), compile_kwargs={'literal_binds': True}))
            self.assertIn('IN (3, 5)', sql)
            self.assertIn('SDT', sql)


if __name__ == '__main__':
    unittest.main()
