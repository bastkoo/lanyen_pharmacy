import { getSession, logoutSession } from "../api/auth.js";
import { setupAuthDialog, authMessage } from "../components/auth-dialog.js";
import { notify } from '../components/customer-notice.js';

const $ = id => document.getElementById(id);
let checking = false;
function renderUser(user) {
    // Some public pages only have the header account controls, without a profile section.
    if ($("guest-content")) $("guest-content").hidden = Boolean(user);
    if ($("member-content")) $("member-content").hidden = !user;
    $("login-button").hidden = Boolean(user);
    $("logout-button").hidden = !user;
    $("header-status").textContent = user ? `Xin chào, ${user.HoTen}` : "Bạn chưa đăng nhập";
    if ($("account-title")) $("account-title").textContent = user ? "Thông tin tài khoản" : "Rất vui được đón bạn";
    if ($("account-name")) $("account-name").textContent = user?.HoTen || "";
    if ($("account-phone")) $("account-phone").textContent = user?.SDT || "";
    if ($("account-role")) $("account-role").textContent = user ? ({ 0: "Người mua", 1: "Nhân viên", 2: "Quản lý" }[user.VaiTro] || "") : "";
    window.dispatchEvent(new Event('auth-changed'));
}
const openAuth = setupAuthDialog((user, warning) => {
    if (warning) { $("page-status").textContent = warning; notify(warning, 'error'); return; }
    renderUser(user);
    $("page-status").textContent = "Đăng nhập thành công. Chào mừng bạn đến với Lan Yến.";
    notify('Đăng nhập thành công. Chào mừng bạn đến với Lan Yến.');
    $("retry-session").hidden = true;
    $("main").focus();
}, { notice: notify });
for (const id of ["login-button", "start-login"]) $(id)?.addEventListener("click", event => openAuth(event.currentTarget));

async function refreshSession(manual = false) {
    if (checking || $("auth-dialog").open) return;
    checking = true;
    if ($("refresh-account")) $("refresh-account").disabled = true;
    $("retry-session").disabled = true;
    try {
        const data = await getSession();
        renderUser(data.user);
        $("page-status").textContent = "Phiên đăng nhập đang hoạt động.";
        $("retry-session").hidden = true;
        if (manual) notify('Đã kiểm tra phiên đăng nhập.');
    } catch (error) {
        if (["UNAUTHENTICATED", "ACCOUNT_LOCKED", "FORBIDDEN"].includes(error.code)) renderUser(null);
        else $("header-status").textContent = "Chưa thể kiểm tra phiên";
        $("page-status").textContent = error.code === "UNAUTHENTICATED" ? "Bạn có thể đăng nhập bằng số điện thoại để tiếp tục." : authMessage(error);
        $("retry-session").hidden = error.code === "UNAUTHENTICATED";
        if (manual) notify($("page-status").textContent, error.code === 'UNAUTHENTICATED' ? 'info' : 'error');
    } finally {
        checking = false;
        if ($("refresh-account")) $("refresh-account").disabled = false;
        $("retry-session").disabled = false;
    }
}
$("logout-button").addEventListener("click", async () => {
    $("logout-button").disabled = true;
    try {
        await logoutSession();
        renderUser(null);
        $("page-status").textContent = "Bạn đã đăng xuất.";
        notify('Đăng xuất thành công.');
        $("login-button").focus();
    } catch (error) { $("page-status").textContent = authMessage(error); notify($("page-status").textContent, 'error'); }
    finally { $("logout-button").disabled = false; }
});
$("refresh-account")?.addEventListener("click", () => refreshSession(true));
$("retry-session").addEventListener("click", () => refreshSession(true));
window.addEventListener("focus", () => refreshSession());
refreshSession();
