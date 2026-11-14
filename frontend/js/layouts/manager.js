import { getSession, logoutSession } from '../api/auth.js';
import { setupAuthDialog, authMessage } from '../components/auth-dialog.js';
import { managerIcon, renderManagerState } from '../components/manager-state.js';
import { MANAGER_VIEWS, resolveManagerView, managerAccess, accountInitials } from '../utils/manager-view.js';
import { setupDashboard } from '../pages/manager-dashboard.js';
import { setupCategories } from '../pages/manager-categories.js';
import { setupProducts } from '../pages/manager-products.js';

const $ = id => document.getElementById(id);
const gate = $('manager-gate');
const shell = $('manager-shell');
const sidebar = $('manager-sidebar');
const workspace = $('manager-workspace');
const menu = $('account-menu');
const mobile = matchMedia('(max-width: 1023px)');
let user = null, checking = false, loggingOut = false, generation = 0;
function handleAccessError(error) {
    generation += 1;
    if (error.code === 'UNAUTHENTICATED') showGate('empty', 'Phiên đăng nhập đã hết hạn', 'Đăng nhập lại để tiếp tục sử dụng khu vực quản lý.', 'login');
    else showGate('error', error.code === 'ACCOUNT_LOCKED' ? 'Tài khoản đã bị khóa' : 'Tài khoản không có quyền quản lý', authMessage(error), 'login');
}
const dashboard = setupDashboard({ root: $('overview-content'), onAccessError: handleAccessError });
const categories = setupCategories({ root: $('categories-content'), onAccessError: handleAccessError });
const products = setupProducts({ root: $('products-content'), onAccessError: handleAccessError });

function closeDrawer(restoreFocus = true) {
    const wasOpen = document.body.classList.contains('drawer-open');
    document.body.classList.remove('drawer-open');
    $('drawer-backdrop').hidden = true;
    $('open-sidebar').setAttribute('aria-expanded', 'false');
    sidebar.removeAttribute('role');
    sidebar.removeAttribute('aria-modal');
    sidebar.hidden = mobile.matches;
    workspace.inert = false;
    if (wasOpen && restoreFocus && mobile.matches) $('open-sidebar').focus();
}

function openDrawer() {
    if (!mobile.matches || !user) return;
    menu.open = false;
    sidebar.hidden = false;
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
    document.body.classList.add('drawer-open');
    $('drawer-backdrop').hidden = false;
    $('open-sidebar').setAttribute('aria-expanded', 'true');
    workspace.inert = true;
    $('close-sidebar').focus();
}

function showGate(type, title, description, action = 'retry') {
    const wasVisible = !shell.hidden;
    dashboard.clear();
    categories.clear();
    products.clear();
    closeDrawer(false);
    menu.open = false;
    shell.hidden = true;
    $('manager-skip').hidden = true;
    gate.hidden = false;
    user = null;
    for (const id of ['account-name', 'account-full-name', 'account-avatar']) $(id).textContent = '';
    $('account-summary').setAttribute('aria-label', 'Tài khoản quản lý');
    renderManagerState($('access-state'), { type, title, description });
    $('manager-login').hidden = action !== 'login';
    $('manager-retry').hidden = action !== 'retry';
    $('manager-switch-account').hidden = action !== 'switch';
    $('manager-live-status').textContent = title;
    if (wasVisible) $('gate-title').focus();
}

function renderView(focus = false) {
    const key = resolveManagerView(location.hash);
    const view = MANAGER_VIEWS[key];
    menu.open = false;
    $('overview-content').hidden = key !== 'overview';
    $('categories-content').hidden = key !== 'categories';
    $('category-add').hidden = key !== 'categories';
    $('products-content').hidden = key !== 'products';
    $('product-add').hidden = key !== 'products';
    $('module-content').hidden = ['overview', 'categories', 'products'].includes(key);
    document.querySelectorAll('[data-manager-view]').forEach(link => {
        if (link.dataset.managerView === key) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
    $('page-title').textContent = view?.title || 'Không tìm thấy khu vực';
    $('page-description').textContent = view?.description || 'Liên kết này không có trong không gian quản lý.';
    $('page-eyebrow').textContent = view?.section || 'Điều hướng';
    $('breadcrumb-current').textContent = view?.title || 'Không tìm thấy';
    $('placeholder-icon').replaceChildren(managerIcon(view?.icon || 'circle-alert'));
    $('placeholder-title').textContent = view ? `Giao diện ${view.title.toLocaleLowerCase('vi')} chưa được triển khai` : 'Liên kết không hợp lệ';
    $('placeholder-description').textContent = view ?
        'Khu vực này đang được hoàn thiện. Chưa có thao tác quản lý hoặc dữ liệu để hiển thị.' :
        'Chọn một khu vực trong điều hướng hoặc trở lại Tổng quan để tiếp tục.';
    $('module-badge').textContent = view ? 'Chưa triển khai' : 'Không tìm thấy';
    document.title = `${view?.title || 'Không tìm thấy'} · Quản lý Lan Yến`;
    closeDrawer(false);
    if (key === 'overview' && user) dashboard.activate();
    else dashboard.deactivate();
    if (key === 'categories' && user) categories.activate();
    else categories.deactivate();
    if (key === 'products' && user) products.activate();
    else products.deactivate();
    if (focus && user) $('page-title').focus();
}

function showManager(nextUser, focus = false) {
    const access = managerAccess(nextUser);
    if (access === 'forbidden') {
        showGate('error', 'Tài khoản chưa có quyền quản lý', 'Khu vực này chỉ dành cho quản lý nhà thuốc. Bạn có thể trở về trang nhà thuốc hoặc đăng nhập bằng tài khoản khác.', 'switch');
        return;
    }
    if (access !== 'allowed') {
        showGate('error', access === 'locked' ? 'Tài khoản đã bị khóa' : 'Chưa thể xác minh tài khoản', 'Vui lòng đăng nhập lại hoặc thử kiểm tra phiên kết nối.', access === 'locked' ? 'login' : 'retry');
        return;
    }
    const alreadyVisible = !shell.hidden;
    user = nextUser;
    gate.hidden = true;
    shell.hidden = false;
    $('manager-skip').hidden = false;
    const name = user.HoTen || 'Quản lý';
    for (const id of ['account-name', 'account-full-name']) $(id).textContent = name;
    $('account-avatar').textContent = accountInitials(name);
    $('account-summary').setAttribute('aria-label', `Tài khoản ${name}, quản lý`);
    $('manager-live-status').textContent = 'Đã xác thực tài khoản quản lý.';
    if (!alreadyVisible || focus) renderView(focus);
}

const openAuth = setupAuthDialog((nextUser, warning) => {
    if (warning) showGate('error', 'Chưa thể hoàn tất đăng nhập', warning);
    else showManager(nextUser);
});
$('auth-dialog').addEventListener('close', () => {
    if (user) $('page-title').focus();
    else if ($('manager-login').hidden) $('gate-title').focus();
});
$('manager-login').addEventListener('click', event => openAuth(event.currentTarget));

async function checkSession() {
    if (checking || loggingOut || $('auth-dialog').open) return;
    const attempt = ++generation;
    const hadManager = Boolean(user);
    checking = true;
    $('manager-retry').disabled = true;
    try {
        const data = await getSession();
        if (attempt === generation) showManager(data.user);
    } catch (error) {
        if (attempt !== generation) return;
        if (error.code === 'UNAUTHENTICATED') {
            showGate('empty', hadManager ? 'Phiên đăng nhập đã hết hạn' : 'Đăng nhập để vào khu vực quản lý',
                hadManager ? 'Đăng nhập lại để tiếp tục sử dụng khu vực quản lý.' :
                    'Sử dụng tài khoản quản lý nhà thuốc đã được cấp quyền. Phiên đăng nhập được xác thực an toàn bằng số điện thoại và OTP.', 'login');
        } else if (error.code === 'ACCOUNT_LOCKED') {
            showGate('error', 'Tài khoản đã bị khóa', authMessage(error), 'login');
        } else if (error.code === 'FORBIDDEN') {
            showGate('error', 'Tài khoản không có quyền truy cập', authMessage(error), 'switch');
        } else showGate('error', 'Không thể kiểm tra phiên đăng nhập', authMessage(error));
    } finally {
        checking = false;
        $('manager-retry').disabled = false;
    }
}

async function signOut(changeAccount = false) {
    if (loggingOut) return;
    generation += 1;
    loggingOut = true;
    $('manager-logout').disabled = true;
    $('manager-switch-account').disabled = true;
    try {
        await logoutSession();
        showGate('empty', 'Bạn đã đăng xuất', 'Đăng nhập bằng tài khoản quản lý để tiếp tục công việc.', 'login');
        $('manager-login').focus();
        if (changeAccount) openAuth($('manager-login'));
    } catch (error) {
        showGate('error', 'Chưa thể hoàn tất đăng xuất', authMessage(error));
        $('manager-retry').focus();
    } finally {
        loggingOut = false;
        $('manager-logout').disabled = false;
        $('manager-switch-account').disabled = false;
    }
}

$('manager-logout').addEventListener('click', () => signOut());
$('manager-switch-account').addEventListener('click', () => signOut(true));
$('manager-retry').addEventListener('click', checkSession);
$('open-sidebar').addEventListener('click', openDrawer);
$('close-sidebar').addEventListener('click', () => closeDrawer());
$('drawer-backdrop').addEventListener('click', () => closeDrawer());
$('manager-skip').addEventListener('click', event => {
    event.preventDefault();
    $('manager-main').focus();
});
sidebar.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    closeDrawer(false);
    if (link.getAttribute('href') === location.hash || (!location.hash && link.hash === '#overview')) renderView(true);
});
window.addEventListener('hashchange', () => renderView(true));
mobile.addEventListener('change', () => closeDrawer());
window.addEventListener('focus', () => { if (!document.hidden) checkSession(); });
window.addEventListener('pageshow', event => { if (event.persisted) checkSession(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSession(); });
document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) { menu.open = false; $('account-summary').focus(); }
    if (!document.body.classList.contains('drawer-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); }
    if (event.key !== 'Tab') return;
    const controls = [...sidebar.querySelectorAll('a[href], button')].filter(node => node.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
closeDrawer(false);
checkSession();
