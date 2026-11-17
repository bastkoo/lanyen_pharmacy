// UI-only fixture. Production uses real Flask endpoints; no fixture data is persisted.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
let mode = 'normal', nextId = 50, writeGate, releaseWrite;
const calls = [], asOf = '2026-11-15';
const products = Array.from({ length: 23 }, (_, index) => ({ MaThuoc: index + 1, MaVach: `00${String(index + 1).padStart(11, '0')}`, TenThuoc: `Thuốc ${index + 1}`, MaDuoc: `MD-${index + 1}`, SoDangKy: `SDK-${index + 1}`, MaLoaiThuoc: index === 22 ? 2 : 1, QuyCachDongGoi: `Hộp ${index + 1} vỉ x 10 viên`, HinhAnh: '' }));
const categories = Array.from({ length: 101 }, (_, index) => ({ MaLoaiThuoc: index + 1, TenLoaiThuoc: `Danh mục ${index + 1}` }));
let batches = Array.from({ length: 23 }, (_, index) => ({ MaLo: index + 1, MaThuoc: 1, SoLoSanXuat: index ? `LOT-${index + 1}` : '<b>LOT-1</b>', NgaySanXuat: '2025-01-01', HanSuDung: index ? '2027-01-01' : '2026-11-14', SoLuongNhap: 100, SoLuongTon: index ? 100 : 1, GiaNhap: 1000 }));
const pageResult = (items, url, code, extra = {}) => {
    const page = Number(url.searchParams.get('page') || 1), per_page = Number(url.searchParams.get('per_page') || 20);
    return { code, items: items.slice((page - 1) * per_page, page * per_page), total: items.length, pages: Math.ceil(items.length / per_page), page, per_page, ...extra };
};
export async function stockFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local'), parts = url.pathname.split('/');
    let raw = ''; for await (const chunk of req) raw += chunk;
    calls.push({ path: url.pathname, params: url.searchParams, method: req.method, raw });
    if (mode === 'expired-session') return json(401, { code: 'UNAUTHENTICATED' });
    if (mode === 'forbidden') return json(403, { code: 'FORBIDDEN' });
    if (mode === 'network') { req.socket.destroy(); return; }
    if (mode === 'error' || (mode === 'low-error' && url.pathname.endsWith('/low-stock'))) return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (parts[3] === 'categories') {
        if (mode === 'categories-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        return json(200, pageResult(categories, url, 'CATEGORIES_LISTED'));
    }
    if (parts[3] === 'inventory') {
        if (url.pathname.endsWith('/expiring')) {
            const status = url.searchParams.get('status') || 'expiring', days = Number(url.searchParams.get('days') || 0);
            const item = { ...batches[0], MaVach: products[0].MaVach, HanSuDung: status === 'expired' ? '2026-11-14' : days === 0 ? asOf : '2026-11-20', TenThuoc: 'Thuốc 1', TrangThaiHan: status === 'expired' ? 'EXPIRED' : 'EXPIRING' };
            return json(200, pageResult(mode === 'empty' ? [] : [item], url, status === 'expired' ? 'EXPIRED_BATCHES_LISTED' : 'EXPIRING_BATCHES_LISTED', { as_of: asOf, status, days }));
        }
        const low = url.pathname.endsWith('/low-stock');
        const items = products.map(product => ({ MaThuoc: product.MaThuoc, TenThuoc: product.TenThuoc, MaVach: product.MaVach, TongSoLuongTon: product.MaThuoc === 1 ? 2201 : 0, NguongTonKho: product.MaThuoc === 1 ? 2201 : 0, TonKhoThap: true }));
        return json(200, pageResult(mode === 'empty' ? [] : low ? items.slice(0, 2) : items, url, low ? 'LOW_STOCK_LISTED' : 'INVENTORY_SUMMARY'));
    }
    const productId = Number(parts[4]), batchId = Number(parts[6]);
    if (!productId) return json(200, pageResult(mode === 'empty' ? [] : products.filter(product => product.TenThuoc.includes(url.searchParams.get('search') || '') && (!url.searchParams.has('category_id') || product.MaLoaiThuoc === Number(url.searchParams.get('category_id')))), url, 'PRODUCTS_LISTED'));
    if (mode === 'slow' && productId === 1) await new Promise(resolve => setTimeout(resolve, 400));
    const product = products.find(item => item.MaThuoc === productId);
    if (!product || mode === 'product-missing') return json(404, { code: 'PRODUCT_NOT_FOUND' });
    if (parts.length === 5) return json(200, { code: 'PRODUCT_FOUND', product });
    if (!batchId && req.method === 'GET') return json(200, pageResult(mode === 'empty' ? [] : batches.filter(item => item.MaThuoc === productId), url, 'BATCHES_LISTED'));
    const batch = batches.find(item => item.MaLo === batchId && item.MaThuoc === productId);
    if (batchId && (!batch || mode === 'batch-missing')) return json(404, { code: 'BATCH_NOT_FOUND' });
    if (req.method === 'GET') return json(200, { code: 'BATCH_FOUND', batch });
    assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
    if (mode === 'csrf') return json(403, { code: 'CSRF_FAILED' });
    if (mode === 'invalid') return json(400, { code: 'INVALID_REQUEST' });
    if (req.method === 'DELETE') return json(409, { code: 'BATCH_DELETE_UNSAFE' });
    if (mode === 'immutable') return json(409, { code: 'BATCH_QUANTITY_IMMUTABLE' });
    if (mode === 'inconsistent') return json(409, { code: 'BATCH_STOCK_INCONSISTENT' });
    if (mode === 'save-slow') await writeGate;
    const body = JSON.parse(raw), create = req.method === 'POST';
    assert.deepEqual(Object.keys(body).sort(), ['SoLoSanXuat', 'NgaySanXuat', 'HanSuDung', 'GiaNhap', ...(create ? ['SoLuongNhap'] : [])].sort());
    const result = create ? { ...body, MaThuoc: productId, MaLo: nextId++, SoLuongTon: body.SoLuongNhap } : { ...batch, ...body };
    if (create) batches.push(result); else batches[batches.indexOf(batch)] = result;
    return json(create ? 201 : 200, { code: create ? 'BATCH_CREATED' : 'BATCH_UPDATED', batch: result });
}
export async function checkStock({ evaluate: run, waitFor, key, command, root }) {
    const click = id => run(`document.getElementById('${id}').click()`);
    const select = id => run(`document.querySelector('#batch-product-select').value='${id}';document.querySelector('#batch-product-select').dispatchEvent(new Event('change'))`);
    const ready = () => waitFor(`!document.querySelector('#batches-scroll').hidden`);
    const formReady = () => waitFor(`!document.querySelector('#batch-form').hidden && !document.querySelector('#batch-save').disabled`);
    const fill = (values = {}) => run(`(()=>{const data=${JSON.stringify({ SoLoSanXuat: 'NEW-LOT', NgaySanXuat: '2026-01-01', HanSuDung: '2027-01-01', SoLuongNhap: '100', GiaNhap: '0', ...values })};for(const [key,value]of Object.entries(data))document.getElementById('batch-'+key).value=value})()`);
    const submit = () => run(`document.querySelector('#batch-form').requestSubmit()`);
    const screenshot = async name => {
        await run(`window.scrollTo({top:0,behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
        const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(root, 'docs', `MODULE_02_6_6_STOCK_${name}.png`), Buffer.from(result.data, 'base64'));
    };
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await run(`location.hash='batches'`); await waitFor(`document.querySelector('#batch-product-select').options.length===21`);
    await waitFor(`!document.querySelector('#batch-category').disabled && document.querySelector('#batch-category').options.length===102`);
    assert.ok(calls.some(call => call.path.endsWith('/categories') && call.params.get('page') === '2'), 'Loads all category pages');
    assert.match(await run(`document.querySelector('#batch-product-select option[value="1"]').textContent`), /Quy cách: Hộp 1 vỉ x 10 viên/);
    assert.equal(calls.some(call => call.path.endsWith('/batches')), false);
    await click('batch-products-next'); await waitFor(`document.querySelector('#batch-product-select').options.length===4`);
    await run(`document.querySelector('#batch-category').value='1';document.querySelector('#batch-category').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#batch-picker-status').textContent==='22 thuốc · Trang 1 / 2'`);
    await click('batch-products-next'); await waitFor(`document.querySelector('#batch-product-select').options.length===3`);
    assert.ok(calls.some(call => call.params.get('category_id') === '1' && call.params.get('page') === '2'));
    await run(`document.querySelector('#batch-search').value='Thuốc 23';document.querySelector('#batch-search').dispatchEvent(new Event('input'))`);
    await waitFor(`document.querySelector('#batch-picker-status').textContent.includes('Không tìm thấy')`);
    await run(`document.querySelector('#batch-category').value='2';document.querySelector('#batch-category').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#batch-product-select').options.length===2`);
    assert.ok(calls.some(call => call.params.get('category_id') === '2' && call.params.get('search') === 'Thuốc 23'));
    await click('batch-reset'); await waitFor(`document.querySelector('#batch-product-select').options.length===21`);
    await run(`document.querySelector('#batch-category').value='101';document.querySelector('#batch-category').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#batch-product-select').disabled && document.querySelector('#batch-picker-status').textContent.includes('Không tìm thấy')`);
    await click('batch-reset'); await waitFor(`document.querySelector('#batch-product-select').options.length===21`);
    mode = 'categories-error'; await run(`location.hash='inventory'`); await waitFor(`document.querySelector('#batches-content').hidden`);
    await run(`location.hash='batches'`); await waitFor(`!document.querySelector('#batch-categories-retry').hidden && document.querySelector('#batch-product-select').options.length===21`);
    assert.equal(await run(`document.querySelector('#batch-category').disabled`), true);
    mode = 'normal'; await click('batch-categories-retry'); await waitFor(`!document.querySelector('#batch-category').disabled`);
    await click('batch-products-next'); await waitFor(`document.querySelector('#batch-product-select').options.length===4`);
    await click('batch-products-prev'); await waitFor(`document.querySelector('#batch-product-select').options.length===21`);
    await run(`document.querySelector('#batch-search').value='Thuốc 23';document.querySelector('#batch-search').dispatchEvent(new Event('input'))`);
    await waitFor(`document.querySelector('#batch-product-select').options.length===2`);
    assert.ok(calls.some(call => call.params.get('search') === 'Thuốc 23'));
    await run(`document.querySelector('#batch-search').value='';document.querySelector('#batch-product-search').requestSubmit()`); await waitFor(`document.querySelector('#batch-product-select').options.length===21`);
    await select(1); await ready(); assert.equal(await run(`document.querySelector('#batches-body').children.length`), 20);
    assert.match(await run(`document.querySelector('#batch-product-identity').textContent`), /Mã vạch: 0000000000001/);
    assert.match(await run(`document.querySelector('#batch-product-identity').textContent`), /Quy cách đóng gói: Hộp 1 vỉ x 10 viên/);
    await run(`document.querySelector('#batch-category').value='1';document.querySelector('#batch-category').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#batch-picker-status').textContent==='22 thuốc · Trang 1 / 2'`);
    assert.equal(await run(`document.querySelector('#batches-body b')`), null);
    await screenshot('BATCHES_DESKTOP');
    await click('batches-next'); await waitFor(`document.querySelector('#batches-body').children.length===3`);
    assert.equal(await run(`document.querySelector('#batches-body tr > :first-child').textContent`), '21', 'STT continues across pages');
    assert.doesNotMatch(await run(`document.querySelector('#batches-body').textContent`), /#\d+/, 'No database identity is displayed');
    await click('batches-prev'); await waitFor(`document.querySelector('#batches-body').children.length===20`);
    await run(`document.querySelector('#batches-filter').value='LOT-2';document.querySelector('#batches-filter').dispatchEvent(new Event('input'))`);
    assert.match(await run(`document.querySelector('#batches-count').textContent`), /trong trang này/);
    await run(`document.querySelector('#batches-filter').value='';document.querySelector('#batches-filter').dispatchEvent(new Event('input'))`);
    await run(`document.querySelector('#batches-body [data-batch-action="view"]').click()`);
    await waitFor(`!document.querySelector('#batch-detail-panel').hidden`);
    assert.match(await run(`document.querySelector('#batch-detail-panel').textContent`), /Số lượng tồn/);
    await key('Escape', 27); await waitFor(`!document.querySelector('#batch-dialog').open`);
    await select(2); await waitFor(`document.querySelector('#batches-state').textContent.includes('Chưa có dữ liệu')`);
    assert.match(await run(`document.querySelector('#batch-product-identity').textContent`), /Quy cách đóng gói: Hộp 2 vỉ x 10 viên/);
    await click('batch-add'); await formReady(); await submit();
    assert.equal(await run(`document.querySelector('#batch-SoLoSanXuat').getAttribute('aria-invalid')`), 'true');
    assert.equal(calls.filter(call => call.method === 'POST').length, 0);
    await fill({ HanSuDung: '2026-01-01', SoLuongNhap: '0', GiaNhap: '1.5' }); await submit();
    for (const name of ['HanSuDung', 'SoLuongNhap', 'GiaNhap']) assert.equal(await run(`document.querySelector('#batch-${name}').getAttribute('aria-invalid')`), 'true');
    await fill(); mode = 'invalid'; await submit(); await waitFor(`document.querySelector('#batch-dialog-error').textContent.includes('không hợp lệ') && !document.querySelector('#batch-save').disabled`);
    mode = 'csrf'; await submit(); await waitFor(`document.querySelector('#batch-dialog-error').textContent.includes('xác thực') && !document.querySelector('#batch-save').disabled`);
    assert.equal(await run(`document.querySelector('#batch-SoLoSanXuat').value`), 'NEW-LOT');
    mode = 'save-slow'; writeGate = new Promise(resolve => { releaseWrite = resolve; }); const before = calls.filter(call => call.method === 'POST').length;
    await run(`document.querySelector('#batch-form').requestSubmit();document.querySelector('#batch-form').requestSubmit()`);
    await key('Escape', 27); assert.equal(await run(`document.querySelector('#batch-dialog').open`), true); releaseWrite();
    await waitFor(`!document.querySelector('#batch-dialog').open && document.querySelector('#batches-body').children.length===1`);
    assert.equal(calls.filter(call => call.method === 'POST').length, before + 1); mode = 'normal';
    assert.equal(batches.find(item => item.MaThuoc === 2).SoLuongTon, 100);
    assert.equal(await run(`document.querySelector('#batch-category').value`), '1', 'Saving batches preserves category selection');
    await run(`document.querySelector('#batches-body [data-batch-action="edit"]').click()`); await formReady();
    assert.equal(await run(`document.querySelector('#batch-SoLuongNhap').disabled`), true);
    assert.equal(await run(`document.querySelector('#batch-SoLuongTon')`), null);
    await fill({ SoLoSanXuat: 'EDITED', SoLuongNhap: '999', GiaNhap: '1234567' }); mode = 'immutable'; await submit();
    await waitFor(`document.querySelector('#batch-dialog-error').textContent.includes('Không được thay đổi') && !document.querySelector('#batch-save').disabled`);
    mode = 'normal'; await submit(); await waitFor(`!document.querySelector('#batch-dialog').open`); await ready();
    assert.equal(batches.find(item => item.MaThuoc === 2).SoLuongNhap, 100); assert.match(await run(`document.querySelector('#batches-body').textContent`), /1\.234\.567/);
    await run(`document.querySelector('#batches-body [data-batch-action="edit"]').click()`); await formReady(); mode = 'inconsistent'; await submit();
    await waitFor(`document.querySelector('#batch-dialog-error').textContent.includes('không nhất quán')`); await click('batch-close'); mode = 'normal';
    await run(`document.querySelector('#batches-body [data-batch-action="delete"]').click()`); await waitFor(`!document.querySelector('#batch-delete-confirm').disabled`);
    const deletes = calls.filter(call => call.method === 'DELETE').length;
    assert.match(await run(`document.querySelector('#batch-delete-name').textContent`), /EDITED.*Thuốc 2/);
    await key('Escape', 27); await waitFor(`!document.querySelector('#batch-dialog').open`); assert.equal(calls.filter(call => call.method === 'DELETE').length, deletes);
    await run(`document.querySelector('#batches-body [data-batch-action="delete"]').click()`); await waitFor(`!document.querySelector('#batch-delete-confirm').disabled`); await click('batch-delete-confirm');
    await waitFor(`document.querySelector('#batch-dialog-error').textContent.includes('Không thể xóa lô')`);
    assert.equal(await run(`document.querySelector('#batches-body').children.length`), 1); await click('batch-close');
    mode = 'batch-missing'; await run(`document.querySelector('#batches-body [data-batch-action="view"]').click()`); await waitFor(`document.querySelector('#batch-dialog-error').textContent.includes('không còn tồn tại')`); await click('batch-close'); mode = 'normal';
    mode = 'slow'; await run(`document.querySelector('#batch-product-select').value='1';document.querySelector('#batch-product-select').dispatchEvent(new Event('change'));document.querySelector('#batch-product-select').value='2';document.querySelector('#batch-product-select').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#batch-product-identity').textContent.includes('Thuốc 2') && !document.querySelector('#batches-scroll').hidden`); await run(`new Promise(r=>setTimeout(r,500))`);
    assert.match(await run(`document.querySelector('#batch-product-identity').textContent`), /Thuốc 2/); mode = 'normal';
    mode = 'error'; await click('batches-refresh'); await waitFor(`!document.querySelector('#batches-retry').hidden`); mode = 'normal'; await click('batches-retry'); await ready();
    mode = 'network'; await click('batches-refresh'); await waitFor(`document.querySelector('#batches-state').textContent.includes('Mất kết nối')`); mode = 'normal'; await click('batches-retry'); await ready();
    for (const width of [1280, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
        assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`), true, `Batches overflow ${width}`);
        if (width === 375) await screenshot('BATCHES_MOBILE');
        await click('batch-add'); await formReady(); await fill();
        assert.equal(await run(`document.querySelector('#batch-dialog').scrollWidth<=document.querySelector('#batch-dialog').clientWidth`), true);
        await key('Tab', 9, 8); assert.equal(await run(`document.querySelector('#batch-dialog').contains(document.activeElement)`), true);
        if (width === 375) await screenshot('FORM_MOBILE');
        await key('Escape', 27); await waitFor(`!document.querySelector('#batch-dialog').open && document.activeElement.id==='batch-add'`);
    }
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await run(`location.hash='inventory'`); await waitFor(`document.querySelector('#inventory-summary-body').children.length===20 && document.querySelector('#inventory-low-body').children.length===2 && document.querySelector('#inventory-expiry-body').children.length===1`);
    assert.match(await run(`document.querySelector('#inventory-summary-body').textContent`), /2\.201/); // Physical stock includes expired batch.
    assert.match(await run(`document.querySelector('#inventory-summary-body').textContent`), /Mã vạch: 0000000000001/);
    assert.match(await run(`document.querySelector('#inventory-expiry-body').textContent`), /Mã vạch: 0000000000001/);
    assert.match(await run(`document.querySelector('#inventory-low-body').textContent`), /Thuốc 2.*0/); // Product without batches.
    assert.match(await run(`document.querySelector('#inventory-expiry-body').textContent`), /Còn 5 ngày/);
    await screenshot('INVENTORY_DESKTOP');
    await click('inventory-summary-next'); await waitFor(`document.querySelector('#inventory-summary-body').children.length===3`);
    await click('inventory-summary-prev'); await waitFor(`document.querySelector('#inventory-summary-body').children.length===20`);
    await run(`document.querySelector('#inventory-summary-filter').value='Thuốc 23';document.querySelector('#inventory-summary-filter').dispatchEvent(new Event('input'))`);
    assert.equal(await run(`document.querySelector('#inventory-summary-body').children.length`), 0); assert.match(await run(`document.querySelector('#inventory-summary-state').textContent`), /trong trang này/);
    await run(`document.querySelector('#inventory-summary-filter').value='';document.querySelector('#inventory-summary-filter').dispatchEvent(new Event('input'))`);
    await run(`document.querySelector('#inventory-expiry-days').value='36501';document.querySelector('#inventory-expiry-form').requestSubmit()`);
    assert.match(await run(`document.querySelector('#inventory-expiry-error').textContent`), /36500/);
    await run(`document.querySelector('#inventory-expiry-days').value='0';document.querySelector('#inventory-expiry-form').requestSubmit()`); await waitFor(`document.querySelector('#inventory-expiry-body').textContent.includes('Hết hạn hôm nay')`);
    await run(`document.querySelector('#inventory-expiry-status').value='expired';document.querySelector('#inventory-expiry-status').dispatchEvent(new Event('change'));document.querySelector('#inventory-expiry-form').requestSubmit()`);
    await waitFor(`document.querySelector('#inventory-expiry-body').textContent.includes('Đã hết hạn 1 ngày')`);
    assert.equal(await run(`document.querySelector('#inventory-expiry-days').disabled`), true);
    assert.ok(calls.some(call => call.params.get('status') === 'expired'));
    mode = 'low-error'; await click('inventory-low-refresh'); await waitFor(`!document.querySelector('#inventory-low-retry').hidden`);
    assert.equal(await run(`document.querySelector('#inventory-summary-body').children.length`), 20); mode = 'normal'; await click('inventory-low-retry'); await waitFor(`document.querySelector('#inventory-low-body').children.length===2`);
    mode = 'empty'; for (const id of ['summary', 'low', 'expiry']) await click(`inventory-${id}-refresh`);
    await waitFor(`['summary','low','expiry'].every(id=>document.querySelector('#inventory-'+id+'-state').textContent.includes('Chưa có dữ liệu'))`);
    mode = 'normal'; for (const id of ['summary', 'low', 'expiry']) await click(`inventory-${id}-refresh`);
    await waitFor(`document.querySelector('#inventory-summary-body').children.length===20 && document.querySelector('#inventory-low-body').children.length===2`);
    for (const width of [1280, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
        assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`), true, `Inventory overflow ${width}`);
        if (width === 375) await screenshot('INVENTORY_MOBILE');
    }
    await run(`document.querySelector('#inventory-low-body tr:nth-child(2) [data-stock-product]').click()`);
    await waitFor(`location.hash==='#batches' && document.querySelector('#batch-product-identity').textContent.includes('Thuốc 2') && !document.querySelector('#batches-scroll').hidden`);
    await run(`location.hash='inventory'`); await waitFor(`document.querySelector('#inventory-summary-body').children.length===20`);
    mode = 'expired-session'; await click('inventory-summary-refresh'); await waitFor(`!document.querySelector('#manager-gate').hidden`);
    assert.equal(await run(`document.querySelector('#inventory-summary-body').children.length+document.querySelector('#batches-body').children.length`), 0);
    mode = 'normal'; await click('manager-retry'); await waitFor(`!document.querySelector('#manager-shell').hidden`);
    await run(`location.hash='batches'`); await waitFor(`!document.querySelector('#batch-product-select').disabled`);
    assert.equal(await run(`document.querySelector('#batch-category').value`), '', 'Session cleanup clears category selection');
    mode = 'forbidden'; await select(1); await waitFor(`!document.querySelector('#manager-gate').hidden`); mode = 'normal';
    console.log('PASS: batches create/view/edit, immutable quantities, unsafe delete refusal, stock summary/low/expiry/as_of, filters/pagination, cross-page navigation, stale requests/errors/retry/401/403, keyboard/dialogs, 1440–320px. API/AUTH MOCK; no PostgreSQL writes.');
}
