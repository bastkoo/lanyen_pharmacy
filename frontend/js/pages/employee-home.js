import { getSession, logoutSession } from '../api/auth.js';
import { setupAuthDialog, authMessage } from '../components/auth-dialog.js';
import { renderAvatar } from '../components/customer-account.js';
import { setupEmployeeOrders } from './employee-orders.js';
import { getEmployeePendingCount } from '../api/employee-orders.js';
import { setupEmployeeCounter } from './employee-counter.js';

const $ = id => document.getElementById(id);
const views = { messages: 'Nhắn tin', orders: 'Xử lý đơn hàng', counter: 'Tạo đơn hàng', returns: 'Đổi trả' };
let version = 0, user = null, checking = false, signingOut = false, disposed = false;
let countTimer, countVersion = 0;
async function refreshPendingCount() {
    clearTimeout(countTimer);
    const id = user?.MaNguoiDung, attempt = ++countVersion;
    if (user?.VaiTro !== 1 || disposed) return;
    try {
        const data = await getEmployeePendingCount();
        if (id !== user?.MaNguoiDung || disposed || attempt !== countVersion || user?.VaiTro !== 1) return;
        if (!Number.isSafeInteger(data.count) || data.count < 0) throw { code: 'INVALID_RESPONSE' };
        for (const badge of document.querySelectorAll('[data-employee-pending-count]')) {
            badge.textContent = String(data.count); badge.hidden = data.count === 0;
            badge.removeAttribute('title');
            badge.setAttribute('aria-label', `${data.count} đơn đang chờ xử lý`);
        }
    } catch {
        if (id === user?.MaNguoiDung && attempt === countVersion && user?.VaiTro === 1) for (const badge of document.querySelectorAll('[data-employee-pending-count]')) { badge.textContent = '?'; badge.hidden = false; badge.setAttribute('aria-label', 'Chưa tải được số đơn chờ xử lý'); badge.title = 'Chưa tải được số đơn chờ xử lý. Hệ thống sẽ thử lại.'; }
    } finally { if (!disposed && user?.VaiTro === 1 && attempt === countVersion) countTimer = setTimeout(refreshPendingCount, 30000); }
}
window.addEventListener('employee-orders-changed', refreshPendingCount);
const account = $('employee-account'), trigger = account.querySelector('summary');
trigger.setAttribute('aria-label', 'Tài khoản nhân viên');
const ordersUI = setupEmployeeOrders({ getUser: () => user, onSessionError: () => { receive(null); load(); } });
const counterUI = setupEmployeeCounter({ getUser: () => user, onSessionError: () => { receive(null); load(); } });
function closeNavigation() { document.body.classList.remove('employee-nav-open'); $('employee-menu-toggle').setAttribute('aria-expanded', 'false'); }

function selectView(focus = false) {
    const requested = location.hash.slice(1), current = Object.hasOwn(views, requested) ? requested : 'orders';
    if (requested !== current) history.replaceState(null, '', `#${current}`);
    for (const view of Object.keys(views)) {
        $(`employee-${view}`).hidden = view !== current;
        const link = document.querySelector(`[data-employee-view="${view}"]`);
        if (view === current) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
    document.title = `${views[current]} · Nhân viên Lan Yến`;
    document.querySelector('.employee-preview-note').hidden = ['orders', 'counter'].includes(current);
    if (current === 'orders' && user?.VaiTro === 1) ordersUI.activate(); else ordersUI.deactivate();
    if (current === 'counter' && user?.VaiTro === 1) counterUI.activate(); else counterUI.deactivate();
    closeNavigation();
    if (focus && user?.VaiTro === 1) $(`employee-${current}-title`).focus();
}
function showGate(title, message, { login = false, retry = false } = {}) {
    ordersUI.clear(); counterUI.clear(); document.body.classList.remove('employee-authorized'); closeNavigation(); $('employee-menu-toggle').hidden = true;
    $('employee-workspace').hidden = true; $('employee-gate').hidden = false;
    $('employee-gate-title').textContent = title; $('employee-state').textContent = message;
    $('employee-gate-login').hidden = !login; $('employee-retry').hidden = !retry;
}
function receive(next) {
    if (String(user?.MaNguoiDung) !== String(next?.MaNguoiDung)) { ordersUI.clear(); counterUI.clear(); }
    version++; user = next || null;
    clearTimeout(countTimer);
    for (const badge of document.querySelectorAll('[data-employee-pending-count]')) badge.hidden = true;
    refreshPendingCount();
    $('employee-login').hidden = Boolean(user); account.hidden = !user; account.open = false;
    $('employee-name').textContent = user?.HoTen || '';
    $('employee-role').textContent = user ? ({ 0: 'Khách hàng', 1: 'Nhân viên', 2: 'Quản lý' }[user.VaiTro] || 'Tài khoản') : '';
    trigger.setAttribute('aria-label', user ? `Tài khoản của ${user.HoTen}` : 'Tài khoản nhân viên');
    renderAvatar($('employee-avatar'), user);
    if (user?.VaiTro === 1) {
        document.body.classList.add('employee-authorized'); $('employee-menu-toggle').hidden = false;
        $('employee-gate').hidden = true; $('employee-workspace').hidden = false; selectView();
    } else if (user) showGate('Khu vực dành cho nhân viên', 'Tài khoản hiện tại không có vai trò nhân viên. Bạn có thể đăng xuất và dùng tài khoản nhân viên để tiếp tục.');
    else showGate('Đăng nhập để bắt đầu công việc', 'Sử dụng tài khoản nhân viên đã được cấp để truy cập nhắn tin, xử lý đơn hàng và đổi trả.', { login: true });
}
const openAuth = setupAuthDialog(next => {
    if (disposed) return;
    receive(next); $('employee-feedback').textContent = '';
    $('main').focus();
});
for (const id of ['employee-login', 'employee-gate-login']) $(id).addEventListener('click', event => openAuth(event.currentTarget));

async function load() {
    if (checking || signingOut || disposed || $('auth-dialog').open) return;
    const attempt = ++version; checking = true;
    $('employee-retry').disabled = true;
    try {
        const data = await getSession();
        if (disposed || attempt !== version) return;
        if (data.code !== 'AUTHENTICATED' || !data.user) throw { code: 'INVALID_RESPONSE' };
        receive(data.user);
    } catch (error) {
        if (disposed || attempt !== version) return;
        receive(null);
        if (error.code === 'ACCOUNT_LOCKED') showGate('Tài khoản đã bị khóa', authMessage(error), { login: true });
        else if (error.code !== 'UNAUTHENTICATED') showGate('Chưa thể kiểm tra tài khoản', authMessage(error), { retry: true });
    } finally { checking = false; $('employee-retry').disabled = false; }
}
$('employee-retry').addEventListener('click', load);
$('employee-logout').addEventListener('click', async () => {
    if (signingOut) return;
    signingOut = true; version++; $('employee-logout').disabled = true;
    try {
        await logoutSession();
        if (disposed) return;
        receive(null); $('employee-feedback').textContent = 'Bạn đã đăng xuất.'; $('employee-gate-login').focus();
    } catch (error) { if (!disposed) $('employee-feedback').textContent = authMessage(error); }
    finally { signingOut = false; $('employee-logout').disabled = false; }
});
account.addEventListener('keydown', event => { if (event.key === 'Escape' && account.open) { event.preventDefault(); account.open = false; trigger.focus(); } });
$('employee-menu-toggle').addEventListener('click', () => { const open = document.body.classList.toggle('employee-nav-open'); $('employee-menu-toggle').setAttribute('aria-expanded', String(open)); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('employee-nav-open')) { closeNavigation(); $('employee-menu-toggle').focus(); } });
document.addEventListener('pointerdown', event => { if (!account.contains(event.target)) account.open = false; });
document.addEventListener('focusin', event => { if (!account.contains(event.target)) account.open = false; });
window.addEventListener('hashchange', () => selectView(true));
window.addEventListener('auth-changed', event => { if (!disposed) receive(event.detail?.user); });
window.addEventListener('focus', load);
window.addEventListener('pagehide', () => { disposed = true; version++; clearTimeout(countTimer); user = null; ordersUI.clear(); counterUI.clear(); $('employee-workspace').hidden = true; account.hidden = true; account.open = false; });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; checking = false; showGate('Đang kiểm tra tài khoản', 'Vui lòng chờ trong giây lát…'); load(); } });
selectView(); load();
