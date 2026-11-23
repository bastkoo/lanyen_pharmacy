import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

let rows = [], nextId = 1, mode = 'normal';
export function resetAddressFixture(items) { rows = items.map(item => ({ ...item })); nextId = Math.max(0, ...rows.map(item => item.MaDiaChi)) + 1; mode = 'normal'; }
export const setAddressFixtureMode = value => { mode = value; };
export const addressSnapshot = () => rows.map(item => ({ ...item }));
let provinceMode = 'normal';
export function provinceFixture(url) {
    const isList = new URL(url).pathname.endsWith('/p/');
    if (provinceMode === 'list-error' && isList || provinceMode === 'ward-error' && !isList) return { status: 503, body: {} };
    const code = Number(new URL(url).pathname.split('/').at(-1));
    const provinces = [{ code: 1, name: 'Thành phố Hà Nội' }, { code: 79, name: 'Thành phố Hồ Chí Minh' }];
    return { status: 200, body: isList ? provinces : { code, name: provinces.find(item => item.code === code)?.name, wards: [{ code: code === 79 ? 26743 : 1, name: code === 79 ? 'Phường A' : 'Phường B', province_code: code }] } };
}
export async function addressFixture(req, json) {
    if (mode === 'read-error' && req.method === 'GET') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (req.method === 'GET') return json(200, { code: 'ADDRESSES_LISTED', items: [...rows].sort((a, b) => Number(b.DiaChiGiao) - Number(a.DiaChiGiao) || a.MaDiaChi - b.MaDiaChi) });
    assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
    let body = ''; for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    if (mode === 'write-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (req.method === 'POST' || req.method === 'PUT') assert.deepEqual(Object.keys(data).sort(), ['DiaChiCuThe', 'PhuongXa', 'TinhThanh']);
    if (req.method === 'POST') { const item = { ...data, MaDiaChi: nextId++, DiaChiGiao: !rows.length }; rows.push(item); return json(201, { code: 'ADDRESS_CREATED', address: item }); }
    const id = Number(req.url.split('/')[5]), item = rows.find(row => row.MaDiaChi === id);
    if (!item) return json(404, { code: 'ADDRESS_NOT_FOUND' });
    if (req.method === 'PUT') { Object.assign(item, data); return json(200, { code: 'ADDRESS_UPDATED', address: item }); }
    if (req.method === 'PATCH') { for (const row of rows) row.DiaChiGiao = row === item; return json(200, { code: 'ADDRESS_PRIMARY_UPDATED' }); }
    rows = rows.filter(row => row !== item);
    if (item.DiaChiGiao && rows.length) rows[0].DiaChiGiao = true;
    return json(200, { code: 'ADDRESS_DELETED' });
}

export async function checkAddresses({ evaluate: run, waitFor, command, key, baseUrl, root, setScenario }) {
    rows = []; nextId = 1; mode = 'normal';
    provinceMode = 'normal';
    const navigate = async file => { await command('Page.navigate', { url: `${baseUrl}/pages/${file}` }); await new Promise(resolve => setTimeout(resolve, 50)); };
    const click = expression => run(`${expression}.focus();${expression}.click()`);
    const $ = id => `document.querySelector('#${id}')`;
    const item = id => `document.querySelector('[data-address-id="${id}"]')`;
    const action = (id, text) => `Array.from(${item(id)}.querySelectorAll('button')).find(button=>button.textContent===${JSON.stringify(text)})`;
    const ready = count => waitFor(`document.querySelector('#address-list')?.children.length===${count} && document.querySelector('#address-list').getAttribute('aria-busy')==='false' && !document.querySelector('#address-add').disabled`);
    async function add(street) {
        await click($('address-add')); await waitFor(`${$('address-dialog')}.open`);
        await waitFor(`!${$('address-province')}.disabled`);
        await run(`${$('address-province')}.value='79';${$('address-province')}.dispatchEvent(new Event('change'))`);
        await waitFor(`!${$('address-ward')}.disabled && !${$('address-save')}.disabled`);
        await run(`${$('address-ward')}.value='26743';${$('address-street')}.value=${JSON.stringify(street)};${$('address-form')}.requestSubmit()`);
        await waitFor(`!${$('address-dialog')}.open && !${$('address-add')}.disabled`);
    }
    try {
        setScenario('customer'); await navigate('customer/home.html'); await waitFor(`document.querySelector('.customer-account')?.hidden===false`);
        assert.equal(await run(`document.querySelector('[data-management]').hidden`), true);
        setScenario('forbidden'); await navigate('customer/home.html'); await waitFor(`document.querySelector('[data-management]')?.hidden===false`);
        assert.equal(await run(`document.querySelector('[data-management]').getAttribute('href')`), '../employee/index.html');
        await click($('account-avatar-button')); await click(`document.querySelector('[data-management]')`);
        await waitFor(`document.querySelector('#employee-workspace')?.hidden===false`);
        assert.equal(await run('location.pathname'), '/pages/employee/index.html');
        setScenario('manager'); await navigate('customer/addresses.html'); await ready(0);
        await waitFor(`document.querySelector('.account-sidebar-identity p').textContent==='Nguyễn Lan Yến'`);
        assert.equal(await run(`document.querySelector('.customer-account-sidebar a[aria-current]').textContent`), 'Địa chỉ nhận hàng');
        provinceMode = 'list-error'; await click($('address-add'));
        await waitFor(`!${$('address-location-retry')}.hidden`);
        assert.equal(await run(`${$('address-save')}.disabled`), true, 'Cannot save a new address while geography is unavailable');
        provinceMode = 'normal'; await click($('address-location-retry')); await waitFor(`!${$('address-save')}.disabled`);
        await click($('address-save'));
        assert.equal(await run(`${$('address-province')}.getAttribute('aria-invalid')`), 'true');
        await key('Escape', 27); await waitFor(`!${$('address-dialog')}.open`);
        await add('<b>Nhà thứ nhất</b>'); await ready(1);
        assert.equal(rows[0].TinhThanh, 'Thành phố Hồ Chí Minh', 'Persist selected names instead of provider codes');
        assert.equal(rows[0].DiaChiGiao, true); assert.equal(await run(`${item(1)}.querySelector('h2 b')`), null);
        await add('Nhà thứ hai'); await ready(2); await add('Nhà thứ ba'); await ready(3);
        assert.deepEqual(rows.map(row => row.DiaChiGiao), [true, false, false]);
        await click(action(3, 'Đặt làm địa chỉ chính')); await ready(3);
        await waitFor(`${item(3)}.querySelector('.address-primary')!==null`);
        assert.deepEqual(rows.map(row => row.DiaChiGiao), [false, false, true]);
        await click(action(2, 'Sửa')); await waitFor(`${$('address-dialog')}.open && !${$('address-save')}.disabled`);
        await run(`${$('address-street')}.value='Nhà thứ hai đã sửa';${$('address-form')}.requestSubmit()`);
        await waitFor(`!${$('address-dialog')}.open && !${$('address-add')}.disabled`);
        assert.equal(rows[1].DiaChiCuThe, 'Nhà thứ hai đã sửa');
        mode = 'write-error'; await click(action(2, 'Sửa')); await waitFor(`!${$('address-save')}.disabled`);
        await run(`${$('address-street')}.value='Dữ liệu giữ lại';${$('address-form')}.requestSubmit()`);
        await waitFor(`!${$('address-save')}.disabled && ${$('address-form-state')}.textContent!=='Đang lưu…'`);
        assert.equal(await run(`${$('address-dialog')}.open`), true); assert.equal(await run(`${$('address-street')}.value`), 'Dữ liệu giữ lại');
        mode = 'normal'; await key('Escape', 27);
        await click(action(3, 'Xóa')); await waitFor(`${$('address-delete-dialog')}.open`);
        assert.match(await run(`${$('address-delete-description')}.textContent`), /tạo sớm nhất/);
        await click($('address-delete-cancel')); assert.equal(rows.length, 3);
        await click(action(3, 'Xóa')); await click($('address-delete-confirm')); await ready(2);
        assert.deepEqual(rows.map(row => row.DiaChiGiao), [true, false]);
        mode = 'read-error'; await command('Page.reload'); await waitFor(`!${$('address-retry')}?.hidden`);
        assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true, 'Read failures have no toast');
        mode = 'normal'; await click($('address-retry')); await ready(2);
        rows[1].TinhThanh = 'Tỉnh đã lưu cũ'; rows[1].PhuongXa = 'Phường đã lưu cũ';
        await command('Page.reload'); await ready(2); await click(action(2, 'Sửa')); await waitFor(`!${$('address-save')}.disabled`);
        assert.equal(await run(`${$('address-province')}.selectedOptions[0].textContent`), 'Tỉnh đã lưu cũ', 'Legacy values are retained without a forced migration');
        await key('Escape', 27);
        await click($('address-add')); await waitFor(`!${$('address-province')}.disabled`);
        provinceMode = 'ward-error'; await run(`${$('address-province')}.value='1';${$('address-province')}.dispatchEvent(new Event('change'))`);
        await waitFor(`!${$('address-location-retry')}.hidden`); assert.equal(await run(`${$('address-save')}.disabled`), true);
        provinceMode = 'normal'; await click($('address-location-retry')); await waitFor(`!${$('address-ward')}.disabled`);
        await run(`${$('address-ward')}.value='1';${$('address-province')}.value='79';${$('address-province')}.dispatchEvent(new Event('change'))`);
        await waitFor(`!${$('address-ward')}.disabled`);
        assert.equal(await run(`${$('address-ward')}.value`), '', 'Changing province clears the previous ward'); await key('Escape', 27);
        for (const width of [1440, 1024, 768, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Address layout fits ${width}px`);
            await click($('address-add')); await waitFor(`${$('address-dialog')}.open`);
            assert.equal(await run(`${$('address-dialog')}.scrollWidth<=${$('address-dialog')}.clientWidth`), true);
            await waitFor(`!${$('address-province')}.disabled`);
            await run(`${$('address-province')}.value='79';${$('address-province')}.dispatchEvent(new Event('change'))`);
            await waitFor(`!${$('address-ward')}.disabled`); await run(`${$('address-ward')}.value='26743'`);
            if (width === 1440 || width === 375) {
                const formShot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `MODULE_03_6_ADDRESS_FORM_${width}.png`), Buffer.from(formShot.data, 'base64'));
            }
            await key('Escape', 27);
            if (width === 1440 || width === 375) {
                await run(`window.scrollTo({top:0,behavior:'instant'})`);
                const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `MODULE_03_6_ADDRESSES_${width}.png`), Buffer.from(shot.data, 'base64'));
            }
        }
        await click(`document.querySelector('.customer-account-sidebar a[href="orders.html"]')`);
        await waitFor(`location.pathname.endsWith('/orders.html') && document.querySelector('#orders-list .orders-card')!==null`);
        assert.equal(await run(`document.querySelector('#orders-content').getAttribute('aria-busy')`), 'false');
        await navigate('customer/addresses.html'); await ready(2);
        await click(action(2, 'Xóa')); await click($('address-delete-confirm')); await ready(1);
        await click(action(1, 'Xóa')); await click($('address-delete-confirm')); await ready(0);
        await add('Địa chỉ mới sau khi xóa hết'); await ready(1); assert.equal(rows[0].DiaChiGiao, true);
        await click($('account-avatar-button')); await click($('logout-button'));
        await waitFor(`${$('address-list')}.children.length===0 && !${$('address-login')}.hidden`);
        console.log('PASS: role-based management destinations/employee shell; account sidebar; address CRUD, one primary, switch, oldest promotion on delete, validation/ownership UI, failed writes preserve input, read retry without toast, logout and 1440–320px. MOCK API.');
    } finally { rows = []; mode = 'normal'; setScenario('anonymous'); }
}
