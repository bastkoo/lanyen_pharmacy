"""Development-only persistence verification inside a rolled-back transaction.

Uses real PostgreSQL inserts and reads, with Groq/Redis mocked. All new fixture
rows are rolled back; existing user, message and medicine rows are never edited.
"""
import secrets
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from app import create_app
from app.extensions import db
from app.models.nguoi_dung import NguoiDung
from app.models.tin_nhan import TinNhan
from app.models.noi_dung_tin_nhan import NoiDungTinNhan
from app.models.loai_thuoc import LoaiThuoc
from app.models.thuoc import Thuoc
from app.models.don_vi_gia_thuoc import DonViGiaThuoc
from app.models.lo_thuoc import LoThuoc
from app.repositories import chat_repository
from app.repositories.thuoc_repository import search_ai_context
from app.services.inventory_service import current_date
from app.services import ai_chat_service as ai
from app.services.chat_service import access
from app.services.auth_service import AuthError


def main():
    app = create_app({'TESTING': True})
    if app.config['APP_ENV'] != 'development':
        raise RuntimeError('Use a development database for this verification.')
    with app.app_context():
        models = (NguoiDung, TinNhan, NoiDungTinNhan, LoaiThuoc, Thuoc, DonViGiaThuoc, LoThuoc)
        before = tuple(db.session.execute(select(func.count()).select_from(m)).scalar_one() for m in models)
        db.session.rollback()
        with db.engine.connect() as connection:
            transaction = connection.begin()
            isolated = scoped_session(sessionmaker(bind=connection, join_transaction_mode='create_savepoint'))
            try:
                with patch.object(db, 'session', isolated):
                    user_id = -secrets.randbelow(10**12) - 1
                    user = NguoiDung(MaNguoiDung=user_id, HoTen='AI transaction fixture',
                        SDT='T' + uuid4().hex[:14], VaiTro=0, TrangThai=False)
                    db.session.add(user)
                    db.session.commit()  # releases a savepoint only, never the outer transaction
                    product_id, today = -secrets.randbelow(10**8)-10, current_date()
                    name = 'AI inventory fixture ' + uuid4().hex
                    db.session.add(LoaiThuoc(MaLoaiThuoc=product_id, TenLoaiThuoc=name))
                    db.session.flush()
                    db.session.add(Thuoc(MaThuoc=product_id, MaLoaiThuoc=product_id, TenThuoc=name,
                        HinhAnh='', MoTa=name, MaDuoc=uuid4().hex, MaVach=uuid4().hex, SoDangKy=uuid4().hex,
                        DangBaoChe='Test', QuyCachDongGoi='Test', NhaSanXuat='Test', NuocSanXuat='Test',
                        CachDung='Test', ChongChiDinh='Test', BaoQuan='Test', NguongTonKho=0, KeDon=False, PhanLoai=False))
                    db.session.flush()
                    db.session.add(DonViGiaThuoc(MaDonGia=product_id, MaThuoc=product_id,
                        DonViTinh='Hộp', GiaBan=10000, SoLuongQuyDoi=10))
                    def batch(batch_id, quantity, expiry):
                        return LoThuoc(MaLo=batch_id, MaThuoc=product_id, SoLoSanXuat=uuid4().hex,
                            NgaySanXuat=today-timedelta(days=30), HanSuDung=expiry,
                            SoLuongNhap=100, SoLuongTon=quantity, GiaNhap=100)
                    valid = batch(product_id, 9, today)
                    db.session.add_all([valid, batch(product_id-1, 100, today-timedelta(days=1))])
                    db.session.flush()
                    assert search_ai_context([name], today) == []  # expired 100 + valid 9 is insufficient
                    valid.SoLuongTon = 10
                    db.session.flush()
                    assert [p.MaThuoc for p in search_ai_context([name], today)] == [product_id]
                    valid.SoLuongTon = 0
                    db.session.flush()
                    assert search_ai_context([name], today) == []
                    valid.SoLuongTon = 9
                    db.session.add(batch(product_id-2, 1, today+timedelta(days=1)))
                    db.session.flush()
                    assert [p.MaThuoc for p in search_ai_context([name], today)] == [product_id]
                    db.session.commit()
                    print('POSTGRESQL_AI_STOCK_OK: expired, empty, unit conversion, multiple batches')
                    with patch.object(ai, 'rate_limit'), patch.object(ai, 'completion', side_effect=[
                        {'terms': []}, {'text': 'Xin chào, tôi là trợ lý AI.', 'product_ids': []}]):
                        request_id = uuid4()
                        first = ai.answer(user, 'Xin chào', request_id)
                        retry = ai.answer(user, 'Xin chào', request_id)
                    assert retry == first
                    history = ai.history(user)
                    assert len(history['items']) == 2
                    assert [m['role'] for m in history['items']] == ['KHACH_HANG', 'AI']
                    assert ai.history(SimpleNamespace(MaNguoiDung=user_id-1))['items'] == []
                    assert chat_repository.messages(user_id=user_id) == []
                    reply = db.session.get(NoiDungTinNhan, int(first['messages'][1]['id']))
                    assert reply.NguoiGui is None and reply.LoaiNguoiGui == 'AI'
                    assert not chat_repository.is_staff_message(reply)
                    original_add = ai.chats.add
                    def fail_ai_insert(thread_id, sender_id, role, body, timestamp):
                        if role == 'AI':
                            raise SQLAlchemyError('Simulated insert failure')
                        return original_add(thread_id, sender_id, role, body, timestamp)
                    with patch.object(ai, 'rate_limit'), patch.object(ai, 'completion', side_effect=[
                        {'terms': []}, {'text': 'This pair must be rolled back.', 'product_ids': []}]), \
                            patch.object(ai.chats, 'add', side_effect=fail_ai_insert):
                        try:
                            ai.answer(user, 'Atomic rollback test', uuid4())
                        except AuthError as error:
                            assert error.code == 'DATABASE_UNAVAILABLE'
                        else:
                            raise AssertionError('Expected insert failure.')
                    assert len(ai.history(user)['items']) == 2
                    try:
                        access(SimpleNamespace(VaiTro=1, MaNguoiDung=99), int(first['messages'][0]['thread_id']))
                    except AuthError as error:
                        assert error.code == 'CHAT_NOT_FOUND'
                    else:
                        raise AssertionError('AI thread was exposed to pharmacist endpoints.')
                    print('POSTGRESQL_AI_HISTORY_OK: two rows, retry, ownership, pharmacist isolation')
            finally:
                isolated.remove()
                transaction.rollback()
        after = tuple(db.session.execute(select(func.count()).select_from(m)).scalar_one() for m in models)
        assert before == after, 'Test fixture rows were not rolled back.'
        db.session.rollback()
        print('FIXTURE_ROLLBACK_OK: existing row counts preserved')


if __name__ == '__main__':
    main()
