from sqlalchemy import delete, func, or_, select

from app.extensions import db
from app.models.thuoc import Thuoc
from app.models.chi_tiet_don_hang import ChiTietDonHang
from app.models.chi_tiet_khuyen_mai import ChiTietKhuyenMai
from app.models.don_vi_gia_thuoc import DonViGiaThuoc
from app.models.gio_thuoc import GioThuoc
from app.models.lo_thuoc import LoThuoc


SORT_COLUMNS = {name: getattr(Thuoc, name) for name in (
    'MaThuoc', 'TenThuoc', 'MaDuoc', 'SoDangKy', 'MaLoaiThuoc', 'NguongTonKho', 'PhanLoai')}
REFERENCE_MODELS = (ChiTietDonHang, ChiTietKhuyenMai, DonViGiaThuoc, GioThuoc, LoThuoc)


def find_by_id(product_id, for_update=False):
    query = select(Thuoc).where(Thuoc.MaThuoc == product_id)
    if for_update:
        query = query.with_for_update()
    return db.session.execute(query).scalar_one_or_none()


def list_products(search='', category_id=None, phan_loai=None, page=1, per_page=20,
                  sort_by='MaThuoc', sort_order='asc'):
    query = select(Thuoc)
    if search:
        query = query.where(or_(*(column.icontains(search, autoescape=True) for column in
                                 (Thuoc.TenThuoc, Thuoc.MaDuoc, Thuoc.SoDangKy))))
    if category_id is not None:
        query = query.where(Thuoc.MaLoaiThuoc == category_id)
    if phan_loai is not None:
        query = query.where(Thuoc.PhanLoai == phan_loai)
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    column = SORT_COLUMNS[sort_by]
    ordering = column.desc() if sort_order == 'desc' else column.asc()
    query = query.order_by(ordering, Thuoc.MaThuoc.asc()).offset((page - 1) * per_page).limit(per_page)
    return db.session.execute(query).scalars().all(), total


def create(data):
    product = Thuoc(**data)
    db.session.add(product)
    db.session.flush()
    return product


def update(product, data):
    for key, value in data.items():
        setattr(product, key, value)
    db.session.flush()
    return product


def has_references(product_id):
    return db.session.execute(select(or_(*(
        select(model.MaThuoc).where(model.MaThuoc == product_id).exists()
        for model in REFERENCE_MODELS)))).scalar_one()


def remove(product_id):
    # Delete only the parent row; rely on existing FK restrictions, never cascade.
    db.session.execute(delete(Thuoc).where(Thuoc.MaThuoc == product_id))


def commit():
    db.session.commit()


def rollback():
    db.session.rollback()
