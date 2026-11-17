from sqlalchemy import select, func

from app.extensions import db
from app.models.don_hang import DonHang
from app.models.chi_tiet_don_hang import ChiTietDonHang
from app.models.thuoc import Thuoc
from app.models.don_vi_gia_thuoc import DonViGiaThuoc


def find(order_id, lock=False):
    query = select(DonHang).where(DonHang.MaDonHang == order_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.session.execute(query).scalar_one_or_none()


def create(values, items):
    order = DonHang(**values)
    db.session.add(order)
    db.session.flush()
    for item in items:
        db.session.add(ChiTietDonHang(MaDonHang=order.MaDonHang, **item))
    return order


def detail_items(order_id):
    return db.session.execute(select(ChiTietDonHang, Thuoc, DonViGiaThuoc)
                              .outerjoin(Thuoc, Thuoc.MaThuoc == ChiTietDonHang.MaThuoc)
                              .outerjoin(DonViGiaThuoc, DonViGiaThuoc.MaDonGia == ChiTietDonHang.MaDonGia)
                              .where(ChiTietDonHang.MaDonHang == order_id)
                              .order_by(ChiTietDonHang.MaChiTiet)).all()


def list_owned(user_id, statuses, page, per_page):
    query = select(DonHang).where(DonHang.MaNguoiMua == user_id)
    if statuses is not None:
        query = query.where(DonHang.TrangThaiDonHang.in_(statuses))
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    processing_count = db.session.execute(select(func.count()).select_from(DonHang).where(
        DonHang.MaNguoiMua == user_id, DonHang.TrangThaiDonHang.in_((0, 1)))).scalar_one()
    items = db.session.execute(query.order_by(DonHang.NgayDat.desc(), DonHang.MaDonHang.desc())
                               .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    if not items:
        return items, total, processing_count, {}
    # One preview per order, with a line count. Avoid an N+1 query for products.
    first = select(ChiTietDonHang.MaDonHang,
                   func.min(ChiTietDonHang.MaChiTiet).label('first_id'), func.count().label('item_count')).where(
                       ChiTietDonHang.MaDonHang.in_([item.MaDonHang for item in items])).group_by(
                           ChiTietDonHang.MaDonHang).subquery()
    rows = db.session.execute(select(first.c.MaDonHang, first.c.item_count, ChiTietDonHang, Thuoc, DonViGiaThuoc)
                              .select_from(first)
                              .join(ChiTietDonHang, ChiTietDonHang.MaChiTiet == first.c.first_id)
                              .outerjoin(Thuoc, Thuoc.MaThuoc == ChiTietDonHang.MaThuoc)
                              .outerjoin(DonViGiaThuoc, DonViGiaThuoc.MaDonGia == ChiTietDonHang.MaDonGia)).all()
    return items, total, processing_count, {row[0]: row[1:] for row in rows}
