from sqlalchemy import select

from app.extensions import db
from app.models.gio_thuoc import GioThuoc
from app.models.nguoi_dung import NguoiDung
from app.models.thuoc import Thuoc
from app.models.don_vi_gia_thuoc import DonViGiaThuoc


def lock_user(user_id):
    # Serialize cart mutations even when no cart row exists yet.
    return db.session.execute(select(NguoiDung).where(
        NguoiDung.MaNguoiDung == user_id).with_for_update()).scalar_one_or_none()


def list_items(user_id):
    return db.session.execute(select(GioThuoc).where(
        GioThuoc.MaNguoiDung == user_id).order_by(GioThuoc.MaGio)).scalars().all()


def catalog_details(pairs):
    if not pairs:
        return {}
    unit_ids = [pair[1] for pair in pairs]
    rows = db.session.execute(select(Thuoc, DonViGiaThuoc).join(
        DonViGiaThuoc, Thuoc.MaThuoc == DonViGiaThuoc.MaThuoc).where(
            DonViGiaThuoc.MaDonGia.in_(unit_ids))).all()
    return {(product.MaThuoc, unit.MaDonGia): (product, unit) for product, unit in rows}


def create(user_id, product_id, unit_id, quantity):
    item = GioThuoc(MaNguoiDung=user_id, MaThuoc=product_id,
                    MaDonGia=unit_id, SoLuong=quantity)
    db.session.add(item)
    return item


def remove(item):
    db.session.delete(item)
