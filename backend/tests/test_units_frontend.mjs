import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUnit, formatUnitPrice, unitErrorMessage } from '../../frontend/js/utils/unit-validation.js';
globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/units.js');

test('unit validation matches backend ranges, Unicode lengths and exact writable fields', () => {
    const values = { DonViTinh: '  Hộp  ', GiaBan: '0', SoLuongQuyDoi: '1', MaThuoc: 99, MaDonGia: 8 };
    assert.deepEqual(validateUnit(values), { data: { DonViTinh: 'Hộp', GiaBan: 0, SoLuongQuyDoi: 1 }, errors: {} });
    for (const name of ['GiaBan', 'SoLuongQuyDoi']) {
        for (const value of ['', '-1', '1.5', '1e2', '1,000', true, null, undefined, 2147483648, 1.5]) assert.ok(validateUnit({ ...values, [name]: value }).errors[name], `${name}: ${value}`);
        assert.equal(validateUnit({ ...values, [name]: '2147483647' }).errors[name], undefined);
    }
    assert.ok(validateUnit({ ...values, SoLuongQuyDoi: '0' }).errors.SoLuongQuyDoi);
    for (const value of ['', ' \t\n', 'a\0b', 'a'.repeat(51), null, true]) assert.ok(validateUnit({ ...values, DonViTinh: value }).errors.DonViTinh);
    assert.equal(validateUnit({ ...values, DonViTinh: '💊'.repeat(50) }).errors.DonViTinh, undefined);
    assert.equal(validateUnit({ ...values, DonViTinh: 'Hộp' }).errors.DonViTinh, undefined); // No invented duplicate rule.
});
test('VND amounts and reference/conflict errors have explicit messages', () => {
    assert.match(formatUnitPrice(1234567), /1\.234\.567/); assert.match(formatUnitPrice(0), /0/);
    assert.match(formatUnitPrice(2147483647), /2\.147\.483\.647/);
    assert.match(unitErrorMessage({ code: 'UNIT_IN_USE' }), /giỏ thuốc.*đơn hàng/);
    assert.match(unitErrorMessage({ code: 'UNIT_NOT_FOUND' }), /không còn tồn tại/);
    assert.match(unitErrorMessage({ code: 'CSRF_FAILED' }), /xác thực/);
});
test('five unit APIs scope product/unit IDs and reuse cookie + fresh CSRF client', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, text: async () => JSON.stringify({ csrf_token: 'fresh-unit-csrf' }) }; };
    await api.getUnits(3, { page: 2, per_page: 20 }); await api.getUnit(3, 7);
    const body = { DonViTinh: 'Hộp', GiaBan: 10000, SoLuongQuyDoi: 10 };
    await api.createUnit(3, body); await api.updateUnit(3, 7, body); await api.deleteUnit(3, 7);
    const units = calls.filter(call => call.url.includes('/units'));
    assert.deepEqual(units.map(call => call.options.method), ['GET', 'GET', 'POST', 'PUT', 'DELETE']);
    assert.ok(units[0].url.endsWith('/products/3/units?page=2&per_page=20'));
    assert.ok(units[1].url.endsWith('/products/3/units/7'));
    for (const call of calls) assert.equal(call.options.credentials, 'include');
    for (const call of units.slice(2)) assert.equal(call.options.headers['X-CSRF-Token'], 'fresh-unit-csrf');
    for (const call of units.slice(2, 4)) assert.deepEqual(JSON.parse(call.options.body), body);
    assert.equal(units.at(-1).options.body, undefined);
});
