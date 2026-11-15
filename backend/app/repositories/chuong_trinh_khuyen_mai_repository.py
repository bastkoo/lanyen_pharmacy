from sqlalchemy import delete, func, select

from app.extensions import db
from app.models.chuong_trinh_khuyen_mai import ChuongTrinhKhuyenMai
from app.models.chi_tiet_khuyen_mai import ChiTietKhuyenMai


def find_by_id(promotion_id, for_update=False):
    query = select(ChuongTrinhKhuyenMai).where(
        ChuongTrinhKhuyenMai.MaChuongTrinh == promotion_id)
    if for_update:
        query = query.with_for_update()
    return db.session.execute(query).scalar_one_or_none()


def list_promotions(page, per_page):
    query = select(ChuongTrinhKhuyenMai)
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    items = db.session.execute(query.order_by(ChuongTrinhKhuyenMai.MaChuongTrinh)
                               .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return items, total


def create(data):
    promotion = ChuongTrinhKhuyenMai(**data)
    db.session.add(promotion)
    db.session.flush()
    return promotion


def update(promotion, data):
    for key in ('TenChuongTrinh', 'NgayBatDau', 'NgayKetThuc'):
        setattr(promotion, key, data[key])
    db.session.flush()
    return promotion


def has_details(promotion_id):
    return db.session.execute(select(select(ChiTietKhuyenMai.MaChuongTrinh).where(
        ChiTietKhuyenMai.MaChuongTrinh == promotion_id).exists())).scalar_one()


def remove(promotion_id):
    # Parent-only DELETE; never cascade to promotion details or medicines.
    db.session.execute(delete(ChuongTrinhKhuyenMai).where(
        ChuongTrinhKhuyenMai.MaChuongTrinh == promotion_id))


def commit():
    db.session.commit()


def rollback():
    db.session.rollback()
