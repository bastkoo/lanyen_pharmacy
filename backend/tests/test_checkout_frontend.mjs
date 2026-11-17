import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutUrl, readCheckoutSelection } from '../../frontend/js/utils/checkout-selection.js';
import { checkoutFields } from '../../frontend/js/utils/sepay-checkout.js';

test('Sandbox form validates action, order and amount and restores signed input order', () => {
    const order = { MaDonHang: '4', TongThanhToan: '32000' };
    const payment = { environment: 'sandbox', action: 'https://pay-sandbox.sepay.vn/v1/checkout/init', method: 'POST', fields: {
        signature: 'A'.repeat(43) + '=', payment_method: 'BANK_TRANSFER', order_invoice_number: 'LYSGTEST4',
        order_description: 'Đơn #4', operation: 'PURCHASE', currency: 'VND', merchant: 'SP-TEST-EXAMPLE', order_amount: '32000' } };
    assert.deepEqual(checkoutFields(payment, order).map(([key]) => key), ['order_amount','merchant','currency','operation','order_description','order_invoice_number','payment_method','signature']);
    for (const change of [{ action: 'https://pay.sepay.vn/v1/checkout/init' }, { method: 'GET' },
        { fields: { ...payment.fields, order_amount: '1' } }, { fields: { ...payment.fields, order_invoice_number: 'LYSGTEST5' } },
        { fields: { ...payment.fields, secret_key: 'not-allowed' } }, { fields: { ...payment.fields, signature: '' } }]) {
        assert.throws(() => checkoutFields({ ...payment, ...change }, order));
    }
});

test('Production form requires matching host, merchant, invoice and order environment', () => {
    const order = { MaDonHang: '4', TongThanhToan: '32000', payment_environment: 'production' };
    const payment = { environment: 'production', action: 'https://pay.sepay.vn/v1/checkout/init', method: 'POST', fields: {
        signature: 'A'.repeat(43) + '=', payment_method: 'BANK_TRANSFER', order_invoice_number: 'LYSGLIVE4',
        order_description: 'Đơn #4', operation: 'PURCHASE', currency: 'VND', merchant: 'MERCHANT_PRODUCTION_TEST', order_amount: '32000' } };
    assert.equal(checkoutFields(payment, order)[0][1], '32000');
    for (const change of [{ environment: 'sandbox' }, { environment: 'unknown' },
        { action: 'https://pay-sandbox.sepay.vn/v1/checkout/init' },
        { fields: { ...payment.fields, merchant: 'SP-TEST-EXAMPLE' } },
        { fields: { ...payment.fields, order_invoice_number: 'LYSGTEST4' } }]) {
        assert.throws(() => checkoutFields({ ...payment, ...change }, order));
    }
    assert.throws(() => checkoutFields(payment, { ...order, payment_environment: 'sandbox' }));
});

test('checkout selection transfers only unit identifiers and preserves selected distinct rows', () => {
    const url = checkoutUrl([21, 11, 21]);
    assert.equal(url, 'checkout.html?unit=21&unit=11');
    assert.deepEqual(readCheckoutSelection(url.slice(url.indexOf('?'))), [21, 11]);
    assert.deepEqual(readCheckoutSelection(''), []);
    assert.deepEqual(readCheckoutSelection('?unit=2147483647'), [2147483647]);
});

test('invalid, unknown and excessive checkout selection never becomes a purchase request', () => {
    for (const query of ['?unit=0', '?unit=-1', '?unit=1.5', '?unit=1e2', '?unit=01', '?unit=2147483648', '?unit=', '?unit=1&price=1', '?owner=99']) {
        assert.throws(() => readCheckoutSelection(query));
    }
    assert.throws(() => readCheckoutSelection('?' + Array(1001).fill('unit=1').join('&')));
    for (const ids of [[], [0], [-1], [NaN], [2147483648], Array(1001).fill(1)]) assert.throws(() => checkoutUrl(ids));
});
