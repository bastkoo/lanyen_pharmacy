import json
from datetime import timedelta, timezone

from app.extensions import db
from app.repositories import chat_repository as chats
from app.repositories import gio_thuoc_repository as carts
from app.services.auth_service import AuthError
from app.services.cart_service import operation, require_unit, add_database, get_cart
from app.services.consultation_service import PREFIX, decode
from app.services.inventory_service import usable_stock
from app.services.order_expiry_service import vietnam_now
from app.services.cloudinary_service import upload_image, validate_product_image_url

CHAT_FOLDER = 'lan-yen-pharmacy/chat'


def access(actor, thread_id, lock=False, writing=False):
    if not 0 < thread_id <= 9223372036854775807:
        raise AuthError('CHAT_NOT_FOUND', 404)
    thread = chats.thread(thread_id, lock=lock)
    if thread is None or getattr(thread, 'LoaiHoiThoai', 'DUOC_SI') != 'DUOC_SI':
        raise AuthError('CHAT_NOT_FOUND', 404)
    visible = (actor.VaiTro == 0 and thread.NguoiGui == actor.MaNguoiDung) or (
        actor.VaiTro == 1 and ((thread.TrangThai == 0 and thread.MaNhanVien is None)
        or (thread.TrangThai == 1 and thread.MaNhanVien == actor.MaNguoiDung)))
    if not visible:
        raise AuthError('CHAT_NOT_FOUND', 404)
    if writing and (thread.TrangThai != 1 or thread.MaNhanVien != actor.MaNguoiDung):
        raise AuthError('CHAT_NOT_ASSIGNED', 409)
    return thread


def summary(thread):
    return dict(id=str(thread.MaTinNhan), status=thread.TrangThai,
                assigned=str(thread.MaNhanVien) if thread.MaNhanVien is not None else None)


def serialize(message, role):
    payload = decode(message.NoiDung)
    payload.pop('request_id', None)
    return dict(id=str(message.MaNoiDung), thread_id=str(message.MaTinNhan),
        sender='Dược sĩ' if role == 1 else 'Khách hàng', role=role,
        at=message.ThoiGianGui.replace(tzinfo=timezone(timedelta(hours=7))).isoformat(), read=message.DaDoc, **payload)


@operation
def history(actor, thread_id=None, before=None):
    thread = access(actor, thread_id, lock=True) if actor.VaiTro == 1 else None
    rows = chats.messages(user_id=actor.MaNguoiDung if actor.VaiTro == 0 else None,
                          thread_id=thread_id, before=before)
    return dict(items=[serialize(*row) for row in rows], has_more=len(rows) == 50,
                thread=summary(thread) if thread else None)


@operation
def unread(actor):
    return dict(count=chats.unread(actor.MaNguoiDung))


@operation
def queue(actor, search, page):
    rows, total = chats.queue(actor.MaNguoiDung, search.strip(), page)
    return dict(items=[dict(summary(thread), customer={'HoTen': customer.HoTen, 'SDT': customer.SDT})
                       for thread, customer in rows], total=total, page=page, per_page=20)


@operation
def pending_count():
    return dict(count=chats.pending_count())


@operation
def claim(actor, thread_id, finish=False):
    thread = access(actor, thread_id, lock=True)
    if finish:
        if thread.TrangThai != 1 or thread.MaNhanVien != actor.MaNguoiDung:
            raise AuthError('CHAT_NOT_ASSIGNED', 409)
        thread.TrangThai = 2
    else:
        if thread.MaNhanVien not in (None, actor.MaNguoiDung):
            raise AuthError('CHAT_ALREADY_CLAIMED', 409)
        thread.MaNhanVien = actor.MaNguoiDung; thread.TrangThai = 1
    result = summary(thread)
    db.session.commit()
    return result


def product_cards(items, priced=False):
    details = carts.catalog_details([(line['MaThuoc'], line['MaDonGia'], 1) for line in items])
    result = []
    for line in items:
        record = details.get((line['MaThuoc'], line['MaDonGia']))
        if record is None:
            raise AuthError('UNIT_NOT_FOUND', 404)
        product, unit = record
        result.append(dict(line, TenThuoc=product.TenThuoc, HinhAnh=product.HinhAnh, DonViTinh=unit.DonViTinh))
    if priced:
        validate_stock(items)
        quote = get_cart(entries=[(line['MaThuoc'], line['MaDonGia'], line.get('SoLuong', 1)) for line in items])
        prices = {line['MaDonGia']: line for line in quote['items']}
        for line in result:
            price = prices.get(line['MaDonGia'])
            if price is None or price['GiaBan'] is None:
                raise AuthError('UNIT_UNAVAILABLE', 409)
            if not price['ConHang']:
                raise AuthError('OUT_OF_STOCK', 409)
            line.update(DonGia=str(price['GiaBan']), ThanhTien=str(price['ThanhTien']),
                        SoLuongKhuyenMai=price.get('SoLuongKhuyenMai', 0))
    return result


def validate_stock(items):
    required = {}
    for item in sorted(items, key=lambda line: line['MaDonGia']):
        unit = require_unit(item['MaThuoc'], item['MaDonGia'])
        if unit.SoLuongQuyDoi <= 0:
            raise AuthError('OUT_OF_STOCK', 409)
        required[item['MaThuoc']] = required.get(item['MaThuoc'], 0) + item.get('SoLuong', 1) * unit.SoLuongQuyDoi
    stock = usable_stock(list(required))
    if any(count > stock.get(product_id, 0) for product_id, count in required.items()):
        raise AuthError('OUT_OF_STOCK', 409)


def offer_items(actor, message_id):
    offer = next((message for message in chats.customer_payloads(actor.MaNguoiDung)
                  if message.MaNoiDung == message_id), None)
    if offer is None or decode(offer.NoiDung)['kind'] != 'offer' or not chats.is_staff_message(offer):
        raise AuthError('CHAT_OFFER_NOT_FOUND', 404)
    return decode(offer.NoiDung)['items']


@operation
def quote_offer(actor, message_id, lock_promotions=False):
    items = offer_items(actor, message_id)
    quote = get_cart(entries=[(item['MaThuoc'], item['MaDonGia'], item.get('SoLuong', 1)) for item in items],
                     lock_promotions=lock_promotions)
    validate_stock(items)
    if any(item['GiaBan'] is None or not item['ConHang'] for item in quote['items']):
        raise AuthError('OUT_OF_STOCK', 409)
    return quote


@operation
def send(actor, values, thread_id=None):
    values = dict(values, request_id=str(values['request_id']))
    if (actor.VaiTro == 0 and values['kind'] == 'offer') or (actor.VaiTro == 1 and values['kind'] == 'product'):
        raise AuthError('FORBIDDEN', 403)
    if actor.VaiTro == 0:
        if carts.lock_user(actor.MaNguoiDung) is None:
            raise AuthError('UNAUTHENTICATED', 401)
        # Search completed sessions too: retrying a send after finish must not
        # create a duplicate message or a new consultation.
        previous = chats.customer_payloads(actor.MaNguoiDung)
        thread = None
    else:
        thread = access(actor, thread_id, lock=True, writing=True)
        previous = chats.thread_payloads(thread_id)
    for message in previous:
        payload = decode(message.NoiDung)
        if payload.get('request_id') == values['request_id'] and message.NguoiGui == actor.MaNguoiDung:
            comparable = {key: payload.get(key) for key in values}
            if 'items' in comparable:
                comparable['items'] = [dict(MaThuoc=line['MaThuoc'], MaDonGia=line['MaDonGia'], SoLuong=line.get('SoLuong', 1)) for line in comparable['items']]
            if comparable != values:
                raise AuthError('CHAT_REQUEST_CHANGED', 409)
            return serialize(message, actor.VaiTro)
    payload = dict(values)
    if values['kind'] == 'image':
        validate_product_image_url(values['url'], folder=CHAT_FOLDER)
    if 'items' in values:
        payload['items'] = product_cards(values['items'], priced=values['kind'] == 'offer')
    if thread is None:
        thread = chats.active_customer(actor.MaNguoiDung) or chats.create_thread(actor.MaNguoiDung)
    message = chats.add(thread.MaTinNhan, actor.MaNguoiDung,
        PREFIX + json.dumps(payload, ensure_ascii=False, separators=(',', ':')), vietnam_now(),
        sender_type='DUOC_SI' if actor.VaiTro == 1 else 'KHACH_HANG')
    result = serialize(message, actor.VaiTro)
    db.session.commit()
    return result


@operation
def read(actor, last_id, thread_id=None):
    last_id = int(last_id)
    if last_id > 9223372036854775807:
        raise AuthError('INVALID_REQUEST', 400)
    if actor.VaiTro == 1:
        access(actor, thread_id, lock=True)
    chats.mark_read(actor.MaNguoiDung, last_id, user_id=actor.MaNguoiDung if actor.VaiTro == 0 else None,
                    thread_id=thread_id)
    db.session.commit()


@operation
def upload(actor, file, thread_id=None):
    if actor.VaiTro == 1:
        access(actor, thread_id, writing=True)
    return upload_image(file, CHAT_FOLDER)


@operation
def purchase(actor, message_id):
    # Read only the owner's server-issued offers. The completed thread remains
    # usable, but another customer's message never grants purchase access.
    offer = next((message for message in chats.customer_payloads(actor.MaNguoiDung)
                  if message.MaNoiDung == message_id), None)
    if offer is None or decode(offer.NoiDung)['kind'] != 'offer' or not chats.is_staff_message(offer):
        raise AuthError('CHAT_OFFER_NOT_FOUND', 404)
    items = decode(offer.NoiDung)['items']
    if carts.lock_user(actor.MaNguoiDung) is None:
        raise AuthError('UNAUTHENTICATED', 401)
    product_ids = {item['MaThuoc'] for item in items}
    combined = {(record.MaThuoc, record.MaDonGia): record.SoLuong for record in carts.list_items(actor.MaNguoiDung)
                if record.MaThuoc in product_ids}
    for item in items:
        key = (item['MaThuoc'], item['MaDonGia']); combined[key] = combined.get(key, 0) + item.get('SoLuong', 1)
    required = {}
    for (product_id, unit_id), quantity in sorted(combined.items()):
        unit = require_unit(product_id, unit_id, for_update=True)
        if unit.SoLuongQuyDoi <= 0:
            raise AuthError('OUT_OF_STOCK', 409)
        required[product_id] = required.get(product_id, 0) + quantity * unit.SoLuongQuyDoi
    stock = usable_stock(list(required))
    if any(count > stock.get(product_id, 0) for product_id, count in required.items()):
        raise AuthError('OUT_OF_STOCK', 409)
    # Reprice the proposed units with today's promotions; no price is trusted
    # from the saved card. Checkout will lock and recheck the quote again.
    entries = [(item['MaThuoc'], item['MaDonGia'], item.get('SoLuong', 1)) for item in items]
    quote = get_cart(entries=entries)
    if any(item['GiaBan'] is None or not item['ConHang'] for item in quote['items']):
        raise AuthError('OUT_OF_STOCK', 409)
    add_database(actor.MaNguoiDung, entries, check_stock=True)
    return dict(unit_ids=[item['MaDonGia'] for item in items], total=str(quote['total']))
