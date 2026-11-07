
from app.extensions import db


class ChiTietDonHang(db.Model):
    __tablename__ = "ChiTietDonHang"

    # Khóa chính
    MaChiTiet = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    # Khóa ngoại đến DonHang
    MaDonHang = db.Column(
        db.BigInteger,
        db.ForeignKey("DonHang.MaDonHang"),
        nullable=False
    )

    # Khóa ngoại đến Thuoc
    MaThuoc = db.Column(
        db.Integer,
        db.ForeignKey("Thuoc.MaThuoc"),
        nullable=False
    )

    # Số lượng thuốc
    SoLuong = db.Column(
        db.Integer,
        nullable=False
    )

    # Đơn giá tại thời điểm đặt hàng
    DonGia = db.Column(
        db.Integer,
        nullable=False
    )

    # Khóa ngoại đến DonVi_GiaThuoc
    MaDonGia = db.Column(
        db.Integer,
        db.ForeignKey("DonVi_GiaThuoc.MaDonGia"),
        nullable=False
    )
