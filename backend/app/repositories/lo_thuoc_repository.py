from sqlalchemy import select

from app.extensions import db
from app.models.lo_thuoc import LoThuoc


def find_by_id(product_id, batch_id, for_update=False):
    query = select(LoThuoc).where(LoThuoc.MaThuoc == product_id, LoThuoc.MaLo == batch_id)
    if for_update:
        query = query.with_for_update()
    return db.session.execute(query).scalar_one_or_none()


def list_batches(product_id, page, per_page):
    from app.repositories.inventory_repository import paginate
    query = select(LoThuoc).where(LoThuoc.MaThuoc == product_id).order_by(LoThuoc.MaLo)
    return paginate(query, page, per_page, mappings=False)


def create(product_id, data):
    batch = LoThuoc(MaThuoc=product_id, SoLuongTon=data['SoLuongNhap'], **data)
    db.session.add(batch)
    db.session.flush()
    return batch


def update(batch, data):
    # Quantity and product identifiers are deliberately never assigned here.
    for key in ('SoLoSanXuat', 'NgaySanXuat', 'HanSuDung', 'GiaNhap'):
        setattr(batch, key, data[key])
    db.session.flush()
    return batch
