from sqlalchemy import delete, func, or_, select

from app.extensions import db
from app.models.don_vi_gia_thuoc import DonViGiaThuoc
from app.models.gio_thuoc import GioThuoc
from app.models.chi_tiet_don_hang import ChiTietDonHang


REFERENCE_MODELS = (GioThuoc, ChiTietDonHang)


def find_by_id(product_id, unit_id, for_update=False):
    query = select(DonViGiaThuoc).where(
        DonViGiaThuoc.MaThuoc == product_id, DonViGiaThuoc.MaDonGia == unit_id)
    if for_update:
        query = query.with_for_update()
    return db.session.execute(query).scalar_one_or_none()


def list_units(product_id, page, per_page):
    query = select(DonViGiaThuoc).where(DonViGiaThuoc.MaThuoc == product_id)
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    items = db.session.execute(query.order_by(DonViGiaThuoc.MaDonGia)
                               .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return items, total


def create(product_id, data):
    unit = DonViGiaThuoc(MaThuoc=product_id, **data)
    db.session.add(unit)
    db.session.flush()
    return unit


def update(unit, data):
    for key, value in data.items():
        setattr(unit, key, value)
    db.session.flush()
    return unit


def has_references(unit_id):
    return db.session.execute(select(or_(*(
        select(model.MaDonGia).where(model.MaDonGia == unit_id).exists()
        for model in REFERENCE_MODELS)))).scalar_one()


def remove(product_id, unit_id):
    # Parent-only DELETE, scoped to the product; never cascade related records.
    db.session.execute(delete(DonViGiaThuoc).where(
        DonViGiaThuoc.MaThuoc == product_id, DonViGiaThuoc.MaDonGia == unit_id))


def commit():
    db.session.commit()


def rollback():
    db.session.rollback()
