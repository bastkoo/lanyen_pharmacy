
from app.extensions import db


class TinNhan(db.Model):
    __tablename__ = "TinNhan"

    # Khóa chính
    MaTinNhan = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    # Người gửi - khóa ngoại đến NguoiDung
    NguoiGui = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=False
    )

    # Nhân viên phụ trách - có thể NULL
    MaNhanVien = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=True
    )

    # 0: Chờ phản hồi
    # 1: Đang xử lý
    # 2: Đã xong
    TrangThai = db.Column(
        db.Integer,
        nullable=False
    )
