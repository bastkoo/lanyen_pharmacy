// Isolated AUTH/API fixture, never production account data or a login bypass.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizePhone } from '../../frontend/js/utils/auth-validation.js';
let mode = 'normal', actorId = '12', nextId = 100, writeGate, releaseWrite;
const BIG_ID = '9223372036854775807', calls = [];
let rows = Array.from({ length: 23 }, (_, i) => ({ MaNguoiDung: String(i + 1), HoTen: i === 0 ? '<b>Nhân viên 1</b>' : `Nội bộ ${i + 1}`, SDT: `+849${String(i + 1).padStart(8, '0')}`, VaiTro: (i + 1) % 2 ? 1 : 2, TrangThai: (i + 1) % 5 === 0, Email: i % 3 ? `staff${i + 1}@example.com` : null, AnhDaiDien: null }));
rows.push({ MaNguoiDung: BIG_ID, HoTen: 'Quản lý BigInteger', SDT: '+84999999999', VaiTro: 2, TrangThai: false, Email: null, AnhDaiDien: 'https://example.invalid/missing-avatar.png' });
export const accountActor = () => rows.find(row => row.MaNguoiDung === actorId);
export async function accountFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local'), parts = url.pathname.split('/'), id = parts[4];
    let raw = ''; for await (const chunk of req) raw += chunk; calls.push({ method: req.method, path: url.pathname, params: url.searchParams, raw });
    if (mode === 'expired') return json(401, { code: 'UNAUTHENTICATED' });
    if (mode === 'forbidden') return json(403, { code: 'FORBIDDEN' });
    if (mode === 'network') { req.socket.destroy(); return; }
    if (mode === 'error' || (mode === 'stats-error' && url.searchParams.get('per_page') === '1')) return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (mode === 'slow' && id === '1') await new Promise(resolve => setTimeout(resolve, 400));
    const row = rows.find(value => value.MaNguoiDung === id);
    if (id && (!row || mode === 'missing')) return json(404, { code: 'ACCOUNT_NOT_FOUND' });
    if (req.method === 'GET') {
        if (id) return json(200, { code: 'ACCOUNT_FOUND', account: row });
        let found = mode === 'empty' ? [] : rows;
        const term = (url.searchParams.get('search') || '').toLocaleLowerCase();
        found = found.filter(value => `${value.HoTen} ${value.SDT}`.toLocaleLowerCase().includes(term));
        if (url.searchParams.has('role')) found = found.filter(value => String(value.VaiTro) === url.searchParams.get('role'));
        if (url.searchParams.has('status')) found = found.filter(value => String(value.TrangThai) === url.searchParams.get('status'));
        const page = Number(url.searchParams.get('page') || 1), per_page = Number(url.searchParams.get('per_page') || 20);
        return json(200, { code: 'ACCOUNTS_LISTED', items: found.slice((page - 1) * per_page, page * per_page), page, per_page, total: found.length, pages: Math.ceil(found.length / per_page) });
    }
    assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
    if (mode === 'csrf') return json(403, { code: 'CSRF_FAILED' });
    if (mode === 'invalid') return json(400, { code: 'INVALID_REQUEST' });
    if (mode === 'save-slow') await writeGate;
    const body = JSON.parse(raw);
    if (req.method === 'PATCH') {
        assert.deepEqual(Object.keys(body), ['TrangThai']); assert.equal(typeof body.TrangThai, 'boolean');
        if (mode === 'last') return json(409, { code: 'LAST_ACTIVE_MANAGER' });
        if (id === actorId && body.TrangThai) return json(409, { code: 'CANNOT_LOCK_SELF' });
        row.TrangThai = body.TrangThai; return json(200, { code: 'ACCOUNT_STATUS_UPDATED', account: row });
    }
    assert.deepEqual(Object.keys(body).sort(), ['HoTen', 'SDT', 'VaiTro', 'Email', 'AnhDaiDien'].sort());
    assert.ok([1, 2].includes(body.VaiTro)); body.SDT = normalizePhone(body.SDT);
    if (rows.some(value => value.SDT === body.SDT && value !== row)) return json(409, { code: 'ACCOUNT_PHONE_EXISTS' });
    if (row && id === actorId && body.VaiTro !== 2) return json(409, { code: 'CANNOT_DEMOTE_SELF' });
    const account = { ...body, MaNguoiDung: row ? id : String(nextId++), TrangThai: row ? row.TrangThai : false };
    if (row) rows[rows.indexOf(row)] = account; else rows.push(account);
    return json(row ? 200 : 201, { code: row ? 'ACCOUNT_UPDATED' : 'ACCOUNT_CREATED', account });
}

export async function checkAccounts({ evaluate: run, waitFor, key, command, root }) {
    const click = id => run(`document.getElementById('${id}').click()`);
    const ready = () => waitFor(`!document.querySelector('#accounts-scroll').hidden && document.querySelector('#accounts-stat-total').textContent!=='—'`);
    const formReady = () => waitFor(`!document.querySelector('#account-form').hidden && !document.querySelector('#account-dialog-save').disabled`);
    const submit = () => run(`document.querySelector('#account-form').requestSubmit()`);
    const fill = (extra = {}) => run(`(()=>{const data=${JSON.stringify({ HoTen: 'Nhân viên mới', SDT: '0903333333', VaiTro: '1', Email: '', AnhDaiDien: '', ...extra })};for(const [name,value]of Object.entries(data))document.getElementById('account-'+name).value=value;document.querySelector('#account-VaiTro').dispatchEvent(new Event('change'))})()`);
    const rowAction = (id, action) => run(`document.querySelector('[data-account-id="${id}"][data-account-action="${action}"]').click()`);
    const filter = (search = '', role = '', status = '') => run(`document.querySelector('#accounts-search').value=${JSON.stringify(search)};document.querySelector('#accounts-role').value=${JSON.stringify(role)};document.querySelector('#accounts-status').value=${JSON.stringify(status)};document.querySelector('#accounts-filters').requestSubmit()`);
    const screenshot = async name => { await run(`window.scrollTo({top:0,behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`); const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await writeFile(path.join(root, 'docs', `MODULE_02_8_2_ACCOUNTS_${name}.png`), Buffer.from(result.data, 'base64')); };
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await run(`location.hash='accounts'`); await ready();
    assert.equal(await run(`document.querySelector('#accounts-body').children.length`), 20); assert.equal(await run(`document.querySelector('#accounts-stat-total').textContent`), '24');
    assert.equal(await run(`document.querySelector('#accounts-stat-employees').textContent`), '12'); assert.equal(await run(`document.querySelector('#accounts-stat-managers').textContent`), '12'); assert.equal(await run(`document.querySelector('#accounts-stat-locked').textContent`), '4');
    assert.equal(await run(`document.querySelector('#accounts-body b')`), null); assert.equal(await run(`document.querySelector('[data-account-id="12"][data-account-action="status"]').disabled`), true);
    await screenshot('DESKTOP');
    await click('accounts-next'); await waitFor(`document.querySelector('#accounts-body').children.length===4`);
    assert.match(await run(`document.querySelector('#accounts-body').textContent`), /9223372036854775807/);
    await rowAction(BIG_ID, 'view'); await waitFor(`!document.querySelector('#account-detail').hidden`); assert.match(await run(`document.querySelector('#account-detail').textContent`), /9223372036854775807/);
    await screenshot('DETAIL_DESKTOP'); await key('Escape', 27); await waitFor(`!document.querySelector('#account-dialog').open`);
    await click('accounts-prev'); await waitFor(`document.querySelector('#accounts-body').children.length===20`);
    await filter('', '1', 'true'); await waitFor(`document.querySelector('#accounts-body').children.length===2`); assert.equal(await run(`document.querySelector('#accounts-stat-total').textContent`), '24');
    await filter('Nội bộ 2'); await waitFor(`document.querySelector('#accounts-count').textContent.startsWith('5 ')`);
    await click('accounts-reset'); await ready();
    await click('account-add'); await formReady(); assert.equal(await run(`document.querySelector('#account-dialog input[type="password"]')`), null); assert.equal(await run(`document.querySelector('#account-VaiTro option[value="0"]')`), null);
    await submit(); assert.equal(await run(`document.querySelector('#account-HoTen').getAttribute('aria-invalid')`), 'true');
    await fill({ VaiTro: '0', SDT: '123' }); await submit(); assert.equal(await run(`document.querySelector('#account-VaiTro').getAttribute('aria-invalid')`), 'true'); assert.equal(calls.filter(call => call.method === 'POST').length, 0);
    await fill({ SDT: '+84900000001' }); await submit(); await waitFor(`document.querySelector('#account-SDT-error').textContent.includes('đã thuộc') && !document.querySelector('#account-dialog-save').disabled`);
    await fill(); mode = 'csrf'; await submit(); await waitFor(`document.querySelector('#account-dialog-error').textContent.includes('xác thực') && !document.querySelector('#account-dialog-save').disabled`); assert.equal(await run(`document.querySelector('#account-HoTen').value`), 'Nhân viên mới');
    mode = 'save-slow'; writeGate = new Promise(resolve => { releaseWrite = resolve; }); const before = calls.filter(call => call.method === 'POST').length;
    await run(`document.querySelector('#account-form').requestSubmit();document.querySelector('#account-form').requestSubmit()`); await key('Escape', 27); assert.equal(await run(`document.querySelector('#account-dialog').open`), true); releaseWrite();
    await waitFor(`!document.querySelector('#account-dialog').open && document.querySelector('#accounts-stat-total').textContent==='25'`); mode = 'normal'; assert.equal(calls.filter(call => call.method === 'POST').length, before + 1);
    await click('account-add'); await formReady(); await fill({ HoTen: 'Quản lý mới', SDT: '0904444444', VaiTro: '2', Email: 'manager@example.com' }); await submit(); await waitFor(`!document.querySelector('#account-dialog').open && document.querySelector('#accounts-stat-total').textContent==='26'`);
    await rowAction('1', 'edit'); await formReady(); await fill({ HoTen: 'Nhân viên được nâng quyền', SDT: '+84900000001', VaiTro: '2', Email: 'updated@example.com' }); assert.match(await run(`document.querySelector('#account-role-change').textContent`), /Nhân viên.*Quản lý/); await submit(); await waitFor(`!document.querySelector('#account-dialog').open`); await ready(); assert.equal(rows.find(row => row.MaNguoiDung === '1').VaiTro, 2);
    await rowAction('12', 'edit'); await formReady(); assert.equal(await run(`document.querySelector('#account-VaiTro option[value="1"]').disabled`), true);
    await fill({ HoTen: 'Self', SDT: '+84900000012', VaiTro: '1' }); const updates = calls.filter(call => call.method === 'PUT').length; await submit(); assert.equal(calls.filter(call => call.method === 'PUT').length, updates); await click('account-dialog-close');
    await rowAction('2', 'status'); await waitFor(`!document.querySelector('#account-confirm').hidden && !document.querySelector('#account-confirm-submit').disabled`); assert.match(await run(`document.querySelector('#account-confirm-name').textContent`), /Nội bộ 2.*Quản lý/);
    const patches = calls.filter(call => call.method === 'PATCH').length; await key('Escape', 27); await waitFor(`!document.querySelector('#account-dialog').open`); assert.equal(calls.filter(call => call.method === 'PATCH').length, patches);
    await rowAction('2', 'status'); await waitFor(`!document.querySelector('#account-confirm-submit').disabled`); mode = 'last'; await click('account-confirm-submit'); await waitFor(`document.querySelector('#account-dialog-error').textContent.includes('cuối cùng')`); assert.equal(rows.find(row => row.MaNguoiDung === '2').TrangThai, false); await click('account-dialog-close'); mode = 'normal';
    await rowAction('3', 'status'); await waitFor(`!document.querySelector('#account-confirm-submit').disabled`); await click('account-confirm-submit'); await waitFor(`!document.querySelector('#account-dialog').open`); await ready(); assert.equal(rows.find(row => row.MaNguoiDung === '3').TrangThai, true);
    await rowAction('3', 'status'); await waitFor(`document.querySelector('#account-confirm-submit').textContent==='Mở khóa tài khoản' && !document.querySelector('#account-confirm-submit').disabled`); await click('account-confirm-submit'); await waitFor(`!document.querySelector('#account-dialog').open`); await ready(); assert.equal(rows.find(row => row.MaNguoiDung === '3').TrangThai, false);
    mode = 'stats-error'; await click('accounts-refresh'); await waitFor(`!document.querySelector('#accounts-stats-retry').hidden && !document.querySelector('#accounts-scroll').hidden`); assert.equal(await run(`document.querySelector('#accounts-stat-total').textContent`), '—'); mode = 'normal'; await click('accounts-stats-retry'); await ready();
    mode = 'missing'; await rowAction('1', 'view'); await waitFor(`document.querySelector('#account-dialog-error').textContent.includes('không tồn tại')`); await click('account-dialog-close'); mode = 'normal';
    mode = 'slow'; await rowAction('1', 'view'); await click('account-dialog-close'); await rowAction('2', 'view'); await waitFor(`document.querySelector('#account-detail').textContent.includes('Nội bộ 2')`); await run(`new Promise(r=>setTimeout(r,500))`); assert.match(await run(`document.querySelector('#account-detail').textContent`), /Nội bộ 2/); await click('account-dialog-close'); mode = 'normal';
    for (const width of [1280, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 }); assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`), true, `Account list overflow ${width}`);
        if (width === 375) await screenshot('MOBILE'); await click('account-add'); await formReady(); await fill(); assert.equal(await run(`document.querySelector('#account-dialog').scrollWidth<=document.querySelector('#account-dialog').clientWidth`), true); await key('Tab', 9, 8); assert.equal(await run(`document.querySelector('#account-dialog').contains(document.activeElement)`), true); if (width === 375) await screenshot('FORM_MOBILE'); await key('Escape', 27); await waitFor(`!document.querySelector('#account-dialog').open && document.activeElement.id==='account-add'`);
    }
    mode = 'empty'; await click('accounts-refresh'); await waitFor(`document.querySelector('#accounts-state-text').textContent.includes('Không có tài khoản') && document.querySelector('#accounts-stat-total').textContent==='0'`); mode = 'normal'; await click('accounts-refresh'); await ready();
    mode = 'network'; await click('accounts-refresh'); await waitFor(`document.querySelector('#accounts-state-text').textContent.includes('Mất kết nối')`); mode = 'normal'; await click('accounts-refresh'); await ready();
    // A genuine numeric BIGINT on the wire must stay exact in route + self checks.
    actorId = BIG_ID; await run(`location.hash='overview'`); await waitFor(`document.querySelector('#accounts-content').hidden`); await run(`window.dispatchEvent(new Event('focus'))`); await waitFor(`document.querySelector('#account-name').textContent==='Quản lý BigInteger'`); await run(`location.hash='accounts'`); await ready(); await click('accounts-next'); await waitFor(`document.querySelector('[data-account-id="${BIG_ID}"]')`);
    assert.equal(await run(`document.querySelector('[data-account-id="${BIG_ID}"][data-account-action="status"]').disabled`), true);
    await rowAction(BIG_ID, 'edit'); await formReady(); assert.equal(await run(`document.querySelector('#account-VaiTro option[value="1"]').disabled`), true); await fill({ HoTen: 'Quản lý BigInteger', SDT: '+84999999999', VaiTro: '2' }); await submit(); await waitFor(`!document.querySelector('#account-dialog').open`); assert.ok(calls.some(call => call.method === 'PUT' && call.path.endsWith('/' + BIG_ID)));
    actorId = '12'; mode = 'expired'; await click('accounts-refresh'); await waitFor(`!document.querySelector('#manager-gate').hidden`); assert.equal(await run(`document.querySelector('#accounts-body').children.length`), 0); assert.equal(await run(`document.querySelector('#account-HoTen').value`), '');
    mode = 'normal'; await click('manager-retry'); await waitFor(`!document.querySelector('#manager-shell').hidden`); await ready(); mode = 'forbidden'; await click('accounts-refresh'); await waitFor(`!document.querySelector('#manager-gate').hidden`); mode = 'normal';
    console.log('PASS: accounts global totals, server filters/page, create employee/manager, detail/profile/role/status, duplicate phone, self protections, last-manager error, true BIGINT wire/session paths, CSRF, empty/network/stats failure/401/403, stale detail, keyboard/focus and 1440–320px. AUTH/API MOCK; no real account writes.');
}
