from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.extensions import db
from app.models.nguoi_dung import NguoiDung


def find_by_phone(phone):
    return db.session.execute(select(NguoiDung).where(NguoiDung.SDT == phone)).scalar_one_or_none()


def find_by_id(user_id):
    return db.session.get(NguoiDung, user_id)


def create_customer(phone, name):
    # PostgreSQL waits for a concurrent insert then ignores only the SDT conflict.
    # Other constraint failures propagate to the service and roll back.
    statement = insert(NguoiDung).values(
        SDT=phone, HoTen=name, VaiTro=0, TrangThai=False
    ).on_conflict_do_nothing(index_elements=[NguoiDung.SDT])
    db.session.execute(statement)
    user = find_by_phone(phone)
    db.session.commit()
    return user
