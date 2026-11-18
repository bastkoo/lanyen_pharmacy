from sqlalchemy import BigInteger, case, cast, func, select

from app.extensions import db
from app.models.diem_thuong import DiemThuong


def balance(user_id):
    amount = cast(DiemThuong.SoDiem, BigInteger)
    value = db.session.execute(select(func.coalesce(func.sum(case(
        (DiemThuong.LoaiGiaoDich.is_(True), amount), else_=-amount)), 0))
        .where(DiemThuong.MaNguoiDung == user_id)).scalar_one()
    return int(value)


def debit(user_id, quantity, order_id, timestamp):
    # The caller holds the account lock and commits this with the order.
    db.session.add(DiemThuong(MaNguoiDung=user_id, SoDiem=quantity,
        LoaiGiaoDich=False, ThoiGianTichDiem=timestamp,
        LyDo=f'Đổi xu thanh toán đơn hàng #{order_id} (1 xu = 100đ)'))


def list_owned(user_id, page, per_page):
    owned = DiemThuong.MaNguoiDung == user_id
    amount = cast(DiemThuong.SoDiem, BigInteger)
    balance, total = db.session.execute(select(
        func.coalesce(func.sum(case((DiemThuong.LoaiGiaoDich.is_(True), amount), else_=-amount)), 0),
        func.count(DiemThuong.MaDiemThuong)).where(owned)).one()
    rows = db.session.execute(select(DiemThuong).where(owned)
        .order_by(DiemThuong.ThoiGianTichDiem.desc(), DiemThuong.MaDiemThuong.desc())
        .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return rows, int(balance), total
