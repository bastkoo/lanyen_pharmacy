import { getAccount, createAccount, updateAccount, setAccountStatus } from '../api/accounts.js';
import { accountId } from '../utils/json-integers.js';
import { accountInitials } from '../utils/manager-view.js';
import { validHttps } from '../utils/product-validation.js';
import { ACCOUNT_FIELDS, accountRole, validateAccount, accountError } from '../utils/account-validation.js';
import { stockNode as n } from './stock-table.js';

export function normalizeAccount(value) {
    if (!value || ![1, 2].includes(value.VaiTro) || typeof value.TrangThai !== 'boolean' || typeof value.HoTen !== 'string' || typeof value.SDT !== 'string' || ![null, 'string'].includes(value.Email === null ? null : typeof value.Email) || ![null, 'string'].includes(value.AnhDaiDien === null ? null : typeof value.AnhDaiDien)) throw new Error('INVALID_RESPONSE');
    return { ...value, MaNguoiDung: accountId(value.MaNguoiDung) };
}
export function renderAccountAvatar(account) {
    const avatar = n('span', accountInitials(account.HoTen), 'accounts-avatar'); avatar.setAttribute('aria-hidden', 'true');
    if (validHttps(account.AnhDaiDien)) { const image = n('img'); image.alt = ''; image.referrerPolicy = 'no-referrer'; image.loading = 'lazy'; image.src = account.AnhDaiDien; image.addEventListener('error', () => image.remove()); avatar.append(image); }
    return avatar;
}
export function setupAccountDialog({ isActive, getActorId, onAccessError, onSaved, onSelfUpdated }) {
    const $ = id => document.getElementById(id), dialog = $('account-dialog');
    let version = 0, controller, current, targetId, opener, mode, ready = false, busy = false, desiredStatus;
    const self = id => accountId(getActorId()) === accountId(id);
    for (const [name, label, type] of ACCOUNT_FIELDS) {
        const wrap = n('div'), caption = n('label', `${label}${['Email', 'AnhDaiDien'].includes(name) ? ' (không bắt buộc)' : ' *'}`), input = n(type === 'select' ? 'select' : 'input', undefined, 'categories-input'), error = n('p', '', 'category-dialog__error');
        input.id = `account-${name}`; input.name = name; caption.htmlFor = input.id;
        if (type === 'select') { for (const role of [1, 2]) { const option = n('option', accountRole(role)); option.value = role; input.append(option); } }
        else { input.type = type; input.autocomplete = name === 'HoTen' ? 'name' : name === 'SDT' ? 'tel' : name === 'Email' ? 'email' : 'off'; }
        input.required = !['Email', 'AnhDaiDien'].includes(name); error.id = `${input.id}-error`; error.setAttribute('role', 'status'); input.setAttribute('aria-describedby', error.id);
        input.addEventListener('input', () => { error.textContent = ''; input.removeAttribute('aria-invalid'); }); wrap.append(caption, input, error); $('account-fields').append(wrap);
    }
    function access(error) { if (['UNAUTHENTICATED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) { onAccessError(error); return true; } return false; }
    function clearErrors() { $('account-dialog-error').textContent = ''; for (const [name] of ACCOUNT_FIELDS) { $(`account-${name}-error`).textContent = ''; $(`account-${name}`).removeAttribute('aria-invalid'); } }
    function roleChange() { $('account-role-change').textContent = current && mode === 'edit' ? `Vai trò hiện tại: ${accountRole(current.VaiTro)} → Vai trò sau khi lưu: ${accountRole(Number($('account-VaiTro').value))}${self(current.MaNguoiDung) ? '. Bạn không thể tự hạ quyền.' : '.'}` : ''; }
    function setBusy(value) {
        busy = value; dialog.setAttribute('aria-busy', String(value)); for (const element of dialog.querySelectorAll('button,input,select')) element.disabled = value;
        $('account-dialog-save').disabled = value || !ready; $('account-confirm-submit').disabled = value || !ready;
        $('account-dialog-save').textContent = value ? 'Đang lưu…' : 'Lưu tài khoản';
        $('account-confirm-submit').textContent = value ? 'Đang xử lý…' : desiredStatus ? 'Khóa tài khoản' : 'Mở khóa tài khoản';
        if (current && mode === 'edit') $('account-VaiTro').querySelector('option[value="1"]').disabled = self(current.MaNguoiDung);
        if (current) $('account-detail-status').disabled = value || self(current.MaNguoiDung);
    }
    function renderDetail(account) {
        const target = $('account-detail'); target.replaceChildren();
        const identity = n('div', undefined, 'accounts-detail-identity'); identity.append(renderAccountAvatar(account), n('strong', account.HoTen)); target.append(identity);
        const dl = n('dl');
        for (const [label, value] of [['Mã người dùng', account.MaNguoiDung], ['Họ tên', account.HoTen], ['Số điện thoại', account.SDT], ['Email', account.Email || 'Chưa có'], ['Ảnh đại diện', account.AnhDaiDien || 'Chưa có'], ['Vai trò', accountRole(account.VaiTro)], ['Trạng thái', account.TrangThai ? 'Đã khóa' : 'Đang hoạt động']]) dl.append(n('dt', label), n('dd', value));
        target.append(dl); $('account-detail-status').textContent = account.TrangThai ? 'Mở khóa tài khoản' : 'Khóa tài khoản'; $('account-detail-status').title = self(account.MaNguoiDung) ? 'Không thể tự khóa tài khoản đang đăng nhập.' : '';
    }
    async function open(action, id, source) {
        if (!isActive() || busy) return;
        controller?.abort(); controller = new AbortController(); const attempt = ++version;
        mode = action; targetId = id === undefined ? undefined : accountId(id); current = undefined; ready = action === 'create';
        if (source && !dialog.contains(source)) opener = source;
        $('account-form').reset(); clearErrors(); $('account-detail').replaceChildren(); $('account-confirm-name').textContent = ''; $('account-confirm-description').textContent = ''; $('account-role-change').textContent = '';
        $('account-dialog-title').textContent = ({ create: 'Tạo tài khoản nội bộ', edit: 'Chỉnh sửa tài khoản', view: 'Chi tiết tài khoản', status: 'Thay đổi trạng thái tài khoản' })[action];
        $('account-dialog-context').textContent = action === 'create' ? 'Tạo tài khoản nhân viên hoặc quản lý đang hoạt động.' : 'Thông tin hiện tại được tải từ hệ thống.';
        $('account-dialog-loading').textContent = ready ? '' : 'Đang tải thông tin tài khoản…'; $('account-form').hidden = !ready; $('account-detail').hidden = true; $('account-detail-actions').hidden = true; $('account-confirm').hidden = true;
        $('account-VaiTro').querySelector('option[value="1"]').disabled = false;
        setBusy(false); if (!dialog.open) dialog.showModal(); document.body.classList.add('category-modal-open');
        if (ready) { $('account-HoTen').focus(); return; }
        try {
            const data = await getAccount(targetId, { signal: controller.signal });
            if (!isActive() || attempt !== version || !dialog.open) return;
            if (data.code !== 'ACCOUNT_FOUND') throw new Error('INVALID_RESPONSE'); current = normalizeAccount(data.account); if (current.MaNguoiDung !== targetId) throw new Error('INVALID_RESPONSE');
            $('account-dialog-context').textContent = `${current.HoTen} · #${targetId}${self(targetId) ? ' · Tài khoản của bạn' : ''}`;
            $('account-dialog-loading').textContent = ''; ready = true;
            if (action === 'view') { renderDetail(current); $('account-detail').hidden = false; $('account-detail-actions').hidden = false; }
            if (action === 'edit') { for (const [name] of ACCOUNT_FIELDS) $(`account-${name}`).value = current[name] ?? ''; $('account-form').hidden = false; roleChange(); }
            if (action === 'status') {
                if (self(targetId)) { ready = false; $('account-dialog-error').textContent = 'Không thể thay đổi trạng thái tài khoản đang đăng nhập tại đây.'; }
                else { desiredStatus = !current.TrangThai; $('account-dialog-title').textContent = desiredStatus ? 'Khóa tài khoản' : 'Mở khóa tài khoản'; $('account-confirm-name').textContent = `${current.HoTen} · ${accountRole(current.VaiTro)} · ${current.SDT}`; $('account-confirm-description').textContent = desiredStatus ? 'Sau khi khóa, tài khoản không thể sử dụng các API cần đăng nhập, kể cả với phiên đã đăng nhập trước đó.' : 'Mở khóa để tài khoản có thể đăng nhập bằng số điện thoại và OTP trở lại.'; $('account-confirm').hidden = false; }
            }
            setBusy(false); (action === 'edit' ? $('account-HoTen') : $('account-dialog-close')).focus();
        } catch (error) { if (isActive() && attempt === version && error.code !== 'REQUEST_ABORTED' && !access(error)) { $('account-dialog-loading').textContent = ''; $('account-dialog-error').textContent = accountError(error); } }
    }
    function close() { version++; controller?.abort(); ready = false; busy = false; if (dialog.open) dialog.close(); document.body.classList.remove('category-modal-open'); }
    async function save(statusOnly = false) {
        if (!isActive() || busy || !ready) return;
        clearErrors(); const values = Object.fromEntries(ACCOUNT_FIELDS.map(([name]) => [name, $(`account-${name}`).value]));
        const { data, errors } = validateAccount(values);
        if (!statusOnly && mode === 'edit' && self(targetId) && data.VaiTro !== 2) errors.VaiTro = 'Không thể tự hạ quyền tài khoản đang đăng nhập.';
        if (!statusOnly && Object.keys(errors).length) { for (const [name, text] of Object.entries(errors)) { $(`account-${name}-error`).textContent = text; $(`account-${name}`).setAttribute('aria-invalid', 'true'); } $(`account-${Object.keys(errors)[0]}`).focus(); return; }
        if (statusOnly && self(targetId)) return;
        const attempt = version, action = mode, id = targetId; setBusy(true);
        try {
            const result = statusOnly ? await setAccountStatus(id, desiredStatus) : action === 'create' ? await createAccount(data) : await updateAccount(id, data);
            if (!isActive() || attempt !== version) return;
            const expected = statusOnly ? 'ACCOUNT_STATUS_UPDATED' : action === 'create' ? 'ACCOUNT_CREATED' : 'ACCOUNT_UPDATED'; if (result.code !== expected) throw new Error('INVALID_RESPONSE');
            const saved = normalizeAccount(result.account); if (action !== 'create' && saved.MaNguoiDung !== id) throw new Error('INVALID_RESPONSE');
            const own = self(saved.MaNguoiDung); close(); onSaved(statusOnly ? `Đã ${saved.TrangThai ? 'khóa' : 'mở khóa'} tài khoản “${saved.HoTen}”.` : `Đã ${action === 'create' ? 'tạo' : 'cập nhật'} tài khoản “${saved.HoTen}”.`); if (own) onSelfUpdated();
        } catch (error) {
            if (!isActive() || attempt !== version) return;
            if (!access(error)) {
                $('account-dialog-error').textContent = accountError(error);
                if (error.code === 'ACCOUNT_PHONE_EXISTS') { $('account-SDT-error').textContent = accountError(error); $('account-SDT').setAttribute('aria-invalid', 'true'); }
                if (['ACCOUNT_NOT_FOUND', 'LAST_ACTIVE_MANAGER', 'CANNOT_LOCK_SELF', 'CANNOT_DEMOTE_SELF'].includes(error.code)) ready = false;
                $('account-dialog-error').focus();
            }
        } finally { if (attempt === version) setBusy(false); }
    }
    $('account-form').addEventListener('submit', event => { event.preventDefault(); save(); }); $('account-confirm-submit').addEventListener('click', () => save(true));
    $('account-VaiTro').addEventListener('change', roleChange); $('account-detail-edit').addEventListener('click', event => open('edit', targetId, event.currentTarget)); $('account-detail-status').addEventListener('click', event => open('status', targetId, event.currentTarget));
    for (const id of ['account-dialog-close', 'account-dialog-cancel']) $(id).addEventListener('click', () => { if (!busy) close(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); }); document.addEventListener('keydown', event => { if (dialog.open && busy && event.key === 'Escape') event.preventDefault(); });
    dialog.addEventListener('close', () => { if (dialog.open) return; version++; controller?.abort(); busy = false; ready = false; document.body.classList.remove('category-modal-open'); if (isActive()) (opener?.isConnected && opener.getClientRects().length ? opener : $('accounts-list-title')).focus(); });
    return { open, close, clear() { close(); current = undefined; targetId = undefined; opener = undefined; $('account-form').reset(); $('account-detail').replaceChildren(); clearErrors(); for (const id of ['account-dialog-context', 'account-dialog-loading', 'account-confirm-name', 'account-confirm-description', 'account-role-change']) $(id).textContent = ''; } };
}
