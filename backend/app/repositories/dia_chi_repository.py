from sqlalchemy import select

from app.extensions import db
from app.models.dia_chi import DiaChi


def list_owned(user_id):
    return db.session.execute(select(DiaChi).where(DiaChi.MaNguoiDung == user_id)
                              .order_by(DiaChi.MaDiaChi).execution_options(populate_existing=True)).scalars().all()


def create(user_id, data, primary):
    item = DiaChi(MaNguoiDung=user_id, DiaChiGiao=primary, **data)
    db.session.add(item)
    return item


def update(item, data):
    for key in ('TinhThanh', 'PhuongXa', 'DiaChiCuThe'):
        setattr(item, key, data[key])


def remove(item):
    db.session.delete(item)
