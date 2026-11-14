// Isolated headless UI test. Auth responses are mocked only by this test server.
// Production files never contain an authenticated preview flag or mock user.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { categoryFixture, checkCategories } from './browser_categories.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const frontend = path.join(root, 'frontend');
let scenario = 'manager', logoutCount = 0, sessionCount = 0;
const dashboardTest = process.argv.includes('--dashboard');
const categoryTest = process.argv.includes('--categories');
let dashboardMode = 'populated';
const dashboardCalls = [];
const fixtureToday = new Date('2026-11-14T00:00:00Z');
function dashboardFixture(pathname, params) {
    const days = Number(params.get('days') || 30);
    const first = new Date(fixtureToday); first.setUTCDate(first.getUTCDate() - days + 1);
    const date = value => value.toISOString().slice(0, 10);
    const period = { days, start_date: date(first), end_date: date(fixtureToday), timezone: 'Asia/Ho_Chi_Minh' };
    const empty = dashboardMode === 'empty';
    const revenue = empty ? '0' : days === 7 ? '70000' : '250000';
    if (pathname.endsWith('/dashboard/summary')) return { code: 'DASHBOARD_SUMMARY', orders: empty ? 0 : 3, customers: empty ? 0 : 9, period, revenue: { available: true, amount: revenue, order_status: 3, payment_status: 1 } };
    if (pathname.endsWith('/dashboard/revenue')) return { code: 'REVENUE_LISTED', has_data: !empty, period, total: revenue,
        items: Array.from({ length: days }, (_, index) => { const day = new Date(first); day.setUTCDate(day.getUTCDate() + index); return { date: date(day), amount: empty ? '0' : index === 0 ? (days === 7 ? '30000' : '100000') : index === days - 1 ? (days === 7 ? '40000' : '150000') : '0' }; }) };
    if (pathname.endsWith('/dashboard/recent-orders')) return { code: 'RECENT_ORDERS_LISTED', period, items: empty ? [] : [
        { MaDonHang: '203', NgayDat: '2026-11-14T14:30:00', TongThanhToan: days === 7 ? '40000' : '150000', TrangThaiDonHang: 3, TenTrangThai: 'Hoàn thành' },
        { MaDonHang: '202', NgayDat: '2026-11-13T10:15:00', TongThanhToan: '90000', TrangThaiDonHang: 0, TenTrangThai: 'Chờ duyệt' },
        { MaDonHang: '201', NgayDat: period.start_date + 'T09:00:00', TongThanhToan: days === 7 ? '30000' : '100000', TrangThaiDonHang: 3, TenTrangThai: 'Hoàn thành' }] };
    if (pathname.endsWith('/products')) return { code: 'PRODUCTS_LISTED', total: empty ? 0 : 17, items: [] };
    if (pathname.endsWith('/low-stock')) return { code: 'LOW_STOCK_LISTED', total: empty ? 0 : 2, items: empty ? [] : [
        { MaThuoc: 3, TenThuoc: 'Thuốc kiểm thử A', TongSoLuongTon: 4, NguongTonKho: 10, TonKhoThap: true },
        { MaThuoc: 4, TenThuoc: 'Thuốc kiểm thử B', TongSoLuongTon: 0, NguongTonKho: 5, TonKhoThap: true }] };
    if (pathname.endsWith('/expiring')) return { code: 'EXPIRING_BATCHES_LISTED', total: empty ? 0 : 1, as_of: date(fixtureToday), items: empty ? [] : [
        { MaThuoc: 3, MaLo: 7, TenThuoc: 'Thuốc kiểm thử A', SoLoSanXuat: 'TEST-LOT', HanSuDung: '2026-11-25', SoLuongTon: 4 }] };
    return null;
}
const fixtureUser = { MaNguoiDung: 12, HoTen: 'Nguyễn Lan Yến', SDT: '+84900000000', VaiTro: 2, TrangThai: false };
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://fixture.local').pathname;
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (categoryTest && pathname.startsWith('/api/manager/categories')) return categoryFixture(req, json);
    if (pathname === '/api/auth/me') {
        sessionCount++;
        if (scenario === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        if (scenario === 'anonymous') return json(401, { code: 'UNAUTHENTICATED', csrf_token: 'fixture-csrf' });
        if (scenario === 'locked') return json(403, { code: 'ACCOUNT_LOCKED', csrf_token: 'fixture-csrf' });
        return json(200, { code: 'AUTHENTICATED', csrf_token: 'fixture-csrf', user: { ...fixtureUser, VaiTro: scenario === 'forbidden' ? 1 : 2 } });
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
        logoutCount++;
        scenario = 'anonymous';
        return json(200, { code: 'LOGGED_OUT' });
    }
    if (pathname === '/api/auth/otp/request' && req.method === 'POST') return json(200, { code: 'OTP_SENT', retry_after: 60 });
    if (pathname === '/api/auth/otp/verify' && req.method === 'POST') {
        scenario = 'manager';
        return json(200, { code: 'AUTHENTICATED', csrf_token: 'fixture-csrf', user: fixtureUser });
    }
    if (dashboardTest && pathname.startsWith('/api/manager/')) {
        const url = new URL(req.url, 'http://fixture.local'); dashboardCalls.push(url.pathname + url.search);
        if (dashboardMode === 'unauthorized') return json(401, { code: 'UNAUTHENTICATED' });
        if (dashboardMode === 'partial-error' && pathname.endsWith('/low-stock')) return json(503, { code: 'DATABASE_UNAVAILABLE' });
        const data = dashboardFixture(pathname, url.searchParams);
        if (data) return json(200, data);
    }
    if (pathname === '/js/config/app.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        return res.end(`export const APP_CONFIG = {API_BASE_URL: 'http://127.0.0.1:${server.address().port}/api'};`);
    }
    try {
        const filename = path.resolve(frontend, '.' + decodeURIComponent(pathname));
        if (!filename.startsWith(frontend + path.sep)) return json(403, {});
        let bytes = await readFile(filename);
        if (filename.endsWith('/manager/index.html') || filename.endsWith('\\manager\\index.html')) {
            const mark = '<div aria-label="Môi trường kiểm thử" style="position:fixed;bottom:6px;right:8px;z-index:90;padding:3px 8px;background:#fff7e5;color:#785313;font:10px Arial;pointer-events:none">KIỂM THỬ GIAO DIỆN · AUTH/API MOCK</div>';
            bytes = Buffer.from(bytes.toString('utf8').replace('</body>', mark + '</body>'));
        }
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf' };
        res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'text/plain' });
        res.end(bytes);
    } catch { json(404, {}); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browserProfile = await mkdtemp(path.join(tmpdir(), 'lanyen-manager-ui-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${browserProfile}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { port = (await readFile(path.join(browserProfile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
        catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(port, 'Headless Chrome did not start');
    const metadata = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    socket = new WebSocket(metadata.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0;
    const pending = new Map();
    const errors = [];
    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
        if (data.id && pending.has(data.id)) {
            const { resolve, reject, timer } = pending.get(data.id);
            clearTimeout(timer); pending.delete(data.id);
            if (data.error) reject(new Error(data.error.message)); else resolve(data.result);
        }
    };
    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timeout')); }, 20000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params) => call(method, params, sessionId);
    const evaluate = async expression => {
        const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
        return result.result.value;
    };
    const waitFor = expression => evaluate(`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(${expression}){clearInterval(timer);resolve(true)}else if(++n>100){clearInterval(timer);reject(new Error('UI state timeout'))}},50)})`);
    const key = async (key, code, modifiers = 0) => {
        await command('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: code, modifiers });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
    };
    const navigate = async mode => {
        scenario = mode;
        await command('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/pages/manager/index.html` });
        await waitFor(`document.querySelector('#access-state')?.getAttribute('aria-busy')==='false' || document.querySelector('#manager-shell')?.hidden===false`);
    };
    const screenshot = async filename => {
        if (!dashboardTest || categoryTest) return; // Preserve earlier module artifacts during category tests.
        filename = filename.replace('MODULE_02_6_1_MANAGER', 'MODULE_02_6_2_DASHBOARD');
        const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(root, 'docs', filename), Buffer.from(result.data, 'base64'));
    };
    await command('Page.enable');
    await command('Runtime.enable');
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('manager');
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate(`getComputedStyle(document.body).fontFamily.includes('Be Vietnam Pro')`), true);
    assert.equal(await evaluate(`document.fonts.check('400 15px "Be Vietnam Pro"')`), true);
    assert.equal(await evaluate(`document.querySelector('#manager-shell').hidden`), false);
    if (dashboardTest) {
        await waitFor(`document.querySelector('#kpi-products').textContent==='17' && document.querySelector('#revenue-chart svg')`);
        assert.match(await evaluate(`document.querySelector('#kpi-revenue').textContent`), /250\.000/);
        assert.equal(await evaluate(`document.querySelector('#kpi-orders').textContent`), '3');
        assert.equal(await evaluate(`document.querySelector('#kpi-customers').textContent`), '9');
        assert.equal(await evaluate(`document.querySelector('#kpi-low-stock').textContent`), '2');
        assert.equal(await evaluate(`document.querySelector('#kpi-expiring').textContent`), '1');
    }
    await screenshot('MODULE_02_6_1_MANAGER_DESKTOP.png');
    for (const route of ['categories', 'products', 'units', 'batches', 'inventory']) {
        await evaluate(`document.querySelector('[data-manager-view="${route}"]').click()`);
        await waitFor(`location.hash==='#${route}' && document.activeElement.id==='page-title'`);
        assert.equal(await evaluate(`document.querySelector('${route === 'categories' ? '#categories-content' : '#module-content'}').hidden`), false);
        assert.equal(await evaluate(`document.querySelector('[data-manager-view="${route}"]').getAttribute('aria-current')`), 'page');
    }
    await evaluate(`location.hash='overview'`);
    await waitFor(`!document.querySelector('#overview-content').hidden`);
    await evaluate(`document.querySelector('#manager-skip').click()`);
    assert.equal(await evaluate('location.hash'), '#overview');
    assert.equal(await evaluate('document.activeElement.id'), 'manager-main');
    await evaluate(`document.querySelector('#account-summary').click()`);
    assert.equal(await evaluate(`document.querySelector('#account-menu').open`), true);
    await key('Escape', 27);
    assert.equal(await evaluate(`document.querySelector('#account-menu').open`), false);
    for (const width of [1280, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
        await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, `Overflow at ${width}`);
        if (width >= 1024) continue;
        await evaluate(`document.querySelector('#open-sidebar').click()`);
        assert.equal(await evaluate(`document.querySelector('#manager-workspace').inert`), true);
        assert.equal(await evaluate(`document.querySelector('#manager-sidebar').getAttribute('aria-modal')`), 'true');
        await evaluate(`document.querySelector('#close-sidebar').focus()`);
        await key('Tab', 9, 8);
        assert.equal(await evaluate(`document.querySelector('#manager-sidebar').contains(document.activeElement)`), true);
        await key('Escape', 27);
        assert.equal(await evaluate('document.activeElement.id'), 'open-sidebar');
        await evaluate(`document.querySelector('#open-sidebar').click();document.querySelector('[data-manager-view="overview"]').click()`);
        assert.equal(await evaluate(`document.body.classList.contains('drawer-open')`), false);
        if (width === 375) {
            await screenshot('MODULE_02_6_1_MANAGER_MOBILE.png');
            await evaluate(`document.querySelector('#open-sidebar').click()`);
            await screenshot('MODULE_02_6_1_MANAGER_DRAWER.png');
            await key('Escape', 27);
        }
    }
    fixtureUser.HoTen = 'Nguyễn '.repeat(35);
    await navigate('manager');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    fixtureUser.HoTen = 'Nguyễn Lan Yến';
    await evaluate(`document.documentElement.style.fontSize='200%'`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, 'Text resize 200% overflow');
    await evaluate(`document.querySelector('#open-sidebar').click()`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, 'Drawer text resize 200% overflow');
    await key('Escape', 27);
    await evaluate(`document.documentElement.style.fontSize=''`);
    if (dashboardTest) {
        await evaluate(`document.querySelector('#dashboard-days').value='7';document.querySelector('#dashboard-days').dispatchEvent(new Event('change'))`);
        await waitFor(`document.querySelector('#kpi-revenue').textContent.includes('70.000') && !document.querySelector('#dashboard-refresh').disabled`);
        assert.ok(dashboardCalls.some(url => url.includes('/dashboard/revenue?days=7')));
        dashboardMode = 'partial-error';
        await evaluate(`document.querySelector('#dashboard-refresh').click()`);
        await waitFor(`document.querySelector('[data-panel-status="low-stock"]').dataset.state==='error' && !document.querySelector('#dashboard-refresh').disabled`);
        assert.equal(await evaluate(`document.querySelector('#kpi-products').textContent`), '17');
        assert.equal(await evaluate(`document.querySelector('#kpi-low-stock').textContent`), '—');
        dashboardMode = 'populated';
        await evaluate(`document.querySelector('[data-dashboard-retry="low-stock"]').click()`);
        await waitFor(`document.querySelector('#kpi-low-stock').textContent==='2'`);
        dashboardMode = 'empty';
        await evaluate(`document.querySelector('#dashboard-refresh').click()`);
        await waitFor(`document.querySelector('[data-panel-status="orders"]').dataset.state==='empty' && !document.querySelector('#dashboard-refresh').disabled`);
        assert.equal(await evaluate(`document.querySelector('#kpi-products').textContent`), '0');
        assert.match(await evaluate(`document.querySelector('#kpi-revenue').textContent`), /0/);
        assert.equal(await evaluate(`document.querySelector('[data-panel-status="revenue"]').dataset.state`), 'empty');
        dashboardMode = 'unauthorized';
        await evaluate(`document.querySelector('#dashboard-refresh').click()`);
        await waitFor(`!document.querySelector('#manager-gate').hidden`);
        assert.equal(await evaluate(`document.querySelector('#recent-orders-body').childElementCount`), 0);
        dashboardMode = 'populated';
    }
    if (categoryTest) {
        await navigate('manager');
        await checkCategories({ evaluate, waitFor, key, command, root });
    }
    await navigate('forbidden');
    assert.equal(await evaluate(`document.querySelector('#manager-shell').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#manager-switch-account').hidden`), false);
    await navigate('locked');
    assert.match(await evaluate(`document.querySelector('#gate-title').textContent`), /bị khóa/);
    await navigate('error');
    assert.equal(await evaluate(`document.querySelector('#manager-retry').hidden`), false);
    scenario = 'manager';
    await evaluate(`document.querySelector('#manager-retry').click()`);
    await waitFor(`!document.querySelector('#manager-shell').hidden`);
    await navigate('anonymous');
    await evaluate(`document.querySelector('#manager-login').click()`);
    assert.equal(await evaluate(`document.querySelector('#auth-dialog').open`), true);
    assert.equal(await evaluate('document.activeElement.id'), 'phone');
    assert.equal(await evaluate(`document.querySelector('#manager-gate').inert`), true);
    await key('Escape', 27);
    assert.equal(await evaluate(`document.querySelector('#auth-dialog').open`), false);
    await evaluate(`document.querySelector('#manager-login').click();document.querySelector('#phone').value='0900000000';document.querySelector('#phone-form').requestSubmit()`);
    await waitFor(`!document.querySelector('#otp-form').hidden && !document.querySelector('#otp').disabled`);
    await evaluate(`document.querySelector('#otp').value='123456';document.querySelector('#otp-form').requestSubmit()`);
    await waitFor(`!document.querySelector('#manager-shell').hidden && !document.querySelector('#auth-dialog').open && !document.querySelector('#manager-shell').inert`);
    await navigate('manager');
    scenario = 'anonymous';
    await evaluate(`window.dispatchEvent(new Event('focus'))`);
    await waitFor(`!document.querySelector('#manager-gate').hidden`);
    assert.match(await evaluate(`document.querySelector('#gate-title').textContent`), /hết hạn/);
    await navigate('manager');
    await evaluate(`document.querySelector('#account-summary').click();document.querySelector('#manager-logout').click()`);
    await waitFor(`document.querySelector('#gate-title').textContent==='Bạn đã đăng xuất'`);
    assert.equal(logoutCount, 1);
    assert.equal(await evaluate(`document.querySelector('#account-full-name').textContent`), '');
    await command('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/pages/customer/home.html` });
    await waitFor(`document.querySelector('#header-status')?.textContent==='Bạn chưa đăng nhập'`);
    await evaluate(`document.querySelector('#start-login').click()`);
    assert.equal(await evaluate(`document.querySelector('#main').inert`), true);
    await key('Escape', 27);
    await waitFor(`!document.querySelector('#main').inert`);
    assert.equal(await evaluate(`document.querySelector('#main').inert`), false);
    assert.equal(await evaluate('document.activeElement.id'), 'start-login');
    assert.deepEqual(errors, []);
    console.log('PASS: manager navigation, real CSS/fonts, 1440/1280/1024/768/375/320 widths, no overflow, drawer/keyboard/focus, account Escape, long name, anonymous/forbidden/locked/network/retry/expired, OTP UI flow, CSRF logout, customer auth dialog regression.');
    console.log(`Auth responses mocked by isolated test server (${sessionCount} checks). No production API or database used.`);
    if (dashboardTest) console.log('PASS: Dashboard amounts/counts, 7-day filter, isolated API failure/retry, empty data, API session expiry.' + (categoryTest ? ' Previous dashboard screenshots preserved.' : ' Screenshots: docs/MODULE_02_6_2_DASHBOARD_{DESKTOP,MOBILE,DRAWER}.png'));
    await call('Browser.close');
} finally {
    socket?.close();
    chrome.kill();
    server.closeAllConnections();
    server.close();
}
