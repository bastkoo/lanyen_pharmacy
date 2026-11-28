from sqlalchemy import select, func, case, cast, String, or_, text

from app.extensions import db
from app.models.don_hang import DonHang
from app.models.chi_tiet_don_hang import ChiTietDonHang
from app.models.thuoc import Thuoc
from app.models.don_vi_gia_thuoc import DonViGiaThuoc
from app.models.nguoi_dung import NguoiDung


def find(order_id, lock=False):
    query = select(DonHang).where(DonHang.MaDonHang == order_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.session.execute(query).scalar_one_or_none()


def find_mobile_request(user_id, request_id):
    return db.session.execute(select(DonHang).where(
        DonHang.MaNguoiMua == user_id,
        DonHang.DuLieuHoanTra['mobile_request']['id'].astext == request_id,
    )).scalar_one_or_none()


def create(values, items):
    order = DonHang(**values)
    db.session.add(order)
    db.session.flush()
    for item in items:
        db.session.add(ChiTietDonHang(MaDonHang=order.MaDonHang, **item))
    return order


def detail_items(order_id):
    return db.session.execute(select(ChiTietDonHang, Thuoc, DonViGiaThuoc)
                              .outerjoin(Thuoc, Thuoc.MaThuoc == ChiTietDonHang.MaThuoc)
                              .outerjoin(DonViGiaThuoc, DonViGiaThuoc.MaDonGia == ChiTietDonHang.MaDonGia)
                              .where(ChiTietDonHang.MaDonHang == order_id)
                              .order_by(ChiTietDonHang.MaChiTiet)).all()


def employee_list(status, search, page, per_page):
    query = select(DonHang, NguoiDung).join(NguoiDung, NguoiDung.MaNguoiDung == DonHang.MaNguoiMua)
    query = query.where(DonHang.TrangThaiDonHang.in_((3, 5) if status == 'returns' else (3,) if status == '3' else (0, 1, 2)))
    if status not in ('all', 'returns'):
        query = query.where(DonHang.TrangThaiDonHang == int(status))
    if search:
        phone_queries = [NguoiDung.SDT.contains(search, autoescape=True)]
        if search.startswith('0') and len(search) > 1:
            phone_queries.append(NguoiDung.SDT.contains('+84' + search[1:], autoescape=True))
        elif search.startswith('+84'):
            phone_queries.append(NguoiDung.SDT.contains('0' + search[3:], autoescape=True))
        query = query.where(or_(cast(DonHang.MaDonHang, String).contains(search, autoescape=True),
                               *phone_queries))
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    priority = case((DonHang.TrangThaiDonHang == 1, 0), (DonHang.TrangThaiDonHang == 0, 1), else_=2)
    ordering = (DonHang.NgayDat.desc(), DonHang.MaDonHang.desc()) if status in ('3', 'returns') else (priority, DonHang.NgayDat, DonHang.MaDonHang)
    rows = db.session.execute(query.order_by(*ordering)
                              .offset((page - 1) * per_page).limit(per_page)).all()
    return rows, total


def customer(user_id):
    return db.session.get(NguoiDung, user_id)


def pending_count():
    return db.session.execute(select(func.count()).select_from(DonHang).where(
        DonHang.TrangThaiDonHang == 1)).scalar_one()


def counter_request(actor_id, request_id):
    # Serializes retries across workers, including before a customer exists.
    db.session.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))'),
                       {'key': f'counter:{actor_id}:{request_id}'})
    return db.session.execute(select(DonHang).where(
        DonHang.KenhDatHang.is_(True),
        DonHang.DuLieuHoanTra['counter_request']['actor'].as_integer() == actor_id,
        DonHang.DuLieuHoanTra['counter_request']['id'].as_string() == request_id)).scalar_one_or_none()


def pending_counter():
    return db.session.execute(select(DonHang, NguoiDung).join(
        NguoiDung, NguoiDung.MaNguoiDung == DonHang.MaNguoiMua).where(
        DonHang.KenhDatHang.is_(True), DonHang.TrangThaiDonHang.in_((0, 1)))
        .order_by(DonHang.NgayDat.desc()).limit(50)).all()


def expired_candidates(cutoff, after_id=0, limit=100):
    return db.session.execute(select(DonHang.MaDonHang, DonHang.MaNguoiMua).where(
        DonHang.MaDonHang > after_id, DonHang.TrangThaiDonHang == 0,
        DonHang.TrangThaiThanhToan == 0, DonHang.PhuongThucThanhToan == 1,
        DonHang.NgayDat < cutoff, DonHang.DuLieuHoanTra.is_not(None))
        .order_by(DonHang.MaDonHang).limit(limit)).all()


def list_owned(user_id, statuses, page, per_page):
    query = select(DonHang).where(DonHang.MaNguoiMua == user_id)
    if statuses is not None:
        query = query.where(DonHang.TrangThaiDonHang.in_(statuses))
    total = db.session.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    processing_count = db.session.execute(select(func.count()).select_from(DonHang).where(
        DonHang.MaNguoiMua == user_id, DonHang.TrangThaiDonHang.in_((0, 1)))).scalar_one()
    items = db.session.execute(query.order_by(DonHang.NgayDat.desc(), DonHang.MaDonHang.desc())
                               .offset((page - 1) * per_page).limit(per_page)).scalars().all()
    if not items:
        return items, total, processing_count, {}
    # Fetch every line for this owned page in one query, without N+1 requests.
    rows = db.session.execute(select(ChiTietDonHang, Thuoc, DonViGiaThuoc)
                              .outerjoin(Thuoc, Thuoc.MaThuoc == ChiTietDonHang.MaThuoc)
                              .outerjoin(DonViGiaThuoc, DonViGiaThuoc.MaDonGia == ChiTietDonHang.MaDonGia)
                              .where(ChiTietDonHang.MaDonHang.in_([item.MaDonHang for item in items]))
                              .order_by(ChiTietDonHang.MaDonHang, ChiTietDonHang.MaChiTiet)).all()
    lines = {}
    for row in rows:
        lines.setdefault(row[0].MaDonHang, []).append(row)
    return items, total, processing_count, lines
