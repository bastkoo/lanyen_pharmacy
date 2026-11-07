
from app.extensions import db


class ThemBaiViet(db.Model):
    __tablename__ = "ThemBaiViet"

    # Khóa chính
    MaBaiViet = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )

    # Nội dung bài viết
    NoiDung = db.Column(
        db.Text,
        nullable=False
    )

    # Tiêu đề bài viết
    TieuDe = db.Column(
        db.Text,
        nullable=False
    )

    # Thời gian đăng
    ThoiGianDang = db.Column(
        db.DateTime,
        nullable=False
    )

    # Người đăng - khóa ngoại đến NguoiDung
    NguoiDang = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=False
    )
