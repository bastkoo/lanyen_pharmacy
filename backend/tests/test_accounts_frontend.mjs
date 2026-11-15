import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonIntegers, accountId } from '../../frontend/js/utils/json-integers.js';
import { validateAccount } from '../../frontend/js/utils/account-validation.js';
globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/accounts.js');
const auth = await import('../../frontend/js/api/auth.js');

test('JSON preserves unsafe integers before rounding and leaves quoted strings untouched', () => {
    const data = parseJsonIntegers('{"MaNguoiDung":9223372036854775807,"safe":9007199254740991,"other":-9007199254740993,"decimal":1.25,"exp":1e2,"name":"\\\"MaNguoiDung\\\":9223372036854775807","nested":[9007199254740993]}');
    assert.equal(data.MaNguoiDung, '9223372036854775807'); assert.equal(data.safe, Number.MAX_SAFE_INTEGER); assert.equal(data.other, '-9007199254740993'); assert.equal(data.decimal, 1.25); assert.equal(data.exp, 100); assert.equal(data.nested[0], '9007199254740993');
    assert.equal(data.name, '"MaNguoiDung":9223372036854775807');
    for (const raw of ['{', '{"id":0123}', '{"id":NaN}']) assert.throws(() => parseJsonIntegers(raw));
    assert.equal(accountId(data.MaNguoiDung), '9223372036854775807'); assert.equal(accountId(12), '12');
    for (const value of [Number.MAX_SAFE_INTEGER + 1, '9223372036854775808', '0', '01', '-1', '1/../2', null, {}]) assert.throws(() => accountId(value));
});
test('account form whitelist matches actual schema and never sends status or ID', () => {
    const valid = { HoTen: '  Nguyễn An  ', SDT: '090 123 4567', VaiTro: '2', Email: '', AnhDaiDien: '', MaNguoiDung: '9223372036854775807', TrangThai: true };
    assert.deepEqual(validateAccount(valid), { data: { HoTen: 'Nguyễn An', SDT: '+84901234567', VaiTro: 2, Email: null, AnhDaiDien: null }, errors: {} });
    for (const name of ['', ' \t', 'a'.repeat(256), 'a\0b', 'a\nb', null]) assert.ok(validateAccount({ ...valid, HoTen: name }).errors.HoTen);
    assert.equal(validateAccount({ ...valid, HoTen: '💊'.repeat(255) }).errors.HoTen, undefined);
    for (const phone of ['', '0123456789', '090123', '+840901234567', true, 901234567, ' '.repeat(25)]) assert.ok(validateAccount({ ...valid, SDT: phone }).errors.SDT);
    for (const role of [0, '0', true, 3, 'admin']) assert.ok(validateAccount({ ...valid, VaiTro: role }).errors.VaiTro);
    for (const email of ['bad', 'a\nb@example.com', 'a'.repeat(256) + '@x.com']) assert.ok(validateAccount({ ...valid, Email: email }).errors.Email);
    for (const image of ['http://example.com/a', 'javascript:alert(1)', 'https://a.com:99999']) assert.ok(validateAccount({ ...valid, AnhDaiDien: image }).errors.AnhDaiDien);
});
test('session and all account APIs preserve exact large IDs with cookie/CSRF', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response('{"code":"OK","csrf_token":"account-csrf","user":{"MaNguoiDung":9223372036854775807,"VaiTro":2,"TrangThai":false},"account":{"MaNguoiDung":9223372036854775807}}'); };
    assert.equal((await auth.getSession()).user.MaNguoiDung, '9223372036854775807');
    const id = '9223372036854775807'; await api.getAccounts({ search: 'Lan & An', role: '2', status: 'false', page: 2, per_page: 20 }); await api.getAccount(id);
    const body = { HoTen: 'An', SDT: '+84901234567', VaiTro: 1, Email: null, AnhDaiDien: null };
    await api.createAccount(body); await api.updateAccount(id, body); await api.setAccountStatus(id, true);
    const manager = calls.filter(call => call.url.includes('/manager/')); assert.deepEqual(manager.map(call => call.options.method), ['GET', 'GET', 'POST', 'PUT', 'PATCH']);
    assert.equal(new URL(manager[0].url).searchParams.get('search'), 'Lan & An'); assert.ok(manager[1].url.endsWith(`/accounts/${id}`)); assert.ok(manager[4].url.endsWith(`/accounts/${id}/status`));
    assert.deepEqual(JSON.parse(manager[4].options.body), { TrangThai: true });
    for (const call of calls) assert.equal(call.options.credentials, 'include');
    for (const call of manager.slice(2)) assert.equal(call.options.headers['X-CSRF-Token'], 'account-csrf');
    assert.throws(() => api.getAccount(9223372036854775807));
});
