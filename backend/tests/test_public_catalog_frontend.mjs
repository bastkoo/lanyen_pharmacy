import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoryIcon } from '../../frontend/js/utils/category-icons.js';
import { readCatalogFilters, catalogQuery, publicProductsUrl } from '../../frontend/js/utils/public-catalog-filters.js';
import { promotionCountdown, promotionBadge } from '../../frontend/js/utils/public-sale-format.js';

globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/public-catalog.js');

test('sale countdown uses Vietnam midnight and includes the entire last day', () => {
    const program = { NgayBatDau: '2026-11-17', NgayKetThuc: '2026-11-20' };
    const read = value => promotionCountdown(program, Date.parse(value));
    assert.deepEqual(read('2026-11-16T23:59:59+07:00'), { state: 'UPCOMING', label: 'Bắt đầu sau', text: '00:00:01', parts: ['00', '00', '00', '01'] });
    assert.deepEqual(read('2026-11-17T00:00:00+07:00'), { state: 'ACTIVE', label: 'Kết thúc sau', text: '4 ngày 00:00:00', parts: ['04', '00', '00', '00'] });
    assert.equal(read('2026-11-17T12:00:00+07:00').text, '3 ngày 12:00:00');
    assert.equal(read('2026-11-20T23:59:59.800+07:00').text, '00:00:01');
    assert.deepEqual(read('2026-11-21T00:00:00+07:00'), { state: 'ENDED', label: 'Đã kết thúc', text: '00:00:00', parts: ['00', '00', '00', '00'] });
    assert.equal(read('2026-11-21T00:00:01+07:00').text, '00:00:00');
    assert.equal(promotionCountdown({ NgayBatDau: '2026-02-30', NgayKetThuc: '2026-03-01' }), null);
    assert.equal(promotionCountdown({ NgayBatDau: '2026-11-20', NgayKetThuc: '2026-11-17' }), null);
});

test('sale badge distinguishes direct discounts and configured percentage', () => {
    assert.equal(promotionBadge({ LoaiGiamGia: false, GiaTriGiam: '200.00' }), 'Ưu đãi');
    assert.equal(promotionBadge({ LoaiGiamGia: true, GiaTriGiam: '20.00' }), '-20%');
    assert.equal(promotionBadge({ LoaiGiamGia: true, GiaTriGiam: '100.00' }), '-100%');
    assert.equal(promotionBadge({ LoaiGiamGia: true, GiaTriGiam: 'invalid' }), 'Ưu đãi');
});

test('public product URLs preserve keyword, category, false prescription, sort and page across navigation', () => {
    const filters = readCatalogFilters('?search=A%20%26%20B&category_id=13&ke_don=false&sort_order=desc&page=2');
    assert.deepEqual(filters, { search: 'A & B', category_id: '13', ke_don: 'false', sort_order: 'desc', page: 2 });
    assert.deepEqual(readCatalogFilters(catalogQuery(filters)), filters);
    assert.ok(publicProductsUrl(filters).startsWith('products.html?'));
    assert.equal(publicProductsUrl(readCatalogFilters('')), 'products.html');
    for (const query of ['?page=0', '?page=-1', '?page=x', '?page=1.5', '?category_id=0', '?category_id=2147483648', '?ke_don=0', '?sort_order=other', '?search=%00', '?category_id=1&category_id=2', '?search=' + 'a'.repeat(256)]) assert.throws(() => readCatalogFilters(query), query);
});

test('all thirteen approved category names have distinct available icons; unknown names have a fallback', () => {
    const names = ['Thiết bị y tế', 'Chăm sóc da mặt', 'Mắt - Thị lực', 'Tiêu hóa', 'Vitamin', 'Kháng sinh & nấm', 'Tim mạch & huyết áp', 'Thần kinh', 'Cơ xương khớp', 'Hô hấp - Tai mũi họng', 'Sinh lý - nội tiết tố', 'Chăm sóc cá nhân', 'Thuốc giảm đau - Hạ sốt - Kháng viêm'];
    const sprite = readFileSync(new URL('../../frontend/assets/icons/catalog-icons.svg', import.meta.url), 'utf8');
    assert.equal(new Set(names.map(categoryIcon)).size, 13);
    for (const name of names) assert.ok(sprite.includes(`id="${categoryIcon(name)}"`), name);
    assert.equal(categoryIcon('  MẮT – THỊ LỰC '), 'eye');
    assert.equal(categoryIcon('Tên danh mục mới'), 'medicine');
});

test('public catalog GETs do not use manager endpoints, cookies or CSRF', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, text: async () => JSON.stringify({ items: [] }) }; };
    await api.getPublicCategories({ page: 1, per_page: 100 });
    await api.getPublicProducts({ category_id: 7, search: 'A & B', page: 2, per_page: 12 });
    await api.getPublicProducts({ category_id: undefined, search: '', page: 1, per_page: 12 });
    assert.ok(calls[0].url.includes('/api/categories?'));
    assert.ok(calls[1].url.includes('/api/products?'));
    assert.equal(new URL(calls[1].url).searchParams.get('category_id'), '7');
    assert.equal(new URL(calls[1].url).searchParams.get('search'), 'A & B');
    assert.equal(new URL(calls[2].url).searchParams.has('category_id'), false);
    for (const call of calls) { assert.equal(call.options.method, 'GET'); assert.equal(call.options.credentials, 'omit'); assert.equal(call.options.headers, undefined); assert.equal(call.url.includes('/manager/'), false); }
});

test('public errors, invalid responses and aborted requests are handled without login or automatic retry', async () => {
    for (const [status, code] of [[404, 'CATEGORY_NOT_FOUND'], [503, 'DATABASE_UNAVAILABLE']]) {
        let count = 0;
        globalThis.fetch = async () => { count++; return { ok: false, status, text: async () => JSON.stringify({ code }) }; };
        await assert.rejects(api.getPublicProducts({}), error => error.code === code);
        assert.equal(count, 1);
    }
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.getPublicCategories({}, { signal: controller.signal }), error => error.code === 'REQUEST_ABORTED');
    globalThis.fetch = async () => ({ ok: true, text: async () => 'null' });
    await assert.rejects(api.getPublicProducts({}), error => error.code === 'INVALID_RESPONSE');
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(api.getPublicProducts({}), error => error.code === 'CONNECTION_FAILED');
});

test('public sale list and program products use read-only public contracts', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return { ok: true, text: async () => JSON.stringify({ items: [] }) };
    };
    await api.getPublicPromotions({ page: 2, per_page: 100 });
    await api.getPromotionProducts(7, { page: 1, per_page: 10 });
    await api.getPublicProduct(9, { promotion_id: 7 });
    assert.equal(new URL(calls[0].url).pathname, '/api/promotions');
    assert.equal(new URL(calls[0].url).searchParams.get('page'), '2');
    assert.equal(new URL(calls[1].url).pathname, '/api/promotions/7/products');
    assert.equal(new URL(calls[2].url).pathname, '/api/products/9');
    assert.equal(new URL(calls[2].url).searchParams.get('promotion_id'), '7');
    for (const call of calls) {
        assert.equal(call.options.method, 'GET');
        assert.equal(call.options.credentials, 'omit');
        assert.equal(call.options.headers, undefined);
    }
});
