import { notifyManager } from '../components/manager-state.js';
import { getAccounts } from '../api/accounts.js';
import { setupLiveSearch } from '../utils/live-search.js';
import { accountId } from '../utils/json-integers.js';
import { accountRole, accountError } from '../utils/account-validation.js';
import { setupAccountDialog, normalizeAccount, renderAccountAvatar } from '../components/account-dialog.js';
import { stockNode as n } from '../components/stock-table.js';

export function setupAccounts({ root, getActorId, onAccessError, onSelfUpdated }) {
    const $ = id => document.getElementById(id);
    let active = false, page = 1, filters = { search: '', role: '', status: '' }, listVersion = 0, statsVersion = 0, listController, statsController;
    const cancelSearch = setupLiveSearch({ input: $('accounts-search'), form: $('accounts-filters'), isActive: () => active, filters: [$('accounts-role'), $('accounts-status')] });
    const dialog = setupAccountDialog({ isActive: () => active, getActorId, onAccessError, onSelfUpdated, onSaved: text => { notifyManager(text); loadList(); loadStats(); } });
    function access(error) { if (['UNAUTHENTICATED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) { onAccessError(error); return true; } return false; }
    function state(text, type = 'empty') {
        $('accounts-state-text').textContent = text; $('accounts-state').hidden = type === 'ready'; $('accounts-scroll').hidden = type !== 'ready'; $('accounts-retry').hidden = type !== 'error'; $('accounts-skeleton').hidden = type !== 'loading'; $('accounts-list').setAttribute('aria-busy', String(type === 'loading'));
        if (type !== 'ready') $('accounts-prev').disabled = $('accounts-next').disabled = true;
    }
    async function loadList() {
        if (!active) return; listController?.abort(); listController = new AbortController(); const attempt = ++listVersion;
        $('accounts-body').replaceChildren(); $('accounts-count').textContent = ''; $('accounts-page').textContent = ''; state('Đang tải tài khoản…', 'loading');
        try {
            const data = await getAccounts({ ...filters, page, per_page: 20 }, { signal: listController.signal });
            if (!active || attempt !== listVersion) return;
            if (data.code !== 'ACCOUNTS_LISTED' || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || !Number.isInteger(data.pages) || data.page !== page) throw new Error('INVALID_RESPONSE');
            if (!data.items.length && page > 1) { page = Math.max(1, data.pages); return loadList(); }
            const records = data.items.map(normalizeAccount), actorId = accountId(getActorId());
            for (const [index, account] of records.entries()) {
                const row = n('tr'), name = n('th'), identity = n('div', undefined, 'accounts-identity'), text = n('div'); name.scope = 'row';
                const own = account.MaNguoiDung === actorId;
                text.append(n('strong', account.HoTen));
                if (own) text.append(n('span', 'Bạn', 'product-row-meta'));
                identity.append(renderAccountAvatar(account), text); name.append(identity);
                const role = n('td'), status = n('td'); role.append(n('span', accountRole(account.VaiTro), `manager-badge${account.VaiTro === 2 ? ' manager-badge--success' : ''}`)); status.append(n('span', account.TrangThai ? 'Đã khóa' : 'Đang hoạt động', `manager-badge ${account.TrangThai ? 'manager-badge--warning' : 'manager-badge--success'}`));
                const actions = n('td'), wrap = n('div', undefined, 'accounts-actions');
                for (const [action, label] of [['view', 'Xem'], ['edit', 'Sửa'], ['status', account.TrangThai ? 'Mở khóa' : 'Khóa']]) {
                    const button = n('button', label, `categories-action${action === 'status' && !account.TrangThai ? ' categories-action--delete' : ''}`); button.type = 'button'; button.dataset.accountAction = action; button.dataset.accountId = account.MaNguoiDung; button.setAttribute('aria-label', `${label} tài khoản ${account.HoTen}`);
                    if (action === 'status' && own) { button.disabled = true; button.title = 'Không thể tự khóa tài khoản đang đăng nhập.'; } wrap.append(button);
                }
                actions.append(wrap); row.append(n('td', String((page - 1) * 20 + index + 1)), name, n('td', account.SDT), n('td', account.Email || 'Chưa có'), role, status, actions); $('accounts-body').append(row);
            }
            state(records.length ? '' : 'Không có tài khoản phù hợp. Thử bỏ bộ lọc hoặc tạo tài khoản.', records.length ? 'ready' : 'empty');
            $('accounts-count').textContent = `${data.total} tài khoản theo bộ lọc · Thống kê phía trên luôn là toàn bộ nội bộ`;
            $('accounts-page').textContent = data.pages ? `Trang ${data.page} / ${data.pages}` : ''; $('accounts-prev').disabled = data.page <= 1; $('accounts-next').disabled = data.page >= data.pages;
        } catch (error) { if (active && attempt === listVersion && error.code !== 'REQUEST_ABORTED' && !access(error)) state(accountError(error), 'error'); }
    }
    async function loadStats() {
        if (!active) return; statsController?.abort(); statsController = new AbortController(); const attempt = ++statsVersion;
        const keys = ['total', 'employees', 'managers', 'locked']; for (const key of keys) $(`accounts-stat-${key}`).textContent = '—'; $('accounts-stats-status').textContent = 'Đang tổng hợp toàn bộ tài khoản nội bộ…'; $('accounts-stats-retry').hidden = true;
        try {
            const data = await Promise.all([{}, { role: 1 }, { role: 2 }, { status: 'true' }].map(filter => getAccounts({ ...filter, page: 1, per_page: 1 }, { signal: statsController.signal })));
            if (!active || attempt !== statsVersion) return;
            for (const result of data) if (result.code !== 'ACCOUNTS_LISTED' || !Number.isSafeInteger(result.total) || result.total < 0) throw new Error('INVALID_RESPONSE');
            data.forEach((result, index) => { $(`accounts-stat-${keys[index]}`).textContent = new Intl.NumberFormat('vi-VN').format(result.total); }); $('accounts-stats-status').textContent = 'Số liệu toàn bộ nội bộ, không phụ thuộc trang và bộ lọc danh sách.';
        } catch (error) { if (active && attempt === statsVersion && error.code !== 'REQUEST_ABORTED' && !access(error)) { $('accounts-stats-status').textContent = accountError(error); $('accounts-stats-retry').hidden = false; } }
    }
    $('accounts-filters').addEventListener('submit', event => { event.preventDefault(); const search = $('accounts-search').value.trim(); $('accounts-filter-error').textContent = [...search].length > 255 || search.includes('\0') ? 'Từ khóa tối đa 255 ký tự, không chứa NUL.' : ''; if ($('accounts-filter-error').textContent) { $('accounts-search').focus(); return; } filters = { search, role: $('accounts-role').value, status: $('accounts-status').value }; page = 1; loadList(); });
    $('accounts-reset').addEventListener('click', () => { cancelSearch(); $('accounts-filters').reset(); filters = { search: '', role: '', status: '' }; page = 1; $('accounts-filter-error').textContent = ''; loadList(); });
    $('accounts-prev').addEventListener('click', () => { page--; loadList(); }); $('accounts-next').addEventListener('click', () => { page++; loadList(); });
    $('accounts-retry').addEventListener('click', loadList); $('accounts-stats-retry').addEventListener('click', loadStats); $('accounts-refresh').addEventListener('click', () => { loadList(); loadStats(); });
    $('account-add').addEventListener('click', event => dialog.open('create', undefined, event.currentTarget)); $('accounts-body').addEventListener('click', event => { const button = event.target.closest('[data-account-action]'); if (button && !button.disabled) dialog.open(button.dataset.accountAction, button.dataset.accountId, button); });
    function deactivate() { cancelSearch(); active = false; listVersion++; statsVersion++; listController?.abort(); statsController?.abort(); dialog.close(); }
    return {
        activate() { if (active) return; active = true; loadList(); loadStats(); }, deactivate,
        clear() { deactivate(); dialog.clear(); page = 1; filters = { search: '', role: '', status: '' }; $('accounts-filters').reset(); $('accounts-body').replaceChildren(); for (const id of ['accounts-count', 'accounts-page', 'accounts-feedback', 'accounts-filter-error', 'accounts-stats-status']) $(id).textContent = ''; $('accounts-feedback').hidden = true; for (const key of ['total', 'employees', 'managers', 'locked']) $(`accounts-stat-${key}`).textContent = '—'; state('Đăng nhập để tải tài khoản nội bộ.'); }
    };
}
