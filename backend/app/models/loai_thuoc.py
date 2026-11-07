
from app.extensions import db


class LoaiThuoc(db.Model):
    __tablename__ = "LoaiThuoc"

    # Khóa chính
    MaLoaiThuoc = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )

    # Tên loại thuốc
    TenLoaiThuoc = db.Column(
        db.String(255),
        nullable=False
    )
