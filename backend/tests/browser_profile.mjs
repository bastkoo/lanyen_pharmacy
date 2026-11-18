import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

let mode = 'normal';
const avatarUrl = 'https://example.invalid/customer-avatar.png';
export async function profileFixture(req, json, user) {
    assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
    if (mode === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (req.url.endsWith('/avatar')) {
        assert.match(req.headers['content-type'], /multipart\/form-data; boundary=/);
        for await (const chunk of req) { /* consume isolated multipart fixture */ }
        return json(200, { code: 'UPLOAD_SUCCESS', data: { url: avatarUrl } });
    }
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    assert.deepEqual(Object.keys(data).sort(), ['AnhDaiDien', 'HoTen']);
    Object.assign(user, data);
    return json(200, { code: 'PROFILE_UPDATED', user });
}

export async function checkProfile({ evaluate: run, waitFor, command, key, baseUrl, root, setScenario, user }) {
    const original = { ...user };
    const click = id => run(`document.querySelector('#${id}').focus();document.querySelector('#${id}').click()`);
    const ready = () => waitFor(`document.querySelector('#profile-form')?.hidden===false && !document.querySelector('#profile-save').disabled`);
    const navigate = async file => { await command('Page.navigate', { url: `${baseUrl}/pages/customer/${file}` }); await new Promise(resolve => setTimeout(resolve, 50)); };
    try {
        setScenario('manager'); await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
        await navigate('home.html'); await waitFor(`document.querySelector('.customer-account')?.hidden===false`);
        assert.equal(await run(`document.querySelector('#account-avatar-button').textContent`), 'Y');
        await click('account-avatar-button');
        assert.deepEqual(await run(`Array.from(document.querySelector('#customer-account-menu').children).map(item=>item.textContent.trim())`), ['Thông tin cá nhân', 'Xu tích lũy', 'Đơn hàng của tôi', 'Địa chỉ nhận hàng', 'Quản lý', 'Đăng xuất']);
        assert.equal(await run(`document.querySelector('[data-management]').getAttribute('href')`), '../manager/index.html#overview');
        await key('Escape', 27);
        assert.equal(await run(`document.querySelector('#customer-account-menu').hidden && document.activeElement.id==='account-avatar-button'`), true);
        await click('account-avatar-button'); await run(`document.querySelector('#customer-account-menu a[href$="addresses.html"]').click()`);
        await waitFor(`document.querySelector('.customer-account-sidebar a[aria-current]')?.getAttribute('href')==='addresses.html'`);
        await waitFor(`document.querySelector('.customer-account')?.hidden===false`);
        await click('account-avatar-button'); await run(`document.querySelector('#customer-account-menu a').click()`); await ready();
        assert.equal(await run('location.pathname'), '/pages/customer/profile.html');
        assert.equal(await run(`document.querySelector('#profile-phone').readOnly`), true);
        await run(`document.querySelector('#profile-name').value='  Nguyễn Bình  ';document.querySelector('#profile-name').dispatchEvent(new Event('input'));document.querySelector('#profile-phone').value='injected';document.querySelector('#profile-form').requestSubmit()`);
        await waitFor(`document.querySelector('#profile-save-state').textContent==='Đã lưu thông tin cá nhân.' && !document.querySelector('#profile-save').disabled`);
        assert.equal(user.HoTen, 'Nguyễn Bình'); assert.equal(user.SDT, original.SDT);
        assert.equal(await run(`document.querySelector('#account-avatar-button').textContent`), 'B');
        await command('Page.reload'); await new Promise(resolve => setTimeout(resolve, 50)); await ready();
        assert.equal(await run(`document.querySelector('#profile-name').value`), 'Nguyễn Bình');
        await run(`document.querySelector('#profile-name').value='';document.querySelector('#profile-form').requestSubmit()`);
        assert.equal(await run(`document.querySelector('#profile-name').getAttribute('aria-invalid')`), 'true');
        await run(`document.querySelector('#profile-name').value='Tên giữ lại';document.querySelector('#profile-name').dispatchEvent(new Event('input'))`);
        mode = 'error'; await run(`document.querySelector('#profile-form').requestSubmit()`);
        await waitFor(`!document.querySelector('#profile-save').disabled && document.querySelector('#profile-save-state').textContent!=='Đang lưu…'`);
        assert.equal(await run(`document.querySelector('#profile-name').value`), 'Tên giữ lại'); assert.equal(user.HoTen, 'Nguyễn Bình');
        mode = 'normal';
        await run(`(() => {const file=new File([new Uint8Array([1,2,3])],'avatar.png',{type:'image/png'});const dt=new DataTransfer();dt.items.add(file);document.querySelector('#profile-image').files=dt.files;document.querySelector('#profile-image').dispatchEvent(new Event('change'));})()`);
        await waitFor(`!document.querySelector('#profile-save').disabled && !document.querySelector('#profile-remove-image').hidden`);
        assert.equal(user.AnhDaiDien || null, null, 'Upload is only applied to the account after Save');
        await run(`document.querySelector('#profile-form').requestSubmit()`); await waitFor(`document.querySelector('#profile-save-state').textContent==='Đã lưu thông tin cá nhân.' && !document.querySelector('#profile-save').disabled`);
        assert.equal(user.AnhDaiDien, avatarUrl);
        await waitFor(`document.querySelector('#account-avatar-button').textContent==='L'`);
        await click('profile-remove-image'); await run(`document.querySelector('#profile-form').requestSubmit()`);
        await waitFor(`document.querySelector('#profile-save-state').textContent==='Đã lưu thông tin cá nhân.' && !document.querySelector('#profile-save').disabled`);
        assert.equal(user.AnhDaiDien, null);
        for (const width of [1440, 768, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Profile fits ${width}px`);
            await click('account-avatar-button');
            assert.equal(await run(`(()=>{const rect=document.querySelector('#customer-account-menu').getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth})()`), true, `Account menu fits ${width}px`);
            await key('Escape', 27);
            if (width === 1440 || width === 375) {
                const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `MODULE_03_5_PROFILE_${width}.png`), Buffer.from(shot.data, 'base64'));
            }
        }
        await click('account-avatar-button'); await click('logout-button');
        await waitFor(`document.querySelector('#profile-form').hidden && !document.querySelector('#profile-login').hidden`);
        assert.equal(await run(`document.querySelector('#profile-name').value`), '');
        assert.equal(await run(`document.querySelector('.customer-account').hidden`), true);
        console.log('PASS: avatar initials/broken-image fallback, account menu/keyboard, own profile navigation/save/reload, immutable phone, upload/save/remove, failure preserves input, logout clears data and 1440–320px. API/provider mocked.');
    } finally { Object.assign(user, original); mode = 'normal'; setScenario('anonymous'); }
}
