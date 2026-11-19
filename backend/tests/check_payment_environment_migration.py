"""Explicit, narrowly scoped migration verification; never runs in unit discovery.

From backend: .venv/Scripts/python.exe -m tests.check_payment_environment_migration --apply
Without --apply this script only checks the database name and Alembic revision.
"""
import sys

from flask_migrate import upgrade
from sqlalchemy import event, inspect, text

from app import create_app
from app.extensions import db


def fingerprint(connection, table, key):
    # Names are fixed by the script; hashes and counts avoid exporting customer data.
    statement = ('SELECT count(*), md5(COALESCE(string_agg('
                 "(to_jsonb(d) - 'MoiTruongThanhToan')::text, '' ORDER BY "
                 f'"{key}"), \'\')) FROM "{table}" d')
    return tuple(connection.execute(text(statement)).one())


def column_spec(engine):
    return {column['name']: (str(column['type']), column['nullable'], column['default'])
            for column in inspect(engine).get_columns('DonHang')}


def limit_locks(connection, record, proxy):
    cursor = connection.cursor()
    cursor.execute("SET lock_timeout = '5s'")
    cursor.execute("SET statement_timeout = '30s'")
    cursor.close()


def main():
    stage = 'inspect'
    try:
        app = create_app()
        with app.app_context():
            engine = db.engine
            with engine.connect() as connection:
                database = connection.execute(text('SELECT current_database()')).scalar_one()
                revision = connection.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
                print('database:', database)
                print('revision:', revision)
                if '--apply' not in sys.argv:
                    return 0
                if database != 'lan_yen_pharmacy' or revision != '7e66691b2041':
                    raise RuntimeError('Unexpected database or revision')
                before = {table: fingerprint(connection, table, key) for table, key in
                          [('DonHang', 'MaDonHang'), ('ChiTietDonHang', 'MaChiTiet')]}
            before_columns = column_spec(engine)
            if 'MoiTruongThanhToan' in before_columns:
                raise RuntimeError('Column already exists')
            stage = 'apply'
            event.listen(engine, 'checkout', limit_locks)
            try:
                upgrade(directory='migrations', revision='31ac74d9e206')
            finally:
                event.remove(engine, 'checkout', limit_locks)
            stage = 'verify'
            after_columns = column_spec(engine)
            with engine.connect() as connection:
                after = {table: fingerprint(connection, table, key) for table, key in
                         [('DonHang', 'MaDonHang'), ('ChiTietDonHang', 'MaChiTiet')]}
                new_revision = connection.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
                classified = connection.execute(text(
                    'SELECT count(*) FROM "DonHang" WHERE "MoiTruongThanhToan" IS NOT NULL')).scalar_one()
            assert before == after
            assert set(after_columns) - set(before_columns) == {'MoiTruongThanhToan'}
            assert all(after_columns[name] == spec for name, spec in before_columns.items())
            assert after_columns['MoiTruongThanhToan'] == ('VARCHAR(10)', True, None)
            assert classified == 0 and new_revision == '31ac74d9e206'
            print('new_revision:', new_revision)
            print('only_added_column: MoiTruongThanhToan VARCHAR(10) NULL, no default')
            print('existing_order_and_detail_values_unchanged:', before == after)
            print('existing_orders_classified:', classified)
            return 0
    except Exception as error:
        # Never print connection strings, driver exception text, or secret values.
        print('Migration check failed; stage:', stage, 'error_type:', type(error).__name__)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
