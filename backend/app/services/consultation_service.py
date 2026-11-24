"""Purchase authority comes from employee-issued chat offers, never client data."""
import json

from app.repositories import chat_repository as chats
from app.repositories import gio_thuoc_repository as carts
from app.services.auth_service import AuthError

PREFIX = 'LYCHAT1:'


def decode(text):
    if text.startswith(PREFIX):
        try:
            result = json.loads(text[len(PREFIX):])
            if isinstance(result, dict) and result.get('kind') in ('text', 'image', 'product', 'offer'):
                return result
        except (ValueError, TypeError):
            pass
    return {'kind': 'text', 'text': text}


def require_authorization(user_id, pairs):
    details = carts.catalog_details([(product, unit, 1) for product, unit in pairs])
    restricted = {(product_id, unit_id) for (product_id, unit_id), (product, _) in details.items()
                  if getattr(product, 'PhanLoai', False) is True}
    if not restricted:
        return
    if user_id is None:
        raise AuthError('CONSULTATION_REQUIRED', 409)
    approved = set()
    for message in chats.customer_payloads(user_id):
        payload = decode(message.NoiDung)
        if payload['kind'] == 'offer' and chats.is_staff_message(message):
            approved.update((line['MaThuoc'], line['MaDonGia']) for line in payload['items'])
    if not restricted.issubset(approved):
        raise AuthError('CONSULTATION_REQUIRED', 409)
