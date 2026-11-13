import { getSession, logoutSession } from "../api/auth.js";
import { setupAuthDialog, authMessage } from "../components/auth-dialog.js";

const $ = id => document.getElementById(id);
let checking = false;
function renderUser(user) {
    $("guest-content").hidden = Boolean(user);
    $("member-content").hidden = !user;
    $("login-button").hidden = Boolean(user);
    $("logout-button").hidden = !user;
    $("header-status").textContent = user ? `Xin chào, ${user.HoTen}` : "Bạn chưa đăng nhập";
    $("account-title").textContent = user ? "Thông tin tài khoản" : "Rất vui được đón bạn";
    $("account-name").textContent = user?.HoTen || "";
    $("account-phone").textContent = user?.SDT || "";
    $("account-role").textContent = user ? ({ 0: "Người mua", 1: "Nhân viên", 2: "Quản lý" }[user.VaiTro] || "") : "";
}
const openAuth = setupAuthDialog((user, warning) => {
    if (warning) { $("page-status").textContent = warning; return; }
    renderUser(user);
    $("page-status").textContent = "Đăng nhập thành công. Chào mừng bạn đến với Lan Yến.";
    $("retry-session").hidden = true;
    $("main").focus();
});
for (const id of ["login-button", "start-login"]) $(id).addEventListener("click", event => openAuth(event.currentTarget));

async function refreshSession() {
    if (checking || $("auth-dialog").open) return;
    checking = true;
    $("refresh-account").disabled = true;
    $("retry-session").disabled = true;
    try {
        const data = await getSession();
        renderUser(data.user);
        $("page-status").textContent = "Phiên đăng nhập đang hoạt động.";
        $("retry-session").hidden = true;
    } catch (error) {
        if (["UNAUTHENTICATED", "ACCOUNT_LOCKED", "FORBIDDEN"].includes(error.code)) renderUser(null);
        else $("header-status").textContent = "Chưa thể kiểm tra phiên";
        $("page-status").textContent = error.code === "UNAUTHENTICATED" ? "Bạn có thể đăng nhập bằng số điện thoại để tiếp tục." : authMessage(error);
        $("retry-session").hidden = error.code === "UNAUTHENTICATED";
    } finally {
        checking = false;
        $("refresh-account").disabled = false;
        $("retry-session").disabled = false;
    }
}
$("logout-button").addEventListener("click", async () => {
    $("logout-button").disabled = true;
    try {
        await logoutSession();
        renderUser(null);
        $("page-status").textContent = "Bạn đã đăng xuất.";
        $("login-button").focus();
    } catch (error) { $("page-status").textContent = authMessage(error); }
    finally { $("logout-button").disabled = false; }
});
$("refresh-account").addEventListener("click", refreshSession);
$("retry-session").addEventListener("click", refreshSession);
window.addEventListener("focus", refreshSession);
refreshSession();
