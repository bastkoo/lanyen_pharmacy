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
    # Fetch every line for this owned page in one query, without N+1 requests.
    rows = db.session.execute(select(ChiTietDonHang, Thuoc, DonViGiaThuoc)
                              .outerjoin(Thuoc, Thuoc.MaThuoc == ChiTietDonHang.MaThuoc)
                              .outerjoin(DonViGiaThuoc, DonViGiaThuoc.MaDonGia == ChiTietDonHang.MaDonGia)
                              .where(ChiTietDonHang.MaDonHang.in_([item.MaDonHang for item in items]))
                              .order_by(ChiTietDonHang.MaDonHang, ChiTietDonHang.MaChiTiet)).all()
    lines = {}
    for row in rows:
        lines.setdefault(row[0].MaDonHang, []).append(row)
    return items, total, processing_count, lines
