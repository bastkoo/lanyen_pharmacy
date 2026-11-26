"""Gộp giỏ khách có biên nhận Redis, không thay schema hoặc giỏ session Web."""
import hashlib
import json
import time

from redis import RedisError

from app.services import cart_service, otp_service
from app.services.otp_service import AuthError

MAX_AGE = 7 * 24 * 60 * 60


def merge(owner_id, data):
    # Biên nhận sống lâu hơn cửa sổ nhận yêu cầu: retry cũ không thể cộng lần hai.
    age = int(time.time()) - data['created_at']
    if age < -300 or age > MAX_AGE:
        raise AuthError('CART_MERGE_EXPIRED', 409)
    fingerprint = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    key = f'mobile:cart-merge:{owner_id}:{data["merge_id"]}'
    cache = otp_service.store()
    pending, done = 'pending:' + fingerprint, 'done:' + fingerprint
    try:
        if not cache.set(key, pending, nx=True, ex=MAX_AGE + 3600):
            previous = cache.get(key)
            if isinstance(previous, bytes):
                previous = previous.decode()
            if previous == done:
                return {'code': 'CART_MERGED'}
            raise AuthError('CART_MERGE_PENDING', 409)
    except RedisError:
        raise AuthError('CART_SYNC_UNAVAILABLE', 503) from None
    try:
        # Một transaction cho cả giỏ, cộng theo sản phẩm + đơn vị như Web.
        cart_service.add_database(owner_id, [
            (item['MaThuoc'], item['MaDonGia'], item['SoLuong']) for item in data['items']
        ], check_stock=True)
    except AuthError:
        # Lỗi nghiệp vụ xảy ra trước commit: rollback rồi mới cho phép thử lại.
        cart_service.db.session.rollback()
        try:
            cache.delete(key)
        except RedisError:
            raise AuthError('CART_MERGE_PENDING', 409) from None
        raise
    try:
        cache.set(key, done, ex=MAX_AGE + 3600)
    except RedisError:
        # DB có thể đã commit: giữ pending và giỏ cục bộ để đối chiếu, không cộng lại.
        raise AuthError('CART_MERGE_PENDING', 409) from None
    return {'code': 'CART_MERGED'}
