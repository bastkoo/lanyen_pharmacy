from functools import wraps

from flask import session
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.repositories import gio_thuoc_repository as carts
from app.repositories import don_vi_gia_thuoc_repository as units
from app.services.auth_service import AuthError, current_user
from app.services.inventory_service import usable_stock
from app.services.inventory_service import current_date
from app.repositories import chi_tiet_khuyen_mai_repository as promotion_items
from app.services.sale_pricing import cart_prices

MAX_QUANTITY = 2147483647
# Bound the signed session cookie; only identifiers and quantities are stored.
MAX_GUEST_ITEMS = 50


def operation(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except AuthError:
            db.session.rollback()
            raise
        except SQLAlchemyError:
            db.session.rollback()
            raise AuthError('DATABASE_UNAVAILABLE', 503) from None
    return wrapped


def owner():
    user_id = session.get('user_id')
    return current_user(user_id).MaNguoiDung if user_id is not None else None


def guest_items():
    return [list(item) for item in session.get('guest_cart', [])]


def check_quantity(quantity):
    if not 1 <= quantity <= MAX_QUANTITY:
        raise AuthError('CART_QUANTITY_LIMIT', 409)


def require_unit(product_id, unit_id, check_stock=False, for_update=False):
    unit = (units.find_by_id(product_id, unit_id, for_update=True) if for_update
            else units.find_by_id(product_id, unit_id))
    if unit is None:
        raise AuthError('UNIT_NOT_FOUND', 404)
    if unit.GiaBan < 0:
        raise AuthError('UNIT_UNAVAILABLE', 409)
    if check_stock and (unit.SoLuongQuyDoi <= 0 or
                        usable_stock([product_id]).get(product_id, 0) < unit.SoLuongQuyDoi):
        raise AuthError('OUT_OF_STOCK', 409)
    return unit


def add_database(user_id, entries, check_stock=False):
    if carts.lock_user(user_id) is None:
        raise AuthError('UNAUTHENTICATED', 401)
    existing = carts.list_items(user_id)
    for product_id, unit_id, quantity in entries:
        require_unit(product_id, unit_id, check_stock=check_stock)
        matches = [item for item in existing if (item.MaThuoc, item.MaDonGia) == (product_id, unit_id)]
        total = quantity + sum(item.SoLuong for item in matches)
        check_quantity(total)
        if matches:
            matches[0].SoLuong = total
            for duplicate in matches[1:]:
                carts.remove(duplicate)
                existing.remove(duplicate)
        else:
            existing.append(carts.create(user_id, product_id, unit_id, quantity))
    db.session.commit()


@operation
def merge_guest(user_id):
    entries = guest_items()
    if entries:
        add_database(user_id, entries)
        # Clear only after the database transaction succeeds.
        session.pop('guest_cart', None)


@operation
def add_item(product_id, unit_id):
    user_id = owner()
    if user_id is not None:
        add_database(user_id, [(product_id, unit_id, 1)], check_stock=True)
    else:
        require_unit(product_id, unit_id, check_stock=True)
        entries = guest_items()
        match = next((item for item in entries if item[:2] == [product_id, unit_id]), None)
        if match:
            check_quantity(match[2] + 1)
            match[2] += 1
        else:
            if len(entries) >= MAX_GUEST_ITEMS:
                raise AuthError('GUEST_CART_FULL', 409)
            entries.append([product_id, unit_id, 1])
        session['guest_cart'] = entries
    return {'code': 'CART_ITEM_ADDED'}


@operation
def get_cart(selected_ids=None, lock_promotions=False):
    user_id = owner()
    entries = ([(item.MaThuoc, item.MaDonGia, item.SoLuong) for item in carts.list_items(user_id)]
               if user_id is not None else guest_items())
    if selected_ids is not None:
        entries = [entry for entry in entries if entry[1] in selected_ids]
    details = carts.catalog_details(entries)
    product_ids = list({entry[0] for entry in entries})
    all_units = units.public_units(product_ids) if entries else []
    stock = usable_stock(product_ids) if entries else {}
    programs = (promotion_items.active_for_products(product_ids, current_date(), for_update=True)
                if lock_promotions else promotion_items.active_for_products(product_ids, current_date())) if entries else []
    prices = cart_prices(entries, details, all_units, programs) if entries else []
    items = []
    for (product_id, unit_id, quantity), pricing in zip(entries, prices):
        product, unit = details.get((product_id, unit_id), (None, None))
        available = unit is not None and unit.GiaBan >= 0
        items.append({'MaThuoc': product_id, 'MaDonGia': unit_id, 'SoLuong': quantity,
                      'TenThuoc': product.TenThuoc if product else 'Sản phẩm không còn khả dụng',
                      'DonViTinh': unit.DonViTinh if unit else '',
                      'GiaBan': unit.GiaBan if available else None,
                      'HinhAnh': getattr(product, 'HinhAnh', None),
                      'ConHang': bool(available and unit.SoLuongQuyDoi > 0 and quantity * unit.SoLuongQuyDoi <= stock.get(product_id, 0)),
                      'DonViGia': [{'MaDonGia': option.MaDonGia, 'DonViTinh': option.DonViTinh,
                                    'GiaBan': option.GiaBan,
                                    'ConHang': option.SoLuongQuyDoi > 0 and option.SoLuongQuyDoi <= stock.get(product_id, 0)}
                                   for option in all_units if option.MaThuoc == product_id and option.GiaBan >= 0],
                      'QuyCachDongGoi': product.QuyCachDongGoi if product else '',
                      'ThanhTien': quantity * unit.GiaBan if available else None})
        if pricing and pricing['KhuyenMai']:
            items[-1].update(pricing, GiaGoc=unit.GiaBan)
    return {'code': 'CART_LISTED', 'items': items, 'authenticated': user_id is not None,
            'total_quantity': sum(item['SoLuong'] for item in items),
            'total': sum(item['ThanhTien'] or 0 for item in items)}


@operation
def remove_item(unit_id):
    user_id = owner()
    if user_id is not None:
        if carts.lock_user(user_id) is None:
            raise AuthError('UNAUTHENTICATED', 401)
        for item in carts.list_items(user_id):
            if item.MaDonGia == unit_id:
                carts.remove(item)
        db.session.commit()
    else:
        session['guest_cart'] = [item for item in guest_items() if item[1] != unit_id]
    return {'code': 'CART_ITEM_REMOVED'}


@operation
def update_item(unit_id, destination_id, quantity):
    check_quantity(quantity)
    user_id = owner()
    if user_id is not None:
        if carts.lock_user(user_id) is None:
            raise AuthError('UNAUTHENTICATED', 401)
        records = carts.list_items(user_id)
        source = next((item for item in records if item.MaDonGia == unit_id), None)
        entries = [(item.MaThuoc, item.MaDonGia, item.SoLuong) for item in records]
    else:
        entries = guest_items()
        source = next((item for item in entries if item[1] == unit_id), None)
    if source is None:
        raise AuthError('CART_ITEM_NOT_FOUND', 404)
    product_id = source.MaThuoc if user_id is not None else source[0]
    unit = require_unit(product_id, destination_id)
    total = quantity + sum(count for product, existing_id, count in entries
                           if product == product_id and existing_id == destination_id and existing_id != unit_id)
    check_quantity(total)
    if unit.SoLuongQuyDoi <= 0 or total * unit.SoLuongQuyDoi > usable_stock([product_id]).get(product_id, 0):
        raise AuthError('OUT_OF_STOCK', 409)
    if user_id is None:
        result = []
        for entry in entries:
            if entry is source:
                result.append([product_id, destination_id, total])
            elif entry[0] != product_id or entry[1] != destination_id:
                result.append(entry)
        session['guest_cart'] = result
    else:
        for record in records:
            if record is not source and record.MaThuoc == product_id and record.MaDonGia in (unit_id, destination_id):
                carts.remove(record)
        source.MaDonGia = destination_id
        source.SoLuong = total
        db.session.commit()
    return {'code': 'CART_ITEM_UPDATED'}
