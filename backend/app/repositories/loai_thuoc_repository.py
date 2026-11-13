from sqlalchemy import delete, func, select, text

from app.extensions import db
from app.models.loai_thuoc import LoaiThuoc
from app.models.thuoc import Thuoc


def lock_writes():
    # No unique constraint exists. Serialize category writes until commit/rollback.
    # This lock also conflicts with direct INSERT/UPDATE/DELETE on this table.
    db.session.execute(text('LOCK TABLE "LoaiThuoc" IN SHARE ROW EXCLUSIVE MODE'))


def find_by_id(category_id):
    return db.session.get(LoaiThuoc, category_id)


def find_duplicate(name, exclude_id=None):
    normalized = func.lower(func.trim(func.regexp_replace(
        LoaiThuoc.TenLoaiThuoc, r'\s+', ' ', 'g')))
    query = select(LoaiThuoc.MaLoaiThuoc).where(normalized == func.lower(name))
    if exclude_id is not None:
        query = query.where(LoaiThuoc.MaLoaiThuoc != exclude_id)
    return db.session.execute(query.limit(1)).scalar_one_or_none() is not None


def list_categories(search, page, per_page):
    query = select(LoaiThuoc)
    if search:
        query = query.where(LoaiThuoc.TenLoaiThuoc.icontains(search, autoescape=True))
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    items = db.session.execute(query.order_by(LoaiThuoc.MaLoaiThuoc)
                               .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return items, total


def create(name):
    category = LoaiThuoc(TenLoaiThuoc=name)
    db.session.add(category)
    db.session.flush()
    return category


def update(category, name):
    category.TenLoaiThuoc = name
    db.session.flush()
    return category


def has_medicines(category_id):
    return db.session.execute(select(Thuoc.MaThuoc).where(
        Thuoc.MaLoaiThuoc == category_id).limit(1)).scalar_one_or_none() is not None


def remove(category_id):
    # Explicit parent-only DELETE: never invoke ORM cascades.
    db.session.execute(delete(LoaiThuoc).where(LoaiThuoc.MaLoaiThuoc == category_id))


def commit():
    db.session.commit()


def rollback():
    db.session.rollback()
