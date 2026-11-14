import { getDashboardSummary, getRecentOrders, getProductCount, getLowStock, getExpiringBatches, getRevenue } from '../api/manager.js';
import { formatCount, formatVnd, formatStoredDate } from '../utils/dashboard-format.js';
import { renderRevenueChart } from '../components/revenue-chart.js';

const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
};
const accessErrors = new Set(['UNAUTHENTICATED', 'ACCOUNT_LOCKED', 'FORBIDDEN']);

export function setupDashboard({ root, onAccessError }) {
    const $ = id => root.querySelector(`#${id}`);
    let active = false, generation = 0, controller;
    const keys = ['summary', 'products', 'revenue', 'orders', 'low-stock', 'expiring'];
    const metrics = { summary: ['kpi-revenue', 'kpi-orders', 'kpi-customers'], products: ['kpi-products'],
        'low-stock': ['kpi-low-stock'], expiring: ['kpi-expiring'], revenue: [], orders: [] };
    const requests = {
        summary: options => getDashboardSummary(Number($('dashboard-days').value), options),
        products: getProductCount,
        revenue: options => getRevenue(Number($('dashboard-days').value), options),
        orders: options => getRecentOrders(Number($('dashboard-days').value), options),
        'low-stock': getLowStock, expiring: getExpiringBatches
    };

    function state(key, type, message = '') {
        const status = root.querySelector(`[data-panel-status="${key}"]`);
        status.hidden = type === 'ready';
        status.dataset.state = type;
        status.querySelector('span').textContent = message;
        status.querySelector('button').hidden = type !== 'error';
        const content = root.querySelector(`[data-panel-content="${key}"]`);
        if (content) content.hidden = type !== 'ready';
        root.querySelector(`[data-dashboard-panel="${key}"]`)?.setAttribute('aria-busy', String(type === 'loading'));
    }

    function renderSummary(data) {
        $('kpi-orders').textContent = formatCount(data.orders);
        $('kpi-customers').textContent = formatCount(data.customers);
        $('kpi-revenue').textContent = formatVnd(data.revenue.amount);
        $('dashboard-period').textContent = `${formatStoredDate(data.period.start_date)} – ${formatStoredDate(data.period.end_date)} · Giờ Việt Nam`;
    }

    function renderOrders(data) {
        if (!Array.isArray(data.items)) throw new Error('INVALID_RESPONSE');
        const body = $('recent-orders-body'); body.replaceChildren();
        for (const order of data.items) {
            const row = el('tr');
            row.append(el('th', `#${order.MaDonHang}`), el('td', formatStoredDate(order.NgayDat, true)), el('td', formatVnd(order.TongThanhToan), 'dashboard-money'));
            row.firstChild.scope = 'row';
            const status = el('td');
            const className = order.TrangThaiDonHang === 3 ? 'manager-badge--success' :
                [0, 5].includes(order.TrangThaiDonHang) ? 'manager-badge--warning' : '';
            status.append(el('span', order.TenTrangThai, `manager-badge ${className}`)); row.append(status); body.append(row);
        }
        state('orders', data.items.length ? 'ready' : 'empty', 'Chưa có đơn hàng trong khoảng thời gian này.');
    }

    function renderAlerts(key, data) {
        if (!Array.isArray(data.items)) throw new Error('INVALID_RESPONSE');
        const count = formatCount(data.total);
        $(key === 'low-stock' ? 'kpi-low-stock' : 'kpi-expiring').textContent = count;
        const list = $(key === 'low-stock' ? 'low-stock-list' : 'expiring-list'); list.replaceChildren();
        for (const item of data.items) {
            const row = el('li'); row.append(el('strong', item.TenThuoc));
            if (key === 'low-stock') {
                row.append(el('span', `Tồn ${formatCount(item.TongSoLuongTon)} · Ngưỡng ${formatCount(item.NguongTonKho)}`));
            } else row.append(el('span', `Lô ${item.SoLoSanXuat} · HSD ${formatStoredDate(item.HanSuDung)}`),
                el('span', `Còn ${formatCount(item.SoLuongTon)} đơn vị nhỏ nhất`, 'dashboard-alert-meta'));
            list.append(row);
        }
        $(key === 'low-stock' ? 'low-stock-caption' : 'expiring-caption').textContent = data.total > data.items.length ?
            `Hiển thị ${formatCount(data.items.length)} trên ${count} ${key === 'low-stock' ? 'thuốc' : 'lô'}.` : '';
        state(key, data.items.length ? 'ready' : 'empty', key === 'low-stock' ?
            'Chưa có thuốc chạm hoặc dưới ngưỡng tồn kho.' : 'Chưa có lô còn tồn sắp hết hạn trong 30 ngày tới.');
    }

    async function loadOne(key, attempt, signal) {
        metrics[key].forEach(id => { $(id).textContent = '—'; });
        if (key === 'low-stock') $('low-stock-caption').textContent = '';
        if (key === 'expiring') $('expiring-caption').textContent = '';
        state(key, 'loading', 'Đang tải dữ liệu…');
        try {
            const data = await requests[key]({ signal });
            if (!active || attempt !== generation) return;
            if (key === 'summary') renderSummary(data);
            else if (key === 'products') $('kpi-products').textContent = formatCount(data.total);
            else if (key === 'orders') { renderOrders(data); return; }
            else if (key === 'low-stock' || key === 'expiring') { renderAlerts(key, data); return; }
            else {
                if (!data.has_data) { state(key, 'empty', 'Chưa ghi nhận doanh thu từ đơn hoàn thành và đã thanh toán trong khoảng này.'); return; }
                renderRevenueChart($('revenue-chart'), data);
            }
            state(key, 'ready');
        } catch (error) {
            if (!active || attempt !== generation || error.code === 'REQUEST_ABORTED') return;
            if (accessErrors.has(error.code)) { onAccessError(error); return; }
            metrics[key].forEach(id => { $(id).textContent = '—'; });
            state(key, 'error', 'Chưa tải được dữ liệu. Bạn có thể thử lại riêng khu vực này.');
        }
    }

    async function load() {
        if (!active) return;
        controller?.abort(); controller = new AbortController();
        $('dashboard-period').textContent = '';
        const attempt = ++generation;
        $('dashboard-refresh').disabled = true;
        $('dashboard-live').textContent = 'Đang cập nhật Dashboard…';
        await Promise.allSettled(keys.map(key => loadOne(key, attempt, controller.signal)));
        if (active && attempt === generation) {
            $('dashboard-refresh').disabled = false;
            $('dashboard-live').textContent = 'Đã hoàn tất kiểm tra các khu vực Dashboard.';
        }
    }

    $('dashboard-days').addEventListener('change', load);
    $('dashboard-refresh').addEventListener('click', load);
    root.addEventListener('click', event => {
        const button = event.target.closest('[data-dashboard-retry]');
        if (button && active) loadOne(button.dataset.dashboardRetry, generation, controller.signal);
    });
    return {
        activate() { if (!active) { active = true; load(); } },
        deactivate() { active = false; generation++; controller?.abort(); },
        clear() {
            active = false; generation++; controller?.abort();
            Object.values(metrics).flat().forEach(id => { $(id).textContent = '—'; });
            for (const id of ['recent-orders-body', 'low-stock-list', 'expiring-list', 'revenue-chart']) $(id).replaceChildren();
            $('dashboard-period').textContent = '';
            $('low-stock-caption').textContent = '';
            $('expiring-caption').textContent = '';
            for (const key of keys) state(key, 'loading', 'Đang tải dữ liệu…');
        }
    };
}
