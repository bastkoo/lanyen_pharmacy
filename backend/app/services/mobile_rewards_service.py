"""Số dư/lịch sử hiện có và điểm danh theo ngày Việt Nam; không đổi schema."""
from datetime import datetime, time, timedelta, timezone

from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.repositories import diem_thuong_repository as points
from app.repositories import nguoi_dung_repository as users
from app.services.otp_service import AuthError
from app.services.order_expiry_service import vietnam_now
from app.services import points_service

VIETNAM = timezone(timedelta(hours=7))


def week_status(user_id, now):
    today = now.date()
    monday = today - timedelta(days=today.weekday())
    start = datetime.combine(monday, time.min)
    claimed = {stamp.date() for stamp in points.check_ins_between(user_id, start, start + timedelta(days=7))}
    days = []
    for offset in range(7):
        date = monday + timedelta(days=offset)
        state = 'claimed' if date in claimed else 'missed' if date < today else 'today' if date == today else 'upcoming'
        days.append(dict(date=date.isoformat(), reward=10 if offset == 6 else 5, status=state))
    return dict(week_start=monday.isoformat(), today=today.isoformat(), days=days,
                server_time=now.replace(tzinfo=VIETNAM).isoformat(),
                next_refresh_at=datetime.combine(today + timedelta(days=1), time.min, tzinfo=VIETNAM).isoformat())


def read(user_id, page):
    try:
        result = points_service.list_points(user_id, page, 20)
        if page > 1 and page > result['pages']:
            result = points_service.list_points(user_id, max(1, result['pages']), 20)
        # Chuỗi số nguyên giữ đúng xu lớn trên cả Flutter Web.
        result['balance'] = str(result['balance'])
        for item in result['items']:
            item['SoDiem'] = str(item['SoDiem'])
            stamp = datetime.fromisoformat(item['ThoiGianTichDiem'])
            item['ThoiGianTichDiem'] = stamp.replace(tzinfo=VIETNAM).isoformat()
        return dict(code='REWARDS_LISTED', **result, **week_status(user_id, vietnam_now()))
    except SQLAlchemyError:
        db.session.rollback()
        raise AuthError('DATABASE_UNAVAILABLE', 503) from None


def check_in(user_id):
    try:
        # Khóa cùng bản ghi người dùng xuyên suốt kiểm tra + ghi, kể cả chưa có xu.
        user = users.lock_by_id(user_id)
        if user is None:
            raise AuthError('UNAUTHENTICATED', 401)
        if user.TrangThai:
            raise AuthError('ACCOUNT_LOCKED', 403)
        if user.VaiTro != 0:
            raise AuthError('FORBIDDEN', 403)
        # Đọc giờ sau khi nhận khóa, tránh dùng ngày cũ khi chờ qua nửa đêm.
        now = vietnam_now()
        start = datetime.combine(now.date(), time.min)
        existing = points.check_ins_between(user_id, start, start + timedelta(days=1))
        amount = 0 if existing else 10 if now.weekday() == 6 else 5
        if amount:
            points.create_check_in(user_id, amount, now)
        db.session.commit()
        return dict(code='CHECK_IN_RECORDED' if amount else 'CHECK_IN_ALREADY_RECORDED',
                    awarded=str(amount), date=now.date().isoformat())
    except AuthError:
        db.session.rollback()
        raise
    except SQLAlchemyError:
        db.session.rollback()
        raise AuthError('DATABASE_UNAVAILABLE', 503) from None
