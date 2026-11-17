import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/auth.js');
const reply = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });

test('own-profile writes whitelist name/avatar and obtain fresh session CSRF', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return reply(options.method === 'GET' ? { csrf_token: 'fresh-profile' } : { code: 'PROFILE_UPDATED' });
    };
    await api.updateProfile({ HoTen: 'An', AnhDaiDien: null, SDT: 'injected', MaNguoiDung: 999, VaiTro: 2 });
    assert.deepEqual(calls.map(call => [new URL(call.url).pathname, call.options.method]), [['/api/auth/me', 'GET'], ['/api/auth/me', 'PUT']]);
    assert.deepEqual(JSON.parse(calls[1].options.body), { HoTen: 'An', AnhDaiDien: null });
    assert.equal(calls[1].options.headers['X-CSRF-Token'], 'fresh-profile');
    assert.equal(calls[1].options.credentials, 'include');
    assert.equal(calls[1].options.cache, 'no-store');
});

test('avatar sends multipart without a hardcoded boundary; auth failure prevents writes', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return reply({ csrf_token: 'avatar-token', code: 'UPLOAD_SUCCESS' }); };
    await api.uploadAvatar(new File(['image'], 'avatar.png', { type: 'image/png' }));
    const upload = calls[1];
    assert.equal(new URL(upload.url).pathname, '/api/auth/me/avatar');
    assert.equal(upload.options.method, 'POST');
    assert.equal(upload.options.headers['Content-Type'], undefined);
    assert.equal(upload.options.body.get('image').name, 'avatar.png');
    assert.equal(upload.options.headers['X-CSRF-Token'], 'avatar-token');
    let attempts = 0;
    globalThis.fetch = async () => { attempts++; return reply({ code: 'UNAUTHENTICATED' }, 401); };
    await assert.rejects(api.updateProfile({ HoTen: 'An', AnhDaiDien: null }), error => error.code === 'UNAUTHENTICATED');
    assert.equal(attempts, 1);
});

test('failed profile writes propagate once without an automatic retry', async () => {
    let attempts = 0;
    globalThis.fetch = async (_, options) => { attempts++; return options.method === 'GET' ? reply({ csrf_token: 'x' }) : reply({ code: 'DATABASE_UNAVAILABLE' }, 503); };
    await assert.rejects(api.updateProfile({ HoTen: 'An', AnhDaiDien: null }), error => error.code === 'DATABASE_UNAVAILABLE');
    assert.equal(attempts, 2);
});
