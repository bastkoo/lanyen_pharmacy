import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const validation = await import('../../frontend/js/utils/auth-validation.js');
const api = await import('../../frontend/js/api/auth.js');
const reply = (code, status = 200, extra = {}) => ({ ok: status < 400, status,
    text: async () => JSON.stringify({ code, ...extra }) });

test('login dialog keeps OTP cooldown and routes authenticated staff by role only after verification', async () => {
    const previous = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, setInterval: globalThis.setInterval, now: Date.now };
    try {
        const { setupAuthDialog } = await import('../../frontend/js/components/auth-dialog.js');
        for (const role of [0, 1, 2]) {
            const elements = new Map(), redirects = [], authenticated = [];
            let tick, focused, submittedOtp, now = 100000;
            Date.now = () => now;
            globalThis.setInterval = handler => { tick = handler; return 0; };
            const byId = id => {
                if (!elements.has(id)) elements.set(id, {
                    value: '', dataset: {}, attributes: {}, listeners: {}, open: false,
                    addEventListener(type, handler) { this.listeners[type] = handler; },
                    setAttribute(key, value) { this.attributes[key] = value; },
                    removeAttribute(key) { delete this.attributes[key]; },
                    querySelectorAll() { return []; }, reset() {}, focus() { focused = id; }, select() {},
                    show() { this.open = true; }, close() { this.open = false; }
                });
                return elements.get(id);
            };
            globalThis.document = { getElementById: byId, querySelectorAll: () => [], addEventListener() {}, body: { classList: { add() {}, remove() {} } } };
            globalThis.window = { addEventListener() {}, location: { assign: url => redirects.push(url) } };
            let requests = 0;
            globalThis.fetch = async (url, options) => {
                if (url.endsWith('/me')) return reply('UNAUTHENTICATED', 401, { csrf_token: 'csrf' });
                if (url.endsWith('/otp/request')) { requests++; return reply('OTP_SENT', 200, { retry_after: 60 }); }
                if (url.endsWith('/otp/verify')) { submittedOtp = JSON.parse(options.body).otp; return reply('AUTHENTICATED', 200, { user: { VaiTro: role } }); }
                assert.fail(url);
            };
            const open = setupAuthDialog(user => authenticated.push(user));
            open();
            assert.equal(byId('auth-progress').hidden, true);
            byId('phone').value = '0901234567';
            const submit = async id => {
                byId(id).listeners.submit({ preventDefault() {} });
                for (let attempt = 0; attempt < 30 && byId('auth-dialog').attributes['aria-busy'] === 'true'; attempt++) await new Promise(resolve => setImmediate(resolve));
                assert.equal(byId('auth-dialog').attributes['aria-busy'], 'false');
            };
            await submit('phone-form');
            assert.equal(byId('auth-progress').hidden, true);
            assert.equal(byId('auth-status').textContent, 'Mã OTP đã được tạo. Mã có hiệu lực trong 5 phút.');
            assert.equal(byId('resend-otp').disabled, true);
            assert.equal(byId('resend-otp').textContent, 'Gửi lại sau 60s');
            byId('resend-otp').listeners.click();
            assert.equal(requests, 1);
            assert.deepEqual(redirects, []);
            now += 60000; tick();
            assert.equal(byId('resend-otp').disabled, false);
            assert.equal(byId('resend-otp').textContent, 'Gửi lại mã');
            byId('change-phone').listeners.click();
            assert.equal(byId('phone-form').hidden, false);
            assert.equal(byId('auth-progress').hidden, true);
            await submit('phone-form');
            byId('otp').value = '1'; byId('otp').listeners.input();
            assert.equal(focused, 'otp-2');
            byId('otp-2').value = 'a'; byId('otp-2').listeners.input();
            assert.equal(byId('otp-2').value, '');
            byId('otp-2').listeners.keydown({ key: 'Backspace', preventDefault() {} });
            assert.equal(focused, 'otp');
            byId('otp').listeners.paste({ preventDefault() {}, clipboardData: { getData: () => '12 34 56' } });
            assert.deepEqual(['otp', 'otp-2', 'otp-3', 'otp-4', 'otp-5', 'otp-6'].map(id => byId(id).value), ['1', '2', '3', '4', '5', '6']);
            assert.equal(focused, 'otp-6');
            await submit('otp-form');
            assert.equal(submittedOtp, '123456');
            assert.equal(byId('auth-dialog').open, false);
            if (role === 0) {
                assert.deepEqual(redirects, []);
                assert.deepEqual(authenticated, [{ VaiTro: 0 }]);
            } else {
                assert.equal(redirects.length, 1);
                assert.ok(redirects[0].endsWith(role === 1 ? '/pages/employee/index.html#orders' : '/pages/manager/index.html#overview'));
                assert.deepEqual(authenticated, []);
            }
        }
    } finally {
        Date.now = previous.now;
        globalThis.fetch = async () => reply('LOGGED_OUT');
        await api.logoutSession();
        Object.assign(globalThis, { document: previous.document, window: previous.window, fetch: previous.fetch, setInterval: previous.setInterval });
    }
});

test('phone validation accepts local/international and rejects malformed input', () => {
    assert.equal(validation.normalizePhone(' 090 123 4567 '), '+84901234567');
    assert.equal(validation.normalizePhone('+84 901-234-567'), '+84901234567');
    for (const input of ['', 'abc', '+', '123456', '+012345', '+12025550123', '090123456789012345']) {
        assert.throws(() => validation.normalizePhone(input));
    }
});
test('OTP/name validation preserves paste and rejects invalid values', () => {
    assert.equal(validation.validOtp('123456'), true);
    for (const otp of ['12345', '1234567', '12a456']) assert.equal(validation.validOtp(otp), false);
    assert.equal(validation.validName(' Nguyễn An '), true);
    for (const name of ['', '   ', 'a'.repeat(256), 'An\n']) assert.equal(validation.validName(name), false);
});
test('API bootstraps CSRF, preserves credentials and sends profile to actual contract', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith('/me')) return reply('UNAUTHENTICATED', 401, { csrf_token: 'guest-csrf' });
        return reply('PROFILE_REQUIRED', 200, { csrf_token: 'guest-csrf' });
    };
    assert.equal((await api.requestOtp('+84901234567')).code, 'PROFILE_REQUIRED');
    assert.equal(calls[0].url, 'http://127.0.0.1:5000/api/auth/me');
    assert.ok(calls[1].url.endsWith('/otp/request'));
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(calls[1].options.headers['X-CSRF-Token'], 'guest-csrf');
    assert.deepEqual(JSON.parse(calls[1].options.body), { phone: '+84901234567' });
    await api.verifyOtp('+84901234567', '123456');
    assert.deepEqual(JSON.parse(calls[2].options.body), { phone: '+84901234567', otp: '123456' });
    assert.ok(calls[2].url.endsWith('/otp/verify'));
    await api.registerProfile('Nguyễn An');
    assert.ok(calls[3].url.endsWith('/register'));
    assert.deepEqual(JSON.parse(calls[3].options.body), { ho_ten: 'Nguyễn An' });
});
test('API uses rotated CSRF on logout and propagates locked/network errors', async () => {
    let posted;
    globalThis.fetch = async (url, options) => {
        if (url.endsWith('/me')) return reply('AUTHENTICATED', 200, { csrf_token: 'rotated' });
        posted = options;
        return reply('LOGGED_OUT');
    };
    await api.logoutSession();
    assert.equal(posted.headers['X-CSRF-Token'], 'rotated');
    globalThis.fetch = async () => reply('ACCOUNT_LOCKED', 403);
    await assert.rejects(api.getSession(), error => error.code === 'ACCOUNT_LOCKED' && error.status === 403);
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(api.getSession(), error => error.code === 'CONNECTION_FAILED');
});
test('HTML has unique IDs, labels, real asset references and safe module wiring', () => {
    const filename = fileURLToPath(new URL('../../frontend/pages/customer/home.html', import.meta.url));
    const html = readFileSync(filename, 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const input of ['phone', 'otp', 'full-name']) assert.ok(html.includes(`for="${input}"`));
    for (const match of html.matchAll(/(?:href|src)="(\.\.\/[^"#]+)"/g)) {
        assert.ok(existsSync(path.resolve(path.dirname(filename), match[1])), match[1]);
    }
    const js = ['pages/home.js', 'components/auth-dialog.js', 'api/auth.js'];
    for (const file of js) {
        const source = readFileSync(new URL(`../../frontend/js/${file}`, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /localStorage|sessionStorage|innerHTML|console\.log/);
    }
});
