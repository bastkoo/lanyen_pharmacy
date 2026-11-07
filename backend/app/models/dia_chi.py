
from app.extensions import db


class DiaChi(db.Model):
    __tablename__ = "DiaChi"

    # Khóa chính
    MaDiaChi = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    # Tỉnh / thành phố
    TinhThanh = db.Column(
        db.String(255),
        nullable=False
    )

    # Phường / xã
    PhuongXa = db.Column(
        db.String(255),
        nullable=False
    )

    # Địa chỉ cụ thể
    DiaChiCuThe = db.Column(
        db.String(255),
        nullable=False
    )

    # Khóa ngoại đến NguoiDung
    MaNguoiDung = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=False
    )

    # False: Địa chỉ phụ
    # True: Địa chỉ chính
    DiaChiGiao = db.Column(
        db.Boolean,
        nullable=False
    )
