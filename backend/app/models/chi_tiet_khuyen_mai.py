
from app.extensions import db


class ChiTietKhuyenMai(db.Model):
    __tablename__ = "ChiTietKhuyenMai"

    # Khóa chính kép + khóa ngoại đến ChuongTrinhKhuyenMai
    MaChuongTrinh = db.Column(
        db.Integer,
        db.ForeignKey("ChuongTrinhKhuyenMai.MaChuongTrinh"),
        primary_key=True,
        nullable=False
    )

    # Khóa chính kép + khóa ngoại đến Thuoc
    MaThuoc = db.Column(
        db.Integer,
        db.ForeignKey("Thuoc.MaThuoc"),
        primary_key=True,
        nullable=False
    )

    # False: Giảm giá trực tiếp
    # True: Giảm giá theo phần trăm
    LoaiGiamGia = db.Column(
        db.Boolean,
        nullable=False
    )

    # Giá trị giảm
    GiaTriGiam = db.Column(
        db.Numeric(12, 2),
        nullable=False
    )

    # Số lượng áp dụng khuyến mãi
    SoLuong = db.Column(
        db.Integer,
        nullable=False
    )
