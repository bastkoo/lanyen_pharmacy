from sqlalchemy import delete, func, select

from app.extensions import db
from app.models.chi_tiet_khuyen_mai import ChiTietKhuyenMai


def scoped_query(promotion_id, product_id):
    return select(ChiTietKhuyenMai).where(
        ChiTietKhuyenMai.MaChuongTrinh == promotion_id,
        ChiTietKhuyenMai.MaThuoc == product_id)


def find_by_id(promotion_id, product_id, for_update=False):
    query = scoped_query(promotion_id, product_id)
    if for_update:
        query = query.with_for_update()
    return db.session.execute(query).scalar_one_or_none()


def list_items(promotion_id, page, per_page):
    query = select(ChiTietKhuyenMai).where(ChiTietKhuyenMai.MaChuongTrinh == promotion_id)
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    items = db.session.execute(query.order_by(ChiTietKhuyenMai.MaThuoc)
                               .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return items, total


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
