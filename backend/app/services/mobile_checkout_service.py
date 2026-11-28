"""Checkout JWT dùng lại định giá/đặt hàng/SePay của Website, không đổi schema."""
import hashlib
import json

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import current_app

from app.extensions import db
from app.repositories import gio_thuoc_repository as carts, diem_thuong_repository as points
from app.repositories import don_hang_repository as orders
from app.services import cart_service, order_service, sepay_gateway_service
from app.services.points_service import redemption, earned_points
from app.services.otp_service import AuthError


@cart_service.operation
def quote(user_id, data):
    selected = set(data['MaDonGia'])
    value = cart_service.get_cart(selected_ids=selected, owner_id=user_id)
    if {line['MaDonGia'] for line in value['items']} != selected:
        raise AuthError('CART_CHANGED', 409)
    from app.services.consultation_service import require_authorization
    require_authorization(user_id, [(i['MaThuoc'], i['MaDonGia']) for i in value['items']])
    if any(not i['ConHang'] or i['ThanhTien'] is None for i in value['items']):
        raise AuthError('OUT_OF_STOCK', 409)
    balance = points.balance(user_id)
    quantity, discount = redemption(value['total'], balance) if data['DoiDiem'] else (0, 0)
    original = sum((i.get('GiaGoc') or i['GiaBan']) * i['SoLuong'] for i in value['items'])
    total = value['total'] - discount
    for item in value['items']:
        for name in ('GiaBan', 'GiaGoc', 'ThanhTien'):
            if item.get(name) is not None:
                item[name] = str(item[name])
    return dict(code='CHECKOUT_QUOTED', items=value['items'], original=str(original),
                subtotal=str(value['total']), product_discount=str(original - value['total']),
                balance=str(balance), redeemed=str(quantity), points_discount=str(discount), total=str(total),
                estimated_points=str(earned_points(total)))


def create(user, data):
    values = dict(data)
    request_id = str(values.pop('request_id'))
    values['MaDonGia'] = sorted(values['MaDonGia'])
    digest = hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()
    return order_service.create(user, values, mobile_request={'id': request_id, 'hash': digest})


@cart_service.operation
def recover(user_id, request_id):
    if carts.lock_user(user_id) is None:
        raise AuthError('UNAUTHENTICATED', 401)
    order = orders.find_mobile_request(user_id, str(request_id))
    if order is None:
        raise AuthError('ORDER_NOT_FOUND', 404)
    result = order_service.serialize(order, legacy_payment=False)
    db.session.commit()
    return result


def signer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt='mobile-sepay-bridge-v1')


def payment_ticket(user_id, order_id):
    # Kiểm tra chủ đơn và môi trường trước khi cấp vé mở cổng thanh toán.
    sepay_gateway_service.initialize(user_id, order_id, mobile=True)
    return signer().dumps({'owner': user_id, 'order': order_id})


def payment_form(ticket):
    try:
        value = signer().loads(ticket, max_age=300)
        if (not isinstance(value, dict) or type(value.get('owner')) is not int or type(value.get('order')) is not int
                or value['owner'] <= 0 or value['order'] <= 0):
            raise BadSignature('Invalid ticket')
    except (BadSignature, SignatureExpired):
        raise AuthError('PAYMENT_LINK_EXPIRED', 401) from None
    return sepay_gateway_service.initialize(value['owner'], value['order'], mobile=True)
