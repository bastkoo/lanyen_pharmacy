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
from app.repositories import chi_tiet_khuyen_mai_repository as promotion_items
from app.repositories import diem_thuong_repository as points
from app.repositories import lo_thuoc_repository as batches
from app.services.auth_service import AuthError
from app.services.cart_service import get_cart, operation, require_unit, add_database, check_quantity
from app.services.inventory_service import usable_stock, deduct_order_stock
from app.services.sepay_gateway_service import gateway_config
from app.schemas.order_schema import ORDER_FILTERS
from app.services.points_service import redemption


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
    result['DoiDiem'] = getattr(order, 'DoiDiem', False)
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
def create(user, data, reorder_id=None):
    # Serialize checkout with cart mutations and other orders for this account.
    if carts.lock_user(user.MaNguoiDung) is None:
        raise AuthError('UNAUTHENTICATED', 401)
    environment = gateway_config()['SEPAY_ENV'] if data['PhuongThucThanhToan'] == 1 else None
    records = ([] if reorder_id is not None else
               [item for item in carts.list_items(user.MaNguoiDung) if item.MaDonGia in data['MaDonGia']])
    if reorder_id is None and {item.MaDonGia for item in records} != set(data['MaDonGia']):
        raise AuthError('CART_CHANGED', 409)
    # Lock quotas before pricing: a concurrent checkout must reprice after the
    # previous order commits, rather than both using the same remaining quota.
    quote = (reorder_quote(user.MaNguoiDung, reorder_id, data['MaChiTiet'], lock=True)
             if reorder_id is not None else get_cart(set(data['MaDonGia']), lock_promotions=True))
    if not quote['items'] or any(item['GiaBan'] is None or not item['ConHang'] for item in quote['items']):
        raise AuthError('OUT_OF_STOCK', 409)
    # Multiple units of the same product must fit the combined base-unit stock.
    required = {}
    promotion_required = {}
    details, original = [], 0
    for item in sorted(quote['items'], key=lambda item: item['MaDonGia']):
        unit = require_unit(item['MaThuoc'], item['MaDonGia'], for_update=True)
        if unit.SoLuongQuyDoi <= 0:
            raise AuthError('OUT_OF_STOCK', 409)
        required[item['MaThuoc']] = required.get(item['MaThuoc'], 0) + item['SoLuong'] * unit.SoLuongQuyDoi
        original += item['SoLuong'] * unit.GiaBan
        details.append(dict(MaThuoc=item['MaThuoc'], MaDonGia=item['MaDonGia'],
                            SoLuong=item['SoLuong'], DonGia=unit.GiaBan))
        if item.get('KhuyenMai') and item.get('SoLuongKhuyenMai', 0) > 0:
            key = (item['KhuyenMai']['MaChuongTrinh'], item['MaThuoc'])
            promotion_required[key] = (promotion_required.get(key, 0)
                                       + item['SoLuongKhuyenMai'] * unit.SoLuongQuyDoi)
    stock = usable_stock(list(required))
    if any(count > stock.get(product, 0) for product, count in required.items()):
        raise AuthError('OUT_OF_STOCK', 409)
    total = quote['total']
    redeemed = 0
    if data.get('DoiDiem', False):
        # Account lock above serializes balance checks and debits across orders.
        redeemed, discount = redemption(total, points.balance(user.MaNguoiDung))
        if redeemed <= 0:
            raise AuthError('POINTS_UNAVAILABLE', 409)
        total -= discount
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
    quotas = []
    for (promotion_id, product_id), quantity in sorted(promotion_required.items()):
        detail = promotion_items.find_by_id(promotion_id, product_id, for_update=True)
        if detail is None or detail.SoLuong < quantity:
            raise AuthError('QUOTE_CHANGED', 409)
        quotas.append((detail, quantity))
    # Both COD and QR debit on completion, exactly once with order/cart writes.
    # Gateway initialization and IPN only update payment status, never stock.
    allocations = deduct_order_stock(required)
    for detail, quantity in quotas:
        detail.SoLuong -= quantity
    order = orders.create(dict(
        MaNguoiMua=user.MaNguoiDung, MaNhanVien=None, TongTien=original,
        TienGiamGia=original - total, TongThanhToan=total,
        DoiDiem=redeemed > 0,
        DuLieuHoanTra={'version': 1, 'batches': allocations, 'points': redeemed,
            'promotions': [dict(MaChuongTrinh=promotion_id, MaThuoc=product_id, SoLuong=quantity)
                           for (promotion_id, product_id), quantity in sorted(promotion_required.items())]},
        TrangThaiDonHang=1 if data['PhuongThucThanhToan'] == 0 else 0,
        PhuongThucThanhToan=data['PhuongThucThanhToan'], TrangThaiThanhToan=0,
        MoiTruongThanhToan=environment,
        NgayDat=datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None), KenhDatHang=False,
        GhiChu='\n'.join([recipient, receipt, data['GhiChu'].strip()]).rstrip()), details)
    if redeemed:
        points.debit(user.MaNguoiDung, redeemed, order.MaDonHang, order.NgayDat)
    for record in records:
        carts.remove(record)
    result = serialize(order, legacy_payment=False)
    db.session.commit()
    return result


@operation
def cancel(user_id, order_id, *, expired_before=None, employee_id=None, allowed_states=(0, 1)):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    if carts.lock_user(user_id) is None:
        raise AuthError('UNAUTHENTICATED', 401)
    order = orders.find(order_id, lock=True)
    if order is None or order.MaNguoiMua != user_id:
        raise AuthError('ORDER_NOT_FOUND', 404)
    if order.TrangThaiDonHang not in allowed_states:
        raise AuthError('ORDER_NOT_CANCELLABLE', 409)
    if expired_before is not None and not (order.TrangThaiDonHang == 0 and order.TrangThaiThanhToan == 0
            and order.PhuongThucThanhToan == 1 and order.NgayDat < expired_before):
        raise AuthError('ORDER_NOT_EXPIRED', 409)
    data = order.DuLieuHoanTra
    if not valid_return_data(data) or bool(data['points']) != bool(order.DoiDiem):
        raise AuthError('ORDER_REFUND_REVIEW_REQUIRED', 409)
    # Same lock order as checkout: promotion quota before batch stock.
    quotas, stock = [], []
    for entry in sorted(data['promotions'], key=lambda value: (value['MaChuongTrinh'], value['MaThuoc'])):
        detail = promotion_items.find_by_id(entry['MaChuongTrinh'], entry['MaThuoc'], for_update=True)
        if detail is None or not 0 < entry['SoLuong'] <= 2147483647 - detail.SoLuong:
            raise AuthError('ORDER_REFUND_REVIEW_REQUIRED', 409)
        quotas.append((detail, entry['SoLuong']))
    for entry in sorted(data['batches'], key=lambda value: (value['MaThuoc'], int(value['MaLo']))):
        batch = batches.find_by_id(entry['MaThuoc'], int(entry['MaLo']), for_update=True)
        if batch is None or not 0 < entry['SoLuong'] <= batch.SoLuongNhap - batch.SoLuongTon:
            raise AuthError('ORDER_REFUND_REVIEW_REQUIRED', 409)
        stock.append((batch, entry['SoLuong']))
    for detail, quantity in quotas:
        detail.SoLuong += quantity
    for batch, quantity in stock:
        batch.SoLuongTon += quantity
    if data['points']:
        points.refund(user_id, data['points'], order_id,
                      datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None))
    order.TrangThaiDonHang = 4
    if employee_id is not None:
        order.MaNhanVien = employee_id
    result = serialize(order, legacy_payment=False)
    db.session.commit()
    return result


def valid_return_data(data):
    if (not isinstance(data, dict) or data.get('version') != 1
            or type(data.get('points')) is not int or not 0 <= data['points'] <= 2147483647):
        return False
    for name, keys in (('batches', ('MaThuoc', 'MaLo')), ('promotions', ('MaChuongTrinh', 'MaThuoc'))):
        entries = data.get(name)
        if not isinstance(entries, list) or (name == 'batches' and not entries):
            return False
        seen = set()
        for entry in entries:
            if (not isinstance(entry, dict) or type(entry.get('SoLuong')) is not int
                    or not 0 < entry['SoLuong'] <= 2147483647):
                return False
            ids = []
            for key in keys:
                value = entry.get(key)
                if key == 'MaLo':
                    if not isinstance(value, str) or not re.fullmatch(r'[1-9][0-9]{0,18}', value) or int(value) > 9223372036854775807:
                        return False
                elif type(value) is not int or not 0 < value <= 2147483647:
                    return False
                ids.append(value)
            if tuple(ids) in seen:
                return False
            seen.add(tuple(ids))
    return True


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
    if order.TrangThaiDonHang == 3:
        award = points.order_award(order.MaNguoiMua, order.MaDonHang)
        result['XuDaCong'] = str(award) if award is not None else None
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
    items, total, processing_count, lines = orders.list_owned(user_id, ORDER_FILTERS[status], page, per_page)
    result = []
    for order in items:
        value = serialize(order, legacy_payment=False)
        value['NgayDat'] = order.NgayDat.isoformat()
        receipt_lines = (order.GhiChu or '').split('\n')
        receipt = receipt_lines[1] if len(receipt_lines) > 1 and receipt_lines[0].startswith('Người nhận: ') else ''
        value['HinhThucNhanHang'] = ('pickup' if receipt.startswith('Nhận tại nhà thuốc: ') else
                                    'delivery' if receipt.startswith('Giao tận nơi: ') else None)
        value['items'] = [serialize_item(*line) for line in lines.get(order.MaDonHang, [])]
        value['item_count'] = len(value['items'])
        # Keep the preview field for older clients; the new UI uses all items.
        value['preview'] = value['items'][0] if value['items'] else None
        value['can_pay'] = (order.PhuongThucThanhToan == 1 and order.TrangThaiThanhToan == 0
                            and order.TrangThaiDonHang == 0 and order.MoiTruongThanhToan in ('sandbox', 'production'))
        result.append(value)
    return {'items': result, 'total': total, 'processing_count': processing_count,
            'page': page, 'per_page': per_page, 'status': status}


def reorder_lines(user_id, order_id, lock=False):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id, lock=True) if lock else orders.find(order_id)
    if order is None or order.MaNguoiMua != user_id:
        raise AuthError('ORDER_NOT_FOUND', 404)
    if order.TrangThaiDonHang not in (3, 4):
        raise AuthError('ORDER_NOT_REORDERABLE', 409)
    return orders.detail_items(order_id)


@operation
def reorder_quote(user_id, order_id, selected_ids, lock=False):
    lines = reorder_lines(user_id, order_id, lock=lock)
    selected = set(selected_ids)
    if not selected or not selected.issubset({str(detail.MaChiTiet) for detail, _, _ in lines}):
        raise AuthError('INVALID_REQUEST', 400)
    quantities = {}
    for detail, product, unit in lines:
        if str(detail.MaChiTiet) not in selected:
            continue
        if product is None or unit is None:
            raise AuthError('UNIT_NOT_FOUND', 404)
        key = (detail.MaThuoc, detail.MaDonGia)
        quantities[key] = quantities.get(key, 0) + detail.SoLuong
        check_quantity(quantities[key])
    entries = [(product, unit, quantity) for (product, unit), quantity in sorted(quantities.items())]
    return get_cart(entries=entries, lock_promotions=lock)


@operation
def reorder_options(user_id, order_id):
    lines = reorder_lines(user_id, order_id)
    stock = usable_stock(list({detail.MaThuoc for detail, _, _ in lines})) if lines else {}
    result = []
    for detail, product, unit in lines:
        item = serialize_item(detail, product, unit)
        available = bool(product and unit and unit.GiaBan >= 0 and unit.SoLuongQuyDoi > 0
                         and detail.SoLuong * unit.SoLuongQuyDoi <= stock.get(detail.MaThuoc, 0))
        item.update(GiaBan=str(unit.GiaBan) if unit and unit.GiaBan >= 0 else None, ConHang=available)
        result.append(item)
    return {'MaDonHang': str(order_id), 'items': result}


@operation
def reorder(user_id, order_id, selected_ids):
    # One transaction for all selected lines, using saved quantities, never
    # accepting client prices/quantities or granting access to another owner.
    if carts.lock_user(user_id) is None:
        raise AuthError('UNAUTHENTICATED', 401)
    lines = reorder_lines(user_id, order_id, lock=True)
    selected = set(selected_ids)
    if not selected or not selected.issubset({str(detail.MaChiTiet) for detail, _, _ in lines}):
        raise AuthError('INVALID_REQUEST', 400)
    additions = {}
    for detail, product, unit in lines:
        if str(detail.MaChiTiet) not in selected:
            continue
        if product is None or unit is None:
            raise AuthError('UNIT_NOT_FOUND', 404)
        key = (detail.MaThuoc, detail.MaDonGia)
        additions[key] = additions.get(key, 0) + detail.SoLuong
    products = {product_id for product_id, _ in additions}
    totals = dict(additions)
    for record in carts.list_items(user_id):
        if record.MaThuoc in products:
            key = (record.MaThuoc, record.MaDonGia)
            totals[key] = totals.get(key, 0) + record.SoLuong
    required = {}
    for (product_id, unit_id), quantity in sorted(totals.items()):
        check_quantity(quantity)
        unit = require_unit(product_id, unit_id, for_update=True)
        if unit.SoLuongQuyDoi <= 0:
            raise AuthError('OUT_OF_STOCK', 409)
        required[product_id] = required.get(product_id, 0) + quantity * unit.SoLuongQuyDoi
    stock = usable_stock(list(products))
    if any(quantity > stock.get(product_id, 0) for product_id, quantity in required.items()):
        raise AuthError('OUT_OF_STOCK', 409)
    add_database(user_id, [(product_id, unit_id, quantity)
                           for (product_id, unit_id), quantity in sorted(additions.items())], check_stock=True)
    return {'unit_ids': sorted({unit_id for _, unit_id in additions})}


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
