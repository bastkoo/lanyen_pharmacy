from sqlalchemy import func, select

from app.extensions import db
from app.models.lo_thuoc import LoThuoc
from app.models.thuoc import Thuoc


def paginate(query, page, per_page, mappings=True):
    total = db.session.execute(select(func.count()).select_from(query.order_by(None).subquery())).scalar_one()
    result = db.session.execute(query.offset((page - 1) * per_page).limit(per_page))
    items = result.mappings().all() if mappings else result.scalars().all()
    return items, total


def summary(page, per_page, low_stock=False):
    # Aggregate before joining: prices/units must never multiply inventory rows.
    totals = select(LoThuoc.MaThuoc, func.sum(LoThuoc.SoLuongTon).label('total')) \
        .group_by(LoThuoc.MaThuoc).subquery()
    total = func.coalesce(totals.c.total, 0)
    warning = total <= Thuoc.NguongTonKho
    query = select(Thuoc.MaThuoc, Thuoc.TenThuoc, total.label('TongSoLuongTon'),
                   Thuoc.NguongTonKho, warning.label('TonKhoThap')) \
        .outerjoin(totals, totals.c.MaThuoc == Thuoc.MaThuoc).order_by(Thuoc.MaThuoc)
    if low_stock:
        query = query.where(warning)
    return paginate(query, page, per_page)


def expiring(today, until, status, page, per_page):
    query = select(*LoThuoc.__table__.columns, Thuoc.TenThuoc) \
        .join(Thuoc, Thuoc.MaThuoc == LoThuoc.MaThuoc).where(LoThuoc.SoLuongTon > 0)
    if status == 'expired':
        query = query.where(LoThuoc.HanSuDung < today)
    else:
        query = query.where(LoThuoc.HanSuDung >= today, LoThuoc.HanSuDung <= until)
    query = query.order_by(LoThuoc.HanSuDung, LoThuoc.MaLo)
    return paginate(query, page, per_page)
