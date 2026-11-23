import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.hidden = false; this.disabled = false; this.value = ''; this.files = []; this.scrollTop = 0; this.clientHeight = 200; this.classList = { toggle() {}, add() {} }; }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    async fire(type) { for (const handler of this.listeners[type] || []) await handler({ preventDefault() {}, target: this }); }
    click() { return this.fire('click'); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire('close'); }
    getClientRects() { return [{}]; }
    closest(tag) { return this.tagName === tag ? this : this.parentElement?.closest(tag); }
    querySelectorAll(selector) { return this.children.flatMap(child => [ ...(selector.split(',').includes(child.tagName) ? [child] : []), ...child.querySelectorAll(selector) ]); }
    get scrollHeight() { return this.children.length * 100; }
}
function environment() {
    const previous = Object.fromEntries(['document', 'window', 'location', 'fetch'].map(key => [key, globalThis[key]]));
    const body = new Element('body'), head = new Element('head'), handlers = {}, events = [];
    const byId = id => [...head.children, ...body.children, ...head.querySelectorAll('button,input,section,h2,div'), ...body.querySelectorAll('button,input,section,h2,div')].find(item => item.id === id);
    globalThis.document = { body, head, createElement: tag => new Element(tag), createElementNS: (namespace, tag) => { const element = new Element(tag); element.namespaceURI = namespace; return element; }, getElementById: byId, hasFocus: () => true, hidden: false };
    globalThis.location = { protocol: 'http:', hostname: 'localhost', assign: value => events.push(value) };
    globalThis.window = { addEventListener(type, handler) { (handlers[type] ||= []).push(handler); }, dispatchEvent(event) { events.push(event); for (const handler of handlers[event.type] || []) handler(event); } };
    return { events, byId, body, emit: (type, detail) => window.dispatchEvent({ type, detail }), restore() { window.dispatchEvent({ type: 'pagehide' }); Object.assign(globalThis, previous); } };
}
const reply = (value, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(value) });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('consultation button sends the chosen product to chat instead of mutating the cart', async () => {
    const env = environment();
    try {
        const { purchaseControls } = await import('../../frontend/js/components/cart.js');
        globalThis.fetch = () => assert.fail('Consultation must not add directly to cart');
        const product = { MaThuoc: 7, TenThuoc: 'Thuốc', PhanLoai: true, DonViGia: [{ MaDonGia: 3, DonViTinh: 'Hộp', GiaBan: 10000, ConHang: true }] };
        const controls = purchaseControls(product), buy = controls.querySelectorAll('button')[0];
        assert.equal(buy.textContent, 'Nhắn tin'); assert.equal(buy.disabled, false); await buy.click();
        assert.ok(controls.querySelectorAll('p').some(item => item.textContent === 'Cần dược sĩ tư vấn'));
        assert.deepEqual(env.events.at(-1).detail, { MaThuoc: 7, MaDonGia: 3 });
        product.DonViGia[0].ConHang = false;
        const unavailable = purchaseControls(product).querySelectorAll('button')[0];
        assert.equal(unavailable.disabled, true); assert.equal(unavailable.textContent, 'Hết hàng');
    } finally { env.restore(); }
});

test('composer retains the same request after a lost response and uploads images with CSRF', async () => {
    const env = environment();
    try {
        const { createChatComposer } = await import('../../frontend/js/components/chat.js');
        const posts = [], sent = []; let fail = true;
        globalThis.fetch = async (url, options) => {
            if (url.endsWith('/auth/me')) return reply({ user: { MaNguoiDung: '12' }, csrf_token: 'csrf' });
            assert.equal(options.headers['X-CSRF-Token'], 'csrf');
            if (url.endsWith('/images')) { assert.ok(options.body instanceof FormData); assert.equal(options.headers['Content-Type'], undefined); return reply({ data: { url: 'https://example.com/chat.png' } }); }
            posts.push(JSON.parse(options.body)); if (fail) { fail = false; throw Error('Lost response'); }
            return reply({ message: { id: '1' } });
        };
        const composer = createChatComposer({ getOwner: () => '12', getContext: () => ({ messages: '/messages', images: '/images' }), onSent: value => sent.push(value) });
        composer.setEnabled(true);
        const text = composer.element.querySelectorAll('textarea')[0]; text.value = 'Xin tư vấn';
        assert.ok(composer.element.querySelectorAll('span').some(item => item.textContent === 'Gửi tệp'));
        await composer.element.fire('submit'); assert.equal(text.disabled, true);
        await composer.element.fire('submit'); assert.deepEqual(posts[0], posts[1]); assert.equal(sent.length, 1); assert.equal(text.value, '');
        const file = composer.element.querySelectorAll('input')[0]; file.files = [new File(['image'], 'chat.png', { type: 'image/png' })];
        await composer.element.fire('submit');
        assert.equal(posts.at(-1).kind, 'image'); assert.equal(posts.at(-1).url, 'https://example.com/chat.png');
        composer.clear();
    } finally { env.restore(); }
});

test('customer widget counts unread, reads only when open and clears private history on logout', async () => {
    const env = environment();
    try {
        const reads = [], calls = [];
        globalThis.fetch = async (url, options) => {
            calls.push(url);
            if (url.endsWith('/auth/me')) return reply({ user: { MaNguoiDung: '12' }, csrf_token: 'csrf' });
            if (url.endsWith('/unread')) return reply({ count: 2 });
            if (url.endsWith('/read')) { reads.push(JSON.parse(options.body)); return reply({}); }
            return reply({ items: [{ id: '9007199254741001', role: 1, sender: 'Dược sĩ', kind: 'text', text: '<script>not HTML</script>', at: '2026-11-23T10:00:00+07:00' }], has_more: false });
        };
        const { setupCustomerChat } = await import('../../frontend/js/components/customer-chat.js'); setupCustomerChat();
        env.emit('auth-changed', { user: { MaNguoiDung: '12', VaiTro: 0 } }); await settle();
        const trigger = env.byId('customer-chat-button');
        assert.match(trigger.attributes['aria-label'], /2 tin chưa đọc/); assert.equal(reads.length, 0);
        await trigger.click(); await settle(); await settle();
        assert.deepEqual(reads.at(-1), { last_id: '9007199254741001' });
        const panel = env.byId('customer-chat'); assert.equal(panel.hidden, false);
        assert.equal(panel.querySelectorAll('article').length, 1);
        assert.ok(panel.querySelectorAll('p').some(item => item.textContent === '<script>not HTML</script>'));
        env.emit('auth-changed', { user: null });
        assert.equal(panel.hidden, true); assert.equal(panel.querySelectorAll('article').length, 0);
    } finally { env.restore(); }
});

test('employee UI claims before replying and removes finished conversations', async () => {
    const env = environment();
    try {
        const root = new Element('div'); document.querySelector = () => root;
        let assigned = false, finished = false;
        globalThis.fetch = async (url, options) => {
            if (url.endsWith('/auth/me')) return reply({ user: { MaNguoiDung: '8' }, csrf_token: 'csrf' });
            if (url.includes('/threads?')) return reply({ items: finished ? [] : [{ id: '1', status: assigned ? 1 : 0, assigned: assigned ? '8' : null, customer: { HoTen: 'Khách', SDT: '0900000000' } }], total: finished ? 0 : 1, per_page: 20 });
            if (url.endsWith('/claim')) { assigned = true; return reply({ thread: { id: '1', status: 1, assigned: '8' } }); }
            if (url.endsWith('/finish')) { finished = true; return reply({}); }
            return reply({ items: [], has_more: false, thread: { id: '1', status: assigned ? 1 : 0, assigned: assigned ? '8' : null } });
        };
        const { setupEmployeeChat } = await import('../../frontend/js/pages/employee-chat.js');
        const ui = setupEmployeeChat({ getUser: () => ({ MaNguoiDung: '8', VaiTro: 1 }), onSessionError() { assert.fail('Unexpected auth failure'); } });
        ui.activate(); await settle();
        await root.querySelectorAll('button').find(item => item.className === 'employee-chat-thread').click(); await settle();
        const fieldset = root.querySelectorAll('fieldset')[0]; assert.equal(fieldset.disabled, true);
        await root.querySelectorAll('button').find(item => item.textContent === 'Tiếp nhận').click(); await settle();
        assert.equal(fieldset.disabled, false);
        await root.querySelectorAll('button').find(item => item.textContent === 'Kết thúc tư vấn').click(); await settle();
        assert.equal(fieldset.disabled, true); assert.equal(root.querySelectorAll('button').filter(item => item.className === 'employee-chat-thread').length, 0);
        ui.clear();
    } finally { env.restore(); }
});

test('employee product tool opens a modal and sends the selected unit and quantity with a price preview', async () => {
    const env = environment(); let ui;
    try {
        const root = new Element('div'); document.querySelector = () => root;
        const posts = [];
        globalThis.fetch = async (url, options) => {
            if (url.endsWith('/auth/me')) return reply({ user: { MaNguoiDung: '8' }, csrf_token: 'csrf' });
            if (url.includes('/threads?')) return reply({ items: [{ id: '1', status: 1, assigned: '8', customer: { HoTen: 'Khách', SDT: '0900000000' } }], total: 1, per_page: 20 });
            if (url.includes('/counter/products?')) return reply({ items: [{ MaThuoc: 7, TenThuoc: 'Thuốc A', DonViGia: [
                { MaDonGia: 3, DonViTinh: 'Viên', GiaBan: 1000 }, { MaDonGia: 4, DonViTinh: 'Hộp', GiaBan: 10000, GiaKhuyenMai: 8000, SoLuongKhuyenMai: 2 }
            ] }], total: 1 });
            if (options.method === 'POST') { posts.push(JSON.parse(options.body)); return reply({ message: { id: '1' } }); }
            return reply({ items: [], has_more: false, thread: { id: '1', status: 1, assigned: '8' } });
        };
        const { setupEmployeeChat } = await import('../../frontend/js/pages/employee-chat.js');
        ui = setupEmployeeChat({ getUser: () => ({ MaNguoiDung: '8', VaiTro: 1 }), onSessionError() { assert.fail('Unexpected auth error'); } });
        ui.activate(); await settle();
        await root.querySelectorAll('button').find(item => item.className === 'employee-chat-thread').click(); await settle();
        const picker = root.querySelectorAll('dialog')[0]; assert.equal(picker.hidden, true);
        const attach = root.querySelectorAll('button').find(item => item.attributes['aria-label'] === 'Gửi tệp ảnh');
        assert.equal(attach.querySelectorAll('svg').length, 1);
        await root.querySelectorAll('button').find(item => item.attributes['aria-label'] === 'Thêm sản phẩm tư vấn').click(); await settle();
        assert.equal(picker.open, true);
        const units = picker.querySelectorAll('select')[0], quantity = picker.querySelectorAll('input').find(item => item.type === 'number');
        units.value = '4'; quantity.value = '3'; await quantity.fire('input');
        assert.ok(picker.querySelectorAll('p').some(item => item.textContent === 'Tạm tính: 26.000 ₫'));
        await picker.querySelectorAll('button').find(item => item.textContent === 'Chọn').click();
        await picker.querySelectorAll('button').find(item => item.textContent === 'Gửi thẻ sản phẩm').click(); await settle();
        assert.deepEqual(posts[0].items, [{ MaThuoc: 7, MaDonGia: 4, SoLuong: 3 }]);
        assert.equal(picker.open, false);
        const { renderChatMessage } = await import('../../frontend/js/components/chat.js');
        const message = renderChatMessage({ id: '1', role: 1, kind: 'offer', at: '2026-11-23T10:00:00+07:00', items: [{ TenThuoc: 'Thuốc A', DonViTinh: 'Hộp', SoLuong: 3, DonGia: '8000', ThanhTien: '26000', SoLuongKhuyenMai: 2 }] });
        assert.ok(message.querySelectorAll('strong').some(item => item.textContent === 'Thành tiền: 26.000 ₫'));
    } finally { ui?.clear(); env.restore(); }
});
