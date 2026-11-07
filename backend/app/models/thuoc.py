
from app.extensions import db


class Thuoc(db.Model):
    __tablename__ = "Thuoc"

    # Khóa chính
    MaThuoc = db.Column(
        db.Integer,
        primary_key=True,
        autoincrement=True
    )

    # Khóa ngoại đến LoaiThuoc
    MaLoaiThuoc = db.Column(
        db.Integer,
        db.ForeignKey("LoaiThuoc.MaLoaiThuoc"),
        nullable=False
    )

    # Hình ảnh thuốc
    HinhAnh = db.Column(
        db.Text,
        nullable=False
    )

    # Tên thuốc
    TenThuoc = db.Column(
        db.String(255),
        nullable=False
    )

    # Mô tả thuốc
    MoTa = db.Column(
        db.Text,
        nullable=False
    )

    # Mã của Cục Quản lý Dược
    MaDuoc = db.Column(
        db.String(50),
        nullable=False
    )

    # Số đăng ký lưu hành
    SoDangKy = db.Column(
        db.String(100),
        nullable=False
    )

    # Dạng bào chế
    DangBaoChe = db.Column(
        db.String(255),
        nullable=False
    )

    # Quy cách đóng gói
    QuyCachDongGoi = db.Column(
        db.String(255),
        nullable=False
    )

    # Nhà sản xuất
    NhaSanXuat = db.Column(
        db.String(255),
        nullable=False
    )

    # Nước sản xuất
    NuocSanXuat = db.Column(
        db.String(255),
        nullable=False
    )

    # Cách dùng
    CachDung = db.Column(
        db.Text,
        nullable=False
    )

    # Chống chỉ định
    ChongChiDinh = db.Column(
        db.Text,
        nullable=False
    )

    # Bảo quản
    BaoQuan = db.Column(
        db.Text,
        nullable=False
    )

    # Ngưỡng tồn kho tối thiểu
    NguongTonKho = db.Column(
        db.Integer,
        nullable=False
    )

    # False: Không cần tư vấn
    # True: Cần dược sĩ tư vấn
    PhanLoai = db.Column(
    db.Boolean,
    nullable=False,
    default=False,
    server_default=db.false()
    )
