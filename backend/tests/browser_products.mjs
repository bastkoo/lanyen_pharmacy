import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PRODUCT_FIELDS } from '../../frontend/js/utils/product-validation.js';

const data = Object.fromEntries(PRODUCT_FIELDS.map(([key, , type]) => [key, type === 'category' ? 1 : type === 'integer' ? 0 : type === 'boolean' ? false : 'Thông tin kiểm thử']));
Object.assign(data, { HinhAnh: 'https://example.invalid/image.png', TenThuoc: 'Thuốc kiểm thử', MaDuoc: 'TEST', SoDangKy: 'TEST-REG' });
let items = Array.from({ length: 23 }, (_, index) => ({ ...data, MaThuoc: index + 1, TenThuoc: `Thuốc kiểm thử ${index + 1}`, MaLoaiThuoc: index % 2 + 1, PhanLoai: index % 2 === 1 }));
let mode = 'normal', nextId = 30;
const calls = [];
export async function productFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local'), id = Number(url.pathname.split('/')[4]);
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ method: req.method, path: url.pathname, query: url.searchParams, body });
    if (mode === 'expired') return json(401, { code: 'UNAUTHENTICATED' });
    if (mode === 'forbidden') return json(403, { code: 'FORBIDDEN' });
    if (mode === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (url.pathname.endsWith('/categories')) return json(200, { code: 'CATEGORIES_LISTED', page: 1, per_page: 100, pages: 1, total: 2, items: [{ MaLoaiThuoc: 1, TenLoaiThuoc: 'Nhóm A' }, { MaLoaiThuoc: 2, TenLoaiThuoc: 'Nhóm B' }] });
    if (req.method !== 'GET') {
        assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
        if (mode === 'csrf') return json(403, { code: 'CSRF_FAILED' });
    }
    if (url.pathname.endsWith('/uploads/products')) {
        assert.ok(req.headers['content-type'].startsWith('multipart/form-data; boundary='));
        assert.match(body, /name="image"/);
        if (mode === 'upload-error') return json(503, { code: 'CLOUDINARY_UNAVAILABLE' });
        return json(200, { code: 'UPLOAD_SUCCESS', data: { url: 'https://example.invalid/uploaded.png', public_id: 'fixture-test-image' } });
    }
    const item = items.find(value => value.MaThuoc === id);
    if (req.method === 'GET' && !id) {
        let found = items.filter(value => [value.TenThuoc, value.MaDuoc, value.SoDangKy].some(text => text.includes(url.searchParams.get('search') || '')));
        if (url.searchParams.has('category_id')) found = found.filter(value => value.MaLoaiThuoc === Number(url.searchParams.get('category_id')));
        if (url.searchParams.has('phan_loai')) found = found.filter(value => String(value.PhanLoai) === url.searchParams.get('phan_loai'));
        const page = Number(url.searchParams.get('page') || 1), per_page = Number(url.searchParams.get('per_page') || 20);
        return json(200, { code: 'PRODUCTS_LISTED', items: found.slice((page - 1) * per_page, page * per_page), page, per_page, total: found.length, pages: Math.ceil(found.length / per_page) });
    }
    if (id && !item) return json(404, { code: 'PRODUCT_NOT_FOUND' });
    if (req.method === 'GET') return json(200, { code: 'PRODUCT_FOUND', product: item });
    if (req.method === 'DELETE') {
        if (id === 1) return json(409, { code: 'PRODUCT_IN_USE' });
        items = items.filter(value => value !== item); return json(200, { code: 'PRODUCT_DELETED' });
    }
    const payload = JSON.parse(body);
    assert.deepEqual(Object.keys(payload).sort(), Object.keys(data).sort());
    if (mode === 'save-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    const product = { ...payload, MaThuoc: item ? id : nextId++ };
    if (item) items[items.indexOf(item)] = product; else items.push(product);
    return json(item ? 200 : 201, { code: item ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED', product });
}

export async function checkProducts({ evaluate: run, waitFor, key, command, root }) {
    const chooseFile = async (type, size = 20) => run(`(()=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(${size})],'test.${type.split('/')[1]}',{type:${JSON.stringify(type)}}));const input=document.querySelector('#product-image-file');input.files=dt.files;input.dispatchEvent(new Event('change'))})()`);
    const screenshot = async name => {
        await run(`document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:0,behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
        const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(root, 'docs', `MODULE_02_6_4_PRODUCTS_${name}.png`), Buffer.from(result.data, 'base64'));
    };
    await run(`location.hash='products'`);
    await waitFor(`!document.querySelector('#products-table-wrap').hidden && document.querySelector('#products-body').children.length===20`);
    await run(`document.querySelector('#products-next').click()`);
    await waitFor(`document.querySelector('#products-page-status').textContent.includes('Trang 2')`);
    await run(`document.querySelector('#products-search').value='TEST';document.querySelector('#products-category').value='2';document.querySelector('#products-classification').value='true';document.querySelector('#products-filters').requestSubmit()`);
    await waitFor(`document.querySelector('#products-result-count').textContent.includes('11 thuốc')`);
    assert.ok(calls.some(call => call.query.get('category_id') === '2' && call.query.get('phan_loai') === 'true' && call.query.get('search') === 'TEST'));
    await run(`document.querySelector('#products-reset').click()`);
    await waitFor(`document.querySelector('#products-body').children.length===20`);
    await run(`document.querySelector('[data-product-action="view"]').click()`);
    await waitFor(`!document.querySelector('#product-details').hidden`);
    assert.match(await run(`document.querySelector('#product-details').textContent`), /Thông tin sử dụng/);
    await run(`document.querySelector('#product-back').click();document.querySelector('#product-add').click();document.querySelector('#product-form').requestSubmit()`);
    assert.equal(await run(`document.querySelector('#product-TenThuoc').getAttribute('aria-invalid')`), 'true');
    assert.equal(calls.filter(call => call.method === 'POST' && call.path === '/api/manager/products').length, 0);
    await run(`(()=>{const data=${JSON.stringify(data)};for(const [name,value]of Object.entries(data))document.getElementById('product-'+name).value=String(value);document.querySelector('#product-TenThuoc').value='Thuốc mới'})()`);
    await run(`document.querySelector('#product-MaLoaiThuoc').value='2';[...document.querySelectorAll('#product-field-groups button')].find(button=>button.textContent==='Làm mới danh mục').click()`);
    await waitFor(`!document.querySelector('#product-MaLoaiThuoc').disabled && document.querySelector('#product-MaLoaiThuoc-error').textContent===''`);
    assert.equal(await run(`document.querySelector('#product-MaLoaiThuoc').value`), '2');
    assert.equal(await run(`document.querySelector('#product-TenThuoc').value`), 'Thuốc mới');
    await chooseFile('image/png', 5242881);
    assert.match(await run(`document.querySelector('#product-image-error').textContent`), /5 MiB/);
    await chooseFile('image/svg+xml');
    assert.match(await run(`document.querySelector('#product-image-error').textContent`), /JPEG/);
    await chooseFile('image/png');
    await run(`document.querySelector('#product-form').requestSubmit()`);
    assert.match(await run(`document.querySelector('#product-HinhAnh-error').textContent`), /chưa được upload/);
    mode = 'upload-error'; await run(`document.querySelector('#product-upload').click()`);
    await waitFor(`document.querySelector('#product-image-error').textContent.includes('Cloudinary') && !document.querySelector('#product-upload').disabled`);
    mode = 'normal'; await run(`document.querySelector('#product-upload').click()`);
    await waitFor(`document.querySelector('#product-upload-status').textContent.includes('Upload thành công')`);
    assert.equal(await run(`document.querySelector('#product-HinhAnh').value`), 'https://example.invalid/uploaded.png');
    mode = 'save-error'; await run(`document.querySelector('#product-form').requestSubmit()`);
    await waitFor(`document.querySelector('#product-form-error').textContent.includes('URL ảnh được giữ lại') && !document.querySelector('#product-save').disabled`);
    assert.equal(await run(`document.querySelector('#product-TenThuoc').value`), 'Thuốc mới');
    const uploads = calls.filter(call => call.path.includes('/uploads/')).length;
    mode = 'csrf'; await run(`document.querySelector('#product-form').requestSubmit()`);
    await waitFor(`document.querySelector('#product-form-error').textContent.includes('bảo mật') && !document.querySelector('#product-save').disabled`);
    assert.equal(await run(`document.querySelector('#product-HinhAnh').value`), 'https://example.invalid/uploaded.png');
    assert.equal(await run(`document.querySelector('#manager-shell').hidden`), false);
    mode = 'normal'; await run(`document.querySelector('#product-form').requestSubmit();document.querySelector('#product-form').requestSubmit()`);
    await waitFor(`document.querySelector('#product-workspace').hidden && document.querySelector('#products-feedback').textContent.includes('Đã thêm')`);
    assert.equal(items.filter(item => item.TenThuoc === 'Thuốc mới').length, 1);
    assert.equal(calls.filter(call => call.path.includes('/uploads/')).length, uploads);
    await waitFor(`!document.querySelector('#products-table-wrap').hidden`);
    await run(`document.querySelector('[data-product-action="edit"][data-product-id="1"]').click()`);
    await waitFor(`!document.querySelector('#product-form').hidden && document.querySelector('#product-TenThuoc').value==='Thuốc kiểm thử 1'`);
    await run(`document.querySelector('#product-TenThuoc').value='Thuốc đã sửa';document.querySelector('#product-form').requestSubmit()`);
    await waitFor(`document.querySelector('#product-workspace').hidden && document.querySelector('#products-feedback').textContent.includes('Đã cập nhật')`);
    assert.equal(calls.filter(call => call.path.includes('/uploads/')).length, uploads);
    await waitFor(`!document.querySelector('#products-table-wrap').hidden`);
    await run(`document.querySelector('[data-product-action="delete"][data-product-id="1"]').click()`);
    await waitFor(`!document.querySelector('#product-delete-confirm').disabled`);
    assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
    await run(`document.querySelector('#product-delete-confirm').click()`);
    await waitFor(`document.querySelector('#product-delete-error').textContent.includes('dữ liệu liên quan')`);
    assert.ok(items.some(item => item.MaThuoc === 1));
    await run(`document.querySelector('#product-delete-cancel').click()`);
    await run(`document.querySelector('[data-product-action="delete"][data-product-id="2"]').click()`);
    await waitFor(`!document.querySelector('#product-delete-confirm').disabled`);
    await run(`document.querySelector('#product-delete-confirm').click()`);
    await waitFor(`!document.querySelector('#product-delete-dialog').open && !document.querySelector('[data-product-id="2"]')`);
    assert.ok(!items.some(item => item.MaThuoc === 2));
    for (const width of [1440, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
        await run('window.scrollTo(0,0);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Products overflow ${width}`);
        if ([1440, 375].includes(width)) await screenshot(width === 1440 ? 'DESKTOP' : 'MOBILE');
        await run(`document.querySelector('[data-product-action="edit"][data-product-id="1"]').click()`);
        await waitFor(`!document.querySelector('#product-form').hidden && !document.querySelector('#product-save').disabled`);
        assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Editor overflow ${width}`);
        if ([1440, 375].includes(width)) await screenshot(width === 1440 ? 'FORM_DESKTOP' : 'FORM_MOBILE');
        await run(`document.querySelector('#product-back').click()`);
        await waitFor(`!document.querySelector('#products-table-wrap').hidden`);
    }
    mode = 'error'; await run(`document.querySelector('#products-reload').click()`);
    await waitFor(`!document.querySelector('#products-retry').hidden`);
    mode = 'normal'; await run(`document.querySelector('#products-retry').click()`);
    await waitFor(`!document.querySelector('#products-table-wrap').hidden`);
    mode = 'expired'; await run(`document.querySelector('#products-reload').click()`);
    await waitFor(`!document.querySelector('#manager-gate').hidden`);
    assert.equal(await run(`document.querySelector('#products-body').children.length`), 0);
    mode = 'normal';
    console.log('PASS: product list/search/category/classification/page/detail/CRUD, upload validation/failure/retry, retained image URL after save failure, unchanged image on edit, referenced delete, session expiry, responsive list/form. Fixture only; no real Cloudinary upload.');
}
