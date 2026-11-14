"""Optional explicit live check. No auth bypass, schema writes, or data output.

Run from backend: .venv/Scripts/python.exe tests/check_dashboard_readonly.py
This is NOT a unit test and is never picked up by unittest discovery.
"""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text

from app.config.config import Config
from app.repositories import dashboard_repository, inventory_repository
from app.services.dashboard_service import date_range


def main():
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI, connect_args={
        'connect_timeout': 5,
        'options': '-c default_transaction_read_only=on -c statement_timeout=10000',
    })
    try:
        with engine.connect().execution_options(isolation_level='REPEATABLE READ', postgresql_readonly=True) as connection:
            with connection.begin():
                assert connection.execute(text('SHOW transaction_read_only')).scalar_one() == 'on'
                start, end, _ = date_range(30)
                # Route the repository SELECTs through this one read-only snapshot.
                with patch.object(dashboard_repository.db.session, 'execute', side_effect=connection.execute):
                    counts = dashboard_repository.counts(start, end)
                    points = dashboard_repository.revenue_series(start, end)
                    orders = dashboard_repository.recent_orders(start, end, 5)
                    low, low_count = inventory_repository.summary(1, 5, low_stock=True)
                independent = connection.execute(text('''
                    SELECT COUNT(*) AS orders,
                    COALESCE(SUM("TongThanhToan") FILTER
                        (WHERE "TrangThaiDonHang"=3 AND "TrangThaiThanhToan"=1), 0) AS revenue
                    FROM "DonHang" WHERE "NgayDat">=:start AND "NgayDat"<:end
                '''), {'start': start, 'end': end}).mappings().one()
                customers = connection.execute(text('SELECT COUNT(*) FROM "NguoiDung" WHERE "VaiTro"=0')).scalar_one()
                assert int(counts['orders']) == independent['orders']
                assert int(counts['revenue']) == int(independent['revenue'])
                assert counts['customers'] == customers
                assert sum(int(row['amount']) for row in points) == int(counts['revenue'])
                assert len(orders) <= 5
                assert low_count >= len(low)
                assert all(row['TongSoLuongTon'] <= row['NguongTonKho'] for row in low)
                print('PASS: PostgreSQL read-only snapshot; Dashboard counts/revenue/day totals match independent SQL.')
                print('PASS: recent-order limit and current low-stock predicates. No values or credentials printed; no writes.')
    finally:
        engine.dispose()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Live read-only check unavailable/failed:', type(error).__name__)
        print('No raw database error, connection string, credentials or business records displayed.')
        sys.exit(1)
