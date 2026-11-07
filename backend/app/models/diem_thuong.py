
from app.extensions import db


class DiemThuong(db.Model):
    __tablename__ = "DiemThuong"

    # Khóa chính
    MaDiemThuong = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    # Số điểm thưởng
    SoDiem = db.Column(
        db.Integer,
        nullable=False
    )

    # Thời gian tích điểm
    ThoiGianTichDiem = db.Column(
        db.DateTime,
        nullable=False
    )

    # Khóa ngoại đến NguoiDung
    MaNguoiDung = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=False
    )

    # True: Cộng điểm
    # False: Trừ điểm
    LoaiGiaoDich = db.Column(
        db.Boolean,
        nullable=False
    )

    # Lý do cộng hoặc trừ điểm
    LyDo = db.Column(
        db.Text,
        nullable=False
    )
