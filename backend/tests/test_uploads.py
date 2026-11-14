"""Real image validation, mock Cloudinary and PostgreSQL; no credits or live data."""
import unittest
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from cloudinary.exceptions import Error, NotFound
from PIL import Image
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.datastructures import MultiDict

from app import create_app
from app.services.cloudinary_service import validate_product_image_url
from app.utils.image_validator import ImageError
from app.utils.image_validator import MAX_IMAGE_BYTES
from test_products import valid_data


UPLOAD = '/api/manager/uploads/products'
PRODUCTS = '/api/manager/products'
PUBLIC_ID = 'lan-yen-pharmacy/products/' + 'a' * 32
URL = 'https://res.cloudinary.com/test-cloud/image/upload/v123/' + PUBLIC_ID + '.png'


def image_bytes(format='PNG'):
    stream = BytesIO()
    Image.new('RGB', (4, 4), (30, 150, 80)).save(stream, format=format)
    return stream.getvalue()


def resource(url=URL, public_id=PUBLIC_ID):
    return dict(secure_url=url, public_id=public_id, resource_type='image', type='upload', format='png')


class UploadTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            'TESTING': True, 'SECRET_KEY': 'upload-test-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development',
            'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': ['https://shop.example'],
            'CLOUDINARY_CLOUD_NAME': 'test-cloud', 'CLOUDINARY_API_KEY': 'test-key',
            'CLOUDINARY_API_SECRET': 'test-private-secret',
        })
        self.start_patch('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.start_patch('cloudinary.uploader._http.request', side_effect=AssertionError('Cloudinary network forbidden'))
        self.start_patch('cloudinary.api_client.call_api._http.request', side_effect=AssertionError('Cloudinary network forbidden'))
        self.upload = self.start_patch('cloudinary.uploader.upload', return_value=resource())
        self.resource = self.start_patch('cloudinary.api.resource', return_value=resource())
        self.destroy = self.start_patch('cloudinary.uploader.destroy', side_effect=AssertionError('Deletion forbidden'))
        self.start_patch('app.services.cloudinary_service.uuid.uuid4', return_value=SimpleNamespace(hex='a' * 32))
        self.user = SimpleNamespace(MaNguoiDung=12, VaiTro=2, TrangThai=False)
        self.find_user = self.start_patch('app.repositories.nguoi_dung_repository.find_by_id', return_value=self.user)
        self.client = self.app.test_client()
        self.token = 'upload-test-csrf'
        self.login()

    def start_patch(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def login(self):
        with self.client.session_transaction() as state:
            state['user_id'] = 12
            state['csrf_token'] = self.token

    def send(self, content=None, mime='image/png', filename='client.png', **kwargs):
        kwargs.setdefault('headers', {'X-CSRF-Token': self.token})
        data = kwargs.pop('data', None)
        if data is None:
            data = {'image': (BytesIO(image_bytes() if content is None else content), filename, mime)}
        return self.client.post(UPLOAD, data=data, **kwargs)


class UploadTests(UploadTestCase):
    def test_jpeg_png_webp_upload(self):
        for format, mime, extension in (('JPEG', 'image/jpeg', 'jpg'), ('PNG', 'image/png', 'png'),
                                         ('WEBP', 'image/webp', 'webp')):
            with self.subTest(format=format):
                url = URL.rsplit('.', 1)[0] + '.' + extension
                self.upload.return_value = dict(resource(url), format=extension)
                response = self.send(image_bytes(format), mime, filename='../../untrusted.svg')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json, {'code': 'UPLOAD_SUCCESS', 'data': {'url': url, 'public_id': PUBLIC_ID}})
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                self.assertNotIn('test-private-secret', response.get_data(as_text=True))

    def test_upload_options_server_controlled_and_signed(self):
        self.assertEqual(self.send().status_code, 200)
        options = self.upload.call_args.kwargs
        self.assertEqual(options['folder'], 'lan-yen-pharmacy/products')
        self.assertEqual(options['public_id'], 'a' * 32)
        self.assertIs(options['overwrite'], False)
        self.assertIs(options['use_filename'], False)
        self.assertIs(options['secure'], True)
        self.assertEqual(options['upload_prefix'], 'https://api.cloudinary.com')
        self.assertNotIn('upload_preset', options)
        self.assertNotIn('unsigned', options)
        self.destroy.assert_not_called()

    def test_missing_file(self):
        self.assertEqual(self.send(data={}).status_code, 400)
        self.upload.assert_not_called()

    def test_empty_file(self):
        self.assertEqual(self.send(b'').status_code, 400)
        self.upload.assert_not_called()

    def test_file_over_limit(self):
        self.assertEqual(self.send(b'x' * (MAX_IMAGE_BYTES + 1)).status_code, 413)
        self.upload.assert_not_called()

    def test_exact_file_limit_and_multipart_overhead(self):
        data = image_bytes()
        data += b'\x00' * (MAX_IMAGE_BYTES - len(data))
        self.assertEqual(self.send(data).status_code, 200)

    def test_request_body_limit_json_error(self):
        response = self.send(b'x' * (MAX_IMAGE_BYTES + 65536))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json['code'], 'IMAGE_TOO_LARGE')

    def test_spoofed_mime(self):
        response = self.send(image_bytes('JPEG'), 'image/png')
        self.assertEqual((response.status_code, response.json['code']), (400, 'IMAGE_MIME_MISMATCH'))
        self.upload.assert_not_called()

    def test_non_image_and_corrupt_image(self):
        for data in (b'not an image', b'<script>alert(1)</script>', image_bytes()[:25]):
            self.assertEqual(self.send(data).status_code, 400)
        self.upload.assert_not_called()

    def test_unsupported_formats(self):
        for data, mime in ((image_bytes('GIF'), 'image/gif'), (b'<svg/>', 'image/svg+xml'),
                           (image_bytes('BMP'), 'image/bmp')):
            self.assertEqual(self.send(data, mime).status_code, 415)
        self.assertEqual(self.send(image_bytes('GIF'), 'image/png').status_code, 415)
        self.upload.assert_not_called()

    def test_decompression_bomb_rejected(self):
        with patch.object(Image, 'MAX_IMAGE_PIXELS', 4):
            self.assertEqual(self.send().status_code, 400)
        self.upload.assert_not_called()

    def test_unknown_fields_duplicate_files_and_override_attempts(self):
        for key in ('folder', 'public_id', 'overwrite', 'url', 'unsigned'):
            data = {'image': (BytesIO(image_bytes()), 'a.png', 'image/png'), key: 'malicious'}
            self.assertEqual(self.send(data=data).status_code, 400)
        data = MultiDict([('image', (BytesIO(image_bytes()), 'a.png', 'image/png')),
                          ('image', (BytesIO(image_bytes()), 'b.png', 'image/png'))])
        self.assertEqual(self.send(data=data).status_code, 400)
        self.upload.assert_not_called()

    def test_anonymous(self):
        with self.client.session_transaction() as state:
            state.pop('user_id')
        self.assertEqual(self.send().status_code, 401)
        self.upload.assert_not_called()

    def test_roles_and_locked_account(self):
        for role in (0, 1, 99):
            self.user.VaiTro = role
            self.assertEqual(self.send().status_code, 403)
        self.user.VaiTro = 2
        self.user.TrangThai = True
        self.assertEqual(self.send().json['code'], 'ACCOUNT_LOCKED')
        self.assertEqual(self.send().status_code, 401)
        self.upload.assert_not_called()

    def test_csrf_and_origin(self):
        for headers in ({}, {'X-CSRF-Token': 'wrong'},
                        {'X-CSRF-Token': self.token, 'Origin': 'https://evil.example'}):
            self.assertEqual(self.send(headers=headers).status_code, 403)
        self.upload.assert_not_called()

    def test_missing_configuration(self):
        for field in ('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'):
            with patch.dict(self.app.config, {field: ''}):
                response = self.send()
                self.assertEqual((response.status_code, response.json['code']), (503, 'CLOUDINARY_NOT_CONFIGURED'))
        self.upload.assert_not_called()

    def test_provider_failure_safe(self):
        self.upload.side_effect = Error('test-private-secret internal traceback')
        response = self.send()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('test-private-secret', response.get_data(as_text=True))

    def test_unexpected_failure_safe(self):
        self.upload.side_effect = RuntimeError('test-private-secret')
        with patch.object(self.app.logger, 'error') as logger:
            response = self.send()
            self.assertEqual(response.status_code, 500)
            self.assertNotIn('test-private-secret', str(logger.call_args))
            self.assertNotIn('test-private-secret', response.get_data(as_text=True))

    def test_malformed_provider_response(self):
        for response in (None, {}, resource('http://example.com/a.png'),
                         resource(public_id='wrong'), dict(resource(), type='private'), resource(url=[])):
            self.upload.return_value = response
            self.assertEqual(self.send().status_code, 502)

    def test_no_arbitrary_delete_endpoint(self):
        for path in (UPLOAD, '/api/manager/uploads/products/arbitrary-id'):
            response = self.client.delete(path, json={'public_id': PUBLIC_ID}, headers={'X-CSRF-Token': self.token})
            self.assertIn(response.status_code, (404, 405))
        self.destroy.assert_not_called()


class ProductImageIntegrationTests(UploadTestCase):
    def setUp(self):
        super().setUp()
        self.product = SimpleNamespace(MaThuoc=3, PhanLoai=False, **valid_data())
        self.find_product = self.start_patch('app.repositories.thuoc_repository.find_by_id', return_value=self.product)
        self.start_patch('app.repositories.loai_thuoc_repository.find_by_id', return_value=SimpleNamespace(MaLoaiThuoc=2))
        self.update = self.start_patch('app.repositories.thuoc_repository.update', return_value=self.product)
        self.create = self.start_patch('app.repositories.thuoc_repository.create', return_value=self.product)
        self.commit = self.start_patch('app.repositories.thuoc_repository.commit')
        self.rollback = self.start_patch('app.repositories.thuoc_repository.rollback')

    def put(self, url):
        return self.client.put(PRODUCTS + '/3', json=dict(valid_data(), HinhAnh=url),
                               headers={'X-CSRF-Token': self.token})

    def test_new_cloudinary_url_verified_before_update(self):
        self.assertEqual(self.put(URL).status_code, 200)
        self.resource.assert_called_once()
        self.assertEqual(self.resource.call_args.args[0], PUBLIC_ID)
        self.assertEqual(self.resource.call_args.kwargs['cloud_name'], 'test-cloud')
        self.update.assert_called_once()
        self.commit.assert_called_once()
        self.destroy.assert_not_called()

    def test_invalid_idna_hostname_safe(self):
        with self.app.app_context(), self.assertRaises(ImageError) as raised:
            validate_product_image_url('https://' + 'a' * 64 + '.example.com/image.png')
        self.assertEqual(raised.exception.status, 400)
        self.resource.assert_not_called()

    def test_create_with_verified_url(self):
        response = self.client.post(PRODUCTS, json=dict(valid_data(), HinhAnh=URL),
                                    headers={'X-CSRF-Token': self.token})
        self.assertEqual(response.status_code, 201)
        self.resource.assert_called_once()
        self.create.assert_called_once()

    def test_wrong_cloud_folder_transformed_and_encoded_urls(self):
        for url in (URL.replace('test-cloud', 'other-cloud'), URL.replace('/products/', '/avatars/'),
                    URL.replace('/v123/', '/c_fill/v123/'), URL + '?x=1', URL + '#fragment',
                    URL.replace('/products/', '/products-evil/'), URL.replace('products/', 'products/%2e%2e/'),
                    URL.replace('res.cloudinary.com', 'custom.cloudinary.com'),
                    URL.replace('res.cloudinary.com', 'res.cloudinary.com.')):
            with self.subTest(url=url):
                self.assertEqual(self.put(url).status_code, 400)
        self.resource.assert_not_called()
        self.update.assert_not_called()

    def test_resource_missing_or_url_not_exact(self):
        self.resource.side_effect = NotFound('private')
        self.assertEqual(self.put(URL).status_code, 400)
        self.resource.side_effect = None
        self.resource.return_value = resource(URL.replace('v123', 'v124'))
        self.assertEqual(self.put(URL).status_code, 400)
        self.update.assert_not_called()

    def test_provider_lookup_failure(self):
        for error, expected in ((Error('private'), 503), (RuntimeError('private'), 502)):
            self.resource.side_effect = error
            response = self.put(URL)
            self.assertEqual(response.status_code, expected)
            self.assertNotIn('private', response.get_data(as_text=True))
        self.update.assert_not_called()

    def test_legacy_url_unchanged_and_external_url_preserved(self):
        self.product.HinhAnh = URL.replace('test-cloud', 'legacy-cloud')
        with patch.dict(self.app.config, CLOUDINARY_API_SECRET=''):
            self.assertEqual(self.put(self.product.HinhAnh).status_code, 200)
            self.assertEqual(self.put('https://external.example.com/new.jpg').status_code, 200)
        self.resource.assert_not_called()
        self.destroy.assert_not_called()

    def test_database_failure_never_deletes_old_or_new_images(self):
        self.commit.side_effect = SQLAlchemyError('private')
        response = self.put(URL)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.get_data(as_text=True))
        self.rollback.assert_called_once()
        self.destroy.assert_not_called()

    def test_delete_product_does_not_delete_cloudinary_image(self):
        self.start_patch('app.repositories.thuoc_repository.has_references', return_value=False)
        remove = self.start_patch('app.repositories.thuoc_repository.remove')
        response = self.client.delete(PRODUCTS + '/3', headers={'X-CSRF-Token': self.token})
        self.assertEqual(response.status_code, 200)
        remove.assert_called_once_with(3)
        self.destroy.assert_not_called()


if __name__ == '__main__':
    unittest.main()
