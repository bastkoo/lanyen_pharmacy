import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.hidden = false; this.disabled = false; this.value = ''; this.textContent = ''; this.isConnected = true; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    async fire(type, target = this) { for (const handler of this.listeners[type] || []) await handler({ target, preventDefault() {}, stopImmediatePropagation() {} }); }
    closest(tag) { return this.tagName === tag ? this : null; }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    getClientRects() { return [{}]; }
    querySelectorAll(selector) {
        const tags = selector.split(',');
        return this.children.flatMap(child => [ ...(tags.includes(child.tagName) ? [child] : []), ...child.querySelectorAll(selector) ]);
    }
    get validity() { const number = Number(this.value); return { valid: !!this.value && Number.isInteger(number) && number >= Number(this.min) && number <= Number(this.max) }; }
    reportValidity() { return this.querySelectorAll('input').every(input => input.validity.valid); }
}

test('employee return UI searches, defaults remaining quantity, confirms, retries safely, and clears account data', async () => {
    const previous = { document: globalThis.document, window: globalThis.window, location: globalThis.location, fetch: globalThis.fetch };
    const elements = new Map();
    const byId = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
    globalThis.document = { getElementById: byId, createElement: tag => new Element(tag), querySelector: () => null };
    globalThis.window = { dispatchEvent() {} };
    globalThis.location = { protocol: 'http:', hostname: 'localhost' };
    const requests = [], posts = [];
    let networkFailure = true;
    const order = { MaDonHang: '45', NgayDat: '2026-11-23T09:30:00+07:00', TongThanhToan: '25550', TrangThaiDonHang: 3, CanReturn: true, KhachHang: { HoTen: '<script>test</script>', SDT: '0900000000' },
        items: [{ MaChiTiet: '1', TenThuoc: 'Thuốc A', HinhAnh: 'https://example.com/thuoc.jpg', SoLuong: 3, DaTra: 1, ConLai: 2, DonViTinh: 'Viên', TienSauGiam: '25550' }], history: [] };
    const response = value => ({ ok: true, text: async () => JSON.stringify(value) });
    globalThis.fetch = async (url, options) => {
        const path = new URL(url).pathname;
        requests.push([String(url), options]);
        if (path.endsWith('/auth/me')) return response({ user: { MaNguoiDung: '8' }, csrf_token: 'csrf' });
        if (options.method === 'POST') {
            assert.equal(options.headers['X-CSRF-Token'], 'csrf');
            posts.push(JSON.parse(options.body));
            if (networkFailure) { networkFailure = false; throw Error('Lost response'); }
            order.items[0].DaTra = 3; order.items[0].ConLai = 0; order.TrangThaiDonHang = 5;
            return response({ code: 'EMPLOYEE_RETURNED', order, receipt: { amount: '17034' } });
        }
        if (path.endsWith('/45/returns')) return response({ code: 'EMPLOYEE_RETURN_DETAIL', order });
        return response({ items: [{ ...order, TongThanhToan: '25550' }], total: 1, per_page: 20 });
    };
    const settle = () => new Promise(resolve => setImmediate(resolve));
    try {
        const { setupEmployeeReturns } = await import('../../frontend/js/pages/employee-returns.js');
        let user = { MaNguoiDung: '8', VaiTro: 1 };
        const ui = setupEmployeeReturns({ getUser: () => user, onSessionError() { assert.fail('Unexpected session failure'); } });
        ui.activate(); await settle();
        assert.equal(byId('return-rows').children.length, 1);
        assert.equal(byId('return-rows').querySelectorAll('time')[0].dateTime, order.NgayDat);
        byId('employee-return-search').value = '0900';
        await byId('return-search-form').fire('submit'); await settle();
        assert.ok(requests.some(([url]) => url.includes('search=0900')));
        await byId('return-rows').querySelectorAll('button')[0].fire('click'); await settle();
        assert.equal(byId('return-detail').open, true);
        assert.match(byId('return-content').querySelectorAll('time')[0].textContent, /^Ngày mua:/);
        assert.match(byId('return-content').querySelectorAll('time')[0].textContent, /23\/11\/26/);
        assert.match(byId('return-content').querySelectorAll('time')[0].textContent, /09:30/);
        const image = byId('return-content').querySelectorAll('img')[0];
        assert.equal(image.src, order.items[0].HinhAnh);
        assert.equal(image.alt, 'Thuốc A');
        await image.fire('error');
        assert.equal(byId('return-content').querySelectorAll('img').length, 0);
        await byId('return-close').fire('click');
        const row = byId('return-rows').children[0];
        for (const cell of row.children) {
            await row.fire('click', cell); await settle();
            assert.equal(byId('return-detail').open, true);
            const summary = byId('return-content').querySelectorAll('dl')[0];
            assert.equal(summary.querySelectorAll('dt')[0].textContent, 'Tổng tiền đã thanh toán trước đó');
            assert.match(summary.querySelectorAll('dd')[0].textContent, /25\.550/);
            await byId('return-close').fire('click');
            assert.equal(document.activeElement, row.querySelectorAll('button')[0]);
        }
        await row.querySelectorAll('button')[0].fire('click'); await settle();
        const input = byId('return-content').querySelectorAll('input')[0];
        assert.equal(input.value, '2'); assert.equal(input.max, '2');
        const form = byId('return-content').querySelectorAll('form')[0];
        input.value = '3'; await form.fire('submit');
        assert.equal(byId('return-confirm').hidden, true);
        input.value = '2'; await input.fire('input'); await form.fire('submit');
        assert.equal(byId('return-confirm').hidden, false);
        assert.ok(byId('return-confirm-description').textContent.includes('17.034'));
        await byId('return-confirm-submit').fire('click');
        assert.equal(byId('return-confirm-submit').disabled, false);
        await byId('return-confirm-submit').fire('click'); await settle();
        assert.deepEqual(posts[0], posts[1]);
        assert.equal(posts[0].DaTra, 1); assert.equal(posts[0].SoLuong, 2);
        assert.match(byId('return-detail-state').textContent, /17\.034/);
        assert.equal(byId('return-content').querySelectorAll('input').length, 0);
        user = null; ui.clear();
        assert.equal(byId('return-content').children.length, 0);
        assert.equal(byId('return-rows').children.length, 0);
        assert.equal(byId('return-detail').open, false);
    } finally { Object.assign(globalThis, previous); }
});
