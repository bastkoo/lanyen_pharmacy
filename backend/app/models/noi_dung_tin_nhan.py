
from app.extensions import db


class NoiDungTinNhan(db.Model):
    __tablename__ = "NoiDungTinNhan"

    # Khóa chính
    MaNoiDung = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    # Khóa ngoại đến TinNhan
    MaTinNhan = db.Column(
        db.BigInteger,
        db.ForeignKey("TinNhan.MaTinNhan"),
        nullable=False
    )

    # Người gửi nội dung - khóa ngoại đến NguoiDung
    NguoiGui = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=False
    )

    # Nội dung tin nhắn
    NoiDung = db.Column(
        db.Text,
        nullable=False
    )

    # Thời gian gửi
    ThoiGianGui = db.Column(
        db.DateTime,
        nullable=False
    )
