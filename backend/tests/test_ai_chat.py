"""AI catalog assistance: no real DB, Redis or Groq calls."""
import json
import unittest
from types import SimpleNamespace as NS
from unittest.mock import patch
from urllib.error import HTTPError

from app import create_app
from app.services import ai_chat_service as service
from app.services.auth_service import AuthError


class AiChatTests(unittest.TestCase):
    def mock(self, path, **kwargs):
        context = patch(path, **kwargs)
        result = context.start()
        self.addCleanup(context.stop)
        return result

    def setUp(self):
        self.app = create_app({'TESTING': True, 'SECRET_KEY': 'ai-tests-secret-' * 3,
            'SQLALCHEMY_DATABASE_URI': 'postgresql+psycopg://unused:unused@localhost/unused',
            'APP_ENV': 'development', 'OTP_DEV_ENABLED': False, 'AUTH_ALLOWED_ORIGINS': [],
            'SESSION_COOKIE_SECURE': False, 'GROQ_API_KEY': 'test-key', 'GROQ_MODEL': 'test-model'})
        self.mock('sqlalchemy.engine.Engine.connect', side_effect=AssertionError('Real DB forbidden'))
        self.actor = NS(MaNguoiDung=12, VaiTro=0, TrangThai=False)
        self.mock('app.services.auth_service.users.find_by_id', side_effect=lambda _: self.actor)
        self.limit = self.mock('app.services.ai_chat_service.rate_limit')
        self.search = self.mock('app.services.ai_chat_service.products.search_ai_context', return_value=[NS(MaThuoc=7)])
        self.card = dict(MaThuoc=7, TenThuoc='Vitamin', PhanLoai=False, KeDon=False,
            MoTa='Mô tả thực tế', CachDung='Thông tin sử dụng', DonViGia=[], HinhAnh='')
        self.mock('app.services.ai_chat_service.get_public_product', side_effect=lambda _: dict(self.card))
        self.mock('app.services.ai_chat_service.list_programs', return_value={'items': [], 'as_of': '2026-11-24'})
        self.rollback = self.mock('app.extensions.db.session.rollback')
        self.commit = self.mock('app.extensions.db.session.commit')
        self.persist = self.mock('app.repositories.chat_repository.add')
        self.completion = self.mock('app.services.ai_chat_service.completion', side_effect=[
            {'terms': ['Vitamin']}, {'text': 'Thông tin từ danh mục.', 'product_ids': [7, 999]}])
        self.client = self.app.test_client()
        with self.client.session_transaction() as state:
            state.update(user_id=12, csrf_token='csrf')

    def post(self, body=None, csrf='csrf'):
        return self.client.post('/api/chat/ai', json=body if body is not None else {'text': 'Vitamin'},
            headers={'X-CSRF-Token': csrf})

    def test_catalog_cards_are_server_owned_and_history_is_never_written(self):
        result = self.post()
        self.assertEqual(result.status_code, 200)
        self.assertEqual([p['MaThuoc'] for p in result.json['products']], [7])
        self.assertEqual(result.headers['Cache-Control'], 'no-store')
        self.persist.assert_not_called()
        self.commit.assert_not_called()
        self.rollback.assert_called()
        self.limit.assert_called_once_with('ai-chat', '12', 10, seconds=60)

    def test_restricted_product_cannot_receive_generated_usage_advice(self):
        self.card.update(PhanLoai=True, MoTa='SECRET DESCRIPTION', CachDung='SECRET DOSAGE')
        self.completion.side_effect = [{'terms': ['Vitamin']}, {'text': 'Unsafe generated advice', 'product_ids': []}]
        result = self.post()
        self.assertIn(service.CONSULT, result.json['text'])
        self.assertNotIn('Unsafe', result.json['text'])
        self.assertTrue(result.json['products'][0]['PhanLoai'])
        provider_input = json.dumps(self.completion.call_args.args)
        self.assertNotIn('SECRET DESCRIPTION', provider_input)
        self.assertNotIn('SECRET DOSAGE', provider_input)

    def test_prescription_requires_pharmacist(self):
        self.card['KeDon'] = True
        self.assertIn('đơn thuốc hợp lệ', self.post().json['text'])

    def test_validation_rejects_history_blank_and_oversized_input(self):
        for body in ({'text': ' '}, {'text': 'x' * 2001}, {'text': 'x', 'history': []}, {'text': 42}, {'text': '\0'}):
            self.assertEqual(self.post(body).status_code, 400)
        self.completion.assert_not_called()

    def test_authentication_customer_role_and_csrf_required(self):
        self.assertEqual(self.post(csrf='wrong').status_code, 403)
        self.actor.VaiTro = 1
        self.assertEqual(self.post().status_code, 403)
        with self.client.session_transaction() as state:
            state.clear()
        self.assertEqual(self.post().status_code, 401)
        self.completion.assert_not_called()

    def test_provider_and_rate_limit_errors_are_safe(self):
        for code in ('AI_UNAVAILABLE', 'AI_RATE_LIMITED'):
            self.completion.side_effect = AuthError(code, 503)
            result = self.post()
            self.assertEqual(result.status_code, 503)
            self.assertEqual(result.json, {'code': code})
        self.limit.side_effect = AuthError('RATE_LIMITED', 429)
        self.assertEqual(self.post().status_code, 429)

    def test_malformed_provider_response_is_rejected(self):
        self.completion.side_effect = [{'terms': 'bad'}]
        self.assertEqual(self.post().json['code'], 'AI_UNAVAILABLE')
        self.completion.side_effect = [{'terms': []}, {'text': '', 'product_ids': []}]
        self.assertEqual(self.post().json['code'], 'AI_UNAVAILABLE')

class AiTransportTests(unittest.TestCase):
    def test_http_failure_and_invalid_json_are_sanitized(self):
        from flask import Flask
        app = Flask(__name__)
        app.config.update(GROQ_API_KEY='private', GROQ_MODEL='test-model')
        for error in (HTTPError('https://api.groq.com', 429, 'private body', {}, None), ValueError('private')):
            with app.app_context(), patch.object(service, 'urlopen', side_effect=error):
                with self.assertRaises(AuthError) as raised:
                    service.completion([])
                self.assertIn(raised.exception.code, ['AI_RATE_LIMITED', 'AI_UNAVAILABLE'])

    def test_configured_model_and_key_are_sent_only_to_groq(self):
        from flask import Flask
        from unittest.mock import MagicMock
        app = Flask(__name__)
        app.config.update(GROQ_API_KEY='private', GROQ_MODEL='configured-model')
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({
            'choices': [{'message': {'content': '{"text":"ok"}'}}]}).encode()
        with app.app_context(), patch.object(service, 'urlopen', return_value=response) as send:
            self.assertEqual(service.completion([]), {'text': 'ok'})
            request = send.call_args.args[0]
            self.assertEqual(request.full_url, 'https://api.groq.com/openai/v1/chat/completions')
            self.assertEqual(request.get_header('Authorization'), 'Bearer private')
            self.assertEqual(json.loads(request.data)['model'], 'configured-model')


if __name__ == '__main__':
    unittest.main()
