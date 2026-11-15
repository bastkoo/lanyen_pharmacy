r"""Read-only real Flask/PostgreSQL promotion contracts; no data writes/mocks.

From backend: .venv\Scripts\python.exe tests/check_promotions_live.py
Test-client signed session for an existing active manager, not an OTP test.
"""
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, text
from app import create_app
from app.extensions import db
from app.models.nguoi_dung import NguoiDung


def check():
    app = create_app()
    with app.app_context():
        db.session.execute(text('SET TRANSACTION READ ONLY'))
        manager = db.session.execute(select(NguoiDung.MaNguoiDung).where(
            NguoiDung.VaiTro == 2, NguoiDung.TrangThai.is_(False)).limit(1)).scalar_one_or_none()
        assert manager is not None, 'NO_ACTIVE_MANAGER'
        client = app.test_client()
        base = 'https://localhost'
        with client.session_transaction(base_url=base) as session:
            session['user_id'] = manager
            session['csrf_token'] = secrets.token_urlsafe(32)

        def get(path, expected):
            response = client.get(path, base_url=base)
            result = response.get_json()
            assert response.status_code == 200 and result['code'] == expected
            return result

        listing = get('/api/manager/promotions?page=1&per_page=100', 'PROMOTIONS_LISTED')
        checked = item_count = 0
        for promotion in listing['items']:
            promotion_id = promotion['MaChuongTrinh']
            detail = get(f'/api/manager/promotions/{promotion_id}', 'PROMOTION_FOUND')
            assert detail['promotion'] == promotion
            items = get(f'/api/manager/promotions/{promotion_id}/items?page=1&per_page=100', 'PROMOTION_ITEMS_LISTED')
            for item in items['items']:
                assert item['MaChuongTrinh'] == promotion_id
                assert set(item) == {'MaChuongTrinh', 'MaThuoc', 'LoaiGiamGia', 'GiaTriGiam', 'SoLuong'}
                assert isinstance(item['GiaTriGiam'], str)
                result = get(f'/api/manager/promotions/{promotion_id}/items/{item["MaThuoc"]}', 'PROMOTION_ITEM_FOUND')
                assert result['item'] == item
                get(f'/api/manager/products/{item["MaThuoc"]}', 'PRODUCT_FOUND')
                item_count += 1
            checked += 1
        get('/api/manager/products?page=1&per_page=20', 'PRODUCTS_LISTED')
        assert app.test_client().get('/api/manager/promotions', base_url=base).status_code == 401
        for path in ('/api/manager/promotions', '/api/manager/promotions/1/items'):
            denied = client.post(path, base_url=base)
            assert denied.status_code == 403 and denied.get_json()['code'] == 'CSRF_FAILED'
        db.session.rollback()
        print(f'PASS real Flask/PostgreSQL READ ONLY: promotion list, {checked} program/item lists, {item_count} item/product details, picker API and session/CSRF guards.')
        if not checked:
            print('SKIP populated promotion contracts: no existing promotions.')
        print('Not tested: live writes including quantity update, OTP, concurrent updates, browser-to-live-server flow.')


if __name__ == '__main__':
    try:
        check()
    except Exception as error:
        print(f'FAIL live promotion check: {type(error).__name__}')
        sys.exit(1)
