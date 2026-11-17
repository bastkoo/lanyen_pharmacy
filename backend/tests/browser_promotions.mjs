// Isolated UI fixture; no production API or PostgreSQL persistence is exercised here.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
let mode = 'normal', nextId = 200, writeGate, releaseWrite;
const calls = [];
let programs = Array.from({ length: 103 }, (_, i) => ({ MaChuongTrinh: i + 1, TenChuongTrinh: i === 0 ? '<b>Chương trình 1</b>' : `Chương trình ${i + 1}`, NgayBatDau: i === 1 ? '9998-01-01' : '2000-01-01', NgayKetThuc: i === 2 ? '2000-01-01' : '9999-12-31' }));
const products = Array.from({ length: 25 }, (_, i) => ({ MaThuoc: i + 1, MaVach: `00${String(i + 1).padStart(11, '0')}`, TenThuoc: `Thuốc ${i + 1}`, MaDuoc: `MD-${i + 1}`, SoDangKy: `SDK-${i + 1}`, HinhAnh: '' }));
let items = Array.from({ length: 23 }, (_, i) => ({ MaChuongTrinh: 1, MaThuoc: i + 1, LoaiGiamGia: i % 2 === 0, GiaTriGiam: i % 2 === 0 ? '10.00' : '1500.25', SoLuong: i === 0 ? 0 : 100 }));
const paged = (values, url, code) => {
    const page = Number(url.searchParams.get('page') || 1), per_page = Number(url.searchParams.get('per_page') || 20);
    return { code, items: values.slice((page - 1) * per_page, page * per_page), total: values.length, pages: Math.ceil(values.length / per_page), page, per_page };
};
export async function promotionFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local'), parts = url.pathname.split('/');
    let raw = ''; for await (const chunk of req) raw += chunk;
    calls.push({ path: url.pathname, method: req.method, params: url.searchParams, raw });
    if (mode === 'expired') return json(401, { code: 'UNAUTHENTICATED' });
    if (mode === 'forbidden') return json(403, { code: 'FORBIDDEN' });
    if (mode === 'network') { req.socket.destroy(); return; }
    if (mode === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (parts[3] === 'products') {
        if (mode === 'picker-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        const id = Number(parts[4]);
        if (id) return json(200, { code: 'PRODUCT_FOUND', product: products.find(product => product.MaThuoc === id) });
        return json(200, paged(products.filter(product => product.TenThuoc.includes(url.searchParams.get('search') || '')), url, 'PRODUCTS_LISTED'));
    }
    const id = Number(parts[4]), productId = Number(parts[6]), itemMode = parts[5] === 'items';
    if (mode === 'slow' && id === 1) await new Promise(resolve => setTimeout(resolve, 400));
    if (!id && req.method === 'GET') {
        if (mode === 'page-error' && url.searchParams.get('page') === '2') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        return json(200, paged(mode === 'empty' ? [] : programs, url, 'PROMOTIONS_LISTED'));
    }
    const program = programs.find(value => value.MaChuongTrinh === id), item = items.find(value => value.MaChuongTrinh === id && value.MaThuoc === productId);
    if (id && (!program || mode === 'program-missing')) return json(404, { code: 'PROMOTION_NOT_FOUND' });
    if (itemMode && productId && (!item || mode === 'item-missing')) return json(404, { code: 'PROMOTION_ITEM_NOT_FOUND' });
    if (req.method === 'GET') {
        if (!itemMode) return json(200, { code: 'PROMOTION_FOUND', promotion: program });
        return productId ? json(200, { code: 'PROMOTION_ITEM_FOUND', item }) : json(200, paged(items.filter(value => value.MaChuongTrinh === id), url, 'PROMOTION_ITEMS_LISTED'));
    }
    assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
    if (mode === 'csrf') return json(403, { code: 'CSRF_FAILED' });
    if (mode === 'invalid') return json(400, { code: 'INVALID_REQUEST' });
    if (mode === 'save-slow') await writeGate;
    if (req.method === 'DELETE') {
        if (itemMode) { items = items.filter(value => value !== item); return json(200, { code: 'PROMOTION_ITEM_DELETED' }); }
        if (items.some(value => value.MaChuongTrinh === id)) return json(409, { code: 'PROMOTION_IN_USE' });
        programs = programs.filter(value => value !== program); return json(200, { code: 'PROMOTION_DELETED' });
    }
    const body = JSON.parse(raw), create = req.method === 'POST';
    if (itemMode) {
        assert.deepEqual(Object.keys(body).sort(), ['LoaiGiamGia', 'GiaTriGiam', 'SoLuong', ...(create ? ['MaThuoc'] : [])].sort());
        if (create && (mode === 'duplicate' || items.some(value => value.MaChuongTrinh === id && value.MaThuoc === body.MaThuoc))) return json(409, { code: 'PROMOTION_ITEM_EXISTS' });
        const result = { ...body, MaChuongTrinh: id, MaThuoc: create ? body.MaThuoc : productId, GiaTriGiam: body.GiaTriGiam.toFixed(2) };
        if (create) items.push(result); else items[items.indexOf(item)] = result;
        return json(create ? 201 : 200, { code: create ? 'PROMOTION_ITEM_CREATED' : 'PROMOTION_ITEM_UPDATED', item: result });
    }
    assert.deepEqual(Object.keys(body).sort(), ['TenChuongTrinh', 'NgayBatDau', 'NgayKetThuc'].sort());
    const result = { ...body, MaChuongTrinh: create ? nextId++ : id };
    if (create) programs.push(result); else programs[programs.indexOf(program)] = result;
    return json(create ? 201 : 200, { code: create ? 'PROMOTION_CREATED' : 'PROMOTION_UPDATED', promotion: result });
}

export async function checkPromotions({ evaluate: run, waitFor, key, command, root }) {
    const click = id => run(`document.getElementById('${id}').click()`);
    const listReady = () => waitFor(`!document.querySelector('#promotions-scroll').hidden && document.querySelector('#promotions-list-view').getAttribute('aria-busy')==='false'`);
    const itemReady = () => waitFor(`!document.querySelector('#promotion-items-scroll').hidden && !document.querySelector('#promotion-item-add').disabled`);
    const dialogReady = () => waitFor(`document.querySelector('#promotion-dialog').open && !document.querySelector('#promotion-dialog-save').disabled && !document.querySelector('#promotion-form').hidden`);
    const submit = () => run(`document.querySelector('#promotion-form').requestSubmit()`);
    const programValues = (overrides = {}) => run(`(()=>{const values=${JSON.stringify({ TenChuongTrinh: 'Chương trình mới', NgayBatDau: '2026-11-15', NgayKetThuc: '2026-11-15', ...overrides })};for(const [name,value]of Object.entries(values))document.getElementById('promotion-'+name).value=value})()`);
    const itemValues = (overrides = {}) => run(`(()=>{const values=${JSON.stringify({ MaThuoc: '25', LoaiGiamGia: 'true', GiaTriGiam: '15', SoLuong: '10', ...overrides })};for(const [name,value]of Object.entries(values))document.getElementById('promotion-'+name).value=value;document.querySelector('#promotion-LoaiGiamGia').dispatchEvent(new Event('change'))})()`);
    const filter = (search = '', status = '') => run(`document.querySelector('#promotions-search').value=${JSON.stringify(search)};document.querySelector('#promotions-status').value=${JSON.stringify(status)};document.querySelector('#promotions-search').dispatchEvent(new Event('input'));new Promise(r=>setTimeout(r,350))`);
    const openProgram = id => run(`document.querySelector('[data-promotion-action="view"][data-id="${id}"]').click()`);
    const screenshot = async (name, selector) => {
        await run(`${selector ? `document.querySelector('${selector}').scrollIntoView({block:'start',behavior:'instant'})` : "window.scrollTo({top:0,behavior:'instant'})"};new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
        const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(root, 'docs', `MODULE_02_7_3_PROMOTIONS_${name}.png`), Buffer.from(result.data, 'base64'));
    };
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await run(`location.hash='promotions'`); await listReady();
    assert.equal(await run(`document.querySelector('#promotions-body').children.length`), 20);
    assert.ok(calls.some(call => call.params.get('page') === '2' && call.params.get('per_page') === '100'));
    assert.equal(await run(`document.querySelector('#promotions-body b')`), null);
    await screenshot('LIST_DESKTOP');
    await filter('Chương trình 103'); assert.equal(await run(`document.querySelector('#promotions-body').children.length`), 1);
    await filter('', 'upcoming'); assert.match(await run(`document.querySelector('#promotions-body').textContent`), /Sắp diễn ra/);
    await filter('', 'ended'); assert.match(await run(`document.querySelector('#promotions-body').textContent`), /Đã kết thúc/);
    await filter(); await click('promotions-next'); assert.match(await run(`document.querySelector('#promotions-page').textContent`), /Trang 2/); await click('promotions-prev');
    mode = 'page-error'; await click('promotions-refresh'); await waitFor(`!document.querySelector('#promotions-retry').hidden`);
    assert.equal(await run(`document.querySelector('#promotions-body').children.length`), 0, 'Never show partial global filter results');
    mode = 'normal'; await click('promotions-retry'); await listReady();
    await click('promotion-add'); await dialogReady(); await submit(); assert.equal(await run(`document.querySelector('#promotion-TenChuongTrinh').getAttribute('aria-invalid')`), 'true');
    await programValues({ NgayKetThuc: '2026-11-14' }); await submit(); assert.equal(await run(`document.querySelector('#promotion-NgayKetThuc').getAttribute('aria-invalid')`), 'true');
    await programValues(); mode = 'invalid'; await submit(); await waitFor(`document.querySelector('#promotion-dialog-error').textContent.includes('không hợp lệ') && !document.querySelector('#promotion-dialog-save').disabled`);
    assert.equal(await run(`document.querySelector('#promotion-TenChuongTrinh').value`), 'Chương trình mới');
    mode = 'save-slow'; writeGate = new Promise(resolve => { releaseWrite = resolve; }); const before = calls.filter(call => call.method === 'POST').length;
    await run(`document.querySelector('#promotion-form').requestSubmit();document.querySelector('#promotion-form').requestSubmit()`); await key('Escape', 27); assert.equal(await run(`document.querySelector('#promotion-dialog').open`), true); releaseWrite();
    await waitFor(`!document.querySelector('#promotion-dialog').open`); await listReady(); assert.equal(calls.filter(call => call.method === 'POST').length, before + 1); mode = 'normal';
    await filter('Chương trình mới'); await run(`document.querySelector('[data-promotion-action="edit"]').click()`); await dialogReady();
    assert.equal(await run(`document.querySelector('#promotion-TenChuongTrinh').value`), 'Chương trình mới'); await programValues({ TenChuongTrinh: 'Đã cập nhật' }); await submit(); await waitFor(`!document.querySelector('#promotion-dialog').open`);
    await waitFor(`document.querySelector('#promotions-list-view').getAttribute('aria-busy')==='false'`); await filter('Đã cập nhật');
    await run(`document.querySelector('[data-promotion-action="delete"]').click()`); await waitFor(`!document.querySelector('#promotion-delete-confirm').disabled`);
    const deletes = calls.filter(call => call.method === 'DELETE').length; await key('Escape', 27); await waitFor(`!document.querySelector('#promotion-dialog').open`); assert.equal(calls.filter(call => call.method === 'DELETE').length, deletes);
    await run(`document.querySelector('[data-promotion-action="delete"]').click()`); await waitFor(`!document.querySelector('#promotion-delete-confirm').disabled`); await click('promotion-delete-confirm'); await waitFor(`!document.querySelector('#promotion-dialog').open`); await waitFor(`document.querySelector('#promotions-list-view').getAttribute('aria-busy')==='false'`);
    await filter(); await run(`document.querySelector('[data-promotion-action="delete"][data-id="1"]').click()`); await waitFor(`!document.querySelector('#promotion-delete-confirm').disabled`); await click('promotion-delete-confirm'); await waitFor(`document.querySelector('#promotion-dialog-error').textContent.includes('Không thể xóa')`); await click('promotion-dialog-close');
    await openProgram(1); await itemReady(); assert.equal(await run(`document.querySelector('#promotion-items-body').children.length`), 20);
    assert.match(await run(`document.querySelector('#promotion-items-body').textContent`), /Mã vạch: 0000000000001/);
    assert.match(await run(`document.querySelector('#promotion-items-body').textContent`), /Hết số lượng áp dụng/); assert.match(await run(`document.querySelector('#promotion-items-body').textContent`), /1\.500,25/);
    await screenshot('DETAIL_DESKTOP');
    await click('promotion-items-next'); await waitFor(`document.querySelector('#promotion-items-body').children.length===3`); await click('promotion-items-prev'); await waitFor(`document.querySelector('#promotion-items-body').children.length===20`);
    await click('promotion-item-add'); await dialogReady(); await waitFor(`!document.querySelector('#promotion-MaThuoc').disabled`);
    assert.equal(await run(`document.querySelector('#promotion-product-find')`), null);
    assert.equal(await run(`document.querySelector('#promotion-picker-retry').hidden`), true);
    mode = 'picker-error';
    await run(`document.querySelector('#promotion-product-search').value='Thuốc 25';document.querySelector('#promotion-product-search').dispatchEvent(new Event('input'))`);
    await waitFor(`!document.querySelector('#promotion-picker-retry').hidden`);
    mode = 'normal'; await click('promotion-picker-retry');
    await waitFor(`document.querySelector('#promotion-MaThuoc').options.length===2 && document.querySelector('#promotion-MaThuoc option[value="25"]')`);
    assert.equal(await run(`document.querySelector('#promotion-picker-retry').hidden`), true);
    assert.equal(await run(`document.querySelector('#promotion-dialog').open`), true, 'Live picker search does not submit the promotion form');
    await run(`document.querySelector('#promotion-product-search').value='';document.querySelector('#promotion-product-search').dispatchEvent(new Event('input'))`);
    await waitFor(`document.querySelector('#promotion-MaThuoc').options.length===21`);
    assert.equal(await run(`document.querySelector('#promotion-MaThuoc option[value="1"]').disabled`), true);
    await click('promotion-picker-next'); await waitFor(`document.querySelector('#promotion-MaThuoc option[value="25"]')`);
    assert.equal(await run(`document.querySelector('#promotion-MaThuoc option[value="23"]').disabled`), true, 'Disable assigned products outside first visible item page');
    await itemValues({ GiaTriGiam: '101', SoLuong: '0' }); await submit(); assert.equal(await run(`document.querySelector('#promotion-GiaTriGiam').getAttribute('aria-invalid')`), 'true'); assert.equal(await run(`document.querySelector('#promotion-SoLuong').getAttribute('aria-invalid')`), 'true');
    await itemValues(); mode = 'duplicate'; await submit(); await waitFor(`document.querySelector('#promotion-dialog-error').textContent.includes('đã có') && !document.querySelector('#promotion-dialog-save').disabled`);
    mode = 'csrf'; await submit(); await waitFor(`document.querySelector('#promotion-dialog-error').textContent.includes('xác thực') && !document.querySelector('#promotion-dialog-save').disabled`);
    mode = 'normal'; await submit(); await waitFor(`!document.querySelector('#promotion-dialog').open`); await itemReady();
    assert.equal(items.find(item => item.MaThuoc === 25).LoaiGiamGia, true);
    await click('promotion-item-add'); await dialogReady(); await waitFor(`!document.querySelector('#promotion-MaThuoc').disabled`); await click('promotion-picker-next'); await waitFor(`document.querySelector('#promotion-MaThuoc option[value="24"]')`);
    await itemValues({ MaThuoc: '24', LoaiGiamGia: 'false', GiaTriGiam: '1000.255' }); await submit(); assert.equal(await run(`document.querySelector('#promotion-GiaTriGiam').getAttribute('aria-invalid')`), 'true');
    await itemValues({ MaThuoc: '24', LoaiGiamGia: 'false', GiaTriGiam: '1000.25' }); await submit(); await waitFor(`!document.querySelector('#promotion-dialog').open`); await itemReady();
    await run(`document.querySelector('[data-item-action="edit"][data-id="1"]').click()`); await dialogReady(); assert.equal(await run(`document.querySelector('#promotion-SoLuong').value`), '0');
    await itemValues({ LoaiGiamGia: 'false', GiaTriGiam: '2000.50', SoLuong: '25' }); await submit(); await waitFor(`!document.querySelector('#promotion-dialog').open`); await itemReady();
    assert.equal(items.find(item => item.MaThuoc === 1).SoLuong, 25); assert.equal(items.find(item => item.MaThuoc === 1).GiaTriGiam, '2000.50');
    await run(`document.querySelector('[data-item-action="delete"][data-id="1"]').click()`); await waitFor(`!document.querySelector('#promotion-delete-confirm').disabled`); await click('promotion-delete-confirm'); await waitFor(`!document.querySelector('#promotion-dialog').open`); await itemReady(); assert.equal(items.some(item => item.MaThuoc === 1), false);
    mode = 'item-missing'; await run(`document.querySelector('[data-item-action="edit"]').click()`); await waitFor(`document.querySelector('#promotion-dialog-error').textContent.includes('không còn')`); await click('promotion-dialog-close'); mode = 'normal';
    mode = 'error'; await click('promotion-items-refresh'); await waitFor(`!document.querySelector('#promotion-items-retry').hidden`); mode = 'normal'; await click('promotion-items-retry'); await itemReady();
    for (const width of [1280, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
        assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`), true, `Detail overflow ${width}`);
        if (width === 375) await screenshot('DETAIL_MOBILE', '#promotion-items-table');
        await click('promotion-item-add'); await dialogReady(); await waitFor(`!document.querySelector('#promotion-MaThuoc').disabled`);
        assert.equal(await run(`document.querySelector('#promotion-dialog').scrollWidth<=document.querySelector('#promotion-dialog').clientWidth`), true, `Dialog overflow ${width}`);
        await key('Tab', 9, 8); assert.equal(await run(`document.querySelector('#promotion-dialog').contains(document.activeElement)`), true);
        if (width === 375) await screenshot('ITEM_FORM_MOBILE'); await key('Escape', 27); await waitFor(`!document.querySelector('#promotion-dialog').open && document.activeElement.id==='promotion-item-add'`);
    }
    await click('promotion-back'); await listReady();
    for (const width of [1440, 1024, 768, 375, 320]) { await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 }); assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`), true, `List overflow ${width}`); if (width === 375) await screenshot('LIST_MOBILE'); }
    mode = 'empty'; await click('promotions-refresh'); await waitFor(`document.querySelector('#promotions-state-text').textContent.includes('Chưa có chương trình')`); mode = 'normal'; await click('promotions-refresh'); await listReady();
    mode = 'network'; await click('promotions-refresh'); await waitFor(`document.querySelector('#promotions-state-text').textContent.includes('Mất kết nối')`); mode = 'normal'; await click('promotions-retry'); await listReady();
    await openProgram(2); await waitFor(`document.querySelector('#promotion-items-state').textContent.includes('Chưa có dữ liệu')`); await click('promotion-back'); await listReady();
    mode = 'program-missing'; await openProgram(1); await waitFor(`document.querySelector('#promotion-detail-status').textContent.includes('không còn tồn tại')`); mode = 'normal'; await click('promotion-back'); await listReady();
    mode = 'slow'; await openProgram(1); await click('promotion-back'); await listReady(); await openProgram(2); await waitFor(`document.querySelector('#promotion-identity').textContent.includes('Chương trình 2')`); await run(`new Promise(r=>setTimeout(r,500))`); assert.match(await run(`document.querySelector('#promotion-identity').textContent`), /Chương trình 2/); mode = 'normal';
    mode = 'expired'; await click('promotion-detail-refresh'); await waitFor(`!document.querySelector('#manager-gate').hidden`); assert.equal(await run(`document.querySelector('#promotion-items-body').children.length+document.querySelector('#promotions-body').children.length`), 0);
    mode = 'normal'; await click('manager-retry'); await waitFor(`!document.querySelector('#manager-shell').hidden`); await listReady(); mode = 'forbidden'; await click('promotions-refresh'); await waitFor(`!document.querySelector('#manager-gate').hidden`); mode = 'normal';
    console.log('PASS: promotion program/item CRUD, full-data name/status filtering, percentage/money/quantity edits, duplicate prevention, protected delete, errors/retry/CSRF/401/403, stale detail, keyboard/focus, desktop/mobile. API/AUTH MOCK; PostgreSQL untouched.');
}
