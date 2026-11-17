import test from 'node:test';
import assert from 'node:assert/strict';
const province = { code: 79, name: 'Thành phố Hồ Chí Minh' };
const ward = { code: 26743, name: 'Phường A', province_code: 79 };
const reply = data => ({ ok: true, json: async () => data });
const fresh = name => import(`../../frontend/js/api/vietnam-addresses.js?${name}`);

test('Vietnam v2 geography requests use province/ward relation without customer cookies or addresses', async () => {
    const api = await fresh('normal'), calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return reply(url.endsWith('/p/') ? [province] : { code: 79, wards: [ward] }); };
    assert.deepEqual(await api.getProvinces(), [province]); assert.deepEqual(await api.getWards(79), [ward]);
    await api.getProvinces(); await api.getWards(79);
    assert.deepEqual(calls.map(call => call.url), ['https://provinces.open-api.vn/api/v2/p/', 'https://provinces.open-api.vn/api/v2/p/79?depth=2']);
    for (const { options } of calls) { assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer'); assert.equal(options.body, undefined); assert.equal(options.headers, undefined); }
});

test('unavailable data can be retried and wrong province wards are rejected', async () => {
    const api = await fresh('retry'); let count = 0;
    globalThis.fetch = async () => { count++; return count === 1 ? { ok: false } : reply([province]); };
    await assert.rejects(api.getProvinces(), error => error.code === 'PROVINCES_UNAVAILABLE');
    assert.deepEqual(await api.getProvinces(), [province]); assert.equal(count, 2);
    globalThis.fetch = async () => reply({ code: 79, wards: [{ ...ward, province_code: 1 }] });
    await assert.rejects(api.getWards(79), error => error.code === 'PROVINCES_UNAVAILABLE');
    globalThis.fetch = async () => reply({ code: 79, wards: [ward] });
    assert.deepEqual(await api.getWards(79), [ward]);
});

test('malformed geography and cancelled selections never enter the successful cache', async () => {
    const api = await fresh('invalid');
    for (const data of [null, [], [null], [{ code: 0, name: 'Bad' }], [province, province]]) {
        globalThis.fetch = async () => reply(data);
        await assert.rejects(api.getProvinces(), error => error.code === 'PROVINCES_UNAVAILABLE');
    }
    let called = false; globalThis.fetch = async () => { called = true; return reply([province]); };
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.getProvinces({ signal: controller.signal }), error => error.code === 'REQUEST_ABORTED');
    assert.equal(called, false);
    assert.deepEqual(await api.getProvinces(), [province]);
});
