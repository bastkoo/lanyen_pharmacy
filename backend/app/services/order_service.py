import re
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

from flask import current_app

from app.extensions import db
from app.repositories import don_hang_repository as orders
from app.repositories import gio_thuoc_repository as carts
from app.repositories import dia_chi_repository as addresses
from app.services.auth_service import AuthError
from app.services.cart_service import get_cart, operation, require_unit
from app.services.inventory_service import usable_stock, deduct_order_stock
from app.services.sepay_gateway_service import gateway_config
from app.schemas.order_schema import ORDER_FILTERS


def payment_config():
    config = current_app.config
    if not all(config.get(key) for key in ('SEPAY_BANK', 'SEPAY_ACCOUNT_NUMBER', 'SEPAY_WEBHOOK_API_KEY')):
        raise AuthError('PAYMENT_NOT_CONFIGURED', 503)
    return config


def serialize(order, legacy_payment=True):
    result = {key: str(getattr(order, key)) for key in
              ('MaDonHang', 'TongTien', 'TienGiamGia', 'TongThanhToan')}
    result.update({key: getattr(order, key) for key in
                   ('TrangThaiDonHang', 'TrangThaiThanhToan', 'PhuongThucThanhToan')})
    if order.PhuongThucThanhToan == 1:
        result['payment_environment'] = order.MoiTruongThanhToan
    # Retain the legacy read payload when configured. Sandbox-only installations
    # can still read order status without supplying bank webhook credentials.
    legacy_configured = all(current_app.config.get(key) for key in ('SEPAY_BANK', 'SEPAY_ACCOUNT_NUMBER', 'SEPAY_WEBHOOK_API_KEY'))
    if legacy_payment and legacy_configured and order.MoiTruongThanhToan is None and order.PhuongThucThanhToan == 1 and order.TrangThaiThanhToan == 0 and order.TrangThaiDonHang == 0:
        config = payment_config()
        content = f'LYDH{order.MaDonHang}'
        result['payment'] = {'bank': config['SEPAY_BANK'], 'account': config['SEPAY_ACCOUNT_NUMBER'],
                             'holder': config.get('SEPAY_ACCOUNT_NAME', ''), 'content': content,
                             'qr_url': 'https://qr.sepay.vn/img?' + urlencode({
                                 'acc': config['SEPAY_ACCOUNT_NUMBER'], 'bank': config['SEPAY_BANK'],
                                 'amount': order.TongThanhToan, 'des': content})}
    return result


@operation
def create(user, data):
    # Same lock as cart mutations: a double submit cannot consume the cart twice.
    if carts.lock_user(user.MaNguoiDung) is None:
        raise AuthError('UNAUTHENTICATED', 401)
    environment = gateway_config()['SEPAY_ENV'] if data['PhuongThucThanhToan'] == 1 else None
    records = [item for item in carts.list_items(user.MaNguoiDung) if item.MaDonGia in data['MaDonGia']]
    if {item.MaDonGia for item in records} != set(data['MaDonGia']):
        raise AuthError('CART_CHANGED', 409)
    quote = get_cart(set(data['MaDonGia']))
    if not quote['items'] or any(item['GiaBan'] is None or not item['ConHang'] for item in quote['items']):
        raise AuthError('OUT_OF_STOCK', 409)
    # Multiple units of the same product must fit the combined base-unit stock.
    required = {}
    details, original = [], 0
    for item in sorted(quote['items'], key=lambda item: item['MaDonGia']):
        unit = require_unit(item['MaThuoc'], item['MaDonGia'], for_update=True)
        if unit.SoLuongQuyDoi <= 0:
            raise AuthError('OUT_OF_STOCK', 409)
        required[item['MaThuoc']] = required.get(item['MaThuoc'], 0) + item['SoLuong'] * unit.SoLuongQuyDoi
        original += item['SoLuong'] * unit.GiaBan
        details.append(dict(MaThuoc=item['MaThuoc'], MaDonGia=item['MaDonGia'],
                            SoLuong=item['SoLuong'], DonGia=unit.GiaBan))
    stock = usable_stock(list(required))
    if any(count > stock.get(product, 0) for product, count in required.items()):
        raise AuthError('OUT_OF_STOCK', 409)
    total = quote['total']
    if total != int(data['TongThanhToan']):
        raise AuthError('QUOTE_CHANGED', 409)
    if not 0 <= original <= 9223372036854775807 or not 0 <= original - total <= 2147483647:
        raise AuthError('ORDER_AMOUNT_LIMIT', 409)
    if data['PhuongThucThanhToan'] == 1 and total <= 0:
        raise AuthError('QR_AMOUNT_INVALID', 409)
    recipient = f"Người nhận: {user.HoTen} · {user.SDT}"
    if data['HinhThucNhanHang'] == 'delivery':
        address = next((a for a in addresses.list_owned(user.MaNguoiDung)
                        if str(a.MaDiaChi) == data['MaDiaChi']), None)
        if address is None:
            raise AuthError('ADDRESS_NOT_FOUND', 404)
        receipt = f'Giao tận nơi: {address.DiaChiCuThe}, {address.PhuongXa}, {address.TinhThanh}'
    else:
        receipt = 'Nhận tại nhà thuốc: 126 Dương Văn An, Phường Vỹ Dạ, TP Huế'
    # Both COD and QR debit on completion, exactly once with order/cart writes.
    # Gateway initialization and IPN only update payment status, never stock.
    deduct_order_stock(required)
    order = orders.create(dict(
        MaNguoiMua=user.MaNguoiDung, MaNhanVien=None, TongTien=original,
        TienGiamGia=original - total, TongThanhToan=total,
        TrangThaiDonHang=1 if data['PhuongThucThanhToan'] == 0 else 0,
        PhuongThucThanhToan=data['PhuongThucThanhToan'], TrangThaiThanhToan=0,
        MoiTruongThanhToan=environment,
        NgayDat=datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None), KenhDatHang=False,
        GhiChu='\n'.join([recipient, receipt, data['GhiChu'].strip()]).rstrip()), details)
    for record in records:
        carts.remove(record)
    result = serialize(order, legacy_payment=False)
    db.session.commit()
    return result


@operation
def read(user_id, order_id):
    if order_id > 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id)
    if order is None or order.MaNguoiMua != user_id:
        raise AuthError('ORDER_NOT_FOUND', 404)
    return serialize(order)


@operation
def read_detail(user_id, order_id):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id)
    if order is None or order.MaNguoiMua != user_id:
        raise AuthError('ORDER_NOT_FOUND', 404)
    result = serialize(order, legacy_payment=False)
    result['NgayDat'] = order.NgayDat.isoformat()
    result['GhiChu'] = order.GhiChu
    result['items'] = [serialize_item(detail, product, unit)
                       for detail, product, unit in orders.detail_items(order_id)]
    return result


def serialize_item(detail, product, unit):
    return dict(
        MaChiTiet=str(detail.MaChiTiet), MaThuoc=detail.MaThuoc, MaDonGia=detail.MaDonGia,
        SoLuong=detail.SoLuong, DonGia=str(detail.DonGia), ThanhTien=str(detail.SoLuong * detail.DonGia),
        TenThuoc=product.TenThuoc if product else 'Sản phẩm không còn trong danh mục',
        HinhAnh=product.HinhAnh if product else None, DonViTinh=unit.DonViTinh if unit else '')


@operation
def list_owned(user_id, status, page, per_page):
    items, total, processing_count, previews = orders.list_owned(user_id, ORDER_FILTERS[status], page, per_page)
    result = []
    for order in items:
        value = serialize(order, legacy_payment=False)
        value['NgayDat'] = order.NgayDat.isoformat()
        lines = (order.GhiChu or '').split('\n')
        receipt = lines[1] if len(lines) > 1 and lines[0].startswith('Người nhận: ') else ''
        value['HinhThucNhanHang'] = ('pickup' if receipt.startswith('Nhận tại nhà thuốc: ') else
                                    'delivery' if receipt.startswith('Giao tận nơi: ') else None)
        preview = previews.get(order.MaDonHang)
        value['item_count'] = preview[0] if preview else 0
        value['preview'] = serialize_item(*preview[1:]) if preview else None
        value['can_pay'] = (order.PhuongThucThanhToan == 1 and order.TrangThaiThanhToan == 0
                            and order.TrangThaiDonHang == 0 and order.MoiTruongThanhToan in ('sandbox', 'production'))
        result.append(value)
    return {'items': result, 'total': total, 'processing_count': processing_count,
            'page': page, 'per_page': per_page, 'status': status}


@operation
def webhook(authorization, data):
    config = payment_config()
    expected = 'Apikey ' + config['SEPAY_WEBHOOK_API_KEY']
    if not secrets.compare_digest(expected.encode(), authorization.encode()):
        raise AuthError('INVALID_WEBHOOK_KEY', 401)
    if not isinstance(data, dict):
        raise AuthError('INVALID_REQUEST', 400)
    if data.get('transferType') != 'in' or data.get('accountNumber') != config['SEPAY_ACCOUNT_NUMBER']:
        return
    # Reject ambiguous contents; never credit two orders from one transfer.
    matches = re.findall(r'(?<![A-Z0-9])LYDH([1-9][0-9]{0,18})(?![A-Z0-9])', str(data.get('content', '')).upper())
    if len(matches) != 1:
        return
    if int(matches[0]) > 9223372036854775807:
        return
    try:
        amount = Decimal(str(data.get('transferAmount')))
        if not amount.is_finite() or amount != amount.to_integral_value() or amount <= 0:
            raise ValueError()
    except (InvalidOperation, ValueError):
        raise AuthError('INVALID_REQUEST', 400) from None
    order = orders.find(int(matches[0]), lock=True)
    if (order is None or order.MoiTruongThanhToan is not None or order.PhuongThucThanhToan != 1 or order.TrangThaiThanhToan != 0
            or order.TrangThaiDonHang != 0 or amount < order.TongThanhToan):
        return
    # Row lock + payment flag make SePay retries idempotent without schema changes.
    order.TrangThaiThanhToan = 1
    order.TrangThaiDonHang = 1
    db.session.commit()
