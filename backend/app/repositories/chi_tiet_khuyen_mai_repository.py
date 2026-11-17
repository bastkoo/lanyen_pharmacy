from sqlalchemy import delete, func, select

from app.extensions import db
from app.models.chi_tiet_khuyen_mai import ChiTietKhuyenMai
from app.models.thuoc import Thuoc
from app.models.chuong_trinh_khuyen_mai import ChuongTrinhKhuyenMai


def scoped_query(promotion_id, product_id):
    return select(ChiTietKhuyenMai).where(
        ChiTietKhuyenMai.MaChuongTrinh == promotion_id,
        ChiTietKhuyenMai.MaThuoc == product_id)


def find_by_id(promotion_id, product_id, for_update=False):
    query = scoped_query(promotion_id, product_id)
    if for_update:
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.session.execute(query).scalar_one_or_none()


def list_items(promotion_id, page, per_page):
    query = select(ChiTietKhuyenMai).where(ChiTietKhuyenMai.MaChuongTrinh == promotion_id)
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    items = db.session.execute(query.order_by(ChiTietKhuyenMai.MaThuoc)
                               .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return items, total


def public_products(promotion_id, page, per_page):
    query = select(Thuoc, ChiTietKhuyenMai).join(ChiTietKhuyenMai,
        ChiTietKhuyenMai.MaThuoc == Thuoc.MaThuoc).where(
            ChiTietKhuyenMai.MaChuongTrinh == promotion_id)
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    records = db.session.execute(query.order_by(Thuoc.TenThuoc, Thuoc.MaThuoc)
        .offset((page - 1) * per_page).limit(per_page)).all()
    return records, total


def active_for_products(product_ids, today, for_update=False):
    if not product_ids:
        return []
    query = (select(ChiTietKhuyenMai, ChuongTrinhKhuyenMai).join(
        ChuongTrinhKhuyenMai, ChuongTrinhKhuyenMai.MaChuongTrinh == ChiTietKhuyenMai.MaChuongTrinh).where(
        ChiTietKhuyenMai.MaThuoc.in_(product_ids), ChiTietKhuyenMai.SoLuong > 0,
        ChuongTrinhKhuyenMai.NgayBatDau <= today, ChuongTrinhKhuyenMai.NgayKetThuc >= today)
        .order_by(ChuongTrinhKhuyenMai.NgayBatDau, ChuongTrinhKhuyenMai.MaChuongTrinh,
                  ChiTietKhuyenMai.MaThuoc))
    if for_update:
        query = query.with_for_update(of=ChiTietKhuyenMai).execution_options(populate_existing=True)
    return db.session.execute(query).all()


def create(promotion_id, data):
    item = ChiTietKhuyenMai(MaChuongTrinh=promotion_id, **data)
    db.session.add(item)
    db.session.flush()
    return item


def update(item, data):
    for key in ('LoaiGiamGia', 'GiaTriGiam', 'SoLuong'):
        if key in data:
            setattr(item, key, data[key])
    db.session.flush()
    return item


def remove(promotion_id, product_id):
    # Only the composite-key detail row; no parent/medicine/price cascade.
    db.session.execute(delete(ChiTietKhuyenMai).where(
        ChiTietKhuyenMai.MaChuongTrinh == promotion_id,
        ChiTietKhuyenMai.MaThuoc == product_id))
