"""Employee counter sales reuse checkout pricing, stock and refund allocations."""
import hashlib
import json

from app.extensions import db
from app.repositories import nguoi_dung_repository as users, don_hang_repository as orders
from app.repositories import diem_thuong_repository as points
from app.services import order_service, employee_order_service
from app.services.auth_service import AuthError
from app.services.cart_service import operation, get_cart
from app.services.otp_service import normalize_phone
from app.services.points_service import redemption, earned_points
from app.services.order_expiry_service import vietnam_now
from app.services import sepay_gateway_service as gateway
from app.repositories import thuoc_repository as products, don_vi_gia_thuoc_repository as units
from app.repositories import chi_tiet_khuyen_mai_repository as promotions
from app.services.product_service import serialize_public_products
from app.services.inventory_service import usable_stock, current_date
from app.services.sale_pricing import cart_prices


def require_customer(user):
    if user and user.TrangThai:
        raise AuthError('CUSTOMER_UNAVAILABLE', 409)
    return user


@operation
def customer(phone):
    phone = normalize_phone(phone)
    user = require_customer(users.find_by_phone(phone))
    return dict(SDT=phone, exists=user is not None, HoTen=user.HoTen if user else '',
                SoXu=str(points.balance(user.MaNguoiDung)) if user else '0')


def entries(data):
    return [(line['MaThuoc'], line['MaDonGia'], line['SoLuong']) for line in data['items']]


@operation
def catalog(filters):
    filters = dict(filters)
    if 'ke_don' in filters:
        filters['ke_don'] = filters['ke_don'] == 'true'
    records, total = products.list_products(**filters, sort_by='TenThuoc')
    product_ids = [product.MaThuoc for product in records]
    raw_units = units.public_units(product_ids) if product_ids else []
    stock = usable_stock(product_ids) if product_ids else {}
    programs = promotions.active_for_products(product_ids, current_date()) if product_ids else []
    values = serialize_public_products(records, raw_units, stock)
    product_map = {product.MaThuoc: product for product in records}
    catalog_items = {(unit.MaThuoc, unit.MaDonGia): (product_map[unit.MaThuoc], unit) for unit in raw_units}
    for product in values:
        product['MaVach'] = product_map[product['MaThuoc']].MaVach
        for unit in product['DonViGia']:
            price = cart_prices([(product['MaThuoc'], unit['MaDonGia'], 1)], catalog_items, raw_units, programs)[0]
            unit['GiaKhuyenMai'] = price['GiaBan'] if price and price['KhuyenMai'] else None
            unit['KhuyenMai'] = price['KhuyenMai'] if price else None
    return dict(items=values, total=total, page=filters['page'], per_page=filters['per_page'])


@operation
def quote(data):
    user = require_customer(users.find_by_phone(normalize_phone(data['SDT']))) if data.get('SDT', '').strip() else None
    value = get_cart(entries=entries(data))
    if any(not line['ConHang'] or line['GiaBan'] is None for line in value['items']):
        raise AuthError('OUT_OF_STOCK', 409)
    balance = points.balance(user.MaNguoiDung) if user else 0
    redeemed, discount = redemption(value['total'], balance) if data['DoiDiem'] else (0, 0)
    return dict(items=value['items'], TongTien=str(sum(line.get('GiaGoc', line['GiaBan']) * line['SoLuong'] for line in value['items'])),
                TongThanhToan=str(value['total'] - discount), XuSuDung=redeemed,
                SoXu=str(balance), XuSeCong=str(earned_points(value['total'] - discount)))


@operation
def create(actor, data):
    phone, request_id = normalize_phone(data['SDT']), str(data['request_id'])
    fingerprint = hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()
    previous = orders.counter_request(actor.MaNguoiDung, request_id)
    if previous:
        if previous.DuLieuHoanTra['counter_request']['fingerprint'] != fingerprint:
            raise AuthError('COUNTER_REQUEST_CHANGED', 409)
        result = detail(previous.MaDonHang)
        db.session.commit()
        return result
    user = require_customer(users.find_by_phone(phone))
    if user is None:
        name = data['HoTen'].strip()
        if not name or any(ord(char) < 32 for char in name):
            raise AuthError('CUSTOMER_NAME_REQUIRED', 400)
        user = require_customer(users.create_customer(phone, name, commit=False))
    user = require_customer(users.lock_by_id(user.MaNguoiDung))
    if user is None:
        raise AuthError('CUSTOMER_UNAVAILABLE', 409)
    values = dict(MaDonGia=[line['MaDonGia'] for line in data['items']],
                  PhuongThucThanhToan=data['PhuongThucThanhToan'], DoiDiem=data['DoiDiem'],
                  TongThanhToan=data['TongThanhToan'], HinhThucNhanHang='pickup', GhiChu='Bán tại quầy')
    result = order_service.create(user, values, entries=entries(data), counter={
        'actor': actor.MaNguoiDung, 'id': request_id, 'fingerprint': fingerprint})
    return detail(int(result['MaDonHang']))


@operation
def detail(order_id):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id)
    if order is None or not (order.TrangThaiDonHang == 3 or order.KenhDatHang):
        raise AuthError('ORDER_NOT_FOUND', 404)
    result = employee_order_service.detail(order_id)
    result['CanPrint'] = order.TrangThaiDonHang == 3
    result['KenhDatHang'] = order.KenhDatHang
    return result


@operation
def complete(actor, order_id):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    initial = orders.find(order_id)
    if initial is None or not initial.KenhDatHang:
        raise AuthError('ORDER_NOT_FOUND', 404)
    users.lock_by_id(initial.MaNguoiMua)
    order = orders.find(order_id, lock=True)
    if order.TrangThaiDonHang == 3:
        result = detail(order_id)
        db.session.commit()
        return result
    if order.TrangThaiDonHang != 1 or order.TrangThaiThanhToan != 1:
        raise AuthError('PAYMENT_PENDING', 409)
    quantity = earned_points(order.TongThanhToan)
    if not 0 <= quantity <= 2147483647:
        raise AuthError('ORDER_POINTS_LIMIT', 409)
    if quantity > 0:
        points.award(order.MaNguoiMua, quantity, order_id, vietnam_now())
    order.TrangThaiDonHang = 3
    order.MaNhanVien = actor.MaNguoiDung
    result = detail(order_id)
    db.session.commit()
    return result


@operation
def payment(order_id):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id)
    if order is None or not order.KenhDatHang:
        raise AuthError('ORDER_NOT_FOUND', 404)
    return gateway.initialize(order.MaNguoiMua, order_id, employee=True)


@operation
def pending():
    return [employee_order_service.summary(order, user) for order, user in orders.pending_counter()]
