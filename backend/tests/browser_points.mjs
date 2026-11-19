import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

let mode = 'normal';
export const setPointsFixtureMode = value => { mode = value; };
const ledger = Array.from({ length: 21 }, (_, index) => ({ MaDiemThuong: index + 1, SoDiem: index === 20 ? 5 : 10, LoaiGiaoDich: index !== 20, LyDo: index === 1 ? '<b>Lý do an toàn</b>' : index === 20 ? 'Trừ điểm' : 'Cộng điểm', ThoiGianTichDiem: '2026-11-17T10:30:00' })).reverse();
export function pointsFixture(req, json) {
    assert.equal(req.method, 'GET');
    if (mode === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    const query = new URL(req.url, 'http://fixture.local').searchParams;
    assert.equal(query.has('MaNguoiDung'), false);
    const page = Number(query.get('page') || 1), per_page = Number(query.get('per_page') || 20);
    const entries = mode === 'empty' ? [] : ledger;
    return json(200, { code: 'POINTS_LISTED', balance: entries.length ? 195 : 0, total: entries.length, page, per_page, pages: Math.ceil(entries.length / per_page), items: entries.slice((page - 1) * per_page, page * per_page) });
}
export async function checkPoints({ evaluate: run, waitFor, command, root, baseUrl, setScenario }) {
    const click = expression => run(`${expression}.click()`);
    const ready = count => waitFor(`document.querySelector('#points-content')?.hidden===false && document.querySelector('#points-content').getAttribute('aria-busy')==='false' && document.querySelector('#points-history').children.length===${count}`);
    try {
        mode = 'normal'; setScenario('manager');
        await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
        await command('Page.navigate', { url: `${baseUrl}/pages/customer/points.html` }); await new Promise(resolve => setTimeout(resolve, 50)); await ready(20);
        assert.equal(await run(`document.querySelector('#points-balance').textContent`), '195');
        assert.deepEqual(await run(`Array.from(document.querySelectorAll('.customer-account-sidebar a')).map(link=>link.textContent.trim())`), ['Thông tin cá nhân', 'Xu tích lũy', 'Đơn hàng của tôi', 'Địa chỉ nhận hàng']);
        assert.equal(await run(`getComputedStyle(document.querySelector('.customer-account-sidebar a[aria-current]')).color`), 'rgb(51, 51, 51)');
        assert.equal(await run(`getComputedStyle(document.querySelector('#customer-account-menu a')).color`), 'rgb(51, 51, 51)');
        assert.equal(await run(`document.querySelector('#points-history b')`), null);
        assert.match(await run(`document.querySelector('#points-history').textContent`), /−5/);
        assert.equal(await run(`document.querySelector('#points-history .reward-coin').getAttribute('aria-label')`), 'xu');
        assert.equal(await run(`getComputedStyle(document.querySelector('.points-balance .reward-coin')).backgroundColor`), 'rgb(255, 193, 7)');
        assert.equal(await run(`document.querySelectorAll('h1 .reward-coin, .customer-account-sidebar .reward-coin, #customer-account-menu .reward-coin').length`), 0);
        assert.equal(await run(`getComputedStyle(document.querySelector('.points-balance .reward-coin')).fontSize===getComputedStyle(document.querySelector('#points-balance')).fontSize`), true);
        assert.equal(await run(`getComputedStyle(document.querySelector('.reward-coin'),'::after').content`), '"₫"');
        await click(`document.querySelector('#points-next')`); await ready(1);
        assert.equal(await run(`document.querySelector('#points-page').textContent`), 'Trang 2 / 2');
        assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true);
        mode = 'error'; await click(`document.querySelector('#points-prev')`);
        await waitFor(`!document.querySelector('#points-retry').hidden`);
        assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true);
        mode = 'normal'; await click(`document.querySelector('#points-retry')`); await ready(20);
        for (const width of [1440, 768, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true);
            if (width === 1440 || width === 375) {
                const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `MODULE_03_7_POINTS_${width}.png`), Buffer.from(screenshot.data, 'base64'));
            }
        }
        mode = 'empty'; await command('Page.reload'); await new Promise(resolve => setTimeout(resolve, 50)); await ready(0);
        assert.equal(await run(`document.querySelector('#points-balance').textContent`), '0');
        assert.equal(await run(`document.querySelector('#points-pagination').hidden`), true);
        await click(`document.querySelector('#account-avatar-button')`); await click(`document.querySelector('#logout-button')`);
        await waitFor(`document.querySelector('#points-content').hidden && !document.querySelector('#points-login').hidden`);
        assert.equal(await run(`document.querySelector('#points-history').children.length`), 0);
        console.log('PASS: points navigation/order, dark menu labels, own balance/history, signed amounts, safe text, paging/empty/error/retry without toast, logout clears data, 1440–320px. MOCK API.');
    } finally { mode = 'normal'; setScenario('anonymous'); }
}
