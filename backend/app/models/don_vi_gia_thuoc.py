
from app.extensions import db


class DonViGiaThuoc(db.Model):
    __tablename__ = "DonVi_GiaThuoc"

    # Khóa chính
    MaDonGia = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )

    # Khóa ngoại đến Thuoc
    MaThuoc = db.Column(
        db.Integer,
        db.ForeignKey("Thuoc.MaThuoc"),
        nullable=False
    )

    # Đơn vị tính: Hộp, Vỉ, Viên, Gói...
    DonViTinh = db.Column(
        db.String(50),
        nullable=False
    )

    # Giá bán cho đơn vị này
    GiaBan = db.Column(
        db.Integer,
        nullable=False
    )

    # Số lượng đơn vị nhỏ nhất để quy đổi
    SoLuongQuyDoi = db.Column(
        db.Integer,
        nullable=False
    )
