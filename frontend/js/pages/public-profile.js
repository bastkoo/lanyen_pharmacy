import { getSession, updateProfile, uploadAvatar } from '../api/auth.js';
import { authMessage } from '../components/auth-dialog.js';
import { renderAvatar } from '../components/customer-account.js';
import { notify } from '../components/customer-notice.js';
import { validateImageFile, productErrorMessage } from '../utils/product-validation.js';
import { setupAccountSidebar } from '../components/customer-account-sidebar.js';

setupAccountSidebar();

const $ = id => document.getElementById(id);
let user, avatar = null, dirty = false, busy = false, version = 0, disposed = false;
const fields = ['profile-name', 'profile-image', 'profile-remove-image', 'profile-save'];
const message = error => error.code?.startsWith('IMAGE_') || error.code?.startsWith('CLOUDINARY_') || error.code === 'INVALID_CLOUDINARY_URL'
    ? productErrorMessage(error) : error.code === 'INVALID_REQUEST' ? 'Thông tin chưa hợp lệ. Kiểm tra họ tên và ảnh đại diện.' : error.code === 'SESSION_CHANGED' ? 'Tài khoản đăng nhập đã thay đổi. Vui lòng kiểm tra lại thông tin.' : authMessage(error);
function refreshOwner(error) { if (['SESSION_CHANGED', 'UNAUTHENTICATED', 'ACCOUNT_LOCKED'].includes(error.code)) window.dispatchEvent(new Event('focus')); }
function lock(value) { busy = value; for (const id of fields) $(id).disabled = value; $('profile-form').setAttribute('aria-busy', String(value)); }
function preview() { renderAvatar($('profile-avatar'), { HoTen: $('profile-name').value || user?.HoTen, AnhDaiDien: avatar }); $('profile-remove-image').hidden = !avatar; }
function receive(next) {
    version++;
    if (!next) {
        user = null; dirty = false; avatar = null; $('profile-name').value = ''; $('profile-phone').value = ''; $('profile-image').value = '';
        $('profile-avatar').replaceChildren(); $('profile-form').hidden = true; $('profile-login').hidden = false; $('profile-state').textContent = 'Đăng nhập để xem và cập nhật thông tin cá nhân.'; return;
    }
    if (user && String(user.MaNguoiDung) === String(next.MaNguoiDung) && (dirty || busy)) return;
    user = next; avatar = next.AnhDaiDien || null; dirty = false;
    $('profile-name').value = next.HoTen; $('profile-phone').value = next.SDT; $('profile-form').hidden = false; $('profile-login').hidden = true; $('profile-state').textContent = ''; $('profile-retry').hidden = true; preview();
}
async function load() {
    const attempt = ++version;
    try { const data = await getSession(); if (!disposed && attempt === version) receive(data.user); }
    catch (error) {
        if (disposed || attempt !== version) return;
        if (['UNAUTHENTICATED', 'ACCOUNT_LOCKED', 'FORBIDDEN'].includes(error.code)) receive(null);
        else { $('profile-state').textContent = authMessage(error); $('profile-retry').hidden = false; }
    }
}
$('profile-name').addEventListener('input', () => { dirty = true; $('profile-name').removeAttribute('aria-invalid'); $('profile-name-error').textContent = ''; preview(); });
$('profile-remove-image').addEventListener('click', () => { avatar = null; dirty = true; $('profile-image').value = ''; $('profile-image-error').textContent = ''; preview(); });
$('profile-image').addEventListener('change', async () => {
    const file = $('profile-image').files[0]; if (!file || busy || !user) return;
    const warning = validateImageFile(file);
    if (warning) { $('profile-image-error').textContent = warning; notify(warning, 'error'); $('profile-image').value = ''; return; }
    const owner = String(user.MaNguoiDung); lock(true); $('profile-image-error').textContent = 'Đang tải ảnh lên…';
    try {
        const data = await uploadAvatar(file, owner);
        if (disposed || !user || owner !== String(user.MaNguoiDung)) return;
        if (data.code !== 'UPLOAD_SUCCESS' || typeof data.data?.url !== 'string') throw { code: 'INVALID_RESPONSE' };
        avatar = data.data.url; dirty = true; preview(); $('profile-image-error').textContent = ''; notify('Đã tải ảnh lên. Lưu thay đổi để cập nhật ảnh đại diện.');
    } catch (error) { if (!disposed) { $('profile-image-error').textContent = message(error); notify(message(error), 'error'); refreshOwner(error); } }
    finally { if (!disposed) { lock(false); $('profile-image').value = ''; } }
});
$('profile-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !user) return;
    const name = $('profile-name').value.trim();
    if (!name || [...name].length > 255 || /[\u0000-\u001f]/u.test(name)) {
        const warning = 'Nhập họ tên từ 1 đến 255 ký tự hợp lệ.';
        $('profile-name-error').textContent = warning; $('profile-name').setAttribute('aria-invalid', 'true'); $('profile-name').focus(); notify(warning, 'error'); return;
    }
    const owner = String(user.MaNguoiDung); lock(true); $('profile-save-state').textContent = 'Đang lưu…';
    try {
        const data = await updateProfile({ HoTen: name, AnhDaiDien: avatar }, owner);
        if (disposed || !user || owner !== String(user.MaNguoiDung)) return;
        if (data.code !== 'PROFILE_UPDATED' || !data.user) throw { code: 'INVALID_RESPONSE' };
        dirty = false; lock(false); receive(data.user); window.dispatchEvent(new CustomEvent('profile-updated', { detail: { user: data.user } }));
        $('profile-save-state').textContent = 'Đã lưu thông tin cá nhân.'; notify('Đã cập nhật thông tin cá nhân.');
    } catch (error) { if (!disposed) { $('profile-save-state').textContent = message(error); notify(message(error), 'error'); refreshOwner(error); } }
    finally { if (!disposed) lock(false); }
});
$('profile-login').addEventListener('click', () => $('login-button').click());
$('profile-retry').addEventListener('click', load);
window.addEventListener('auth-changed', event => receive(event.detail?.user || null));
window.addEventListener('pagehide', () => { disposed = true; version++; });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; lock(false); load(); } });
load();
