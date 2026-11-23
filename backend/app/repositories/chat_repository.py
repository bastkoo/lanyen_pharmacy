from sqlalchemy import select, func, or_, update

from app.extensions import db
from app.models.tin_nhan import TinNhan
from app.models.noi_dung_tin_nhan import NoiDungTinNhan as Message
from app.models.nguoi_dung import NguoiDung


def thread(thread_id, lock=False):
    query = select(TinNhan).where(TinNhan.MaTinNhan == thread_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.session.execute(query).scalar_one_or_none()


def active_customer(user_id):
    return db.session.execute(select(TinNhan).where(TinNhan.NguoiGui == user_id,
        TinNhan.TrangThai.in_((0, 1))).order_by(TinNhan.MaTinNhan.desc()).limit(1)
        .with_for_update().execution_options(populate_existing=True)).scalar_one_or_none()


def create_thread(user_id):
    value = TinNhan(NguoiGui=user_id, MaNhanVien=None, TrangThai=0)
    db.session.add(value); db.session.flush()
    return value


def queue(actor_id, search, page):
    query = select(TinNhan, NguoiDung).join(NguoiDung, NguoiDung.MaNguoiDung == TinNhan.NguoiGui).where(
        or_((TinNhan.TrangThai == 0) & TinNhan.MaNhanVien.is_(None),
            (TinNhan.TrangThai == 1) & (TinNhan.MaNhanVien == actor_id)))
    if search:
        query = query.where(or_(NguoiDung.HoTen.icontains(search, autoescape=True), NguoiDung.SDT.contains(search, autoescape=True)))
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.session.execute(query.order_by(TinNhan.MaTinNhan.desc()).offset((page-1)*20).limit(20)).all()
    return rows, total


def pending_count():
    return db.session.execute(select(func.count(func.distinct(TinNhan.NguoiGui))).where(
        TinNhan.TrangThai == 0, TinNhan.MaNhanVien.is_(None))).scalar_one()


def messages(user_id=None, thread_id=None, before=None):
    query = select(Message, NguoiDung.VaiTro).join(NguoiDung, NguoiDung.MaNguoiDung == Message.NguoiGui)
    if user_id is not None:
        query = query.join(TinNhan, TinNhan.MaTinNhan == Message.MaTinNhan).where(TinNhan.NguoiGui == user_id)
    else:
        query = query.where(Message.MaTinNhan == thread_id)
    if before:
        query = query.where(Message.MaNoiDung < before)
    return list(reversed(db.session.execute(query.order_by(Message.MaNoiDung.desc()).limit(50)).all()))


def add(thread_id, actor_id, body, timestamp):
    value = Message(MaTinNhan=thread_id, NguoiGui=actor_id, NoiDung=body, ThoiGianGui=timestamp, DaDoc=False)
    db.session.add(value); db.session.flush()
    return value


def customer_payloads(user_id):
    # Server-written typed messages only. TEXT remains compatible with old text.
    return db.session.execute(select(Message).join(TinNhan, TinNhan.MaTinNhan == Message.MaTinNhan)
        .where(TinNhan.NguoiGui == user_id, Message.NoiDung.startswith('LYCHAT1:', autoescape=True))).scalars().all()


def thread_payloads(thread_id):
    return db.session.execute(select(Message).where(Message.MaTinNhan == thread_id,
        Message.NoiDung.startswith('LYCHAT1:', autoescape=True))).scalars().all()


def is_staff_message(message):
    # Assignment at send time is enforced by the service; completed assignments
    # remain on TinNhan so offers keep working after a consultation is finished.
    return db.session.execute(select(TinNhan.MaTinNhan).where(TinNhan.MaTinNhan == message.MaTinNhan,
        TinNhan.MaNhanVien == message.NguoiGui)).scalar_one_or_none() is not None


def unread(user_id):
    return db.session.execute(select(func.count()).select_from(Message).join(TinNhan,
        TinNhan.MaTinNhan == Message.MaTinNhan).where(TinNhan.NguoiGui == user_id,
        Message.NguoiGui != user_id, Message.DaDoc.is_(False))).scalar_one()


def mark_read(actor_id, last_id, user_id=None, thread_id=None):
    query = update(Message).where(Message.MaNoiDung <= last_id, Message.NguoiGui != actor_id, Message.DaDoc.is_(False))
    query = query.where(Message.MaTinNhan.in_(select(TinNhan.MaTinNhan).where(TinNhan.NguoiGui == user_id))) if user_id is not None else query.where(Message.MaTinNhan == thread_id)
    db.session.execute(query.values(DaDoc=True))
