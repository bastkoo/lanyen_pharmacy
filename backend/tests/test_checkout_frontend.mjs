import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutUrl, readCheckoutSelection, readReorderSelection, reorderCheckoutUrl, checkoutRedemption } from '../../frontend/js/utils/checkout-selection.js';
import { checkoutFields } from '../../frontend/js/utils/sepay-checkout.js';

test('redemption uses maximum whole coins at 10 VND, caps at balance and total, and stays opt-in', () => {
    assert.deepEqual(checkoutRedemption('25055', '3000', true), { quantity: 2505n, discount: 25050n, total: 5n });
    assert.deepEqual(checkoutRedemption('25055', '20', true), { quantity: 20n, discount: 200n, total: 24855n });
    assert.deepEqual(checkoutRedemption('25055', '3000', false), { quantity: 0n, discount: 0n, total: 25055n });
    for (const [total, balance] of [['0', '20'], ['9', '20'], ['25000', '0'], ['25000', '-3']]) {
        assert.equal(checkoutRedemption(total, balance, true).quantity, 0n);
    }
    assert.equal(checkoutRedemption('9223372036854775807', '300', true).total, 9223372036854772807n);
});

test('direct reorder transfers only source order and selected lines, preserving bigint IDs', () => {
    const url = reorderCheckoutUrl('45', ['9007199254741001', '9007199254741002']);
    assert.equal(url, 'checkout.html?reorder=45&line=9007199254741001&line=9007199254741002');
    assert.deepEqual(readReorderSelection(url.slice(url.indexOf('?'))), {
        orderId: '45', lineIds: ['9007199254741001', '9007199254741002']
    });
    assert.equal(readReorderSelection('?unit=8'), null);
    for (const query of ['?reorder=0&line=1', '?reorder=45', '?reorder=45&line=1&line=1',
        '?reorder=45&line=9223372036854775808', '?reorder=45&line=1&unit=8', '?reorder=45&reorder=46&line=1']) {
        assert.throws(() => readReorderSelection(query));
    }
});

test('buy now navigates from the reorder dialog without a cart write or cart event', async () => {
    class Element {
        constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.listeners = {}; }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        setAttribute() {}
        addEventListener(name, callback) { this.listeners[name] = callback; }
        querySelectorAll(selector) {
            const inputs = this.children.flatMap(child => child instanceof Element
                ? [...(child.tagName === 'input' ? [child] : []), ...child.querySelectorAll('input')] : []);
            return selector === 'input:checked' ? inputs.filter(input => input.checked) : inputs;
        }
        showModal() { this.open = true; }
        focus() {}
    }
    const original = { document: globalThis.document, location: globalThis.location, window: globalThis.window, fetch: globalThis.fetch };
    const body = new Element('body'), requests = [], destinations = [], events = [];
    globalThis.document = { body, createElement: tag => new Element(tag) };
    globalThis.location = { protocol: 'http:', hostname: 'localhost', assign: url => destinations.push(url) };
    globalThis.window = { dispatchEvent: event => events.push(event.type) };
    globalThis.fetch = async (url, options) => {
        requests.push([new URL(url).pathname, options.method]);
        return { ok: true, text: async () => JSON.stringify({ code: 'REORDER_OPTIONS', MaDonHang: '45', items: [
            { MaChiTiet: '9007199254741001', MaDonGia: 8, SoLuong: 3, GiaBan: '12000', TenThuoc: 'Vitamin', DonViTinh: 'Vỉ', ConHang: true }
        ] }) };
    };
    try {
        const { setupOrderReorder } = await import('../../frontend/js/components/order-reorder.js');
        const reorder = setupOrderReorder({ getUser: () => ({ MaNguoiDung: 12 }), onAdded: () => assert.fail('must not add') });
        await reorder.open({ MaDonHang: '45', TrangThaiDonHang: 3 });
        const buy = body.children[0].children.at(-1).children.find(child => child.id === 'reorder-buy');
        assert.equal(buy.disabled, false);
        await buy.listeners.click();
        assert.deepEqual(destinations, ['checkout.html?reorder=45&line=9007199254741001']);
        assert.deepEqual(requests, [['/api/orders/45/reorder', 'GET']]);
        assert.deepEqual(events, []);
    } finally { Object.assign(globalThis, original); }
});

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
