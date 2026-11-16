// Isolated API fixture only. These checks do not verify PostgreSQL persistence.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

let mode = 'normal', nextId = 40;
let writeGate, releaseWrite;
let units = Array.from({ length: 23 }, (_, index) => ({ MaDonGia: index + 1, MaThuoc: 1, DonViTinh: index === 0 ? '<b>Viên</b>' : `Hộp ${index}`, GiaBan: index * 10000, SoLuongQuyDoi: index + 1 }));
const products = Array.from({ length: 13 }, (_, index) => ({ MaThuoc: index + 1, MaVach: `00${String(index + 1).padStart(11, '0')}`, TenThuoc: `Thuốc ${index + 1}`, MaDuoc: `MD-${index + 1}`, SoDangKy: `SDK-${index + 1}`, HinhAnh: '' }));
const calls = [];
const categories = Array.from({ length: 101 }, (_, index) => ({ MaLoaiThuoc: index + 1, TenLoaiThuoc: `Loại thuốc ${index + 1}` }));
export async function unitFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local'), parts = url.pathname.split('/');
    const productId = Number(parts[4]), unitId = Number(parts[6]);
    let raw = ''; for await (const chunk of req) raw += chunk;
    calls.push({ method: req.method, path: url.pathname, body: raw, params: url.searchParams });
    if (mode === 'expired') return json(401, { code: 'UNAUTHENTICATED' });
    if (mode === 'forbidden') return json(403, { code: 'FORBIDDEN' });
    if (mode === 'network') { req.socket.destroy(); return; }
    if (mode === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (url.pathname.endsWith('/categories')) {
        if (mode === 'categories-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        const page = Number(url.searchParams.get('page')), per_page = Number(url.searchParams.get('per_page'));
        return json(200, { items: categories.slice((page - 1) * per_page, page * per_page), page, per_page, total: categories.length, pages: Math.ceil(categories.length / per_page) });
    }
    if (!productId) {
        const page = Number(url.searchParams.get('page') || 1), perPage = Number(url.searchParams.get('per_page') || 10);
        const categoryId = url.searchParams.get('category_id');
        const items = products.filter(item => item.TenThuoc.includes(url.searchParams.get('search') || '') && (!categoryId || Number(categoryId) === (item.MaThuoc === 13 ? 2 : 1)));
        return json(200, { code: 'PRODUCTS_LISTED', items: items.slice((page - 1) * perPage, page * perPage), page, per_page: perPage, total: items.length, pages: Math.ceil(items.length / perPage) });
    }
    if (mode === 'slow' && productId === 1) await new Promise(resolve => setTimeout(resolve, 400));
    const product = products.find(item => item.MaThuoc === productId);
    if (!product || mode === 'product-missing') return json(404, { code: 'PRODUCT_NOT_FOUND' });
    if (parts.length === 5) return json(200, { code: 'PRODUCT_FOUND', product });
    if (req.method === 'GET' && !unitId) {
        const page = Number(url.searchParams.get('page') || 1), perPage = Number(url.searchParams.get('per_page') || 20);
        const items = units.filter(item => item.MaThuoc === productId);
        return json(200, { code: 'UNITS_LISTED', items: items.slice((page - 1) * perPage, page * perPage), page, per_page: perPage, total: items.length, pages: Math.ceil(items.length / perPage) });
    }
    const unit = units.find(item => item.MaDonGia === unitId && item.MaThuoc === productId);
    if ((unitId && !unit) || mode === 'unit-missing') return json(404, { code: 'UNIT_NOT_FOUND' });
    if (req.method === 'GET') return json(200, { code: 'UNIT_FOUND', unit });
    assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
    if (mode === 'csrf') return json(403, { code: 'CSRF_FAILED' });
    if (mode === 'invalid') return json(400, { code: 'INVALID_REQUEST' });
    if (mode === 'save-slow') await writeGate;
    if (req.method === 'DELETE') {
        if (unitId === 1) return json(409, { code: 'UNIT_IN_USE' });
        units = units.filter(item => item !== unit); return json(200, { code: 'UNIT_DELETED' });
    }
    const body = JSON.parse(raw);
    assert.deepEqual(Object.keys(body).sort(), ['DonViTinh', 'GiaBan', 'SoLuongQuyDoi'].sort());
    assert.equal(typeof body.GiaBan, 'number'); assert.equal(typeof body.SoLuongQuyDoi, 'number');
    const updated = { ...body, MaThuoc: productId, MaDonGia: unit ? unitId : nextId++ };
    if (unit) units[units.indexOf(unit)] = updated; else units.push(updated);
    return json(unit ? 200 : 201, { code: unit ? 'UNIT_UPDATED' : 'UNIT_CREATED', unit: updated });
}

export async function checkUnits({ evaluate: run, waitFor, key, command, root }) {
    const click = id => run(`document.getElementById('${id}').click()`);
    const choose = id => run(`document.querySelector('#units-products button[data-id="${id}"]').click()`);
    const fill = (name, price, conversion) => run(`document.querySelector('#unit-DonViTinh').value=${JSON.stringify(name)};document.querySelector('#unit-GiaBan').value=${JSON.stringify(price)};document.querySelector('#unit-SoLuongQuyDoi').value=${JSON.stringify(conversion)}`);
    const submit = () => run(`document.querySelector('#unit-form').requestSubmit()`);
    const ready = () => waitFor(`!document.querySelector('#units-table-wrap').hidden`);
    const dialogReady = () => waitFor(`!document.querySelector('#unit-save').disabled && !document.querySelector('#unit-form').hidden`);
    const screenshot = async name => {
        await run(`${name === 'MOBILE' ? "document.querySelector('#units-workspace').scrollIntoView({block:'start',behavior:'instant'})" : "window.scrollTo({top:0,behavior:'instant'})"};new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
        const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(root, 'docs', `MODULE_02_6_5_UNITS_${name}.png`), Buffer.from(result.data, 'base64'));
    };
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await run(`location.hash='units'`);
    await waitFor(`document.querySelector('#units-products').children.length===10`);
    assert.equal(calls.filter(call => call.path.endsWith('/units')).length, 0, 'No units loaded before product selection');
    await waitFor(`!document.querySelector('#units-category').disabled && document.querySelector('#units-category').options.length===102`);
    assert.equal(await run(`document.querySelector('label[for="units-category"]').textContent`), 'Loại thuốc');
    assert.ok(calls.some(call => call.path.endsWith('/categories') && call.params.get('page') === '2'), 'Loads every category page');
    await click('units-products-next'); await waitFor(`document.querySelector('#units-products').children.length===3`);
    await run(`document.querySelector('#units-category').value='1';document.querySelector('#units-category').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#units-picker-status').textContent==='12 thuốc phù hợp' && document.querySelector('#units-products').children.length===10`);
    assert.equal(await run(`document.querySelector('#units-products-page').textContent`), '1 / 2', 'Category change resets the product page');
    await click('units-products-next'); await waitFor(`document.querySelector('#units-products').children.length===2`);
    assert.ok(calls.some(call => call.params.get('category_id') === '1' && call.params.get('page') === '2'), 'Pagination retains category');
    await run(`document.querySelector('#units-search').value='Thuốc 13';document.querySelector('#units-search').dispatchEvent(new Event('input'))`);
    await waitFor(`document.querySelector('#units-picker-status').textContent.includes('Không tìm thấy thuốc')`);
    await run(`document.querySelector('#units-category').value='2';document.querySelector('#units-category').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#units-products').children.length===1`);
    assert.ok(calls.some(call => call.params.get('category_id') === '2' && call.params.get('search') === 'Thuốc 13'), 'Combines category and keyword');
    await choose(13); await waitFor(`document.querySelector('#units-product').textContent.includes('Thuốc 13')`);
    await run(`document.querySelector('#units-category').value='101';document.querySelector('#units-category').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#units-picker-status').textContent.includes('Không tìm thấy thuốc')`);
    assert.match(await run(`document.querySelector('#units-product').textContent`), /Thuốc 13/, 'Filtering preserves the open price table');
    await click('units-reset'); await waitFor(`document.querySelector('#units-products').children.length===10`);
    assert.equal(await run(`document.querySelector('#units-search').value + document.querySelector('#units-category').value`), '');
    mode = 'categories-error';
    await run(`location.hash='categories'`); await waitFor(`document.querySelector('#units-content').hidden`);
    await run(`location.hash='units'`); await waitFor(`!document.querySelector('#units-categories-retry').hidden`);
    await waitFor(`document.querySelector('#units-products').children.length===10`);
    assert.equal(await run(`document.querySelector('#units-category').disabled`), true, 'Failed categories do not block keyword search');
    mode = 'normal'; await click('units-categories-retry'); await waitFor(`!document.querySelector('#units-category').disabled`);
    await click('units-products-next'); await waitFor(`document.querySelector('#units-products').children.length===3`);
    await click('units-products-prev'); await waitFor(`document.querySelector('#units-products').children.length===10`);
    await run(`document.querySelector('#units-search').value='Thuốc 13';document.querySelector('#units-search-form').requestSubmit()`);
    await waitFor(`document.querySelector('#units-products').children.length===1`);
    assert.ok(calls.some(call => call.params.get('search') === 'Thuốc 13'));
    await run(`document.querySelector('#units-search').value='';document.querySelector('#units-search-form').requestSubmit()`);
    await waitFor(`document.querySelector('#units-products').children.length===10`);
    await choose(1); await ready();
    await run(`document.querySelector('#units-category').value='1';document.querySelector('#units-category').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#units-picker-status').textContent==='12 thuốc phù hợp'`);
    assert.match(await run(`document.querySelector('#units-product').textContent`), /Mã vạch: 0000000000001/);
    assert.equal(await run(`document.querySelector('#units-body').children.length`), 20);
    assert.equal(await run(`document.querySelector('#units-body b')`), null, 'API names are text, never HTML');
    assert.match(await run(`document.querySelector('#units-body').textContent`), /0\s*₫/);
    await screenshot('DESKTOP');
    await click('units-next'); await waitFor(`document.querySelector('#units-body').children.length===3`);
    assert.equal(await run(`document.querySelector('#units-body tr > :first-child').textContent`), '21', 'STT continues across pages');
    assert.doesNotMatch(await run(`document.querySelector('#units-body').textContent`), /#\d+/, 'No database identity is displayed');
    await click('units-prev'); await waitFor(`document.querySelector('#units-body').children.length===20`);
    await choose(2); await waitFor(`document.querySelector('#units-state-title').textContent==='Thuốc chưa có đơn vị bán'`);
    await click('units-add'); await dialogReady(); await submit();
    assert.equal(await run(`document.querySelector('#unit-DonViTinh').getAttribute('aria-invalid')`), 'true');
    assert.equal(calls.filter(call => call.method === 'POST').length, 0);
    for (const price of ['1.5', '1e3', '-1', '2147483648']) {
        await fill('Hộp', price, '1'); await submit();
        assert.equal(await run(`document.querySelector('#unit-GiaBan').getAttribute('aria-invalid')`), 'true');
    }
    await fill('Hộp', '0', '0'); await submit();
    assert.equal(await run(`document.querySelector('#unit-SoLuongQuyDoi').getAttribute('aria-invalid')`), 'true');
    await fill('Hộp', '0', '10'); mode = 'invalid'; await submit();
    await waitFor(`document.querySelector('#unit-error').textContent.includes('Dữ liệu không hợp lệ') && !document.querySelector('#unit-save').disabled`);
    assert.equal(await run(`document.querySelector('#unit-GiaBan').value`), '0');
    mode = 'csrf'; await submit(); await waitFor(`document.querySelector('#unit-error').textContent.includes('xác thực') && !document.querySelector('#unit-save').disabled`);
    mode = 'save-slow'; const before = calls.filter(call => call.method === 'POST').length;
    writeGate = new Promise(resolve => { releaseWrite = resolve; });
    await run(`document.querySelector('#unit-form').requestSubmit();document.querySelector('#unit-form').requestSubmit()`);
    assert.equal(await run(`document.querySelector('#unit-dialog').getAttribute('aria-busy')`), 'true', await run(`document.querySelector('#unit-error').textContent`));
    await key('Escape', 27); assert.equal(await run(`document.querySelector('#unit-dialog').open`), true);
    releaseWrite();
    await waitFor(`!document.querySelector('#unit-dialog').open`); await ready();
    assert.equal(calls.filter(call => call.method === 'POST').length, before + 1);
    mode = 'normal';
    await run(`document.querySelector('#units-body [data-action="edit"]').click()`); await dialogReady();
    assert.equal(await run(`document.querySelector('#unit-SoLuongQuyDoi').value`), '10');
    await fill('Vỉ', '1234567', '20'); await screenshot('FORM_DESKTOP'); await submit();
    await waitFor(`!document.querySelector('#unit-dialog').open`); await ready();
    assert.match(await run(`document.querySelector('#units-body').textContent`), /1\.234\.567/);
    assert.equal(units.find(item => item.MaThuoc === 2).SoLuongQuyDoi, 20);
    assert.equal(await run(`document.querySelector('#units-category').value`), '1', 'Saving prices preserves the category filter');
    // Duplicate names are supported by the current backend.
    await click('units-add'); await dialogReady(); await fill('Vỉ', '100', '1'); await submit();
    await waitFor(`!document.querySelector('#unit-dialog').open && document.querySelector('#units-body').children.length===2`);
    await run(`document.querySelector('#units-body [data-action="delete"]').click()`);
    await waitFor(`!document.querySelector('#unit-delete-confirm').disabled`);
    assert.match(await run(`document.querySelector('#unit-delete-summary').textContent`), /Vỉ.*1\.234\.567/);
    const deletes = calls.filter(call => call.method === 'DELETE').length;
    await key('Escape', 27); assert.equal(calls.filter(call => call.method === 'DELETE').length, deletes);
    await run(`document.querySelector('#units-body [data-action="delete"]').click()`); await waitFor(`!document.querySelector('#unit-delete-confirm').disabled`);
    await click('unit-delete-confirm'); await waitFor(`!document.querySelector('#unit-dialog').open && document.querySelector('#units-body').children.length===1`);
    await choose(1); await ready();
    await run(`document.querySelector('#units-body [data-action="delete"]').click()`); await waitFor(`!document.querySelector('#unit-delete-confirm').disabled`);
    await click('unit-delete-confirm'); await waitFor(`document.querySelector('#unit-error').textContent.includes('Không thể xóa')`);
    assert.equal(units.some(item => item.MaDonGia === 1), true); await click('unit-delete-cancel');
    mode = 'unit-missing'; await run(`document.querySelector('#units-body [data-action="edit"]').click()`);
    await waitFor(`document.querySelector('#unit-error').textContent.includes('không còn tồn tại')`);
    assert.equal(await run(`document.querySelector('#unit-save').disabled`), true); await click('unit-close');
    mode = 'slow'; await choose(1); await choose(2);
    await waitFor(`document.querySelector('#units-product').textContent.includes('Thuốc 2') && !document.querySelector('#units-table-wrap').hidden`);
    await run(`new Promise(r=>setTimeout(r,500))`);
    assert.match(await run(`document.querySelector('#units-product').textContent`), /Thuốc 2/);
    mode = 'error'; await click('units-reload'); await waitFor(`!document.querySelector('#units-retry').hidden`);
    mode = 'normal'; await click('units-retry'); await ready();
    mode = 'network'; await click('units-reload'); await waitFor(`document.querySelector('#units-state-description').textContent.includes('Mất kết nối')`);
    mode = 'normal'; await click('units-retry'); await ready();
    for (const width of [1280, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
        assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`), true, `Units overflow ${width}`);
        await click('units-add'); await dialogReady(); await fill('Hộp', '2147483647', '2147483647');
        assert.equal(await run(`document.querySelector('#unit-dialog').scrollWidth<=document.querySelector('#unit-dialog').clientWidth`), true, `Dialog overflow ${width}`);
        await key('Tab', 9, 8);
        assert.equal(await run(`document.querySelector('#unit-dialog').contains(document.activeElement)`), true);
        if (width === 375) { await screenshot('FORM_MOBILE'); await click('unit-cancel'); await screenshot('MOBILE'); }
        else await key('Escape', 27);
        await waitFor(`!document.querySelector('#unit-dialog').open && document.activeElement.id==='units-add'`);
    }
    mode = 'product-missing'; await choose(3); await waitFor(`document.querySelector('#units-state-description').textContent.includes('Thuốc không còn tồn tại')`);
    assert.equal(await run(`document.querySelector('#units-add').disabled`), true);
    mode = 'normal'; await choose(2); await ready();
    mode = 'expired'; await click('units-reload'); await waitFor(`!document.querySelector('#manager-gate').hidden`);
    assert.equal(await run(`document.querySelector('#units-products').children.length + document.querySelector('#units-body').children.length`), 0);
    mode = 'normal'; await click('manager-retry'); // Gate login can be hidden; session is still provided by fixture.
    await waitFor(`!document.querySelector('#manager-shell').hidden`);
    await waitFor(`document.querySelector('#units-products').children.length===10`);
    assert.equal(await run(`document.querySelector('#units-category').value`), '', 'Session cleanup clears the category filter');
    mode = 'forbidden'; await choose(1); await waitFor(`!document.querySelector('#manager-gate').hidden`);
    mode = 'normal';
    console.log('PASS: units category/keyword filters, all category pages, reset, empty/error/retry, filter preserved after save and cleared on session expiry; CRUD, exact payload/CSRF, validation, duplicates, conversion edit, VND, protected delete, pagination, stale response, keyboard/dialog focus, desktop/tablet/mobile. API/AUTH MOCK; no PostgreSQL writes.');
}
