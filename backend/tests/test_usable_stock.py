"""Usable batch query excludes expired/empty batches before aggregation."""
import unittest
from datetime import date
from unittest.mock import patch

from sqlalchemy.dialects import postgresql

from app import create_app
from app.repositories import inventory_repository as repository
from app.services import inventory_service


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
