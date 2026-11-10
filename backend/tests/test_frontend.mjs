import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const validation = await import('../../frontend/js/utils/auth-validation.js');
const api = await import('../../frontend/js/api/auth.js');
const reply = (code, status = 200, extra = {}) => ({ ok: status < 400, status,
    json: async () => ({ code, ...extra }) });

test('phone validation accepts local/international and rejects malformed input', () => {
    assert.equal(validation.normalizePhone(' 090 123 4567 '), '+84901234567');
    assert.equal(validation.normalizePhone('+84 901-234-567'), '+84901234567');
    for (const input of ['', 'abc', '+', '123456', '+012345', '090123456789012345']) {
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
    assert.equal((await api.loginWithFirebase('token')).code, 'PROFILE_REQUIRED');
    assert.equal(calls[0].url, 'http://localhost:5000/api/auth/me');
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(calls[1].options.headers['X-CSRF-Token'], 'guest-csrf');
    assert.deepEqual(JSON.parse(calls[1].options.body), { id_token: 'token' });
    await api.loginWithFirebase('fresh-token', 'Nguyễn An');
    assert.deepEqual(JSON.parse(calls[2].options.body), { id_token: 'fresh-token', ho_ten: 'Nguyễn An' });
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
    const js = ['pages/home.js', 'components/auth-dialog.js', 'api/auth.js', 'config/firebase.js'];
    for (const file of js) {
        const source = readFileSync(new URL(`../../frontend/js/${file}`, import.meta.url), 'utf8');
        assert.doesNotMatch(source, /localStorage|sessionStorage|innerHTML|console\.log/);
    }
});
