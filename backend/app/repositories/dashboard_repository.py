from sqlalchemy import and_, case, func, select

from app.extensions import db
from app.models.don_hang import DonHang
from app.models.nguoi_dung import NguoiDung


def counts(start, end):
    customers = select(func.count()).select_from(NguoiDung).where(NguoiDung.VaiTro == 0).scalar_subquery()
    eligible = and_(DonHang.TrangThaiDonHang == 3, DonHang.TrangThaiThanhToan == 1)
    revenue = func.coalesce(func.sum(case((eligible, DonHang.TongThanhToan), else_=0)), 0)
    query = select(func.count().label('orders'), customers.label('customers'), revenue.label('revenue')) \
        .select_from(DonHang).where(DonHang.NgayDat >= start, DonHang.NgayDat < end)
    return dict(db.session.execute(query).mappings().one())


def recent_orders(start, end, limit):
    # Do not join line items: one row per order, without customer PII.
    query = select(DonHang.MaDonHang, DonHang.NgayDat, DonHang.TongThanhToan,
                   DonHang.TrangThaiDonHang).where(DonHang.NgayDat >= start, DonHang.NgayDat < end) \
        .order_by(DonHang.NgayDat.desc(), DonHang.MaDonHang.desc()).limit(limit)
    return db.session.execute(query).mappings().all()


def revenue_series(start, end):
    day = func.date(DonHang.NgayDat)
    query = select(day.label('day'), func.sum(DonHang.TongThanhToan).label('amount')).where(
        DonHang.NgayDat >= start, DonHang.NgayDat < end,
        DonHang.TrangThaiDonHang == 3, DonHang.TrangThaiThanhToan == 1) \
        .group_by(day).order_by(day)
    return db.session.execute(query).mappings().all()
