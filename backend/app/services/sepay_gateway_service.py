"""Environment-isolated checkout forms and SECRET_KEY IPN authentication.

Official contract: https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/form-thanh-toan
No provider credentials or IPN bodies are logged. No live provider requests.
"""
import base64
import hashlib
import hmac
import re
from decimal import Decimal
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from flask import current_app

from app.extensions import db
from app.repositories import don_hang_repository as orders
from app.services.auth_service import AuthError
from app.services.cart_service import operation

CHECKOUT_URL = 'https://pay-sandbox.sepay.vn/v1/checkout/init'
API_BASE_URL = 'https://pgapi-sandbox.sepay.vn'
INVOICE_PREFIX = 'LYSGTEST'
ENVIRONMENTS = {
    'sandbox': (CHECKOUT_URL, API_BASE_URL, INVOICE_PREFIX),
    'production': ('https://pay.sepay.vn/v1/checkout/init', 'https://pgapi.sepay.vn', 'LYSGLIVE'),
}
MAX_ID = 9223372036854775807
SIGNED_FIELDS = (
    'order_amount', 'merchant', 'currency', 'operation', 'order_description',
    'order_invoice_number', 'customer_id', 'payment_method',
    'success_url', 'error_url', 'cancel_url',
)


def gateway_config(environment=None, for_ipn=False):
    source = current_app.config
    env = environment if environment is not None else source.get('SEPAY_ENV', 'sandbox')
    if env not in ENVIRONMENTS:
        raise AuthError('GATEWAY_CONFIG_INVALID', 503)
    if env == 'production' and not for_ipn and not source.get('SEPAY_PRODUCTION_ENABLED', False):
        raise AuthError('GATEWAY_PRODUCTION_DISABLED', 503)
    prefix = 'SEPAY_' + env.upper() + '_'
    credential_names = ('MERCHANT_ID', 'SECRET_KEY', 'IPN_SECRET_KEY')
    # Never fill gaps in a partially configured group with a different group.
    legacy = env == 'sandbox' and not any(source.get(prefix + name) for name in credential_names)
    config = {'SEPAY_ENV': env}
    for name in (*credential_names, 'CHECKOUT_URL', 'API_BASE_URL'):
        config['SEPAY_' + name] = source.get(('SEPAY_' if legacy else prefix) + name, '')
    for name in ('SUCCESS_URL', 'ERROR_URL', 'CANCEL_URL'):
        config['SEPAY_' + name] = source.get(('SEPAY_' if env == 'sandbox' else prefix) + name, '')
    if not all(config.get(key) for key in ('SEPAY_MERCHANT_ID', 'SEPAY_SECRET_KEY', 'SEPAY_IPN_SECRET_KEY')):
        raise AuthError('GATEWAY_NOT_CONFIGURED', 503)
    merchant = config['SEPAY_MERCHANT_ID']
    valid_merchant = (re.fullmatch(r'SP-TEST-[A-Za-z0-9-]+', merchant) if env == 'sandbox'
                      else re.fullmatch(r'[A-Za-z0-9_-]+', merchant) and not merchant.startswith('SP-TEST-'))
    wrong_secret = 'spsk_live_' if env == 'sandbox' else 'spsk_test_'
    if (not valid_merchant or config['SEPAY_SECRET_KEY'].startswith(wrong_secret)
            or config['SEPAY_CHECKOUT_URL'] != ENVIRONMENTS[env][0]
            or config['SEPAY_API_BASE_URL'] != ENVIRONMENTS[env][1]):
        raise AuthError('GATEWAY_CONFIG_INVALID', 503)
    other = 'SEPAY_' + ('PRODUCTION_' if env == 'sandbox' else 'SANDBOX_')
    for name in credential_names:
        other_value = source.get(other + name, '')
        if env == 'production' and not other_value:
            other_value = source.get('SEPAY_' + name, '')
        if other_value and hmac.compare_digest(config['SEPAY_' + name].encode(), other_value.encode()):
            raise AuthError('GATEWAY_ENVIRONMENT_COLLISION', 503)
    for key in (() if for_ipn else ('SEPAY_SUCCESS_URL', 'SEPAY_ERROR_URL', 'SEPAY_CANCEL_URL')):
        value = config.get(key, '')
        if value:
            try:
                parsed = urlsplit(value)
                valid = parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password and not parsed.fragment
            except ValueError:
                valid = False
            if not valid:
                raise AuthError('GATEWAY_CONFIG_INVALID', 503)
    return config


def require_environment(order, environment):
    if order.MoiTruongThanhToan not in ENVIRONMENTS:
        raise AuthError('ORDER_PAYMENT_ENVIRONMENT_UNKNOWN', 409)
    if order.MoiTruongThanhToan != environment:
        raise AuthError('ORDER_PAYMENT_ENVIRONMENT_MISMATCH', 409)


def sign_fields(fields, secret):
    # SePay signs unencoded values in this fixed order, skipping PHP-empty values.
    signed = ','.join(f'{key}={fields[key]}' for key in SIGNED_FIELDS
                      if key in fields and fields[key] not in (None, '', 0, '0', False))
    return base64.b64encode(hmac.new(secret.encode('utf-8'), signed.encode('utf-8'), hashlib.sha256).digest()).decode('ascii')


def require_pending(order):
    from app.services.order_expiry_service import overdue
    if overdue(order):
        raise AuthError('ORDER_EXPIRED', 409)
    if order.PhuongThucThanhToan != 1:
        raise AuthError('ORDER_PAYMENT_METHOD_INVALID', 409)
    if order.TrangThaiThanhToan == 1:
        raise AuthError('ORDER_ALREADY_PAID', 409)
    if order.TrangThaiDonHang != 0 or order.TrangThaiThanhToan != 0:
        raise AuthError('ORDER_NOT_PAYABLE', 409)
    if not 0 < order.TongThanhToan <= MAX_ID:
        raise AuthError('QR_AMOUNT_INVALID', 409)


@operation
def initialize(user_id, order_id):
    config = gateway_config()
    if not 0 < order_id <= MAX_ID:
        raise AuthError('ORDER_NOT_FOUND', 404)
    order = orders.find(order_id, lock=True)
    if order is None or order.MaNguoiMua != user_id:
        raise AuthError('ORDER_NOT_FOUND', 404)
    require_pending(order)
    require_environment(order, config['SEPAY_ENV'])
    # Stable invoice for the existing order, including on retries. No new order,
    # payment attempt record, status update, or change to legacy order data.
    fields = dict(order_amount=str(order.TongThanhToan), merchant=config['SEPAY_MERCHANT_ID'],
                  currency='VND', operation='PURCHASE', order_description=f'Thanh toán đơn hàng #{order.MaDonHang}',
                  order_invoice_number=f'{ENVIRONMENTS[config["SEPAY_ENV"]][2]}{order.MaDonHang}',
                  customer_id=str(order.MaNguoiMua), payment_method='BANK_TRANSFER')
    for name in ('success_url', 'error_url', 'cancel_url'):
        if config.get('SEPAY_' + name.upper()):
            parsed = urlsplit(config['SEPAY_' + name.upper()])
            query = [(key, value) for key, value in parse_qsl(parsed.query) if key != 'order']
            query.append(('order', str(order.MaDonHang)))
            fields[name] = urlunsplit(parsed._replace(query=urlencode(query)))
    fields['signature'] = sign_fields(fields, config['SEPAY_SECRET_KEY'])
    # Release the row lock before the customer leaves for hosted checkout.
    db.session.commit()
    return {'environment': config['SEPAY_ENV'], 'action': config['SEPAY_CHECKOUT_URL'], 'method': 'POST', 'fields': fields}


def amount_equals(value, expected):
    # Gateway sends decimal strings such as "50000.00". Never use floats or
    # truncate fractions, and bound parsing of untrusted numeric strings.
    return (isinstance(value, str) and len(value) <= 32
            and re.fullmatch(r'[0-9]+(?:\.[0-9]{1,2})?', value) is not None
            and Decimal(value) == expected)


@operation
def receive_ipn(received_key, data):
    if not isinstance(data, dict):
        raise AuthError('INVALID_REQUEST', 400)
    provider_order = data.get('order')
    invoice = provider_order.get('order_invoice_number') if isinstance(provider_order, dict) else None
    # The reference selects the key to check, never the authority to credit a
    # record. Its environment MUST also match the persisted order after auth.
    match = re.fullmatch(r'(LYSGTEST|LYSGLIVE)([1-9][0-9]{0,18})', invoice) if isinstance(invoice, str) else None
    if not match or int(match[2]) > MAX_ID:
        raise AuthError('IPN_ORDER_MISMATCH', 409)
    environment = 'sandbox' if match[1] == 'LYSGTEST' else 'production'
    config = gateway_config(environment=environment, for_ipn=True)
    if not hmac.compare_digest(received_key.encode('utf-8'), config['SEPAY_IPN_SECRET_KEY'].encode('utf-8')):
        raise AuthError('INVALID_IPN_KEY', 401)
    if data.get('notification_type') != 'ORDER_PAID':
        return 'IGNORED'  # Includes TRANSACTION_VOID: no unapproved refund/cancel policy.
    provider_order, transaction = data.get('order'), data.get('transaction')
    if not isinstance(provider_order, dict) or not isinstance(transaction, dict):
        raise AuthError('INVALID_REQUEST', 400)
    if (provider_order.get('order_status') != 'CAPTURED'
            or transaction.get('transaction_status') != 'APPROVED'
            or transaction.get('transaction_type') != 'PAYMENT'
            or transaction.get('payment_method') != 'BANK_TRANSFER'):
        return 'IGNORED'
    if provider_order.get('order_currency') != 'VND' or transaction.get('transaction_currency') != 'VND':
        raise AuthError('IPN_CURRENCY_MISMATCH', 409)
    order = orders.find(int(match[2]), lock=True)
    if order is None:
        raise AuthError('ORDER_NOT_FOUND', 404)
    require_environment(order, environment)
    customer = data.get('customer')
    if isinstance(customer, dict) and customer.get('customer_id') is not None:
        if customer['customer_id'] != str(order.MaNguoiMua):
            raise AuthError('IPN_ORDER_MISMATCH', 409)
    if not amount_equals(provider_order.get('order_amount'), order.TongThanhToan) or not amount_equals(transaction.get('transaction_amount'), order.TongThanhToan):
        raise AuthError('IPN_AMOUNT_MISMATCH', 409)
    if order.PhuongThucThanhToan != 1:
        raise AuthError('ORDER_PAYMENT_METHOD_INVALID', 409)
    if order.TrangThaiThanhToan == 1:
        db.session.commit()  # Acknowledge duplicates without changing fulfilment.
        return 'DUPLICATE'
    require_pending(order)
    order.TrangThaiThanhToan = 1
    order.TrangThaiDonHang = 1
    db.session.commit()
    return 'PAID'
