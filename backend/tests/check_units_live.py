r"""Read-only Flask/PostgreSQL contract checks. No mocks and no data writes.

Uses a test-client signed session for an existing active manager, not OTP login.
Run from backend: .venv\Scripts\python.exe tests/check_units_live.py
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
        # All requests share this scoped session/transaction. Even an accidental
        # write in an exercised GET fails at PostgreSQL rather than modifying data.
        db.session.execute(text('SET TRANSACTION READ ONLY'))
        manager_id = db.session.execute(select(NguoiDung.MaNguoiDung).where(
            NguoiDung.VaiTro == 2, NguoiDung.TrangThai.is_(False)).limit(1)).scalar_one_or_none()
        assert manager_id is not None, 'NO_ACTIVE_MANAGER'
        client = app.test_client()
        base = 'https://localhost'
        with client.session_transaction(base_url=base) as session:
            session['user_id'] = manager_id
            session['csrf_token'] = secrets.token_urlsafe(32)

        def get(path, expected):
            response = client.get(path, base_url=base)
            result = response.get_json()
            assert response.status_code == 200, result.get('code', 'REQUEST_FAILED')
            assert result['code'] == expected
            return result

        products = get('/api/manager/products?page=1&per_page=10', 'PRODUCTS_LISTED')
        checked = details = 0
        for product in products['items']:
            product_id = product['MaThuoc']
            get(f'/api/manager/products/{product_id}', 'PRODUCT_FOUND')
            path = f'/api/manager/products/{product_id}/units'
            listing = get(path + '?page=1&per_page=20', 'UNITS_LISTED')
            for unit in listing['items']:
                assert set(unit) == {'MaDonGia', 'MaThuoc', 'DonViTinh', 'GiaBan', 'SoLuongQuyDoi'}
                assert unit['MaThuoc'] == product_id
                assert type(unit['GiaBan']) is int and 0 <= unit['GiaBan'] <= 2147483647
                assert type(unit['SoLuongQuyDoi']) is int and unit['SoLuongQuyDoi'] > 0
            if listing['items']:
                unit_id = listing['items'][0]['MaDonGia']
                detail = get(f'{path}/{unit_id}', 'UNIT_FOUND')
                assert detail['unit'] == listing['items'][0]
                details += 1
            checked += 1
        anonymous = app.test_client().get('/api/manager/products/1/units', base_url=base)
        assert anonymous.status_code == 401
        denied = client.post('/api/manager/products/1/units', base_url=base)
        assert denied.status_code == 403 and denied.get_json()['code'] == 'CSRF_FAILED'
        db.session.rollback()
        print(f'PASS real Flask/PostgreSQL READ ONLY: {checked} product/unit lists, {details} unit details, anonymous and CSRF guards.')
        if not checked:
            print('SKIP data contracts: no existing products available.')
        print('Not tested: real database create/update/delete persistence, OTP login, browser-to-live-server flow.')


if __name__ == '__main__':
    try:
        check()
    except Exception as error:
        # Never print database URLs, SQL parameters, account data or secrets.
        print(f'FAIL live units check: {type(error).__name__}')
        sys.exit(1)
