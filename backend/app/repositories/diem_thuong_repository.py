from sqlalchemy import BigInteger, case, cast, func, select

from app.extensions import db
from app.models.diem_thuong import DiemThuong

# Dấu nhận diện nghiệp vụ ổn định, không dùng chung lý do tích xu mua hàng.
CHECK_IN_REASON = 'Điểm danh hằng ngày'


def check_ins_between(user_id, start, end):
    return list(db.session.execute(select(DiemThuong.ThoiGianTichDiem).where(
        DiemThuong.MaNguoiDung == user_id,
        DiemThuong.LoaiGiaoDich.is_(True),
        DiemThuong.LyDo == CHECK_IN_REASON,
        DiemThuong.ThoiGianTichDiem >= start,
        DiemThuong.ThoiGianTichDiem < end,
    )).scalars().all())


def create_check_in(user_id, quantity, timestamp):
    # Người gọi phải giữ khóa tài khoản đến khi commit/rollback xong.
    db.session.add(DiemThuong(MaNguoiDung=user_id, SoDiem=quantity,
        LoaiGiaoDich=True, ThoiGianTichDiem=timestamp, LyDo=CHECK_IN_REASON))


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
        LyDo=f'Đổi xu thanh toán đơn hàng #{order_id} (1 xu = 10đ)'))


def refund(user_id, quantity, order_id, timestamp):
    db.session.add(DiemThuong(MaNguoiDung=user_id, SoDiem=quantity,
        LoaiGiaoDich=True, ThoiGianTichDiem=timestamp,
        LyDo=f'Hoàn xu do hủy đơn hàng #{order_id}'))


def award(user_id, quantity, order_id, timestamp):
    db.session.add(DiemThuong(MaNguoiDung=user_id, SoDiem=quantity,
        LoaiGiaoDich=True, ThoiGianTichDiem=timestamp, LyDo=f'Tích xu đơn hàng #{order_id}'))


def order_award(user_id, order_id):
    amount, count = db.session.execute(select(func.coalesce(func.sum(cast(DiemThuong.SoDiem, BigInteger)), 0),
        func.count(DiemThuong.MaDiemThuong)).where(DiemThuong.MaNguoiDung == user_id,
        DiemThuong.LoaiGiaoDich.is_(True), DiemThuong.LyDo == f'Tích xu đơn hàng #{order_id}')).one()
    return int(amount) if count else None


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
