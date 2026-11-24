"""Read-only connectivity check. Prints no credentials or conversation content."""
from urllib.error import HTTPError
from unittest.mock import patch

from app import create_app
from app.extensions import db
from app.repositories.thuoc_repository import search_ai_context
from app.services import ai_chat_service as ai
from app.services.public_promotion_service import list_programs
from app.services.inventory_service import current_date


def main():
    app = create_app({'TESTING': True})
    original_open = ai.urlopen

    def inspect_status(*args, **kwargs):
        try:
            return original_open(*args, **kwargs)
        except HTTPError as error:
            print('GROQ_HTTP_STATUS', error.code)
            raise

    with app.app_context():
        sample_name = None
        print('GROQ_CONFIGURED', bool(app.config.get('GROQ_API_KEY')))
        print('GROQ_MODEL', app.config.get('GROQ_MODEL'))
        try:
            with patch.object(ai, 'urlopen', side_effect=inspect_status):
                result = ai.completion([{'role': 'system', 'content': 'Return JSON with key ok and boolean value true.'},
                                        {'role': 'user', 'content': 'Connection check'}], tokens=150)
                print('GROQ_RESPONSE_OK', result.get('ok') is True)
        except ai.AuthError as error:
            print('GROQ_ERROR', error.code)
        try:
            records = search_ai_context(['vitamin', 'đau'], current_date())
            print('CATALOG_MATCHES', len(records))
            sample_name = records[0].TenThuoc if records else None
            print('PROMOTIONS_READ_OK', isinstance(list_programs(page=1, per_page=12)['items'], list))
        except Exception as error:
            print('DATABASE_CHECK_FAILED', type(error).__name__)
        finally:
            db.session.rollback()
        try:
            print('REDIS_OK', app.extensions['otp_redis'].ping())
        except Exception as error:
            print('REDIS_CHECK_FAILED', type(error).__name__)
        try:
            result = ai.generate('Nhà thuốc có sản phẩm vitamin nào?', [])
            print('AI_CATALOG_FLOW_OK', bool(result['text']))
            print('AI_CARD_COUNT', len(result['products']))
            if sample_name:
                result = ai.generate('Cho tôi thông tin sản phẩm ' + sample_name, [])
                print('AI_EXACT_PRODUCT_CARD_OK', bool(result['products']))
        except Exception as error:
            print('AI_CATALOG_FLOW_FAILED', getattr(error, 'code', type(error).__name__))


if __name__ == '__main__':
    main()
