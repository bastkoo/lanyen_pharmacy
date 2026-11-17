import unittest
from types import SimpleNamespace as NS
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError

from app import create_app


class AddressTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'address-test-only-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'SESSION_COOKIE_SECURE': False, 'APP_ENV': 'development', 'OTP_DEV_ENABLED': False,
            'AUTH_ALLOWED_ORIGINS': ['https://shop.example']})
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.user = NS(MaNguoiDung=12, HoTen='An', SDT='+84901234567', VaiTro=0, TrangThai=False, Email=None, AnhDaiDien=None)
        self.mock('app.services.auth_service.users.find_by_id', return_value=self.user)
        self.lock = self.mock('app.services.address_service.users.lock_by_id', return_value=self.user)
        self.rows = []
        self.list_owned = self.mock('app.services.address_service.addresses.list_owned', side_effect=lambda owner: sorted([row for row in self.rows if row.MaNguoiDung == owner], key=lambda row: row.MaDiaChi))
        self.create = self.mock('app.services.address_service.addresses.create', side_effect=self.create_row)
        self.remove = self.mock('app.services.address_service.addresses.remove', side_effect=self.rows.remove)
        self.commit = self.mock('app.extensions.db.session.commit')
        self.flush = self.mock('app.extensions.db.session.flush')
        self.rollback = self.mock('app.extensions.db.session.rollback')
        self.client = self.app.test_client()
        self.base = '/api/auth/me/addresses'
        with self.client.session_transaction() as state:
            state['user_id'] = 12; state['csrf_token'] = 'address-csrf'

    def mock(self, target, **kwargs):
        patcher = patch(target, **kwargs); result = patcher.start(); self.addCleanup(patcher.stop); return result

    def create_row(self, owner, data, primary):
        row = NS(MaDiaChi=max((row.MaDiaChi for row in self.rows), default=0) + 1, MaNguoiDung=owner, DiaChiGiao=primary, **data)
        self.rows.append(row); return row

    def data(self, name='12 Đường A'):
        return dict(TinhThanh='TP Hồ Chí Minh', PhuongXa='Phường A', DiaChiCuThe=name)

    def send(self, method='POST', path='', data=None):
        return self.client.open(self.base + path, method=method, json={} if data is None else data, headers={'X-CSRF-Token': 'address-csrf'})

    def add(self, name='12 Đường A'):
        return self.send(data=self.data(name))

    def test_first_is_primary_later_secondary_and_list_is_private(self):
        first = self.add(); second = self.add('Đường B')
        self.assertEqual(first.status_code, 201)
        self.assertTrue(first.json['address']['DiaChiGiao'])
        self.assertFalse(second.json['address']['DiaChiGiao'])
        self.create_row(99, self.data('Private'), True)
        result = self.client.get(self.base)
        self.assertEqual(len(result.json['items']), 2)
        self.assertNotIn('MaNguoiDung', result.json['items'][0])
        self.assertEqual(result.headers['Cache-Control'], 'no-store')
        self.lock.assert_called_with(12)

    def test_strict_fields_validation_and_no_owner_or_primary_injection(self):
        for field, value in [('MaNguoiDung', 99), ('DiaChiGiao', True), ('MaDiaChi', 7), ('SDT', '123')]:
            self.assertEqual(self.send(data={**self.data(), field: value}).status_code, 400)
        for field in self.data():
            for value in ['', '  ', None, 'a' * 256, 'abc\x00def', '\nName']:
                self.assertEqual(self.send(data={**self.data(), field: value}).status_code, 400)
        self.assertEqual(self.send(data={}).status_code, 400)
        self.assertEqual(self.client.post(self.base, data='x', headers={'X-CSRF-Token': 'address-csrf'}).status_code, 415)
        self.commit.assert_not_called()

    def test_auth_csrf_and_foreign_address_boundaries(self):
        other = self.create_row(99, self.data('Private'), True)
        for method, path, data in [('PUT', f'/{other.MaDiaChi}', self.data()), ('PATCH', f'/{other.MaDiaChi}/primary', {}), ('DELETE', f'/{other.MaDiaChi}', {})]:
            self.assertEqual(self.send(method, path, data).status_code, 404)
        self.assertEqual(self.client.post(self.base, json=self.data()).status_code, 403)
        self.commit.assert_not_called()
        with self.client.session_transaction() as state: state.clear()
        for method, path in [('GET', ''), ('POST', ''), ('PUT', '/1'), ('PATCH', '/1/primary'), ('DELETE', '/1')]:
            self.assertEqual(self.send(method, path).status_code, 401)

    def test_primary_switch_demotes_previous_in_single_commit(self):
        self.add(); self.add('B'); self.add('C'); self.commit.reset_mock()
        response = self.send('PATCH', '/3/primary')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row.DiaChiGiao for row in self.rows], [False, False, True])
        self.commit.assert_called_once()
        response = self.client.get(self.base)
        self.assertEqual(response.json['items'][0]['MaDiaChi'], 3)
        self.assertEqual(self.send('PATCH', '/3/primary').status_code, 200)
        self.assertEqual(sum(row.DiaChiGiao for row in self.rows), 1)

    def test_update_preserves_primary_and_trims_input(self):
        self.add(); self.add('B')
        response = self.send('PUT', '/1', self.data('  Nhà mới  '))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['address']['DiaChiCuThe'], 'Nhà mới')
        self.assertTrue(response.json['address']['DiaChiGiao'])
        self.assertFalse(self.send('PUT', '/2', self.data('Secondary')).json['address']['DiaChiGiao'])

    def test_delete_primary_promotes_oldest_secondary_and_last_delete_resets_book(self):
        self.add(); self.add('B'); self.add('C'); self.send('PATCH', '/3/primary'); self.commit.reset_mock()
        self.assertEqual(self.send('DELETE', '/3').status_code, 200)
        self.assertEqual([row.DiaChiGiao for row in self.rows], [True, False])
        self.commit.assert_called_once()
        self.send('DELETE', '/2')
        self.assertTrue(self.rows[0].DiaChiGiao)
        self.send('DELETE', '/1')
        self.assertEqual(self.rows, [])
        self.assertTrue(self.add().json['address']['DiaChiGiao'])

    def test_locked_owner_is_rechecked_and_db_errors_are_rolled_back(self):
        self.lock.return_value = NS(**{**vars(self.user), 'TrangThai': True})
        self.assertEqual(self.add().status_code, 403)
        self.create.assert_not_called(); self.commit.assert_not_called()
        with self.client.session_transaction() as state: state['user_id'] = 12; state['csrf_token'] = 'address-csrf'
        self.lock.side_effect = SQLAlchemyError('private sql')
        response = self.add()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private sql', response.get_data(as_text=True)); self.rollback.assert_called()

    def test_primary_payload_and_query_whitelists(self):
        self.add()
        self.assertEqual(self.send('PATCH', '/1/primary', {'MaNguoiDung': 99}).status_code, 400)
        self.assertEqual(self.client.get(self.base + '?MaNguoiDung=99').status_code, 400)

    def test_existing_duplicate_or_missing_flags_are_normalized_on_write(self):
        self.create_row(12, self.data('A'), True); self.create_row(12, self.data('B'), True)
        self.send('PUT', '/2', self.data('B'))
        self.assertEqual([row.DiaChiGiao for row in self.rows], [True, False])
        for row in self.rows: row.DiaChiGiao = False
        self.add('C')
        self.assertEqual([row.DiaChiGiao for row in self.rows], [True, False, False])


if __name__ == '__main__': unittest.main()
