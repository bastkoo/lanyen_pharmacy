
from app.extensions import db
from sqlalchemy.dialects.postgresql import JSONB


class DonHang(db.Model):
    __tablename__ = "DonHang"

    # Khóa chính
    MaDonHang = db.Column(
        db.BigInteger,
        primary_key=True,
        autoincrement=True
    )

    # Người mua - khóa ngoại đến NguoiDung
    MaNguoiMua = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=False
    )

    # Nhân viên phụ trách - có thể NULL
    MaNhanVien = db.Column(
        db.BigInteger,
        db.ForeignKey("NguoiDung.MaNguoiDung"),
        nullable=True
    )

    # Tổng tiền trước giảm giá
    TongTien = db.Column(
        db.BigInteger,
        nullable=False
    )

    # Tiền giảm giá
    TienGiamGia = db.Column(
        db.Integer,
        nullable=False
    )

    # Tổng tiền phải thanh toán
    TongThanhToan = db.Column(
        db.BigInteger,
        nullable=False
    )

    # Có sử dụng xu để giảm tiền cho đơn hàng.
    DoiDiem = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    DuLieuHoanTra = db.Column(JSONB, nullable=True)

    # 0: Chờ duyệt
    # 1: Đang xử lý
    # 2: Đang giao
    # 3: Hoàn thành
    # 4: Đã hủy
    # 5: Đã trả
    TrangThaiDonHang = db.Column(
        db.Integer,
        nullable=False
    )

    # 0: Tiền mặt
    # 1: Trực tuyến
    PhuongThucThanhToan = db.Column(
        db.Integer,
        nullable=False
    )

    # Immutable Gateway environment; NULL for COD and unclassified old orders.
    MoiTruongThanhToan = db.Column(db.String(10), nullable=True)

    # Ngày đặt hàng
    NgayDat = db.Column(
        db.DateTime,
        nullable=False
    )

    # Ghi chú (có thể NULL)
    GhiChu = db.Column(
        db.Text,
        nullable=True
    )

    # 0: Chưa thanh toán
    # 1: Đã thanh toán
    TrangThaiThanhToan = db.Column(
        db.Integer,
        nullable=False
    )

    # True: Đặt trực tiếp
    # False: Đặt online
    KenhDatHang = db.Column(
        db.Boolean,
        nullable=False
    )
