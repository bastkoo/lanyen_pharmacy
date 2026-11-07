
from app.extensions import db


class GioThuoc(db.Model):
    __tablename__ = "GioThuoc"

    # Khóa chính
    MaGio = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )

    # Khóa ngoại đến NguoiDung
    MaNguoiDung = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=False
    )

    # Khóa ngoại đến Thuoc
    MaThuoc = db.Column(
        db.Integer,
        db.ForeignKey("Thuoc.MaThuoc"),
        nullable=False
    )

    # Số lượng theo đơn vị đã chọn
    SoLuong = db.Column(
        db.Integer,
        nullable=False
    )

    # Khóa ngoại đến DonVi_GiaThuoc
    MaDonGia = db.Column(
        db.Integer,
        db.ForeignKey("DonVi_GiaThuoc.MaDonGia"),
        nullable=False
    )
