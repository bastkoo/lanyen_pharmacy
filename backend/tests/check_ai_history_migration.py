"""Apply only the approved AI-history revision and verify existing chat rows."""
import sys

from flask_migrate import upgrade
from sqlalchemy import func, inspect, select, text

from app import create_app
from app.extensions import db
from app.models.tin_nhan import TinNhan
from app.models.noi_dung_tin_nhan import NoiDungTinNhan

REVISION = 'b7d20a81c649'


def counts():
    return tuple(db.session.execute(select(func.count()).select_from(model)).scalar_one()
                 for model in (TinNhan, NoiDungTinNhan))


def main():
    app = create_app({'TESTING': True})
    with app.app_context():
        revision = db.session.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
        if revision not in ('af371b90d642', REVISION):
            raise RuntimeError('Unexpected database revision; no changes applied.')
        before = counts()
        db.session.rollback()
        if '--apply' in sys.argv:
            upgrade(revision=REVISION)
        current = db.session.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
        assert current == REVISION, 'AI-history migration has not been applied.'
        assert counts() == before, 'Existing chat row counts changed.'
        columns = {c['name']: c for c in inspect(db.engine).get_columns('NoiDungTinNhan')}
        assert columns['NguoiGui']['nullable'] is True
        assert columns['LoaiNguoiGui']['nullable'] is False
        mismatches = db.session.execute(text('''SELECT count(*) FROM "NoiDungTinNhan" m
            JOIN "TinNhan" t ON t."MaTinNhan" = m."MaTinNhan"
            JOIN "NguoiDung" u ON u."MaNguoiDung" = m."NguoiGui"
            WHERE t."LoaiHoiThoai" = 'DUOC_SI' AND m."LoaiNguoiGui" <>
            CASE WHEN u."VaiTro" = 1 THEN 'DUOC_SI' ELSE 'KHACH_HANG' END''')).scalar_one()
        assert mismatches == 0, 'Existing sender backfill mismatch.'
        db.session.rollback()
        print('AI_HISTORY_MIGRATION_OK', current)
        print('CHAT_ROW_COUNTS_PRESERVED', before)


if __name__ == '__main__':
    main()
