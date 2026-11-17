import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/auth.js');
const reply = (data, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(data) });

test('address clients use own-account endpoints, fresh CSRF and text-only whitelist', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ path: new URL(url).pathname, options }); return reply({ csrf_token: 'address-token', user: { MaNguoiDung: '9007199254740993' }, items: [] }); };
    const owner = '9007199254740993', values = { TinhThanh: 'HCM', PhuongXa: 'A', DiaChiCuThe: 'B', MaNguoiDung: 99, DiaChiGiao: true };
    await api.getAddresses(owner);
    await api.createAddress(values, owner); await api.updateAddress('9007199254740995', values, owner);
    await api.makePrimaryAddress('9007199254740995', owner); await api.deleteAddress('9007199254740995', owner);
    assert.deepEqual(calls.map(call => [call.path, call.options.method]), [
        ['/api/auth/me', 'GET'], ['/api/auth/me/addresses', 'GET'],
        ['/api/auth/me', 'GET'], ['/api/auth/me/addresses', 'POST'],
        ['/api/auth/me', 'GET'], ['/api/auth/me/addresses/9007199254740995', 'PUT'],
        ['/api/auth/me', 'GET'], ['/api/auth/me/addresses/9007199254740995/primary', 'PATCH'],
        ['/api/auth/me', 'GET'], ['/api/auth/me/addresses/9007199254740995', 'DELETE']
    ]);
    for (const call of calls) {
        assert.equal(call.options.credentials, 'include'); assert.equal(call.options.cache, 'no-store');
        if (call.options.method !== 'GET') assert.equal(call.options.headers['X-CSRF-Token'], 'address-token');
    }
    for (const index of [3, 5]) assert.deepEqual(JSON.parse(calls[index].options.body), { TinhThanh: 'HCM', PhuongXa: 'A', DiaChiCuThe: 'B' });
});

test('owner changes and failed writes never trigger automatic mutation retries', async () => {
    let count = 0;
    globalThis.fetch = async () => { count++; return reply({ user: { MaNguoiDung: 22 }, csrf_token: 'other-owner' }); };
    await assert.rejects(api.makePrimaryAddress(1, 12), error => error.code === 'SESSION_CHANGED');
    assert.equal(count, 1);
    await assert.rejects(api.getAddresses(12), error => error.code === 'SESSION_CHANGED');
    assert.equal(count, 2);
    count = 0;
    globalThis.fetch = async (_, options) => { count++; return options.method === 'GET' ? reply({ user: { MaNguoiDung: 12 }, csrf_token: 'x' }) : reply({ code: 'DATABASE_UNAVAILABLE' }, 503); };
    await assert.rejects(api.deleteAddress(1, 12), error => error.code === 'DATABASE_UNAVAILABLE');
    assert.equal(count, 2);
});
