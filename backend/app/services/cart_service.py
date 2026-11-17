from functools import wraps

from flask import session
from sqlalchemy.exc import SQLAlchemyError

from app.extensions import db
from app.repositories import gio_thuoc_repository as carts
from app.repositories import don_vi_gia_thuoc_repository as units
from app.services.auth_service import AuthError, current_user

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


def require_unit(product_id, unit_id):
    unit = units.find_by_id(product_id, unit_id)
    if unit is None:
        raise AuthError('UNIT_NOT_FOUND', 404)
    if unit.GiaBan < 0:
        raise AuthError('UNIT_UNAVAILABLE', 409)
    return unit


def add_database(user_id, entries):
    if carts.lock_user(user_id) is None:
        raise AuthError('UNAUTHENTICATED', 401)
    existing = carts.list_items(user_id)
    for product_id, unit_id, quantity in entries:
        require_unit(product_id, unit_id)
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
        add_database(user_id, [(product_id, unit_id, 1)])
    else:
        require_unit(product_id, unit_id)
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
def get_cart():
    user_id = owner()
    entries = ([(item.MaThuoc, item.MaDonGia, item.SoLuong) for item in carts.list_items(user_id)]
               if user_id is not None else guest_items())
    details = carts.catalog_details(entries)
    items = []
    for product_id, unit_id, quantity in entries:
        product, unit = details.get((product_id, unit_id), (None, None))
        available = unit is not None and unit.GiaBan >= 0
        items.append({'MaThuoc': product_id, 'MaDonGia': unit_id, 'SoLuong': quantity,
                      'TenThuoc': product.TenThuoc if product else 'Sản phẩm không còn khả dụng',
                      'DonViTinh': unit.DonViTinh if unit else '',
                      'GiaBan': unit.GiaBan if available else None,
                      'QuyCachDongGoi': product.QuyCachDongGoi if product else '',
                      'ThanhTien': quantity * unit.GiaBan if available else None})
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
