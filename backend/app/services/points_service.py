from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.repositories import diem_thuong_repository as points
from app.services.auth_service import AuthError


def list_points(user_id, page, per_page):
    try:
        rows, balance, total = points.list_owned(user_id, page, per_page)
        return dict(balance=balance, total=total, page=page, per_page=per_page,
                    pages=(total + per_page - 1) // per_page,
                    items=[dict(MaDiemThuong=row.MaDiemThuong, SoDiem=row.SoDiem,
                                LoaiGiaoDich=row.LoaiGiaoDich, LyDo=row.LyDo,
                                ThoiGianTichDiem=row.ThoiGianTichDiem.isoformat()) for row in rows])
    except SQLAlchemyError:
        db.session.rollback()
        raise AuthError('DATABASE_UNAVAILABLE', 503) from None
