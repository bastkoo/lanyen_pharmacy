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
        self.search = self.mock('app.services.ai_chat_service.products.search_ai_context',
            side_effect=lambda terms, today: [NS(MaThuoc=7)] if terms else [])
        self.card = dict(MaThuoc=7, TenThuoc='Vitamin', PhanLoai=False, KeDon=False,
            MoTa='Mô tả thực tế', CachDung='Thông tin sử dụng', DonViGia=[dict(MaDonGia=3, GiaBan=10000, DonViTinh='Hộp', ConHang=True)], HinhAnh='')
        self.detail = self.mock('app.services.ai_chat_service.get_public_product', side_effect=lambda _: dict(self.card))
        self.mock('app.services.ai_chat_service.list_programs', return_value={'items': [], 'as_of': '2026-11-24'})
        self.rollback = self.mock('app.extensions.db.session.rollback')
        self.commit = self.mock('app.extensions.db.session.commit')
        self.rows = []
        self.history = self.mock('app.repositories.ai_chat_repository.messages', side_effect=lambda uid, before=None, limit=50:
            [m for m in self.rows if before is None or m.MaNoiDung < before][-limit:])
        self.exchange = self.mock('app.repositories.ai_chat_repository.exchange', side_effect=lambda uid, rid:
            [m for m in self.rows if service.payload(m)['request_id'] == rid])
        self.lock = self.mock('app.repositories.ai_chat_repository.lock_customer', side_effect=lambda _: self.actor)
        self.thread = self.mock('app.repositories.ai_chat_repository.conversation', return_value=NS(MaTinNhan=9))
        self.persist = self.mock('app.repositories.ai_chat_repository.add', side_effect=self.add)
        self.completion = self.mock('app.services.ai_chat_service.completion', side_effect=[
            {'terms': ['Vitamin']}, {'text': 'Thông tin từ danh mục.', 'product_ids': [7, 999]}])
        self.client = self.app.test_client()
        with self.client.session_transaction() as state:
            state.update(user_id=12, csrf_token='csrf')

    def post(self, body=None, csrf='csrf'):
        return self.client.post('/api/chat/ai', json=body if body is not None else {'text': 'Vitamin'},
            headers={'X-CSRF-Token': csrf})

    def add(self, thread_id, user_id, role, body, at):
        message = NS(MaNoiDung=len(self.rows)+1, MaTinNhan=thread_id, NguoiGui=user_id,
            LoaiNguoiGui=role, NoiDung=service.chats.PREFIX + body, ThoiGianGui=at)
        self.rows.append(message)
        return message

    def test_catalog_cards_and_both_messages_are_saved_in_existing_tables(self):
        result = self.post()
        self.assertEqual(result.status_code, 200)
        self.assertEqual([p['MaThuoc'] for p in result.json['products']], [7])
        self.assertEqual(result.headers['Cache-Control'], 'no-store')
        self.assertEqual(self.persist.call_count, 2)
        self.assertEqual([m.LoaiNguoiGui for m in self.rows], ['KHACH_HANG', 'AI'])
        self.assertEqual([m.NguoiGui for m in self.rows], [12, None])
        self.assertEqual([m['role'] for m in result.json['messages']], ['KHACH_HANG', 'AI'])
        self.commit.assert_called_once()
        self.rollback.assert_called()
        self.limit.assert_called_once_with('ai-chat', '12', 10, seconds=60)

    def test_retry_after_lost_response_does_not_duplicate_messages_or_call_groq(self):
        body = {'text': 'Vitamin', 'request_id': '00000000-0000-4000-8000-000000000001'}
        first = self.post(body)
        self.assertEqual(self.post(body).json, first.json)
        self.assertEqual(len(self.rows), 2)
        self.assertEqual(self.completion.call_count, 2)
        body['text'] = 'Changed'
        self.assertEqual(self.post(body).json['code'], 'AI_REQUEST_CHANGED')

    def test_history_is_paginated_and_uses_authenticated_customer_only(self):
        self.post()
        result = self.client.get('/api/chat/ai/messages')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(len(result.json['items']), 2)
        self.history.assert_called_with(12, before=None)
        self.assertEqual(len(self.client.get('/api/chat/ai/messages?before=2').json['items']), 1)
        self.assertEqual(self.client.get('/api/chat/ai/messages?user_id=99').status_code, 400)
        self.assertEqual(self.client.get('/api/chat/ai/messages?before=0').status_code, 400)

    def test_recent_context_comes_from_owned_database_history(self):
        self.post()
        self.completion.reset_mock(side_effect=True)
        self.completion.side_effect = [{'terms': ['Vitamin']}, {'text': 'Thông tin bổ sung.', 'product_ids': [7]}]
        self.post({'text': 'Sản phẩm này còn hàng không?'})
        sent = self.completion.call_args_list[0].args[0]
        context = json.loads(sent[1]['content'])['recent_conversation']
        self.assertEqual(len(context), 2)
        self.assertEqual(context[0]['text'], 'Vitamin')

    def test_out_of_stock_products_are_never_recommended(self):
        self.card['DonViGia'][0]['ConHang'] = False
        result = self.post()
        self.assertEqual(result.json['products'], [])
        self.assertIn('Chưa tìm thấy sản phẩm còn hàng', result.json['text'])
        context = json.loads(self.completion.call_args.args[0][1]['content'])
        self.assertEqual(context['products'], [])

    def test_stock_is_rechecked_after_provider_returns(self):
        empty = dict(self.card, DonViGia=[])
        self.detail.side_effect = [self.card, empty]
        result = self.post()
        self.assertEqual(result.json['products'], [])
        self.assertIn('không còn đủ hàng', result.json['text'])

    def test_locked_customer_is_rechecked_before_persisting(self):
        self.lock.return_value = NS(VaiTro=0, TrangThai=True)
        self.lock.side_effect = None
        self.assertEqual(self.post().status_code, 403)
        self.persist.assert_not_called()

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

    def test_text_only_greeting_without_product_ids_is_saved_successfully(self):
        self.completion.side_effect = [{'terms': []}, {'text': 'Xin chào! Tôi có thể giúp gì cho bạn?'}]
        result = self.post({'text': 'Xin chào'})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json['products'], [])
        self.assertIn('Xin chào', result.json['text'])
        self.assertEqual(len(result.json['messages']), 2)
        self.commit.assert_called_once()

    def test_malformed_product_ids_still_rejected(self):
        for ids in ('7', {}, None):
            self.completion.side_effect = [{'terms': []}, {'text': 'Xin chào', 'product_ids': ids}]
            self.assertEqual(self.post().json['code'], 'AI_UNAVAILABLE')
        self.persist.assert_not_called()

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
        self.persist.assert_not_called()

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
