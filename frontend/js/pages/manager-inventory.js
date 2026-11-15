import { getInventorySummary, getLowStock, getExpiry } from '../api/inventory.js';
import { ApiError } from '../api/auth.js';
import { formatBatchDate, dateValue, expiryText, stockError } from '../utils/batch-validation.js';
import { stockNode as n, setupStockTable } from '../components/stock-table.js';

export function setupInventory({ root, onAccessError, onOpenBatches }) {
    const $ = id => document.getElementById(id);
    let active = false, status = 'expiring', days = 30;
    const sections = new Map();
    const number = value => { if (!Number.isSafeInteger(value)) throw new ApiError('INVALID_RESPONSE'); return new Intl.NumberFormat('vi-VN').format(value); };
    function actionCell(item) {
        if (!Number.isInteger(item.MaThuoc) || item.MaThuoc <= 0 || typeof item.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
        const td = n('td'), button = n('button', 'Quản lý lô', 'categories-action'); button.type = 'button'; button.dataset.stockProduct = item.MaThuoc;
        button.setAttribute('aria-label', `Quản lý lô của ${item.TenThuoc}`); td.append(button); return td;
    }
    const summaryRow = item => {
        if (typeof item.TonKhoThap !== 'boolean') throw new ApiError('INVALID_RESPONSE');
        const tr = n('tr'), name = n('th', `${item.TenThuoc} · #${item.MaThuoc}`); name.scope = 'row';
        const state = n('span', item.TonKhoThap ? 'Chạm / dưới ngưỡng' : 'Trên ngưỡng', `manager-badge${item.TonKhoThap ? ' manager-badge--warning' : ''}`), td = n('td'); td.append(state);
        tr.append(name, n('td', number(item.TongSoLuongTon), 'stock-number'), n('td', number(item.NguongTonKho), 'stock-number'), td, actionCell(item)); return tr;
    };
    summaryRow.search = item => item.TenThuoc;
    const expiryRow = item => {
        const data = sections.get('expiry').data;
        if (!['EXPIRING', 'EXPIRED'].includes(item.TrangThaiHan) || item.TrangThaiHan !== (data.status === 'expired' ? 'EXPIRED' : 'EXPIRING') || dateValue(item.HanSuDung) === null || typeof item.SoLoSanXuat !== 'string' || !Number.isInteger(item.MaLo)) throw new ApiError('INVALID_RESPONSE');
        const tr = n('tr'), name = n('th', item.TenThuoc); name.scope = 'row';
        tr.append(name, n('td', `${item.SoLoSanXuat} · #${item.MaLo}`), n('td', formatBatchDate(item.HanSuDung), 'stock-date'), n('td', number(item.SoLuongTon), 'stock-number'), n('td', item.TrangThaiHan === 'EXPIRED' ? 'Đã hết hạn' : 'Sắp hết hạn'), n('td', expiryText(item.HanSuDung, data.as_of)), actionCell(item)); return tr;
    };
    expiryRow.search = item => `${item.TenThuoc} ${item.SoLoSanXuat}`;
    const stockColumns = [['Thuốc'], ['Tổng SL tồn', true], ['Ngưỡng tồn', true], ['Trạng thái tồn'], ['Thao tác']];
    for (const [key, title, description, columns, renderRow, api, code] of [
        ['summary', 'Tổng hợp tồn theo thuốc', 'Tất cả thuốc, bao gồm thuốc chưa có lô. Tồn vật lý gồm cả lô đã hết hạn.', stockColumns, summaryRow, getInventorySummary, 'INVENTORY_SUMMARY'],
        ['low', 'Thuốc tồn kho thấp', 'Tổng tồn nhỏ hơn hoặc bằng ngưỡng của thuốc, theo kết quả Backend.', stockColumns, summaryRow, getLowStock, 'LOW_STOCK_LISTED'],
        ['expiry', 'Các lô cần theo dõi hạn', 'Chỉ lô còn số lượng tồn. Số ngày được tính từ mốc as_of của Backend.', [['Thuốc'], ['Số lô'], ['Hạn sử dụng'], ['SL tồn', true], ['Trạng thái hạn'], ['Thời gian còn lại'], ['Thao tác']], expiryRow, getExpiry, null]
    ]) {
        const table = setupStockTable({ root: $(`inventory-${key}`), id: `inventory-${key}`, title, description, columns, filterLabel: key === 'expiry' ? 'Lọc tên thuốc / số lô trong trang này' : 'Lọc tên thuốc trong trang này', onLoad: page => load(key, page), renderRow });
        sections.set(key, { table, api, code, page: 1, version: 0, controller: undefined, data: undefined });
    }
    async function load(key, page = sections.get(key).page) {
        if (!active) return;
        const section = sections.get(key); section.controller?.abort(); section.controller = new AbortController();
        const attempt = ++section.version; section.page = page; section.data = undefined; section.table.loading();
        if (key === 'expiry') $('inventory-as-of').textContent = '';
        try {
            const query = { page, per_page: 20, ...(key === 'expiry' ? { days, status } : {}) };
            const data = await section.api(query, { signal: section.controller.signal });
            if (!active || attempt !== section.version) return;
            const expected = section.code || (status === 'expired' ? 'EXPIRED_BATCHES_LISTED' : 'EXPIRING_BATCHES_LISTED');
            if (data.code !== expected || !Array.isArray(data.items)) throw new ApiError('INVALID_RESPONSE');
            if (key === 'expiry' && (dateValue(data.as_of) === null || data.status !== status || data.days !== days)) throw new ApiError('INVALID_RESPONSE');
            if (!data.items.length && page > 1) return load(key, Math.max(1, data.pages));
            section.data = data; section.table.render(data);
            if (key === 'expiry') $('inventory-as-of').textContent = `Mốc ngày Backend (UTC+7): ${formatBatchDate(data.as_of)} · ${status === 'expired' ? 'Tất cả lô đã hết hạn còn tồn; không giới hạn số ngày' : `Trong ${days} ngày, gồm hôm nay và ngày cuối`}`;
        } catch (error) {
            if (!active || attempt !== section.version || error.code === 'REQUEST_ABORTED') return;
            if (['UNAUTHENTICATED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) onAccessError(error);
            else section.table.error(stockError(error));
        }
    }
    $('inventory-expiry-status').addEventListener('change', () => { $('inventory-expiry-days').disabled = $('inventory-expiry-status').value === 'expired'; });
    $('inventory-expiry-form').addEventListener('submit', event => {
        event.preventDefault(); const value = $('inventory-expiry-days').value;
        const expired = $('inventory-expiry-status').value === 'expired';
        $('inventory-expiry-error').textContent = !expired && (!/^\d+$/.test(value) || Number(value) > 36500) ? 'Khoảng theo dõi phải là số nguyên từ 0 đến 36500 ngày.' : '';
        if ($('inventory-expiry-error').textContent) { $('inventory-expiry-days').focus(); return; }
        status = expired ? 'expired' : 'expiring'; if (!expired) days = Number(value);
        load('expiry', 1);
    });
    root.addEventListener('click', event => {
        const button = event.target.closest('[data-stock-product]');
        if (button && active) onOpenBatches(Number(button.dataset.stockProduct));
        const jump = event.target.closest('[data-inventory-jump]');
        if (jump) { const heading = $(`inventory-${jump.dataset.inventoryJump}-title`); heading.tabIndex = -1; heading.focus(); heading.scrollIntoView({ block: 'start', behavior: 'instant' }); }
    });
    function deactivate() { active = false; for (const section of sections.values()) { section.version++; section.controller?.abort(); } }
    return {
        activate() { if (active) return; active = true; for (const key of sections.keys()) load(key); },
        deactivate,
        clear() {
            deactivate(); status = 'expiring'; days = 30; $('inventory-expiry-form').reset(); $('inventory-expiry-days').disabled = false;
            $('inventory-expiry-error').textContent = ''; $('inventory-as-of').textContent = '';
            for (const section of sections.values()) { section.data = undefined; section.page = 1; section.table.clear(); }
        }
    };
}
