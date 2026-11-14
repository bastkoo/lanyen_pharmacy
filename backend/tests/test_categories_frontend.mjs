import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/categories.js');
const { normalizeCategoryName, categoryErrorMessage } = await import('../../frontend/js/utils/category-validation.js');

test('category names normalize whitespace and respect model codepoint length', () => {
    assert.equal(normalizeCategoryName('  Thuốc \n giảm   đau '), 'Thuốc giảm đau');
    for (const value of ['', ' \t ', 'a'.repeat(256), 'a\0b', null, 3]) assert.equal(normalizeCategoryName(value), null);
    assert.equal(normalizeCategoryName('a'.repeat(255)).length, 255);
    assert.equal(normalizeCategoryName('💊'.repeat(255)), '💊'.repeat(255));
    assert.equal(normalizeCategoryName('<img onerror=alert(1)>'), '<img onerror=alert(1)>');
});

test('category API uses exact paths, only name body, cookies and fresh CSRF for writes', async () => {
    const calls = [];
    let token = 0;
    globalThis.fetch = async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => url.endsWith('/auth/me') ? { csrf_token: `token-${++token}` } : { code: 'OK' } };
    };
    await api.getCategories({ search: 'Giảm & đau', page: 2, per_page: 10 });
    await api.getCategory(7);
    await api.createCategory('Thuốc'); await api.updateCategory(7, 'Khác'); await api.deleteCategory(7);
    assert.ok(calls[0].url.includes(new URLSearchParams({ search: 'Giảm & đau', page: 2, per_page: 10 }).toString()));
    assert.ok(calls[1].url.endsWith('/categories/7'));
    const writes = calls.filter(x => x.options.method !== 'GET');
    assert.deepEqual(writes.map(x => x.options.method), ['POST', 'PUT', 'DELETE']);
    assert.deepEqual(writes.map(x => x.options.headers['X-CSRF-Token']), ['token-1', 'token-2', 'token-3']);
    assert.deepEqual(JSON.parse(writes[0].options.body), { TenLoaiThuoc: 'Thuốc' });
    assert.deepEqual(JSON.parse(writes[1].options.body), { TenLoaiThuoc: 'Khác' });
    assert.equal(writes[2].options.body, undefined);
    for (const call of calls) assert.equal(call.options.credentials, 'include');
});

test('expired session prevents mutation; conflicts, CSRF and offline errors propagate without retry', async () => {
    let count = 0;
    globalThis.fetch = async () => { count++; return { ok: false, status: 401, json: async () => ({ code: 'UNAUTHENTICATED' }) }; };
    await assert.rejects(api.createCategory('A'), e => e.code === 'UNAUTHENTICATED');
    assert.equal(count, 1);
    for (const [status, code] of [[409, 'CATEGORY_IN_USE'], [409, 'CATEGORY_NAME_EXISTS'], [403, 'CSRF_FAILED'], [503, 'DATABASE_UNAVAILABLE']]) {
        globalThis.fetch = async url => ({ ok: url.endsWith('/auth/me'), status, json: async () => url.endsWith('/auth/me') ? { csrf_token: 'new' } : { code } });
        await assert.rejects(api.deleteCategory(1), e => e.code === code && e.status === status);
        assert.ok(categoryErrorMessage({ code }).length > 20);
    }
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(api.getCategory(1), e => e.code === 'CONNECTION_FAILED');
});
