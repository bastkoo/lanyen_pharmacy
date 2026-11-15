r"""Read-only MaVach metadata/API checks against real PostgreSQL, without mocks.

From backend: .venv\Scripts\python.exe tests/check_barcode_live.py
Uses test-client signed session for an existing active manager, not an OTP test.
"""
import secrets
import sys
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect, select, text
from app import create_app
from app.extensions import db
from app.models.nguoi_dung import NguoiDung
from app.models.thuoc import Thuoc


def check():
    app = create_app()
    with app.app_context():
        db.session.execute(text('SET TRANSACTION READ ONLY'))
        inspector = inspect(db.session.connection())
        column = next(value for value in inspector.get_columns('Thuoc') if value['name'] == 'MaVach')
        assert column['type'].length == Thuoc.__table__.c.MaVach.type.length == 255
        assert column['nullable'] is False and column['default'] is None
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

        products = get('/api/manager/products?page=1&per_page=20&sort_by=MaVach', 'PRODUCTS_LISTED')
        for product in products['items']:
            assert isinstance(product['MaVach'], str)
            detail = get(f'/api/manager/products/{product["MaThuoc"]}', 'PRODUCT_FOUND')
            assert detail['product']['MaVach'] == product['MaVach']
        if products['items']:
            query = urlencode({'search': products['items'][0]['MaVach'], 'per_page': 100})
            result = get('/api/manager/products?' + query, 'PRODUCTS_LISTED')
            assert any(row['MaThuoc'] == products['items'][0]['MaThuoc'] for row in result['items'])
        inventory_count = 0
        for suffix, code in [('summary', 'INVENTORY_SUMMARY'), ('low-stock', 'LOW_STOCK_LISTED'),
                             ('expiring?status=expiring', 'EXPIRING_BATCHES_LISTED'),
                             ('expiring?status=expired', 'EXPIRED_BATCHES_LISTED')]:
            result = get('/api/manager/inventory/' + suffix, code)
            for row in result['items']:
                assert isinstance(row['MaVach'], str)
                inventory_count += 1
        db.session.rollback()
        print(f'PASS real PostgreSQL READ ONLY: MaVach metadata/model match, product sort/list/detail, 4 inventory queries; {len(products["items"])} product rows, {inventory_count} inventory rows checked.')
        if not products['items']:
            print('SKIP populated barcode roundtrip/search: database has no products.')
        print('Not tested: live create/update writes, OTP and browser-to-live-server flow.')


if __name__ == '__main__':
    try:
        check()
    except Exception as error:
        print(f'FAIL barcode check: {type(error).__name__}')
        sys.exit(1)
