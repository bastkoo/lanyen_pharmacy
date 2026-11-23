"""Partial employee returns, using the original order's stock allocations."""
from copy import deepcopy

from app.extensions import db
from app.repositories import don_hang_repository as orders
from app.repositories import gio_thuoc_repository as carts
from app.repositories import lo_thuoc_repository as batches
from app.services import order_service, employee_order_service
from app.services.auth_service import AuthError
from app.services.cart_service import operation
from app.services.order_expiry_service import vietnam_now


def review():
    raise AuthError('ORDER_REFUND_REVIEW_REQUIRED', 409)


def return_state(order, rows):
    data = order.DuLieuHoanTra
    if not order_service.valid_return_data(data) or not rows:
        review()
    if order.TrangThaiDonHang == 5 and (not data.get('returned') or not data.get('returns')):
        review()
    original = data.get('lines')
    totals, counts = {}, {}
    for entry in data['batches']:
        totals[entry['MaThuoc']] = totals.get(entry['MaThuoc'], 0) + entry['SoLuong']
    for line, _, _ in rows:
        counts[line.MaThuoc] = counts.get(line.MaThuoc, 0) + 1
    # Older orders have only aggregate discounts and product batch allocations.
    # A single unit per product permits an exact historical conversion; never
    # guess conversion from today's editable unit catalog for ambiguous orders.
    if original is None and (sum(line.SoLuong * line.DonGia for line, _, _ in rows) != order.TongTien
                             or not 0 <= order.TongThanhToan <= order.TongTien):
        review()
    result, running, previous, required = [], 0, 0, {}
    returned = data.get('returned', {})
    if not isinstance(returned, dict):
        review()
    for line, product, unit in rows:
        if line.SoLuong <= 0:
            review()
        if original is None:
            base = totals.get(line.MaThuoc, 0)
            if counts[line.MaThuoc] != 1 or base <= 0 or base % line.SoLuong:
                review()
            conversion = base // line.SoLuong
            running += line.SoLuong * line.DonGia
            cumulative = running * order.TongThanhToan // order.TongTien if order.TongTien else 0
            amount = cumulative - previous
            previous = cumulative
        else:
            if not isinstance(original, list):
                review()
            matches = [entry for entry in original if isinstance(entry, dict) and entry.get('MaDonGia') == line.MaDonGia]
            if len(matches) != 1:
                review()
            conversion, amount = matches[0].get('conversion'), matches[0].get('amount')
        if type(conversion) is not int or conversion <= 0 or type(amount) is not int or amount < 0:
            review()
        required[line.MaThuoc] = required.get(line.MaThuoc, 0) + line.SoLuong * conversion
        count = returned.get(str(line.MaChiTiet), 0)
        if type(count) is not int or not 0 <= count <= line.SoLuong:
            review()
        item = order_service.serialize_item(line, product, unit)
        item.update(DaTra=count, ConLai=line.SoLuong-count, TienSauGiam=str(amount), conversion=conversion)
        result.append(item)
    if required != totals or sum(int(item['TienSauGiam']) for item in result) != order.TongThanhToan:
        review()
    if set(returned) - {item['MaChiTiet'] for item in result}:
        review()
    return result


def find(order_id, lock=False):
    if not 0 < order_id <= 9223372036854775807:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id, lock=lock)
    if order is None:
        raise AuthError('ORDER_NOT_FOUND', 404)
    if order.TrangThaiDonHang not in (3, 5):
        raise AuthError('ORDER_NOT_RETURNABLE', 409)
    return order


@operation
def detail(order_id):
    order = find(order_id)
    result = employee_order_service.summary(order, orders.customer(order.MaNguoiMua))
    rows = orders.detail_items(order_id)
    try:
        items = return_state(order, rows)
        result['CanReturn'] = True
    except AuthError as error:
        if error.code != 'ORDER_REFUND_REVIEW_REQUIRED':
            raise
        items = [dict(order_service.serialize_item(*row), DaTra=0, ConLai=0) for row in rows]
        result['CanReturn'] = False
    result['items'] = [{key: value for key, value in item.items() if key != 'conversion'} for item in items]
    data = order.DuLieuHoanTra
    result['history'] = data.get('returns', []) if isinstance(data, dict) else []
    return result


@operation
def submit(actor, order_id, MaChiTiet, SoLuong, DaTra, request_id):
    initial = find(order_id)
    if carts.lock_user(initial.MaNguoiMua) is None:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = find(order_id, lock=True)
    data = deepcopy(order.DuLieuHoanTra)
    if not isinstance(data, dict):
        review()
    history = data.get('returns', [])
    if not isinstance(history, list):
        review()
    request_id = str(request_id)
    for receipt in history:
        if receipt['request_id'] == request_id:
            if (receipt['MaChiTiet'], receipt['SoLuong'], receipt['DaTra'], receipt['actor']) != (MaChiTiet, SoLuong, DaTra, actor.MaNguoiDung):
                raise AuthError('RETURN_REQUEST_CONFLICT', 409)
            return dict(order=detail(order_id), receipt=receipt)
    items = return_state(order, orders.detail_items(order_id))
    selected = next((item for item in items if item['MaChiTiet'] == MaChiTiet), None)
    if selected is None:
        raise AuthError('INVALID_REQUEST', 400)
    if selected['DaTra'] != DaTra or SoLuong > selected['ConLai']:
        raise AuthError('RETURN_QUANTITY_CHANGED', 409)
    product_id = selected['MaThuoc']
    already = sum(item['DaTra'] * item['conversion'] for item in items if item['MaThuoc'] == product_id)
    remaining = SoLuong * selected['conversion']
    changes = []
    # Stored allocations retain FIFO export order, which need not be batch-ID order.
    for entry in data['batches']:
        if entry['MaThuoc'] != product_id:
            continue
        skipped = min(already, entry['SoLuong'])
        already -= skipped
        quantity = min(remaining, entry['SoLuong'] - skipped)
        if quantity:
            changes.append((int(entry['MaLo']), quantity))
            remaining -= quantity
    if remaining or already:
        review()
    locked = []
    for batch_id, quantity in sorted(changes):
        batch = batches.find_by_id(product_id, batch_id, for_update=True)
        if batch is None or not 0 < quantity <= batch.SoLuongNhap - batch.SoLuongTon:
            review()
        locked.append((batch, quantity))
    paid, bought = int(selected['TienSauGiam']), selected['SoLuong']
    amount = paid * (DaTra + SoLuong) // bought - paid * DaTra // bought
    receipt = dict(request_id=request_id, MaChiTiet=MaChiTiet, SoLuong=SoLuong, DaTra=DaTra,
                   amount=str(amount), actor=actor.MaNguoiDung, at=vietnam_now().isoformat())
    data['returned'] = {**data.get('returned', {}), MaChiTiet: DaTra + SoLuong}
    data['returns'] = [*history, receipt]
    for batch, quantity in locked:
        batch.SoLuongTon += quantity
    order.DuLieuHoanTra = data
    order.TrangThaiDonHang = 5
    order.MaNhanVien = actor.MaNguoiDung
    result = dict(order=detail(order_id), receipt=receipt)
    db.session.commit()
    return result
