
from app.extensions import db


class ChuongTrinhKhuyenMai(db.Model):
    __tablename__ = "ChuongTrinhKhuyenMai"

    # Khóa chính
    MaChuongTrinh = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )

    # Tên chương trình khuyến mãi
    TenChuongTrinh = db.Column(
        db.String(255),
        nullable=False
    )

    # Ngày bắt đầu
    NgayBatDau = db.Column(
        db.Date,
        nullable=False
    )

    # Ngày kết thúc
    NgayKetThuc = db.Column(
        db.Date,
        nullable=False
    )
