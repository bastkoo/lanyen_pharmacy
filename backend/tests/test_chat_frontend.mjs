import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.hidden = false; this.disabled = false; this.value = ''; this.files = []; this.scrollTop = 0; this.clientHeight = 200; this.classList = { toggle() {}, add() {} }; }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    async fire(type, details = {}) { for (const handler of this.listeners[type] || []) await handler({ preventDefault() {}, target: this, ...details }); }
    requestSubmit() { return this.fire('submit'); }
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
const aiReply = (text, products = [], question = 'Hỏi về thuốc') => ({ text, products, messages: [
    { id: '1', role: 'KHACH_HANG', text: question, products: [], at: '2026-11-24T10:00:00+07:00' },
    { id: '2', role: 'AI', text, products, at: '2026-11-24T10:00:01+07:00' },
] });

test('AI renders styled catalog cards safely, hands restricted products to pharmacist and posts a stable request ID', async () => {
    const env = environment();
    try {
        const calls = [], consultations = [];
        globalThis.fetch = async (url, options) => {
            if (url.endsWith('/auth/me')) return reply({ user: { MaNguoiDung: '12' }, csrf_token: 'csrf' });
            calls.push([url, JSON.parse(options.body)]);
            return reply(aiReply('<script>plain text</script>', [{ MaThuoc: 7, TenThuoc: '<b>Thuốc</b>', PhanLoai: true,
                HinhAnh: 'javascript:alert(1)', DonViGia: [{ MaDonGia: 3, GiaBan: 10000, DonViTinh: 'Hộp', ConHang: true }] }]));
        };
        const { createAiChat } = await import('../../frontend/js/components/ai-chat.js');
        const ai = createAiChat({ getOwner: () => '12', onConsult: product => consultations.push(product), onError: assert.fail });
        ai.setEnabled(true);
        const form = ai.element.querySelectorAll('form')[0], input = ai.element.querySelectorAll('textarea')[0];
        input.value = 'Hỏi về thuốc'; await form.fire('submit');
        assert.equal(calls[0][1].text, 'Hỏi về thuốc');
        assert.match(calls[0][1].request_id, /^[a-f0-9-]{36}$/);
        assert.deepEqual(Object.keys(calls[0][1]).sort(), ['request_id', 'text']);
        assert.ok(calls[0][0].endsWith('/chat/ai'));
        assert.equal(ai.element.querySelectorAll('img').length, 0);
        assert.ok(ai.element.querySelectorAll('p').some(p => p.textContent === '<script>plain text</script>'));
        const contact = ai.element.querySelectorAll('button').find(b => b.textContent === 'Liên hệ dược sĩ');
        await contact.click(); assert.deepEqual(consultations[0], { MaThuoc: 7, MaDonGia: 3 });
        ai.clear(); assert.equal(ai.element.querySelectorAll('article').length, 0); assert.equal(input.value, '');
    } finally { env.restore(); }
});

test('clearing AI during an in-flight request prevents a late response from restoring private content', async () => {
    const env = environment();
    try {
        let finish;
        globalThis.fetch = async url => url.endsWith('/auth/me') ? reply({ user: { MaNguoiDung: '12' }, csrf_token: 'csrf' }) : new Promise(resolve => { finish = resolve; });
        const { createAiChat } = await import('../../frontend/js/components/ai-chat.js');
        const ai = createAiChat({ getOwner: () => '12', onConsult() {}, onError: assert.fail });
        ai.setEnabled(true); ai.element.querySelectorAll('textarea')[0].value = 'Private question';
        const pending = ai.element.querySelectorAll('form')[0].fire('submit'); await settle();
        ai.clear(); finish(reply({ text: 'Private answer', products: [] })); await pending;
        assert.equal(ai.element.querySelectorAll('article').length, 0);
    } finally { env.restore(); }
});

test('widget keeps saved AI messages when closed and clears private memory on logout', async () => {
    const env = environment();
    try {
        globalThis.fetch = async url => {
            if (url.endsWith('/auth/me')) return reply({ user: { MaNguoiDung: '12' }, csrf_token: 'csrf' });
            if (url.endsWith('/unread')) return reply({ count: 0 });
            if (url.endsWith('/ai')) return reply(aiReply('Xin chào'));
            return reply({ items: [], has_more: false });
        };
        const { setupCustomerChat } = await import('../../frontend/js/components/customer-chat.js'); setupCustomerChat();
        env.emit('auth-changed', { user: { MaNguoiDung: '12', VaiTro: 0 } });
        await env.byId('customer-chat-button').click(); await settle();
        const panel = env.byId('customer-chat'), buttons = panel.querySelectorAll('button');
        const aiButton = buttons.find(b => b.textContent === 'Chat với AI'); await aiButton.click();
        assert.equal(aiButton.attributes['aria-pressed'], 'true');
        const ai = panel.children.at(-1); assert.equal(ai.hidden, false);
        ai.querySelectorAll('textarea')[0].value = 'Xin chào'; await ai.querySelectorAll('form')[0].fire('submit');
        assert.equal(ai.querySelectorAll('article').length, 2);
        await buttons.find(b => b.attributes['aria-label'] === 'Đóng trò chuyện').click();
        assert.equal(ai.querySelectorAll('article').length, 2);
        assert.equal(panel.hidden, true);
        env.emit('auth-changed', { user: null });
        assert.equal(ai.querySelectorAll('article').length, 0);
    } finally { env.restore(); }
});

test('AI reloads stored history, sends with Enter and keeps the same request after a failed send', async () => {
    const env = environment();
    try {
        const stored = aiReply('Câu trả lời đã lưu'), calls = []; let fail = true;
        globalThis.fetch = async (url, options) => {
            if (url.endsWith('/auth/me')) return reply({ user: { MaNguoiDung: '12' }, csrf_token: 'csrf' });
            if (url.endsWith('/ai/messages')) return reply({ items: stored.messages, has_more: false });
            calls.push(JSON.parse(options.body));
            if (fail) { fail = false; throw Error('Lost response'); }
            return reply(stored);
        };
        const { createAiChat } = await import('../../frontend/js/components/ai-chat.js');
        const ai = createAiChat({ getOwner: () => '12', onConsult() {}, onError: assert.fail });
        ai.setEnabled(true); await ai.load();
        assert.equal(ai.element.querySelectorAll('article').length, 2);
        assert.ok(ai.element.querySelectorAll('p').some(p => p.textContent === 'Câu trả lời đã lưu'));
        assert.equal(ai.element.querySelectorAll('button').some(b => b.textContent === 'Chat với dược sĩ'), false);
        const input = ai.element.querySelectorAll('textarea')[0]; input.value = 'Hỏi tiếp';
        await input.fire('keydown', { key: 'Enter', shiftKey: true }); assert.equal(calls.length, 0);
        await input.fire('keydown', { key: 'Enter', isComposing: true }); assert.equal(calls.length, 0);
        await input.fire('keydown', { key: 'Enter' }); await settle();
        await ai.element.querySelectorAll('form')[0].fire('submit');
        assert.deepEqual(calls[0], calls[1]);
        assert.equal(ai.element.querySelectorAll('article').length, 2);
    } finally { env.restore(); }
});

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
        assert.ok(composer.element.querySelectorAll('span').some(item => item.textContent === 'Gửi ảnh'));
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
        assert.equal(root.dataset.chatOpen, 'false');
        await root.querySelectorAll('button').find(item => item.className === 'employee-chat-thread').click(); await settle();
        assert.equal(root.dataset.chatOpen, 'true');
        const fieldset = root.querySelectorAll('fieldset')[0]; assert.equal(fieldset.disabled, true);
        await root.querySelectorAll('button').find(item => item.textContent === 'Tiếp nhận').click(); await settle();
        assert.ok(env.events.some(value => value?.type === 'employee-chats-changed'));
        assert.equal(fieldset.disabled, false);
        await root.querySelectorAll('button').find(item => item.attributes['aria-label'] === 'Trở về danh sách hội thoại').click();
        assert.equal(root.dataset.chatOpen, 'false'); assert.equal(fieldset.disabled, true);
        await root.querySelectorAll('button').find(item => item.className === 'employee-chat-thread').click(); await settle();
        assert.equal(root.dataset.chatOpen, 'true'); assert.equal(fieldset.disabled, false);
        await root.querySelectorAll('button').find(item => item.textContent === 'Kết thúc tư vấn').click(); await settle();
        assert.equal(root.dataset.chatOpen, 'false');
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
            if (url.includes('/counter/products?')) return reply({ items: [{ MaThuoc: 7, TenThuoc: 'Thuốc A', HinhAnh: 'https://example.com/product-a.png', DonViGia: [
                { MaDonGia: 3, DonViTinh: 'Viên', GiaBan: 1000, ConHang: true }, { MaDonGia: 4, DonViTinh: 'Hộp', GiaBan: 10000, GiaKhuyenMai: 8000, SoLuongKhuyenMai: 2, ConHang: true }
            ] }, { MaThuoc: 8, TenThuoc: 'Thuốc đã hết', HinhAnh: 'https://example.com/product-b.png', DonViGia: [{ MaDonGia: 5, DonViTinh: 'Hộp', GiaBan: 10000, ConHang: false }] }], total: 2 });
            if (options.method === 'POST') { posts.push(JSON.parse(options.body)); return posts.length === 1 ? reply({ code: 'OUT_OF_STOCK' }, 409) : reply({ message: { id: '1' } }); }
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
        const outOfStock = picker.querySelectorAll('article').find(item => item.dataset.available === 'false');
        assert.ok(outOfStock.querySelectorAll('span').some(item => item.textContent === 'Hết hàng'));
        assert.equal(outOfStock.querySelectorAll('button')[0].disabled, true);
        assert.equal(outOfStock.querySelectorAll('select')[0].disabled, true);
        assert.equal(outOfStock.querySelectorAll('input')[0].disabled, true);
        assert.equal(picker.querySelectorAll('img').length, 2);
        assert.equal(picker.querySelectorAll('img')[0].referrerPolicy, 'no-referrer');
        await picker.querySelectorAll('img')[0].fire('error');
        assert.equal(picker.querySelectorAll('img').length, 1);
        const units = picker.querySelectorAll('select')[0], quantity = picker.querySelectorAll('input').find(item => item.type === 'number');
        units.value = '4'; quantity.value = '3'; await quantity.fire('input');
        assert.ok(picker.querySelectorAll('p').some(item => item.textContent === 'Tạm tính: 26.000 ₫'));
        await picker.querySelectorAll('button').find(item => item.textContent === 'Chọn').click();
        assert.equal(picker.querySelectorAll('dd')[0].textContent, '26.000 ₫');
        assert.ok(picker.querySelectorAll('img').some(item => item.src === 'https://example.com/product-a.png'));
        await picker.querySelectorAll('button').find(item => item.textContent === 'Gửi thẻ sản phẩm').click(); await settle();
        assert.deepEqual(posts[0].items, [{ MaThuoc: 7, MaDonGia: 4, SoLuong: 3 }]);
        assert.equal(picker.open, true);
        assert.ok(picker.querySelectorAll('p').some(item => item.textContent?.includes('không còn đủ hàng')));
        await picker.querySelectorAll('button').find(item => item.textContent === 'Bỏ').click();
        quantity.value = '2'; await quantity.fire('input');
        await picker.querySelectorAll('button').find(item => item.textContent === 'Chọn').click();
        await picker.querySelectorAll('button').find(item => item.textContent === 'Gửi thẻ sản phẩm').click(); await settle();
        assert.deepEqual(posts[1].items, [{ MaThuoc: 7, MaDonGia: 4, SoLuong: 2 }]);
        assert.notEqual(posts[0].request_id, posts[1].request_id);
        assert.equal(picker.open, false);
        const { renderChatMessage } = await import('../../frontend/js/components/chat.js');
        const message = renderChatMessage({ id: '1', role: 1, kind: 'offer', at: '2026-11-23T10:00:00+07:00', items: [{ TenThuoc: 'Thuốc A', DonViTinh: 'Hộp', SoLuong: 3, DonGia: '8000', ThanhTien: '26000', SoLuongKhuyenMai: 2 }] });
        assert.ok(message.querySelectorAll('strong').some(item => item.textContent === 'Thành tiền: 26.000 ₫'));
    } finally { ui?.clear(); env.restore(); }
});

test('customer Buy now only reads the offer quote and navigates without any cart mutation', async () => {
    const env = environment();
    try {
        const calls = [];
        globalThis.fetch = async (url, options) => {
            calls.push([url, options]);
            if (url.endsWith('/auth/me')) return reply({ user: { MaNguoiDung: '12' }, csrf_token: 'csrf' });
            return reply({ unit_ids: [3, 4] });
        };
        const { renderChatMessage } = await import('../../frontend/js/components/chat.js');
        const message = renderChatMessage({ id: '21', kind: 'offer', role: 1, at: '2026-11-23T10:00:00+07:00', items: [
            { TenThuoc: 'Thuốc A', DonViTinh: 'Hộp', SoLuong: 2 }
        ] }, { customer: true, getOwner: () => '12' });
        const buttons = message.querySelectorAll('button');
        assert.equal(buttons.length, 1); assert.equal(buttons[0].textContent, 'Mua ngay');
        await buttons[0].click();
        assert.equal(calls.length, 1);
        assert.ok(calls[0][0].endsWith('/chat/offers/21/quote'));
        assert.equal(calls[0][1].method, 'GET');
        assert.equal(env.events.some(value => value?.type === 'cart-changed'), false);
        assert.ok(env.events.some(value => typeof value === 'string' && value.endsWith('/pages/customer/checkout.html?offer=21')));
    } finally { env.restore(); }
});

test('direct chat quote and checkout use their own API and never call a cart endpoint', async () => {
    const env = environment();
    try {
        const calls = [];
        globalThis.fetch = async (url, options) => {
            calls.push([new URL(url).pathname, options]);
            return reply(url.endsWith('/auth/me') ? { user: { MaNguoiDung: '12' }, csrf_token: 'csrf' } : { code: 'ORDER_CREATED', order: { MaDonHang: '45' } });
        };
        const { quoteChatOffer, checkoutChatOffer } = await import('../../frontend/js/api/chat.js');
        await quoteChatOffer('21');
        const values = { PhuongThucThanhToan: 0, HinhThucNhanHang: 'pickup', GhiChu: '', TongThanhToan: '26000' };
        await checkoutChatOffer('21', values, '12');
        assert.deepEqual(calls.map(([path]) => path), ['/api/chat/offers/21/quote', '/api/auth/me', '/api/chat/offers/21/checkout']);
        assert.equal(calls[0][1].method, 'GET'); assert.equal(calls[2][1].method, 'POST');
        assert.deepEqual(JSON.parse(calls[2][1].body), values); assert.equal(calls[2][1].headers['X-CSRF-Token'], 'csrf');
    } finally { env.restore(); }
});
