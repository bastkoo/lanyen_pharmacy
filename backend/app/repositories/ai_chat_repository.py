"""AI-only queries: every read is scoped to the authenticated customer."""
from sqlalchemy import select

from app.extensions import db
from app.models.tin_nhan import TinNhan
from app.models.noi_dung_tin_nhan import NoiDungTinNhan as Message
from app.models.nguoi_dung import NguoiDung

PREFIX = 'LYAI1:'


def owned_messages(user_id):
    return select(Message).join(TinNhan, TinNhan.MaTinNhan == Message.MaTinNhan).where(
        TinNhan.NguoiGui == user_id, TinNhan.LoaiHoiThoai == 'AI')


def messages(user_id, before=None, limit=50):
    query = owned_messages(user_id)
    if before is not None:
        query = query.where(Message.MaNoiDung < before)
    return list(reversed(db.session.execute(query.order_by(Message.MaNoiDung.desc()).limit(limit)).scalars().all()))


def exchange(user_id, request_id):
    query = owned_messages(user_id).where(Message.NoiDung.startswith(PREFIX, autoescape=True),
        Message.NoiDung.contains('"request_id":"' + request_id + '"', autoescape=True))
    return db.session.execute(query.order_by(Message.MaNoiDung)).scalars().all()


def lock_customer(user_id):
    return db.session.execute(select(NguoiDung).where(NguoiDung.MaNguoiDung == user_id)
        .with_for_update().execution_options(populate_existing=True)).scalar_one_or_none()


def conversation(user_id):
    # Called only while holding the customer's row lock: no duplicate AI threads.
    thread = db.session.execute(select(TinNhan).where(TinNhan.NguoiGui == user_id,
        TinNhan.LoaiHoiThoai == 'AI').order_by(TinNhan.MaTinNhan.desc()).limit(1)).scalar_one_or_none()
    if thread is None:
        thread = TinNhan(NguoiGui=user_id, LoaiHoiThoai='AI', MaNhanVien=None, TrangThai=1)
        db.session.add(thread)
        db.session.flush()
    return thread


def add(thread_id, user_id, sender_type, body, timestamp):
    value = Message(MaTinNhan=thread_id, NguoiGui=user_id, LoaiNguoiGui=sender_type,
                    NoiDung=PREFIX + body, ThoiGianGui=timestamp, DaDoc=True)
    db.session.add(value)
    db.session.flush()
    return value
