import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBatch, dateValue, formatBatchDate, expiryText, stockError } from '../../frontend/js/utils/batch-validation.js';
globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const batches = await import('../../frontend/js/api/batches.js');
const inventory = await import('../../frontend/js/api/inventory.js');
const values = { SoLoSanXuat: '  LOT-1  ', NgaySanXuat: '2026-01-01', HanSuDung: '2027-01-01', SoLuongNhap: '10', GiaNhap: '0', SoLuongTon: 888, MaThuoc: 99 };

test('batch create/edit whitelist preserves immutable stock and exact integer rules', () => {
    const create = validateBatch(values);
    assert.deepEqual(create.errors, {}); assert.equal(create.data.SoLoSanXuat, 'LOT-1'); assert.equal(create.data.SoLuongNhap, 10); assert.equal(create.data.GiaNhap, 0);
    assert.deepEqual(Object.keys(create.data).sort(), ['SoLoSanXuat', 'NgaySanXuat', 'HanSuDung', 'SoLuongNhap', 'GiaNhap'].sort());
    const edit = validateBatch({ ...values, SoLuongNhap: '999', SoLuongTon: -1 }, false);
    assert.deepEqual(edit.errors, {}); assert.equal(edit.data.SoLuongNhap, undefined); assert.equal(edit.data.SoLuongTon, undefined);
    for (const key of ['SoLuongNhap', 'GiaNhap']) {
        for (const raw of ['', '-1', '1.5', '1e2', '1,000', true, null, undefined, 2147483648, 0.5]) assert.ok(validateBatch({ ...values, [key]: raw }).errors[key]);
        assert.equal(validateBatch({ ...values, [key]: '2147483647' }).errors[key], undefined);
    }
    assert.ok(validateBatch({ ...values, SoLuongNhap: '0' }).errors.SoLuongNhap);
    for (const value of ['', ' \t', null, true, 'x\0x', 'x'.repeat(101)]) assert.ok(validateBatch({ ...values, SoLoSanXuat: value }).errors.SoLoSanXuat);
    assert.equal(validateBatch({ ...values, SoLoSanXuat: '💊'.repeat(100) }).errors.SoLoSanXuat, undefined);
});
test('dates reject impossible days; UTC calendar arithmetic preserves Vietnam boundary', () => {
    for (const value of ['2026-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-01T00:00:00Z']) assert.equal(dateValue(value), null, value);
    for (const value of ['2024-02-29', '0001-01-01', '9999-12-31']) assert.equal(typeof dateValue(value), 'number');
    assert.ok(validateBatch({ ...values, HanSuDung: values.NgaySanXuat }).errors.HanSuDung);
    assert.ok(validateBatch({ ...values, HanSuDung: '2025-12-31' }).errors.HanSuDung);
    assert.equal(formatBatchDate('2026-11-15'), '15/11/2026');
    assert.equal(expiryText('2026-11-15', '2026-11-15'), 'Hết hạn hôm nay');
    assert.equal(expiryText('2026-11-14', '2026-11-15'), 'Đã hết hạn 1 ngày');
    assert.equal(expiryText('2026-12-01', '2026-11-15'), 'Còn 16 ngày');
    assert.equal(expiryText('2026-01-01', '2025-12-31'), 'Còn 1 ngày');
});
test('existing safety restrictions have specific messages', () => {
    assert.match(stockError({ code: 'BATCH_DELETE_UNSAFE' }), /Không thể xóa.*lịch sử/);
    assert.match(stockError({ code: 'BATCH_QUANTITY_IMMUTABLE' }), /Không được thay đổi số lượng nhập/);
    assert.match(stockError({ code: 'BATCH_STOCK_INCONSISTENT' }), /không nhất quán/);
});
test('eight APIs use actual query whitelist, cookie session and CSRF', async () => {
    const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, text: async () => JSON.stringify({ csrf_token: 'stock-csrf' }) }; };
    await batches.getBatches(3, { page: 2, per_page: 20 }); await batches.getBatch(3, 7);
    await batches.createBatch(3, validateBatch(values).data); await batches.updateBatch(3, 7, validateBatch(values, false).data); await batches.deleteBatch(3, 7);
    await inventory.getInventorySummary({ page: 1, per_page: 20 }); await inventory.getLowStock({ page: 2, per_page: 20 }); await inventory.getExpiry({ status: 'expired', days: 30, page: 1, per_page: 20 });
    const api = calls.filter(call => call.url.includes('/manager/'));
    assert.equal(api.length, 8); assert.deepEqual(api.slice(0, 5).map(call => call.options.method), ['GET', 'GET', 'POST', 'PUT', 'DELETE']);
    assert.ok(api[0].url.endsWith('/products/3/batches?page=2&per_page=20'));
    assert.ok(api[1].url.endsWith('/products/3/batches/7'));
    for (const call of calls) assert.equal(call.options.credentials, 'include');
    for (const call of api.slice(2, 5)) assert.equal(call.options.headers['X-CSRF-Token'], 'stock-csrf');
    assert.equal(JSON.parse(api[3].options.body).SoLuongNhap, undefined); assert.equal(JSON.parse(api[2].options.body).SoLuongTon, undefined);
    assert.equal(new URL(api.at(-1).url).searchParams.get('status'), 'expired');
});
