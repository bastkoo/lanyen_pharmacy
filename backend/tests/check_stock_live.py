r"""Read-only real Flask/PostgreSQL checks; no repository mocks or database writes.

From backend: .venv\Scripts\python.exe tests/check_stock_live.py
Uses test-client signed session for an existing active manager; not an OTP test.
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
        manager_id = db.session.execute(select(NguoiDung.MaNguoiDung).where(
            NguoiDung.VaiTro == 2, NguoiDung.TrangThai.is_(False)).limit(1)).scalar_one_or_none()
        assert manager_id is not None, 'NO_ACTIVE_MANAGER'
        client = app.test_client()
        base = 'https://localhost'
        with client.session_transaction(base_url=base) as session:
            session['user_id'] = manager_id
            session['csrf_token'] = secrets.token_urlsafe(32)

        def get(path, code):
            response = client.get(path, base_url=base)
            result = response.get_json()
            assert response.status_code == 200 and result['code'] == code
            return result

        paths = [('/summary', 'INVENTORY_SUMMARY'), ('/low-stock', 'LOW_STOCK_LISTED'),
                 ('/expiring?days=30&status=expiring', 'EXPIRING_BATCHES_LISTED'),
                 ('/expiring?days=0&status=expiring', 'EXPIRING_BATCHES_LISTED'),
                 ('/expiring?status=expired', 'EXPIRED_BATCHES_LISTED')]
        for path, code in paths:
            result = get('/api/manager/inventory' + path, code)
            assert isinstance(result['items'], list)
            assert result['total'] >= 0 and result['page'] == 1
            if path.startswith('/expiring'):
                for item in result['items']:
                    assert item['SoLuongTon'] > 0
                    assert (item['HanSuDung'] < result['as_of']) == (result['status'] == 'expired')
            else:
                for item in result['items']:
                    assert item['TonKhoThap'] == (item['TongSoLuongTon'] <= item['NguongTonKho'])
        products = get('/api/manager/products?page=1&per_page=10', 'PRODUCTS_LISTED')
        detail_count = 0
        for product in products['items']:
            product_id = product['MaThuoc']
            listing = get(f'/api/manager/products/{product_id}/batches', 'BATCHES_LISTED')
            for batch in listing['items']:
                assert batch['MaThuoc'] == product_id
                assert set(batch) == {'MaLo', 'MaThuoc', 'SoLoSanXuat', 'NgaySanXuat', 'HanSuDung', 'SoLuongNhap', 'SoLuongTon', 'GiaNhap'}
            if listing['items']:
                batch_id = listing['items'][0]['MaLo']
                get(f'/api/manager/products/{product_id}/batches/{batch_id}', 'BATCH_FOUND')
                detail_count += 1
        assert app.test_client().get('/api/manager/inventory/summary', base_url=base).status_code == 401
        denied = client.post('/api/manager/products/1/batches', base_url=base)
        assert denied.status_code == 403 and denied.get_json()['code'] == 'CSRF_FAILED'
        db.session.rollback()
        print(f'PASS real Flask/PostgreSQL READ ONLY: 5 inventory queries, {len(products["items"])} product batch lists, {detail_count} batch details; session/CSRF guards.')
        if not products['items']:
            print('SKIP populated data: no existing products available; inventory queries returned empty lists.')
        print('Not tested: live create/update persistence, concurrent locking, OTP, browser-to-live-server flow. DELETE deliberately unsupported by Backend.')


if __name__ == '__main__':
    try:
        check()
    except Exception as error:
        print(f'FAIL live stock check: {type(error).__name__}')
        sys.exit(1)
