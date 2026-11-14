import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

let mode = 'normal', nextId = 30;
let items = Array.from({ length: 25 }, (_, i) => ({ MaLoaiThuoc: i + 1, TenLoaiThuoc: `Danh mục ${String(i + 1).padStart(2, '0')}` }));
const calls = [];
export async function categoryFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local');
    const id = Number(url.pathname.split('/')[4]);
    let body = ''; for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    calls.push({ method: req.method, id, data });
    if (mode === 'expired') return json(401, { code: 'UNAUTHENTICATED' });
    if (mode === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (req.method !== 'GET') {
        assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
        if (mode === 'csrf') return json(403, { code: 'CSRF_FAILED' });
    }
    const item = items.find(x => x.MaLoaiThuoc === id);
    if (req.method === 'GET' && !id) {
        const search = (url.searchParams.get('search') || '').toLowerCase();
        const page = Number(url.searchParams.get('page') || 1), per_page = Number(url.searchParams.get('per_page') || 20);
        const found = items.filter(x => x.TenLoaiThuoc.toLowerCase().includes(search));
        return json(200, { code: 'CATEGORIES_LISTED', items: found.slice((page - 1) * per_page, page * per_page), page, per_page, total: found.length, pages: Math.ceil(found.length / per_page) });
    }
    if (id && !item) return json(404, { code: 'CATEGORY_NOT_FOUND' });
    if (req.method === 'GET') return json(200, { code: 'CATEGORY_FOUND', category: item });
    if (req.method === 'DELETE') {
        if (id === 1) return json(409, { code: 'CATEGORY_IN_USE' });
        items = items.filter(x => x !== item); return json(200, { code: 'CATEGORY_DELETED' });
    }
    assert.deepEqual(Object.keys(data), ['TenLoaiThuoc']);
    if (items.some(x => x !== item && x.TenLoaiThuoc.toLowerCase() === data.TenLoaiThuoc.toLowerCase())) return json(409, { code: 'CATEGORY_NAME_EXISTS' });
    const category = item || { MaLoaiThuoc: nextId++ }; category.TenLoaiThuoc = data.TenLoaiThuoc;
    if (!item) items.push(category);
    return json(item ? 200 : 201, { code: item ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED', category });
}

export async function checkCategories({ evaluate, waitFor, key, command, root }) {
    const run = evaluate;
    const submit = name => run(`document.querySelector('#category-name').value=${JSON.stringify(name)};document.querySelector('#category-form').requestSubmit()`);
    await run(`location.hash='categories'`);
    await waitFor(`document.querySelector('#categories-body').children.length===20 && !document.querySelector('#categories-table-wrap').hidden`);
    await run(`document.querySelector('#categories-next').click()`);
    await waitFor(`document.querySelector('#categories-page-status').textContent.includes('Trang 2')`);
    await run(`document.querySelector('#categories-search-input').value='Danh mục 01';document.querySelector('#categories-search-form').requestSubmit()`);
    await waitFor(`document.querySelector('#categories-body').children.length===1 && document.querySelector('#categories-body').textContent.includes('Danh mục 01')`);
    await run(`document.querySelector('#categories-clear-search').click()`);
    await waitFor(`document.querySelector('#categories-body').children.length===20`);
    await run(`document.querySelector('#category-add').click();document.querySelector('#category-form').requestSubmit()`);
    assert.equal(await run(`document.querySelector('#category-name').getAttribute('aria-invalid')`), 'true');
    assert.equal(calls.filter(x => x.method === 'POST').length, 0);
    await submit('  Danh   mục mới  ');
    await run(`document.querySelector('#category-form').requestSubmit()`);
    await waitFor(`!document.querySelector('#category-dialog').open && document.querySelector('#categories-body').children.length===1`);
    assert.equal(calls.filter(x => x.method === 'POST').length, 1);
    assert.equal(items.at(-1).TenLoaiThuoc, 'Danh mục mới');
    await run(`document.querySelector('#category-add').click()`); await submit('danh mục mới');
    await waitFor(`document.querySelector('#category-name-error').textContent.includes('đã tồn tại')`);
    await key('Escape', 27);
    await run(`document.querySelector('[data-category-action="edit"]').click()`);
    await waitFor(`document.querySelector('#category-name').value==='Danh mục mới' && !document.querySelector('#category-save').disabled`);
    assert.ok(calls.some(x => x.method === 'GET' && x.id === 30));
    await submit('Danh mục sửa');
    await waitFor(`!document.querySelector('#category-dialog').open && document.querySelector('#categories-state-title').textContent.includes('Không tìm thấy')`);
    await run(`document.querySelector('#categories-clear-search').click()`);
    await waitFor(`document.querySelector('#categories-body').children.length===20`);
    await run(`document.querySelector('[data-category-action="delete"][data-category-id="1"]').click()`);
    await waitFor(`!document.querySelector('#category-delete-summary').hidden`);
    assert.equal(calls.filter(x => x.method === 'DELETE').length, 0);
    await run(`document.querySelector('#category-save').click()`);
    await waitFor(`document.querySelector('#category-form-error').textContent.includes('đang có thuốc')`);
    assert.ok(items.some(x => x.MaLoaiThuoc === 1));
    await run(`document.querySelector('#category-cancel').click()`);
    await run(`document.querySelector('[data-category-action="delete"][data-category-id="2"]').click()`);
    await waitFor(`!document.querySelector('#category-save').disabled`);
    await run(`document.querySelector('#category-save').click()`);
    await waitFor(`!document.querySelector('#category-dialog').open && !document.querySelector('[data-category-id="2"]')`);
    assert.ok(!items.some(x => x.MaLoaiThuoc === 2));
    mode = 'csrf'; await run(`document.querySelector('#category-add').click()`); await submit('Giữ nội dung');
    await waitFor(`document.querySelector('#category-form-error').textContent.includes('bảo mật')`);
    assert.equal(await run(`document.querySelector('#category-name').value`), 'Giữ nội dung');
    assert.equal(await run(`document.querySelector('#manager-shell').hidden`), false);
    await run(`document.querySelector('#category-cancel').click()`);
    mode = 'error'; await run(`document.querySelector('#categories-reload').click()`);
    await waitFor(`!document.querySelector('#categories-retry').hidden`);
    mode = 'normal'; await run(`document.querySelector('#categories-retry').click()`);
    await waitFor(`!document.querySelector('#categories-table-wrap').hidden`);
    for (const width of [1440, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
        await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Categories overflow ${width}`);
        if (width === 1440 || width === 375) {
            const capture = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            await writeFile(path.join(root, 'docs', `MODULE_02_6_3_CATEGORIES_${width === 1440 ? 'DESKTOP' : 'MOBILE'}.png`), Buffer.from(capture.data, 'base64'));
        }
        await run(`document.querySelector('#category-add').click()`);
        assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true);
        await key('Tab', 9, 8);
        assert.equal(await run(`document.querySelector('#category-dialog').contains(document.activeElement)`), true);
        if (width === 375) {
            const capture = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            await writeFile(path.join(root, 'docs', 'MODULE_02_6_3_CATEGORIES_DIALOG.png'), Buffer.from(capture.data, 'base64'));
        }
        await key('Escape', 27);
    }
    mode = 'expired'; await run(`document.querySelector('#categories-reload').click()`);
    await waitFor(`!document.querySelector('#manager-gate').hidden`);
    assert.equal(await run(`document.querySelector('#categories-body').children.length`), 0);
    mode = 'normal';
    console.log('PASS: categories CRUD/search/page, fresh detail, validation/duplicate, protected delete, CSRF, 503 retry, 401 cleanup, responsive table/dialog. Isolated API fixture; PostgreSQL untouched.');
}
