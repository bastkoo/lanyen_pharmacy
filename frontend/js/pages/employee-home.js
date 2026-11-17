import { getSession } from '../api/auth.js';
import { authMessage } from '../components/auth-dialog.js';

const $ = id => document.getElementById(id);
let version = 0;
function render(user) {
    version++;
    const allowed = user?.VaiTro === 1;
    $('employee-placeholder').hidden = !allowed;
    $('employee-state').textContent = allowed ? `Xin chào, ${user.HoTen}.` : user ? 'Tài khoản này không thuộc vai trò nhân viên.' : 'Vui lòng đăng nhập bằng tài khoản nhân viên.';
}
async function load() {
    const attempt = ++version;
    try { const data = await getSession(); if (attempt === version) render(data.user); }
    catch (error) { if (attempt !== version) return; $('employee-placeholder').hidden = true; $('employee-state').textContent = authMessage(error); }
}
$('employee-retry').addEventListener('click', load);
window.addEventListener('auth-changed', event => render(event.detail?.user));
window.addEventListener('pagehide', () => version++);
window.addEventListener('pageshow', event => { if (event.persisted) load(); });
load();
