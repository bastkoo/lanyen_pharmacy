from sqlalchemy import func, or_, select, text

from app.extensions import db
from app.models.nguoi_dung import NguoiDung


def lock_writes():
    # The guard only read data. Finish that transaction before taking the lock,
    # so even a repeatable-read deployment cannot reuse its pre-lock snapshot.
    db.session.rollback()
    # Existing category module uses this PostgreSQL locking pattern. Serialize
    # account writes and exclude concurrent DML until commit/rollback. No schema change.
    db.session.execute(text('LOCK TABLE "NguoiDung" IN SHARE ROW EXCLUSIVE MODE'))


def find_by_id(account_id):
    # The auth guard may have loaded this identity before waiting for the lock.
    # Refresh it from PostgreSQL, including current role and locked status.
    return db.session.execute(select(NguoiDung).where(NguoiDung.MaNguoiDung == account_id)
                              .execution_options(populate_existing=True)).scalar_one_or_none()


def find_internal(account_id):
    return db.session.execute(select(NguoiDung).where(
        NguoiDung.MaNguoiDung == account_id, NguoiDung.VaiTro.in_((1, 2)))
        .execution_options(populate_existing=True)).scalar_one_or_none()


def list_accounts(search, page, per_page, role=None, status=None):
    query = select(NguoiDung).where(NguoiDung.VaiTro.in_((1, 2)))
    if search:
        # Match phone formatting accepted at login without changing stored data.
        phone_term = search
        for char in ' ().-':
            phone_term = phone_term.replace(char, '')
        if phone_term.startswith('0'):
            phone_term = '+84' + phone_term[1:]
        query = query.where(or_(NguoiDung.HoTen.icontains(search, autoescape=True),
                               NguoiDung.SDT.icontains(phone_term or search, autoescape=True)))
    if role is not None:
        query = query.where(NguoiDung.VaiTro == role)
    if status is not None:
        query = query.where(NguoiDung.TrangThai.is_(status))
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.session.execute(query.order_by(NguoiDung.MaNguoiDung)
                              .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    return rows, total


def count_active_managers():
    return db.session.execute(select(func.count()).select_from(NguoiDung).where(
        NguoiDung.VaiTro == 2, NguoiDung.TrangThai.is_(False))).scalar_one()


def create(data):
    account = NguoiDung(**data, TrangThai=False)
    db.session.add(account)
    db.session.flush()
    return account


def update(account, data):
    for key in ('HoTen', 'SDT', 'VaiTro', 'Email', 'AnhDaiDien'):
        if key in data:
            setattr(account, key, data[key])
    db.session.flush()
    return account


def set_status(account, locked):
    account.TrangThai = locked
    db.session.flush()
    return account


def commit():
    db.session.commit()


def rollback():
    db.session.rollback()
