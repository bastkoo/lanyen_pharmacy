from sqlalchemy import select

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
