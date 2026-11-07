
from app.extensions import db


class NguoiDung(db.Model):
    __tablename__ = "NguoiDung"

    # Khóa chính
    MaNguoiDung = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    # Họ tên người dùng
    HoTen = db.Column(
        db.String(255),
        nullable=False
    )

    # Số điện thoại - duy nhất
    SDT = db.Column(
        db.String(15),
        unique=True,
        nullable=False
    )

    # 0: Người mua
    # 1: Nhân viên
    # 2: Quản lý
    VaiTro = db.Column(
        db.Integer,
        nullable=False
    )

    # False: Còn hoạt động
    # True: Đã khóa
    TrangThai = db.Column(
    db.Boolean,
    nullable=False,
    default=False,
    server_default=db.false()
    )

    # Email (có thể NULL)
    Email = db.Column(
        db.String(255),
        nullable=True
    )

    # Ảnh đại diện (có thể NULL)
    AnhDaiDien = db.Column(
        db.Text,
        nullable=True
    )
