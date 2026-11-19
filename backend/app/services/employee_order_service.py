from datetime import timedelta, timezone

from app.extensions import db
from app.repositories import don_hang_repository as orders
from app.repositories import gio_thuoc_repository as carts
from app.repositories import diem_thuong_repository as points
from app.services.auth_service import AuthError
from app.services.cart_service import operation
from app.services import order_service
from app.services.order_expiry_service import overdue, vietnam_now


def summary(order, customer):
    result = order_service.serialize(order, legacy_payment=False)
    result.update(NgayDat=order.NgayDat.replace(tzinfo=timezone(timedelta(hours=7))).isoformat(),
                  KhachHang={'HoTen': customer.HoTen, 'SDT': customer.SDT} if customer else None,
                  QuaHanThanhToan=overdue(order))
    return result


@operation
def list_orders(status, search, page, per_page):
    search = search.strip().lstrip('#').replace(' ', '').replace('-', '')
    if search and not search.lstrip('+').isdigit():
        raise AuthError('INVALID_REQUEST', 400)
    rows, total = orders.employee_list(status, search, page, per_page)
    return dict(items=[summary(order, customer) for order, customer in rows], total=total,
                page=page, per_page=per_page, status=status)


@operation
def detail(order_id):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id)
    if order is None:
        raise AuthError('ORDER_NOT_FOUND', 404)
    result = summary(order, orders.customer(order.MaNguoiMua))
    value = order_service.read_detail(order.MaNguoiMua, order_id, include_barcode=True)
    result.update(items=value['items'], GhiChu=value['GhiChu'], XuDaCong=value.get('XuDaCong'),
                  CanPrint=order.TrangThaiDonHang == 1)
    return result


@operation
def update(actor, order_id, from_status, to_status):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    if (from_status, to_status) not in ((0, 1), (1, 2), (2, 3)):
        raise AuthError('INVALID_TRANSITION', 409)
    initial = orders.find(order_id)
    if initial is None:
        raise AuthError('ORDER_NOT_FOUND', 404)
    if carts.lock_user(initial.MaNguoiMua) is None:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id, lock=True)
    if order is None or order.TrangThaiDonHang != from_status:
        raise AuthError('ORDER_STATE_CHANGED', 409)
    if overdue(order):
        raise AuthError('ORDER_EXPIRED', 409)
    if (from_status, to_status) == (0, 1):
        order.TrangThaiThanhToan = 1
    if (from_status, to_status) == (2, 3):
        if order.PhuongThucThanhToan == 0:
            order.TrangThaiThanhToan = 1
        quantity = order.TongThanhToan // 100
        if not 0 <= quantity <= 2147483647:
            raise AuthError('ORDER_POINTS_LIMIT', 409)
        points.award(order.MaNguoiMua, quantity, order_id, vietnam_now())
    order.TrangThaiDonHang = to_status
    order.MaNhanVien = actor.MaNguoiDung
    result = detail(order_id)
    db.session.commit()
    return result


@operation
def cancel(actor, order_id):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id)
    if order is None:
        raise AuthError('ORDER_NOT_FOUND', 404)
    return order_service.cancel(order.MaNguoiMua, order_id, employee_id=actor.MaNguoiDung, allowed_states=(0, 1, 2))
