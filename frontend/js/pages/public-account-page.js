import { getSession } from '../api/auth.js';
import { authMessage } from '../components/auth-dialog.js';
import { setupAccountSidebar } from '../components/customer-account-sidebar.js';

setupAccountSidebar();
const $ = id => document.getElementById(id);
let version = 0;
function render(user) {
    version++;
    $('account-page-state').textContent = user ? 'Chức năng xem đơn hàng đang được hoàn thiện.' : 'Đăng nhập để xem đơn hàng của bạn.';
    $('account-page-login').hidden = Boolean(user); $('account-page-retry').hidden = true;
}
async function load() {
    const attempt = ++version;
    try { const data = await getSession(); if (attempt === version) render(data.user); }
    catch (error) { if (attempt !== version) return; if (['UNAUTHENTICATED', 'ACCOUNT_LOCKED', 'FORBIDDEN'].includes(error.code)) render(null); else { $('account-page-state').textContent = authMessage(error); $('account-page-retry').hidden = false; } }
}
$('account-page-login').addEventListener('click', () => $('login-button').click());
$('account-page-retry').addEventListener('click', load);
window.addEventListener('auth-changed', event => render(event.detail?.user));
window.addEventListener('pagehide', () => version++);
window.addEventListener('pageshow', event => { if (event.persisted) load(); });
load();
