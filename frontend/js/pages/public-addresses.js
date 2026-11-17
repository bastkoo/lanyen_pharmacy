import { getSession, getAddresses, createAddress, updateAddress, deleteAddress, makePrimaryAddress } from '../api/auth.js';
import { authMessage } from '../components/auth-dialog.js';
import { setupAccountSidebar } from '../components/customer-account-sidebar.js';
import { notify } from '../components/customer-notice.js';
import { setupVietnamAddressPicker } from '../components/vietnam-address-picker.js';

setupAccountSidebar();
const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result; };
const fields = [['TinhThanh', 'address-province'], ['PhuongXa', 'address-ward'], ['DiaChiCuThe', 'address-street']];
const errorText = error => ({ ADDRESS_NOT_FOUND: 'Địa chỉ không còn tồn tại hoặc không thuộc tài khoản của bạn. Hãy tải lại danh sách.', ADDRESS_IN_USE: 'Địa chỉ đang được sử dụng và chưa thể xóa.', INVALID_REQUEST: 'Nhập đầy đủ tỉnh/thành phố, phường/xã và địa chỉ cụ thể, mỗi mục tối đa 255 ký tự.', DATABASE_UNAVAILABLE: 'Chưa thể cập nhật địa chỉ. Dữ liệu nhập được giữ lại, vui lòng thử lại.', SESSION_CHANGED: 'Tài khoản đăng nhập đã thay đổi. Vui lòng kiểm tra lại thông tin.' }[error.code] || authMessage(error));
let user, rows = [], busy = false, version = 0, disposed = false, editingId = null, deletingId = null, opener;
const locations = setupVietnamAddressPicker({ province: $('address-province'), ward: $('address-ward'), status: $('address-location-state'), retry: $('address-location-retry'), changed: () => { $('address-save').disabled = busy || !locations.canSubmit(); } });
const owner = () => user ? String(user.MaNguoiDung) : null;
const description = row => `${row.DiaChiCuThe}, ${row.PhuongXa}, ${row.TinhThanh}`;
function button(text, action) { const result = node('button', text, 'quiet-link'); result.type = 'button'; result.disabled = busy; result.dataset.addressAction = ''; result.addEventListener('click', () => action(result)); return result; }
function renderRows() {
    $('address-list').replaceChildren();
    for (const row of rows) {
        const item = node('li', undefined, 'address-item'); item.dataset.addressId = String(row.MaDiaChi);
        const heading = node('div', undefined, 'address-item-heading');
        heading.append(node('h2', row.DiaChiCuThe), node('span', row.DiaChiGiao ? 'Địa chỉ chính' : 'Địa chỉ phụ', row.DiaChiGiao ? 'address-badge address-primary' : 'address-badge'));
        const actions = node('div', undefined, 'address-item-actions');
        actions.append(button('Sửa', trigger => openEditor(row, trigger)));
        if (!row.DiaChiGiao) actions.append(button('Đặt làm địa chỉ chính', () => mutate(() => makePrimaryAddress(row.MaDiaChi, owner()), 'ADDRESS_PRIMARY_UPDATED', 'Đã đặt địa chỉ chính.')));
        const remove = button('Xóa', trigger => openDelete(row, trigger)); remove.classList.add('address-delete'); actions.append(remove);
        item.append(heading, node('p', `${row.PhuongXa}, ${row.TinhThanh}`), actions); $('address-list').append(item);
    }
    $('address-add').disabled = busy;
}
function lock(value) {
    busy = value; renderRows();
    for (const id of ['address-street', 'address-close', 'address-cancel', 'address-delete-confirm', 'address-delete-cancel', 'address-location-retry']) $(id).disabled = value;
    locations.setDisabled(value);
    $('address-form').setAttribute('aria-busy', String(value));
}
function restoreFocus() { if (opener?.isConnected) opener.focus({ preventScroll: true }); else if (user) $('address-add').focus({ preventScroll: true }); else $('login-button').focus({ preventScroll: true }); }
function closeDialogs() { for (const id of ['address-dialog', 'address-delete-dialog']) if ($(id).open) $(id).close(); }
function openEditor(row, trigger) {
    if (busy || !user) return;
    opener = trigger; editingId = row?.MaDiaChi ?? null;
    $('address-dialog-title').textContent = row ? 'Sửa địa chỉ' : 'Thêm địa chỉ';
    $('address-default-note').textContent = row ? (row.DiaChiGiao ? 'Địa chỉ này đang là địa chỉ chính.' : 'Địa chỉ này đang là địa chỉ phụ.') : rows.length ? 'Địa chỉ mới sẽ là địa chỉ phụ. Bạn có thể đặt làm địa chỉ chính sau khi lưu.' : 'Địa chỉ đầu tiên sẽ được đặt làm địa chỉ chính.';
    for (const [key, id] of fields) { $(id).value = row?.[key] || ''; $(id).removeAttribute('aria-invalid'); $(`${id}-error`).textContent = ''; }
    $('address-form-state').textContent = ''; $('address-dialog').showModal(); $('address-province').focus();
    locations.open(row);
}
function openDelete(row, trigger) {
    if (busy || !user) return;
    opener = trigger; deletingId = row.MaDiaChi; $('address-delete-state').textContent = '';
    $('address-delete-description').textContent = `${description(row)}.${row.DiaChiGiao && rows.length > 1 ? ' Địa chỉ phụ tạo sớm nhất sẽ trở thành địa chỉ chính.' : ''}`;
    $('address-delete-dialog').showModal(); $('address-delete-cancel').focus();
}
async function load() {
    if (!user || disposed) return;
    const attempt = ++version, account = owner(); $('address-state').textContent = 'Đang tải địa chỉ…'; $('address-retry').hidden = true; $('address-list').setAttribute('aria-busy', 'true');
    try {
        const data = await getAddresses(account);
        if (disposed || attempt !== version || account !== owner()) return;
        if (data.code !== 'ADDRESSES_LISTED' || !Array.isArray(data.items)) throw { code: 'INVALID_RESPONSE' };
        rows = data.items; renderRows(); $('address-state').textContent = rows.length ? '' : 'Bạn chưa có địa chỉ nhận hàng. Thêm địa chỉ đầu tiên để đặt làm địa chỉ chính.';
    } catch (error) {
        if (disposed || attempt !== version || account !== owner()) return;
        $('address-state').textContent = errorText(error); $('address-retry').hidden = false;
        if (['SESSION_CHANGED', 'UNAUTHENTICATED', 'ACCOUNT_LOCKED'].includes(error.code)) window.dispatchEvent(new Event('focus'));
    } finally { if (attempt === version) $('address-list').setAttribute('aria-busy', 'false'); }
}
async function mutate(task, expectedCode, success, dialogState) {
    if (busy || !user) return;
    const account = owner(); lock(true);
    if (dialogState) $(dialogState).textContent = 'Đang lưu…';
    try {
        const data = await task();
        if (disposed || account !== owner()) return;
        if (data.code !== expectedCode) throw { code: 'INVALID_RESPONSE' };
        closeDialogs(); notify(success); await load();
    } catch (error) {
        if (disposed || account !== owner()) return;
        if (dialogState) $(dialogState).textContent = errorText(error); else $('address-state').textContent = errorText(error);
        notify(errorText(error), 'error');
        if (['SESSION_CHANGED', 'UNAUTHENTICATED', 'ACCOUNT_LOCKED'].includes(error.code)) window.dispatchEvent(new Event('focus'));
    } finally { if (!disposed && account === owner()) { lock(false); if (!$('address-dialog').open && !$('address-delete-dialog').open) restoreFocus(); } }
}
function receive(next) {
    const previous = owner(); user = next || null;
    if (previous === owner()) return;
    version++; closeDialogs(); rows = []; lock(false); renderRows(); $('address-retry').hidden = true;
    for (const [, id] of fields) $(id).value = '';
    $('address-add').hidden = !user; $('address-login').hidden = Boolean(user);
    if (user) load(); else $('address-state').textContent = 'Đăng nhập để quản lý địa chỉ nhận hàng của bạn.';
}
$('address-add').addEventListener('click', event => openEditor(null, event.currentTarget));
$('address-login').addEventListener('click', () => $('login-button').click());
$('address-retry').addEventListener('click', () => user ? load() : initialize());
$('address-form').addEventListener('submit', event => {
    event.preventDefault(); if (busy) return;
    if (!locations.canSubmit()) return;
    const values = locations.values(); let firstError;
    for (const [key, id] of fields) {
        const value = (key === 'DiaChiCuThe' ? $(id).value : values[key]).trim();
        const invalid = !value || [...value].length > 255 || /[\u0000-\u001f]/u.test(value);
        $(`${id}-error`).textContent = invalid ? 'Nhập từ 1 đến 255 ký tự hợp lệ.' : ''; $(id).setAttribute('aria-invalid', String(invalid));
        if (invalid) firstError ||= $(id); values[key] = value;
    }
    if (firstError) { firstError.focus(); notify('Kiểm tra các trường địa chỉ được đánh dấu.', 'error'); return; }
    const edit = editingId !== null;
    mutate(() => edit ? updateAddress(editingId, values, owner()) : createAddress(values, owner()), edit ? 'ADDRESS_UPDATED' : 'ADDRESS_CREATED', edit ? 'Đã cập nhật địa chỉ.' : 'Đã thêm địa chỉ nhận hàng.', 'address-form-state');
});
$('address-delete-confirm').addEventListener('click', () => mutate(() => deleteAddress(deletingId, owner()), 'ADDRESS_DELETED', 'Đã xóa địa chỉ nhận hàng.', 'address-delete-state'));
for (const id of ['address-close', 'address-cancel']) $(id).addEventListener('click', () => { if (!busy) $('address-dialog').close(); });
$('address-delete-cancel').addEventListener('click', () => { if (!busy) $('address-delete-dialog').close(); });
for (const id of ['address-dialog', 'address-delete-dialog']) { $(id).addEventListener('cancel', event => { if (busy) event.preventDefault(); }); $(id).addEventListener('close', () => { if (id === 'address-dialog') locations.close(); if (!busy) restoreFocus(); }); }
window.addEventListener('auth-changed', event => receive(event.detail?.user));
window.addEventListener('pagehide', () => { disposed = true; version++; locations.close(); });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; lock(false); initialize(); } });
async function initialize() {
    const attempt = ++version;
    try { const data = await getSession(); if (!disposed && attempt === version) { if (owner() === String(data.user.MaNguoiDung)) load(); else receive(data.user); } }
    catch (error) { if (disposed || attempt !== version) return; if (['UNAUTHENTICATED', 'ACCOUNT_LOCKED', 'FORBIDDEN'].includes(error.code)) { receive(null); $('address-state').textContent = 'Đăng nhập để quản lý địa chỉ nhận hàng của bạn.'; $('address-login').hidden = false; } else { $('address-state').textContent = errorText(error); $('address-retry').hidden = false; } }
}
initialize();
