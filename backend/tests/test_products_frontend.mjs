import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_FIELDS, validateProduct, validateImageFile } from '../../frontend/js/utils/product-validation.js';
globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/products.js');
const valid = Object.fromEntries(PRODUCT_FIELDS.map(([key, , type]) => [key, type === 'category' ? '1' : type === 'integer' ? '0' : type === 'boolean' ? false : 'Thông tin']));
valid.HinhAnh = 'https://example.com/image.png';

test('full product schema validates required fields, lengths, integers and booleans', () => {
    const result = validateProduct(valid);
    assert.deepEqual(result.errors, {}); assert.equal(result.data.NguongTonKho, 0); assert.equal(result.data.PhanLoai, false);
    for (const [key, , type] of PRODUCT_FIELDS) {
        const missing = { ...valid }; delete missing[key];
        assert.ok(validateProduct(missing).errors[key], key);
        if (typeof type === 'number') assert.ok(validateProduct({ ...valid, [key]: 'a'.repeat(type + 1) }).errors[key]);
    }
    for (const value of [-1, true, 1.5, '1.5', '1e2', 2147483648, '']) assert.ok(validateProduct({ ...valid, NguongTonKho: value }).errors.NguongTonKho);
    assert.equal(validateProduct({ ...valid, PhanLoai: true }).data.PhanLoai, true);
    assert.ok(validateProduct({ ...valid, PhanLoai: 'true' }).errors.PhanLoai);
    for (const value of ['http://example.com/a', 'javascript:alert(1)', 'https://a.com/\n', 'https://a.com:99999/a']) assert.ok(validateProduct({ ...valid, HinhAnh: value }).errors.HinhAnh);
    assert.deepEqual(Object.keys(result.data).sort(), [...PRODUCT_FIELDS.map(x => x[0]), 'HinhAnh'].sort());
});

test('file validation accepts exact 5 MiB and rejects empty/large/unsupported files', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.equal(validateImageFile({ type, size: 5 * 1024 * 1024 }), '');
    for (const file of [{ type: 'image/png', size: 0 }, { type: 'image/png', size: 5242881 }, { type: 'image/svg+xml', size: 10 }, { type: 'application/pdf', size: 10 }]) assert.ok(validateImageFile(file));
});

test('product API query contracts, JSON payload and multipart CSRF use shared session client', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ csrf_token: 'fresh' }) }; };
    await api.getProducts({ search: 'A & B', category_id: 1, phan_loai: 'false', page: 2, per_page: 10, sort_by: 'TenThuoc', sort_order: 'asc' });
    await api.getProduct(7); await api.createProduct(validateProduct(valid).data); await api.updateProduct(7, validateProduct(valid).data); await api.deleteProduct(7);
    const file = new File(['image'], 'test.png', { type: 'image/png' }); await api.uploadProductImage(file);
    const query = new URL(calls[0].url).searchParams;
    assert.equal(query.get('phan_loai'), 'false'); assert.equal(query.get('search'), 'A & B'); assert.equal(query.get('page'), '2');
    const upload = calls.at(-1);
    assert.ok(upload.url.endsWith('/manager/uploads/products'));
    assert.ok(upload.options.body instanceof FormData); assert.equal(upload.options.body.get('image').name, 'test.png');
    assert.equal(upload.options.headers['Content-Type'], undefined); assert.equal(upload.options.headers['X-CSRF-Token'], 'fresh');
    for (const call of calls) assert.equal(call.options.credentials, 'include');
    const create = calls.find(x => x.options.method === 'POST' && x.url.endsWith('/products') && !(x.options.body instanceof FormData));
    assert.equal(JSON.parse(create.options.body).MaThuoc, undefined);
});
