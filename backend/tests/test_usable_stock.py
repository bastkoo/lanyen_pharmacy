"""Usable batch query excludes expired/empty batches before aggregation."""
import unittest
from datetime import date
from unittest.mock import patch
from types import SimpleNamespace as NS

from sqlalchemy.dialects import postgresql

from app import create_app
from app.repositories import inventory_repository as repository
from app.services import inventory_service
from app.services.auth_service import AuthError


class UsableStockTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'usable-stock-test-' * 3,
                              'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
                              'APP_ENV': 'development', 'OTP_DEV_ENABLED': False})
        context = self.app.app_context()
        context.push()
        self.addCleanup(context.pop)

    def test_aggregate_filters_before_grouping_without_joining_units(self):
        today = date(2026, 11, 17)
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.all.return_value = [(7, 20), (8, 3)]
            self.assertEqual(repository.usable_totals([7, 8, 9], today), {7: 20, 8: 3})
            statement = execute.call_args.args[0].compile(dialect=postgresql.dialect())
            sql = str(statement)
            self.assertIn('sum("LoThuoc"."SoLuongTon")', sql)
            self.assertIn('"SoLuongTon" >', sql)
            self.assertIn('"HanSuDung" >=', sql)
            self.assertIn('GROUP BY "LoThuoc"."MaThuoc"', sql)
            self.assertNotIn('JOIN', sql)
            self.assertIn(today, statement.params.values())
            self.assertIn([7, 8, 9], statement.params.values())
        with patch.object(repository.db.session, 'execute') as execute:
            self.assertEqual(repository.usable_totals([], today), {})
            execute.assert_not_called()

    def test_service_uses_existing_vietnam_calendar_date(self):
        with patch.object(inventory_service, 'current_date', return_value=date(2026, 11, 17)), \
                patch.object(repository, 'usable_totals', return_value={7: 10}) as totals:
            self.assertEqual(inventory_service.usable_stock([7]), {7: 10})
            totals.assert_called_once_with([7], date(2026, 11, 17))

    def test_fifo_query_locks_only_usable_batches_in_stable_insertion_order(self):
        today = date(2026, 11, 18)
        with patch.object(repository.db.session, 'execute') as execute:
            execute.return_value.scalars.return_value.all.return_value = []
            repository.lock_usable_batches_fifo([8, 7], today)
            query = execute.call_args.args[0]
            sql = str(query.compile(dialect=postgresql.dialect()))
            self.assertIn('"SoLuongTon" >', sql)
            self.assertIn('"HanSuDung" >=', sql)
            self.assertIn('ORDER BY "LoThuoc"."MaThuoc", "LoThuoc"."MaLo" FOR UPDATE', sql)
            self.assertNotIn('SKIP LOCKED', sql)
            self.assertTrue(query.get_execution_options()['populate_existing'])
        with patch.object(repository.db.session, 'execute') as execute:
            self.assertEqual(repository.lock_usable_batches_fifo([], today), [])
            execute.assert_not_called()

    def test_fifo_deduction_spans_batches_and_leaves_later_batches_untouched(self):
        batches = [NS(MaLo=1, MaThuoc=7, SoLuongTon=5), NS(MaLo=2, MaThuoc=7, SoLuongTon=10),
                   NS(MaLo=3, MaThuoc=7, SoLuongTon=20), NS(MaLo=4, MaThuoc=8, SoLuongTon=6)]
        with patch.object(repository, 'lock_usable_batches_fifo', return_value=batches) as lock, \
                patch.object(inventory_service, 'current_date', return_value=date(2026, 11, 18)), \
                patch.object(repository.db.session, 'commit') as commit:
            allocations = inventory_service.deduct_order_stock({7: 12, 8: 6})
            self.assertEqual(allocations, [dict(MaLo='1', MaThuoc=7, SoLuong=5),
                dict(MaLo='2', MaThuoc=7, SoLuong=7), dict(MaLo='4', MaThuoc=8, SoLuong=6)])
            self.assertEqual([batch.SoLuongTon for batch in batches], [0, 3, 20, 0])
            lock.assert_called_once_with([7, 8], date(2026, 11, 18))
            commit.assert_not_called()

    def test_shortage_of_any_product_leaves_every_batch_unchanged(self):
        batches = [NS(MaThuoc=7, SoLuongTon=50), NS(MaThuoc=8, SoLuongTon=2)]
        with patch.object(repository, 'lock_usable_batches_fifo', return_value=batches):
            with self.assertRaises(AuthError) as error:
                inventory_service.deduct_order_stock({7: 30, 8: 3})
            self.assertEqual(error.exception.code, 'OUT_OF_STOCK')
            self.assertEqual([batch.SoLuongTon for batch in batches], [50, 2])

    def test_later_order_cannot_overdraw_remaining_batch_balance(self):
        batch = NS(MaLo=1, MaThuoc=7, SoLuongTon=40)
        with patch.object(repository, 'lock_usable_batches_fifo', return_value=[batch]):
            inventory_service.deduct_order_stock({7: 30})
            self.assertEqual(batch.SoLuongTon, 10)
            with self.assertRaises(AuthError):
                inventory_service.deduct_order_stock({7: 30})
            self.assertEqual(batch.SoLuongTon, 10)

    def test_invalid_or_empty_deductions_do_not_query_stock(self):
        with patch.object(repository, 'lock_usable_batches_fifo') as lock:
            for quantities in [{}, {7: 0}, {7: -1}, {7: True}, {7: 1.5}]:
                with self.assertRaises(AuthError):
                    inventory_service.deduct_order_stock(quantities)
            lock.assert_not_called()
