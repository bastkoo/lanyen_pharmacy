import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/cart.js');
const auth = await import('../../frontend/js/api/auth.js');
const { money, purchaseControls } = await import('../../frontend/js/components/cart.js');
const { withSessionRequest } = await import('../../frontend/js/utils/session-requests.js');
const reply = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

test('consultation products show promotion quota and update it when the unit changes', () => {
    const previous = globalThis.document;
    class Element {
        children = []; listeners = {}; classList = { add() {} };
        constructor(tag) { this.tagName = tag; }
        append(...children) { this.children.push(...children); }
        replaceChildren(...children) { this.children = children; }
        setAttribute() {}
        addEventListener(name, callback) { this.listeners[name] = callback; }
    }
    globalThis.document = { createElement: tag => new Element(tag) };
    try {
        for (const state of ['UPCOMING', 'ACTIVE']) {
            const controls = purchaseControls({ MaThuoc: 1, TenThuoc: 'Sản phẩm tư vấn', PhanLoai: true,
                KhuyenMai: { TrangThai: state }, DonViGia: [
                    { MaDonGia: 1, DonViTinh: 'Hộp', GiaBan: 100000, GiaKhuyenMai: 80000, SoLuongKhuyenMai: 2, ConHang: true },
                    { MaDonGia: 2, DonViTinh: 'Vỉ', GiaBan: 10000, GiaKhuyenMai: 8000, SoLuongKhuyenMai: 20, ConHang: true }
                ] });
            const quota = controls.children.find(child => child.className === 'sale-quota');
            const price = controls.children.find(child => child.className === 'catalog-price');
            const prefix = state === 'UPCOMING' ? 'Dự kiến' : 'Còn';
            assert.equal(quota.hidden, false);
            assert.equal(quota.textContent, `${prefix} 2 Hộp ưu đãi`);
            assert.equal(price.textContent, 'Cần dược sĩ tư vấn');
            const units = controls.children.find(child => child.tagName === 'fieldset');
            units.children[2].children[0].listeners.change();
            assert.equal(quota.textContent, `${prefix} 20 Vỉ ưu đãi`);
            assert.equal(price.textContent, 'Cần dược sĩ tư vấn');
        }
    } finally { globalThis.document = previous; }
});

test('cart guest and account requests use cookies, fresh CSRF and only product/unit identifiers', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return reply(options.method === 'GET' ? { code: 'CART_LISTED', items: [], csrf_token: 'fresh-cart-token' } : { code: 'CART_ITEM_ADDED' });
    };
    await api.addCartItem(7, 8);
    await api.removeCartItem(8);
    assert.deepEqual(calls.map(call => [new URL(call.url).pathname, call.options.method]), [
        ['/api/cart', 'GET'], ['/api/cart/items', 'POST'], ['/api/cart', 'GET'], ['/api/cart/items/8', 'DELETE']
    ]);
    assert.deepEqual(JSON.parse(calls[1].options.body), { MaThuoc: 7, MaDonGia: 8 });
    for (const call of calls) {
        assert.equal(call.options.credentials, 'include');
        assert.equal(call.options.cache, 'no-store');
        if (call.options.method !== 'GET') assert.equal(call.options.headers['X-CSRF-Token'], 'fresh-cart-token');
    }
});

test('cart mutation failures propagate without automatic retry; failed reads prevent writes', async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return reply({ code: 'DATABASE_UNAVAILABLE' }, 503); };
    await assert.rejects(api.addCartItem(7, 8), error => error.code === 'DATABASE_UNAVAILABLE');
    assert.equal(calls, 1);
    calls = 0;
    globalThis.fetch = async (_, options) => { calls++; return options.method === 'GET' ? reply({ csrf_token: 'x' }) : reply({ code: 'UNIT_NOT_FOUND' }, 404); };
    await assert.rejects(api.addCartItem(7, 8), error => error.code === 'UNIT_NOT_FOUND');
    assert.equal(calls, 2);
});

test('cart and auth requests serialize the entire CSRF-read/write sequence', async () => {
    const events = []; let release;
    const held = new Promise(resolve => { release = resolve; });
    globalThis.fetch = async (url, options) => {
        const path = new URL(url).pathname;
        events.push(path);
        if (path === '/api/cart') { await held; return reply({ csrf_token: 'guest' }); }
        return reply({ code: 'AUTHENTICATED', csrf_token: 'new-session' });
    };
    const add = api.addCartItem(7, 8);
    const login = auth.verifyOtp('+84901234567', '123456');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(events, ['/api/cart']);
    release();
    await Promise.all([add, login]);
    assert.deepEqual(events, ['/api/cart', '/api/cart/items', '/api/auth/me', '/api/auth/otp/verify']);
});

test('a rejected session task does not block later requests and VND totals remain exact', async () => {
    await assert.rejects(withSessionRequest(() => { throw new Error('failed'); }));
    assert.equal(await withSessionRequest(() => 7), 7);
    assert.equal(money('4611686014132420609'), '4.611.686.014.132.420.609 ₫');
});
