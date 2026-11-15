r"""Read-only real Flask/PostgreSQL account contract checks; no writes or mocks.

From backend: .venv\Scripts\python.exe tests/check_accounts_live.py
Signed test-client session for an existing active manager, not an OTP login test.
"""
import secrets
import sys
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, text
from app import create_app
from app.extensions import db
from app.models.nguoi_dung import NguoiDung


def check():
    app = create_app()
    with app.app_context():
        db.session.execute(text('SET TRANSACTION READ ONLY'))
        manager = db.session.execute(select(NguoiDung).where(
            NguoiDung.VaiTro == 2, NguoiDung.TrangThai.is_(False)).limit(1)).scalar_one_or_none()
        assert manager is not None, 'NO_ACTIVE_MANAGER'
        client = app.test_client()
        base = 'https://localhost'
        with client.session_transaction(base_url=base) as state:
            state['user_id'] = manager.MaNguoiDung
            state['csrf_token'] = secrets.token_urlsafe(32)

        def get(path, code):
            response = client.get(path, base_url=base)
            result = response.get_json()
            assert response.status_code == 200 and result['code'] == code
            return result

        listing = get('/api/manager/accounts?page=1&per_page=100', 'ACCOUNTS_LISTED')
        for item in listing['items']:
            assert item['VaiTro'] in (1, 2)
            assert set(item) == {'MaNguoiDung', 'HoTen', 'SDT', 'VaiTro', 'TrangThai', 'Email', 'AnhDaiDien'}
        get(f'/api/manager/accounts/{manager.MaNguoiDung}', 'ACCOUNT_FOUND')
        found = get('/api/manager/accounts?' + urlencode({'search': manager.SDT}), 'ACCOUNTS_LISTED')
        assert any(row['MaNguoiDung'] == manager.MaNguoiDung for row in found['items'])
        for role in (1, 2):
            for status in ('true', 'false'):
                result = get(f'/api/manager/accounts?role={role}&status={status}', 'ACCOUNTS_LISTED')
                assert all(row['VaiTro'] == role and row['TrangThai'] == (status == 'true') for row in result['items'])
        customer_id = db.session.execute(select(NguoiDung.MaNguoiDung).where(NguoiDung.VaiTro == 0).limit(1)).scalar_one_or_none()
        if customer_id is not None:
            response = client.get(f'/api/manager/accounts/{customer_id}', base_url=base)
            assert response.status_code == 404 and response.get_json()['code'] == 'ACCOUNT_NOT_FOUND'
        assert app.test_client().get('/api/manager/accounts', base_url=base).status_code == 401
        # CSRF failure happens before service/lock; these requests cannot write.
        for method, path in [('POST', '/api/manager/accounts'), ('PUT', '/api/manager/accounts/1'),
                             ('PATCH', '/api/manager/accounts/1/status')]:
            response = client.open(path, method=method, base_url=base)
            assert response.status_code == 403 and response.get_json()['code'] == 'CSRF_FAILED'
        db.session.rollback()
        print(f'PASS real Flask/PostgreSQL READ ONLY: {len(listing["items"])} internal accounts, list/detail/search, role/status filters, customer scope and session/CSRF guards.')
        if customer_id is None:
            print('SKIP real customer detail scope: no customer row available.')
        print('Not tested: live create/update/lock writes, PostgreSQL concurrent locking, OTP/SMS or browser flow.')


if __name__ == '__main__':
    try:
        check()
    except Exception as error:
        # No account PII, SQL, credentials or tokens in test logs.
        print(f'FAIL live account check: {type(error).__name__}')
        sys.exit(1)
