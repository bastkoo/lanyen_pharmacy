import { listEmployeeOrders, getEmployeeOrder, updateEmployeeOrder, cancelEmployeeOrder } from '../api/employee-orders.js';
import { money } from '../components/cart.js';
import { rewardCoin } from '../components/reward-coin.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
const statusNames = ['Chờ thanh toán', 'Đang chờ xử lý', 'Đang giao', 'Đã giao', 'Đã hủy', 'Đổi trả'];
const dateText = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Chưa có thời gian' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date); };
const errorText = error => ({ INVALID_REQUEST: 'Nhập mã đơn hoặc số điện thoại hợp lệ.',
    INVALID_TRANSITION: 'Không thể chuyển trạng thái theo thao tác này.', ORDER_STATE_CHANGED: 'Đơn đã được cập nhật. Tải lại để kiểm tra trạng thái mới.',
    ORDER_EXPIRED: 'Đơn đã quá 24 giờ chưa thanh toán, không thể tiếp tục xử lý.',
    ORDER_NOT_CANCELLABLE: 'Đơn không còn ở trạng thái được phép hủy.', ORDER_NOT_FOUND: 'Không tìm thấy đơn hàng.',
    ORDER_REFUND_REVIEW_REQUIRED: 'Đơn chưa đủ dữ liệu hoàn trả. Cần nhà thuốc đối soát trước khi hủy.',
    ORDER_POINTS_LIMIT: 'Số xu của đơn vượt giới hạn lưu trữ. Vui lòng liên hệ quản lý.',
    CONNECTION_FAILED: 'Mất kết nối. Hãy tải lại đơn để kiểm tra kết quả trước khi thử tiếp.',
    INVALID_RESPONSE: 'Chưa xác định được kết quả. Hãy tải lại đơn để kiểm tra trước khi thử tiếp.',
    UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn.', SESSION_CHANGED: 'Tài khoản đăng nhập đã thay đổi.',
    FORBIDDEN: 'Tài khoản không có quyền xử lý đơn.', ACCOUNT_LOCKED: 'Tài khoản đã bị khóa.' })[error.code] || 'Chưa thực hiện được thao tác. Vui lòng thử lại.';

export function setupEmployeeOrders({ getUser, onSessionError }) {
    let generation = 0, detailVersion = 0, active = false, timer, busy = false, loading = false;
    let status = 'all', search = '', page = 1, selected = null, detail = null, pending = null, opener;
    const dialog = $('employee-order-action-dialog');
    const allowed = () => getUser()?.VaiTro === 1;
    const owner = () => String(getUser()?.MaNguoiDung || '');
    function checkSession(error) { if (['UNAUTHENTICATED', 'SESSION_CHANGED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) onSessionError(); }
    function schedule() { clearTimeout(timer); if (active && allowed()) timer = setTimeout(() => { if (!dialog.open && !busy && !document.hidden) load(); else schedule(); }, 30000); }
    function clear() {
        generation++; detailVersion++; active = false; busy = loading = false; selected = detail = pending = null;
        clearTimeout(timer); if (dialog.open) dialog.close();
        status = 'all'; search = ''; page = 1; $('employee-order-search').value = '';
        for (const button of document.querySelectorAll('[data-employee-order-filter]')) button.setAttribute('aria-pressed', String(button.dataset.employeeOrderFilter === 'all'));
        $('employee-order-rows').replaceChildren(); $('employee-order-detail-content').replaceChildren(); $('employee-order-detail-content').hidden = true;
        $('employee-order-detail-title').textContent = 'Chọn đơn để xem thông tin';
        $('employee-order-detail-state').textContent = 'Chọn một đơn hàng trong danh sách bên trái.';
        $('employee-order-pagination').hidden = true; $('employee-order-state').textContent = '';
        $('employee-order-detail-retry').hidden = $('employee-order-retry').hidden = true;
        $('employee-order-list').setAttribute('aria-busy', 'false');
        $('employee-invoice').replaceChildren();
    }
    function renderRows(items) {
        $('employee-order-rows').replaceChildren();
        if (!items.length) { const row = node('tr'), cell = node('td'); cell.colSpan = 4; cell.append(node('p', 'Không có đơn hàng phù hợp.', 'employee-orders-empty')); row.append(cell); $('employee-order-rows').append(row); return; }
        for (const value of items) {
            const row = node('tr'); row.dataset.orderId = value.MaDonHang; row.classList.toggle('is-selected', selected === String(value.MaDonHang));
            const reference = node('td'), button = node('button', `#${value.MaDonHang}`, 'quiet-link'); button.type = 'button'; button.dataset.employeeOrder = value.MaDonHang; button.setAttribute('aria-label', `Xem đơn #${value.MaDonHang}`);
            const placed = node('time', dateText(value.NgayDat)); placed.dateTime = value.NgayDat; reference.append(button, placed);
            if (value.TrangThaiDonHang === 0 && value.QuaHanThanhToan) reference.append(node('p', 'Quá thời gian xử lý', 'employee-overdue'));
            const customer = node('td'); customer.append(node('strong', value.KhachHang?.HoTen || 'Chưa có thông tin'), node('p', value.KhachHang?.SDT || ''));
            const amount = node('td'); amount.append(node('strong', money(value.TongThanhToan)), node('p', value.TrangThaiThanhToan === 1 ? 'Đã thanh toán' : value.PhuongThucThanhToan === 0 ? 'Thu tiền COD' : 'Chưa thanh toán'));
            const state = node('td'), badge = node('span', statusNames[value.TrangThaiDonHang], 'employee-order-badge'); badge.dataset.status = value.TrangThaiDonHang; state.append(badge);
            customer.dataset.label = 'Khách hàng'; amount.dataset.label = 'Thanh toán'; state.dataset.label = 'Trạng thái';
            row.append(reference, customer, amount, state); $('employee-order-rows').append(row);
        }
    }
    async function load() {
        if (!allowed() || busy || loading || !active) return;
        const attempt = ++generation, account = owner(); loading = true;
        $('employee-order-list').setAttribute('aria-busy', 'true'); $('employee-order-state').textContent = 'Đang tải đơn hàng…'; $('employee-order-retry').hidden = true;
        try {
            const data = await listEmployeeOrders(status, search, page);
            if (attempt !== generation || account !== owner() || !active) return;
            if (data.code !== 'EMPLOYEE_ORDERS_LISTED' || !Array.isArray(data.items) || !Number.isSafeInteger(data.total)) throw { code: 'INVALID_RESPONSE' };
            if (page > 1 && !data.items.length) { page--; loading = false; return load(); }
            renderRows(data.items); $('employee-order-state').textContent = `${data.total} đơn hàng phù hợp · Ưu tiên đơn đang chờ xử lý.`;
            $('employee-order-pagination').hidden = data.total <= data.per_page && page === 1;
            $('employee-order-page').textContent = `Trang ${page}`; $('employee-order-prev').disabled = page <= 1; $('employee-order-next').disabled = page * data.per_page >= data.total;
        } catch (error) { if (attempt === generation) { $('employee-order-state').textContent = errorText(error); $('employee-order-retry').hidden = false; checkSession(error); } }
        finally { if (attempt === generation) { loading = false; $('employee-order-list').setAttribute('aria-busy', 'false'); schedule(); } }
    }
    function renderDetail(value) {
        detail = value; selected = String(value.MaDonHang);
        $('employee-order-detail-title').textContent = `Đơn hàng #${value.MaDonHang}`;
        $('employee-order-detail-state').textContent = ''; $('employee-order-detail-retry').hidden = true;
        const content = $('employee-order-detail-content'); content.replaceChildren(); content.hidden = false;
        const badge = node('span', statusNames[value.TrangThaiDonHang], 'employee-order-badge'); badge.dataset.status = value.TrangThaiDonHang; content.append(badge, node('p', `Đặt lúc ${dateText(value.NgayDat)}`, 'employee-order-placed'));
        if (value.TrangThaiDonHang === 0 && value.QuaHanThanhToan) content.append(node('p', 'Quá thời gian xử lý', 'employee-overdue'));
        content.append(node('h4', value.KhachHang?.HoTen || 'Khách hàng'), node('p', value.KhachHang?.SDT || ''), node('p', value.GhiChu || '', 'employee-order-note'));
        const products = node('ul', undefined, 'employee-order-products');
        for (const item of value.items) { const line = node('li'); line.append(node('strong', item.TenThuoc), node('span', `${item.SoLuong} ${item.DonViTinh} × ${money(item.DonGia)}`)); products.append(line); }
        content.append(products);
        const totals = node('dl', undefined, 'employee-order-totals');
        for (const [label, amount] of [['Tiền hàng', value.TongTien], ['Giảm giá / đổi xu', value.TienGiamGia], ['Tổng thanh toán', value.TongThanhToan]]) { const line = node('div'); line.append(node('dt', label), node('dd', money(amount))); totals.append(line); }
        content.append(totals, node('p', `${value.PhuongThucThanhToan === 0 ? 'COD' : 'QR'} · ${value.TrangThaiThanhToan === 1 ? 'Đã thanh toán' : 'Chưa thanh toán'}`));
        if (value.TrangThaiDonHang === 3 && value.XuDaCong !== null && value.XuDaCong !== undefined) { const earned = node('p', `Đã cộng ${new Intl.NumberFormat('vi-VN').format(BigInt(value.XuDaCong))} `, 'employee-earned-points'); earned.append(rewardCoin(), document.createTextNode(' vào tài khoản khách hàng.')); content.append(earned); }
        const actions = node('div', undefined, 'employee-order-detail-actions');
        if ([0, 1, 2].includes(value.TrangThaiDonHang)) {
            const next = node('button', ['Xác nhận thanh toán tại quầy', 'Chuyển sang Đang giao', 'Xác nhận Đã giao'][value.TrangThaiDonHang], 'button button-primary'); next.type = 'button'; next.id = 'employee-order-next-status'; next.disabled = busy || value.QuaHanThanhToan === true; next.addEventListener('click', () => confirmAction('update', next));
            const cancel = node('button', 'Hủy đơn', 'button button-outline'); cancel.type = 'button'; cancel.id = 'employee-order-cancel'; cancel.disabled = busy; cancel.addEventListener('click', () => confirmAction('cancel', cancel)); actions.append(next, cancel);
        }
        if (value.CanPrint) { const print = node('button', 'In hóa đơn', 'button button-outline'); print.type = 'button'; print.id = 'employee-order-print'; print.disabled = busy; print.addEventListener('click', printInvoice); actions.append(print); }
        content.append(actions);
        for (const row of $('employee-order-rows').querySelectorAll('[data-order-id]')) row.classList.toggle('is-selected', row.dataset.orderId === selected);
    }
    async function loadDetail(id = selected, focus = false) {
        if (!id || !allowed() || busy) return;
        selected = String(id); const attempt = ++detailVersion, account = owner();
        $('employee-order-detail-state').textContent = 'Đang tải chi tiết…'; $('employee-order-detail-content').hidden = true; $('employee-order-detail-retry').hidden = true;
        try {
            const data = await getEmployeeOrder(id);
            if (attempt !== detailVersion || account !== owner() || !active) return;
            if (data.code !== 'EMPLOYEE_ORDER_DETAIL' || String(data.order?.MaDonHang) !== selected || !Array.isArray(data.order.items)) throw { code: 'INVALID_RESPONSE' };
            renderDetail(data.order); if (focus) $('employee-order-detail-title').focus();
        } catch (error) { if (attempt === detailVersion) { $('employee-order-detail-state').textContent = errorText(error); $('employee-order-detail-retry').hidden = false; checkSession(error); } }
    }
    function confirmAction(kind, source) {
        if (!detail || busy) return;
        opener = source; pending = { kind, id: selected, from: detail.TrangThaiDonHang, account: owner() };
        $('employee-order-action-title').textContent = kind === 'cancel' ? 'Hủy đơn hàng?' : 'Xác nhận cập nhật đơn hàng';
        let description = kind === 'cancel' ? `Hủy đơn #${selected} và hoàn đúng xu, kho, hạn mức khuyến mãi đã sử dụng?`
            : detail.TrangThaiDonHang === 0 ? `Xác nhận đơn #${selected} đã thanh toán tại quầy và chuyển sang Đang chờ xử lý?`
            : detail.TrangThaiDonHang === 1 ? `Chuyển đơn #${selected} sang Đang giao? Sau đó bạn có thể in hóa đơn.`
            : `Xác nhận đơn #${selected} đã giao${detail.PhuongThucThanhToan === 0 ? ' và đã thu tiền COD' : ''}? Khách hàng sẽ được cộng ${BigInt(detail.TongThanhToan) / 100n} xu.`;
        if (kind === 'cancel' && detail.PhuongThucThanhToan === 1 && detail.TrangThaiThanhToan === 1) description += ' Tiền QR đã thanh toán cần nhà thuốc xử lý hoàn riêng.';
        $('employee-order-action-description').textContent = description; $('employee-order-action-state').textContent = '';
        $('employee-order-action-back').disabled = $('employee-order-action-confirm').disabled = false;
        dialog.showModal(); $('employee-order-action-back').focus();
    }
    $('employee-order-action-confirm').addEventListener('click', async () => {
        if (!pending || busy || pending.account !== owner()) return;
        const action = pending, attempt = detailVersion; busy = true;
        $('employee-order-action-back').disabled = $('employee-order-action-confirm').disabled = true; $('employee-order-action-state').textContent = 'Đang cập nhật…';
        try {
            const data = action.kind === 'cancel' ? await cancelEmployeeOrder(action.id, action.account) : await updateEmployeeOrder(action.id, action.from, action.from + 1, action.account);
            if (attempt !== detailVersion || action.account !== owner()) return;
            if (data.code !== (action.kind === 'cancel' ? 'EMPLOYEE_ORDER_CANCELLED' : 'EMPLOYEE_ORDER_UPDATED') || String(data.order?.MaDonHang) !== action.id) throw { code: 'INVALID_RESPONSE' };
            busy = false; pending = null; dialog.close();
            if (action.kind === 'update') renderDetail(data.order); else await loadDetail(action.id);
            await load(); $('employee-order-detail-title').focus();
        } catch (error) {
            if (attempt !== detailVersion) return;
            $('employee-order-action-state').textContent = errorText(error);
            $('employee-order-action-confirm').disabled = ['CONNECTION_FAILED', 'INVALID_RESPONSE', 'ORDER_STATE_CHANGED', 'ORDER_EXPIRED', 'ORDER_NOT_CANCELLABLE', 'ORDER_REFUND_REVIEW_REQUIRED'].includes(error.code);
            checkSession(error);
        } finally { if (attempt === detailVersion && action.account === owner()) { busy = false; $('employee-order-action-back').disabled = false; } }
    });
    $('employee-order-action-back').addEventListener('click', () => { pending = null; dialog.close(); loadDetail(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); else pending = null; });
    dialog.addEventListener('close', () => { if (opener?.isConnected) opener.focus(); schedule(); });
    async function printInvoice() {
        if (!detail || busy || !allowed()) return;
        const account = owner(), id = selected; busy = true;
        try {
            const data = await getEmployeeOrder(id);
            if (account !== owner() || id !== selected) return;
            if (data.code !== 'EMPLOYEE_ORDER_DETAIL' || !data.order?.CanPrint) throw { code: 'ORDER_STATE_CHANGED' };
            const value = data.order, invoice = $('employee-invoice'); invoice.replaceChildren();
            invoice.append(node('h1', 'LAN YẾN PHARMACY'), node('p', '126 Dương Văn An, Phường Vỹ Dạ, TP Huế'), node('h2', 'HÓA ĐƠN BÁN HÀNG'), node('p', `Đơn #${value.MaDonHang} · Đặt lúc ${dateText(value.NgayDat)}`), node('p', `Khách hàng: ${value.KhachHang?.HoTen || ''} · ${value.KhachHang?.SDT || ''}`), node('p', value.GhiChu || ''));
            const table = node('table'), head = node('thead'), headings = node('tr');
            for (const title of ['Sản phẩm', 'Số lượng', 'Đơn giá', 'Thành tiền']) headings.append(node('th', title)); head.append(headings); table.append(head);
            const body = node('tbody'); for (const item of value.items) { const row = node('tr'); for (const text of [item.TenThuoc, `${item.SoLuong} ${item.DonViTinh}`, money(item.DonGia), money(item.ThanhTien)]) row.append(node('td', text)); body.append(row); } table.append(body); invoice.append(table);
            invoice.append(node('p', `Tổng tiền hàng: ${money(value.TongTien)}`), node('p', `Giảm giá / đổi xu: ${money(value.TienGiamGia)}`), node('h3', `Tổng thanh toán: ${money(value.TongThanhToan)}`), node('p', value.TrangThaiThanhToan === 1 ? 'Đã thanh toán' : 'Thu tiền khi nhận hàng'), node('p', `Nhân viên: ${getUser().HoTen}`));
            window.print();
        } catch (error) { $('employee-order-detail-state').textContent = errorText(error); checkSession(error); }
        finally { busy = false; }
    }
    $('employee-order-rows').addEventListener('click', event => { const button = event.target.closest('[data-employee-order]'); if (button) loadDetail(button.dataset.employeeOrder, true); });
    $('employee-order-search-form').addEventListener('submit', event => { event.preventDefault(); if (busy || loading) return; search = $('employee-order-search').value.trim(); page = 1; load(); });
    for (const filter of document.querySelectorAll('[data-employee-order-filter]')) filter.addEventListener('click', () => { if (busy || loading) return; status = filter.dataset.employeeOrderFilter; page = 1; for (const button of document.querySelectorAll('[data-employee-order-filter]')) button.setAttribute('aria-pressed', String(button === filter)); load(); });
    $('employee-order-prev').addEventListener('click', () => { if (page > 1 && !loading) { page--; load(); } });
    $('employee-order-next').addEventListener('click', () => { if (!loading) { page++; load(); } });
    for (const id of ['employee-order-refresh', 'employee-order-retry']) $(id).addEventListener('click', load);
    $('employee-order-detail-retry').addEventListener('click', () => loadDetail());
    return { clear, activate() { active = true; load(); }, deactivate() { active = false; clearTimeout(timer); }, isBusy: () => busy || dialog.open };
}
