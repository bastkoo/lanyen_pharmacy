import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePromotion, validatePromotionItem, promotionStatus, formatPromotionDiscount } from '../../frontend/js/utils/promotion-validation.js';
globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/promotions.js');

test('promotion dates, name lengths and inclusive Vietnam calendar status', () => {
    const value = { TenChuongTrinh: '  Khuyến mãi  ', NgayBatDau: '2026-11-15', NgayKetThuc: '2026-11-15' };
    assert.deepEqual(validatePromotion(value).errors, {}); assert.equal(validatePromotion(value).data.TenChuongTrinh, 'Khuyến mãi');
    assert.equal(promotionStatus(value, '2026-11-14'), 'upcoming'); assert.equal(promotionStatus(value, '2026-11-15'), 'active'); assert.equal(promotionStatus(value, '2026-11-16'), 'ended');
    for (const name of ['', ' \t', 'a\0b', 'a'.repeat(256), null]) assert.ok(validatePromotion({ ...value, TenChuongTrinh: name }).errors.TenChuongTrinh);
    assert.equal(validatePromotion({ ...value, TenChuongTrinh: '💊'.repeat(255) }).errors.TenChuongTrinh, undefined);
    for (const date of ['2026-02-29', '2026-11-31', '2026-1-01']) assert.ok(validatePromotion({ ...value, NgayBatDau: date }).errors.NgayBatDau);
    assert.ok(validatePromotion({ ...value, NgayKetThuc: '2026-11-14' }).errors.NgayKetThuc);
});
test('item validation matches both discounts, exact decimals, create positive and edit zero quantity', () => {
    const value = { MaThuoc: '3', LoaiGiamGia: 'true', GiaTriGiam: '10', SoLuong: '100', MaChuongTrinh: 999 };
    assert.deepEqual(validatePromotionItem(value).data, { MaThuoc: 3, LoaiGiamGia: true, GiaTriGiam: 10, SoLuong: 100 });
    for (const price of ['0', '101', '10.5', '1e2', '', '-1', '10.00']) assert.ok(validatePromotionItem({ ...value, GiaTriGiam: price }).errors.GiaTriGiam);
    for (const price of ['0', '1.25', '9999999999.99']) assert.equal(validatePromotionItem({ ...value, LoaiGiamGia: 'false', GiaTriGiam: price }).errors.GiaTriGiam, undefined);
    for (const price of ['1.005', '10000000000', '1,25', '-1', 'NaN', 'Infinity']) assert.ok(validatePromotionItem({ ...value, LoaiGiamGia: 'false', GiaTriGiam: price }).errors.GiaTriGiam);
    for (const quantity of ['0', '-1', '1.5', '1e2', '2147483648', true]) assert.ok(validatePromotionItem({ ...value, SoLuong: quantity }).errors.SoLuong);
    assert.equal(validatePromotionItem({ ...value, SoLuong: '0' }, { create: false, quantityEditable: true }).data.SoLuong, 0);
    assert.deepEqual(Object.keys(validatePromotionItem(value, { create: false, quantityEditable: true }).data).sort(), ['LoaiGiamGia', 'GiaTriGiam', 'SoLuong'].sort());
});
test('discount display uses real Decimal response and never computes a final selling price', () => {
    assert.equal(formatPromotionDiscount({ LoaiGiamGia: true, GiaTriGiam: '15.00' }), '15%');
    assert.match(formatPromotionDiscount({ LoaiGiamGia: false, GiaTriGiam: '1000.25' }), /1\.000,25/);
    assert.match(formatPromotionDiscount({ LoaiGiamGia: false, GiaTriGiam: '0.00' }), /0/);
    assert.throws(() => formatPromotionDiscount({ LoaiGiamGia: true, GiaTriGiam: '1.50' }));
});
test('ten promotion APIs preserve exact composite paths and shared session/CSRF', async () => {
    const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, text: async () => JSON.stringify({ csrf_token: 'promotions-csrf' }) }; };
    await api.getPromotions({ page: 2, per_page: 100 }); await api.getPromotion(7);
    const program = { TenChuongTrinh: 'KM', NgayBatDau: '2026-01-01', NgayKetThuc: '2026-01-01' };
    await api.createPromotion(program); await api.updatePromotion(7, program); await api.deletePromotion(7);
    await api.getPromotionItems(7, { page: 1, per_page: 100 }); await api.getPromotionItem(7, 3);
    await api.createPromotionItem(7, { MaThuoc: 3, LoaiGiamGia: false, GiaTriGiam: 1000.25, SoLuong: 10 }); await api.updatePromotionItem(7, 3, { LoaiGiamGia: true, GiaTriGiam: 15, SoLuong: 20 }); await api.deletePromotionItem(7, 3);
    const manager = calls.filter(call => call.url.includes('/manager/')); assert.equal(manager.length, 10);
    assert.ok(manager[0].url.endsWith('/promotions?page=2&per_page=100')); assert.ok(manager[6].url.endsWith('/promotions/7/items/3'));
    for (const call of calls) assert.equal(call.options.credentials, 'include');
    for (const call of manager.filter(call => call.options.method !== 'GET')) assert.equal(call.options.headers['X-CSRF-Token'], 'promotions-csrf');
    assert.deepEqual(JSON.parse(manager[8].options.body), { LoaiGiamGia: true, GiaTriGiam: 15, SoLuong: 20 });
});
