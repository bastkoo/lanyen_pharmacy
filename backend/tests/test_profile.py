"""Own-profile writes and avatar validation; isolated DB/provider mocks only."""
import unittest
from io import BytesIO
from types import SimpleNamespace as NS
from unittest.mock import patch

from PIL import Image
from cloudinary.exceptions import Error
from sqlalchemy.exc import SQLAlchemyError

from app import create_app


AVATAR_ID = 'lan-yen-pharmacy/avatars/' + 'a' * 32
AVATAR_URL = 'https://res.cloudinary.com/test-cloud/image/upload/v123/' + AVATAR_ID + '.png'


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'profile-only-test-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example'], 'CLOUDINARY_CLOUD_NAME': 'test-cloud',
            'CLOUDINARY_API_KEY': 'test-key', 'CLOUDINARY_API_SECRET': 'test-private'})
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.user = NS(MaNguoiDung=12, HoTen='Nguyễn An', SDT='+84901234567', VaiTro=0,
                       TrangThai=False, Email=None, AnhDaiDien=None)
        self.mock('app.services.auth_service.users.find_by_id', return_value=self.user)
        self.lock = self.mock('app.services.auth_service.users.lock_by_id', return_value=self.user)
        self.commit = self.mock('app.extensions.db.session.commit')
        self.rollback = self.mock('app.extensions.db.session.rollback')
        self.provider = self.mock('cloudinary.api.resource', return_value=self.resource())
        self.upload = self.mock('cloudinary.uploader.upload', return_value=self.resource())
        self.mock('app.services.cloudinary_service.uuid.uuid4', return_value=NS(hex='a' * 32))
        self.client = self.app.test_client()
        with self.client.session_transaction() as state:
            state['user_id'] = 12
            state['csrf_token'] = 'test-csrf'

    def mock(self, target, **kwargs):
        patcher = patch(target, **kwargs)
        result = patcher.start(); self.addCleanup(patcher.stop)
        return result

    def resource(self):
        return dict(secure_url=AVATAR_URL, public_id=AVATAR_ID, resource_type='image', type='upload', format='png')

    def save(self, **kwargs):
        return self.client.put('/api/auth/me', json=kwargs or {'HoTen': '  Tên Mới  ', 'AnhDaiDien': None}, headers={'X-CSRF-Token': 'test-csrf'})

    def test_owner_only_fields_phone_and_role_unchanged(self):
        result = self.save()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json['user']['HoTen'], 'Tên Mới')
        self.assertEqual(result.json['user']['SDT'], '+84901234567')
        self.assertEqual(result.json['user']['VaiTro'], 0)
        self.lock.assert_called_once_with(12)
        self.commit.assert_called_once()
        self.assertEqual(result.headers['Cache-Control'], 'no-store')

    def test_strict_whitelist_and_name_validation(self):
        for extra in ('SDT', 'VaiTro', 'TrangThai', 'MaNguoiDung', 'Email'):
            self.assertEqual(self.save(HoTen='An', AnhDaiDien=None, **{extra: 'injected'}).status_code, 400)
        for name in ('', '   ', 'a' * 256, 'a\x00b', '\nName', None):
            self.assertEqual(self.save(HoTen=name, AnhDaiDien=None).status_code, 400)
        self.commit.assert_not_called()

    def test_auth_csrf_and_locked_user(self):
        self.assertEqual(self.client.put('/api/auth/me', json={'HoTen': 'An', 'AnhDaiDien': None}).status_code, 403)
        self.user.TrangThai = True
        self.assertEqual(self.save().status_code, 403)
        with self.client.session_transaction() as state:
            state.clear()
        self.assertEqual(self.save().status_code, 401)
        self.commit.assert_not_called()

    def test_recheck_locked_account_after_lock_and_database_failure(self):
        self.lock.return_value = NS(**{**vars(self.user), 'TrangThai': True})
        self.assertEqual(self.save().json['code'], 'ACCOUNT_LOCKED')
        self.commit.assert_not_called()
        self.lock.side_effect = SQLAlchemyError('private details')
        result = self.save()
        self.assertEqual(result.status_code, 503)
        self.assertNotIn('private details', result.get_data(as_text=True))
        self.rollback.assert_called()

    def test_avatar_url_is_verified_and_wrong_folder_external_urls_rejected(self):
        self.assertEqual(self.save(HoTen='An', AnhDaiDien=AVATAR_URL).status_code, 200)
        self.provider.assert_called_once()
        self.assertEqual(self.user.AnhDaiDien, AVATAR_URL)
        for url in ('https://example.com/image.png', AVATAR_URL.replace('/avatars/', '/products/'), 'javascript:alert(1)'):
            self.assertEqual(self.save(HoTen='An', AnhDaiDien=url).status_code, 400)
        self.assertEqual(self.user.AnhDaiDien, AVATAR_URL)
        self.provider.side_effect = Error('provider unavailable')
        self.assertEqual(self.save(HoTen='New', AnhDaiDien=AVATAR_URL.replace('a' * 32, 'b' * 32)).status_code, 503)
        self.assertEqual(self.user.HoTen, 'An')

    def test_unchanged_avatar_and_removal_need_no_provider(self):
        self.user.AnhDaiDien = 'https://example.com/existing.png'
        self.assertEqual(self.save(HoTen='An', AnhDaiDien=self.user.AnhDaiDien).status_code, 200)
        self.assertEqual(self.save(HoTen='An', AnhDaiDien=None).status_code, 200)
        self.assertIsNone(self.user.AnhDaiDien)
        self.provider.assert_not_called()

    def test_customer_avatar_upload_is_signed_separate_folder_and_not_saved_implicitly(self):
        content = BytesIO(); Image.new('RGB', (4, 4)).save(content, format='PNG'); content.seek(0)
        response = self.client.post('/api/auth/me/avatar', data={'image': (content, 'image.png', 'image/png')}, headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['data']['url'], AVATAR_URL)
        self.assertEqual(self.upload.call_args.kwargs['folder'], 'lan-yen-pharmacy/avatars')
        self.assertIs(self.upload.call_args.kwargs['overwrite'], False)
        self.assertIsNone(self.user.AnhDaiDien)
        self.commit.assert_not_called()
        response = self.client.post('/api/auth/me/avatar', data={'image': (BytesIO(b'broken'), 'image.png', 'image/png')}, headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual(response.status_code, 400)

    def test_avatar_upload_requires_auth_csrf_and_does_not_expose_provider_errors(self):
        self.assertEqual(self.client.post('/api/auth/me/avatar').status_code, 403)
        self.upload.side_effect = RuntimeError('secret provider credential')
        content = BytesIO(); Image.new('RGB', (4, 4)).save(content, format='PNG'); content.seek(0)
        with self.assertLogs(self.app.logger, level='ERROR') as logged:
            result = self.client.post('/api/auth/me/avatar', data={'image': (content, 'test.png', 'image/png')}, headers={'X-CSRF-Token': 'test-csrf'})
        self.assertEqual(result.json, {'code': 'UPLOAD_FAILED'})
        self.assertNotIn('secret provider', str(logged.output))
        with self.client.session_transaction() as state:
            state.clear()
        self.assertEqual(self.client.post('/api/auth/me/avatar').status_code, 401)


if __name__ == '__main__':
    unittest.main()
