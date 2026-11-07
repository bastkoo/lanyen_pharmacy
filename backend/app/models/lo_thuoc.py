
from app.extensions import db


class LoThuoc(db.Model):
    __tablename__ = "LoThuoc"

    # Khóa chính
    MaLo = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )

    # Số lô sản xuất
    SoLoSanXuat = db.Column(
        db.String(100),
        nullable=False
    )

    # Ngày sản xuất
    NgaySanXuat = db.Column(
        db.Date,
        nullable=False
    )

    # Hạn sử dụng
    HanSuDung = db.Column(
        db.Date,
        nullable=False
    )

    # Số lượng nhập theo đơn vị nhỏ nhất
    SoLuongNhap = db.Column(
        db.Integer,
        nullable=False
    )

    # Giá nhập của lô thuốc
    GiaNhap = db.Column(
        db.Integer,
        nullable=False
    )

    # Khóa ngoại đến Thuoc
    MaThuoc = db.Column(
        db.Integer,
        db.ForeignKey("Thuoc.MaThuoc"),
        nullable=False
    )

    # Số lượng tồn còn lại
    SoLuongTon = db.Column(
        db.Integer,
        nullable=False
    )
