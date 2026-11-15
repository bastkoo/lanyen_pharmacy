r"""Opt-in live checks: real Flask + read-only PostgreSQL, optional Cloudinary upload.

No repository/provider mocks. This script never creates a user, bypasses a route
guard, writes database rows, or deletes Cloudinary assets. The Flask test client
gets a test-only signed session for an existing active manager (not an OTP test).
Run from backend with: .venv\Scripts\python.exe tests/check_products_live.py --upload
The upload flag intentionally creates ONE labelled QA image in Cloudinary.
"""
import argparse
import io
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageDraw
from sqlalchemy import select, text

from app import create_app
from app.extensions import db
from app.models.nguoi_dung import NguoiDung
from app.services.cloudinary_service import validate_product_image_url


def check():
    parser = argparse.ArgumentParser()
    parser.add_argument('--upload', action='store_true')
    args = parser.parse_args()
    app = create_app()
    with app.app_context():
        db.session.execute(text('SET TRANSACTION READ ONLY'))
        manager = db.session.execute(select(NguoiDung.MaNguoiDung).where(
            NguoiDung.VaiTro == 2, NguoiDung.TrangThai.is_(False)).limit(1)).scalar_one_or_none()
        assert manager is not None, 'NO_ACTIVE_MANAGER'
        client = app.test_client()
        base = 'https://localhost'
        token = secrets.token_urlsafe(32)
        with client.session_transaction(base_url=base) as session:
            session['user_id'] = manager
            session['csrf_token'] = token
        headers = {'X-CSRF-Token': token}

        def get(path):
            response = client.get(path, base_url=base)
            assert response.status_code == 200, response.get_json().get('code', 'REQUEST_FAILED')
            return response.get_json()

        categories = get('/api/manager/categories?page=1&per_page=100')
        products = get('/api/manager/products?page=1&per_page=10&sort_by=TenThuoc&sort_order=asc')
        assert categories['code'] == 'CATEGORIES_LISTED'
        assert products['code'] == 'PRODUCTS_LISTED'
        get('/api/manager/products?search=integration-check&phan_loai=false&page=1&per_page=10')
        if categories['items']:
            get('/api/manager/products?category_id=' + str(categories['items'][0]['MaLoaiThuoc']))
        if products['items']:
            detail = get('/api/manager/products/' + str(products['items'][0]['MaThuoc']))
            assert detail['product']['MaThuoc'] == products['items'][0]['MaThuoc']
            print('PASS real PostgreSQL product detail')
        else:
            print('SKIP real detail: database has no products')
        anonymous = app.test_client().get('/api/manager/products', base_url=base)
        assert anonymous.status_code == 401
        denied = client.post('/api/manager/uploads/products', base_url=base)
        assert denied.status_code == 403 and denied.get_json()['code'] == 'CSRF_FAILED'
        print('PASS real Flask/PostgreSQL: session guards, list, category/filter/search/sort/page, upload CSRF')

        if args.upload:
            image = Image.new('RGB', (480, 320), (232, 245, 238))
            ImageDraw.Draw(image).text((32, 130), 'LAN YEN PHARMACY - INTEGRATION QA', fill=(16, 107, 72))
            stream = io.BytesIO(); image.save(stream, format='PNG'); stream.seek(0)
            response = client.post('/api/manager/uploads/products', base_url=base, headers=headers,
                                   data={'image': (stream, 'integration-qa.png', 'image/png')})
            result = response.get_json()
            assert response.status_code == 200, result.get('code', 'UPLOAD_FAILED')
            assert result['code'] == 'UPLOAD_SUCCESS'
            validate_product_image_url(result['data']['url'])
            print('PASS real Cloudinary: Flask multipart upload and provider resource verification')
            print('QA asset retained (no deletion): ' + result['data']['public_id'])
        db.session.rollback()
        print('PostgreSQL transaction was READ ONLY; no rows/schema/migrations changed. OTP login and live CRUD writes were not exercised.')


if __name__ == '__main__':
    try:
        check()
    except Exception as error:
        # Avoid printing URLs, credentials or raw provider/database exception text.
        safe = str(error) if isinstance(error, AssertionError) else type(error).__name__
        print('Live check failed: ' + safe)
        raise SystemExit(1) from None
