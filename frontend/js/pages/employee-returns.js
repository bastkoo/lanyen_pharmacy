import { listReturnOrders, getReturnOrder, submitReturn } from '../api/employee-orders.js';
import { money } from '../components/cart.js';
import { setupEmployeeDialog } from '../components/employee-dialog.js';
import { setupLiveSearch } from '../utils/live-search.js';
import { validHttps } from '../utils/product-validation.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
const dateText = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Chưa có thời gian' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date); };
const errorText = error => ({ INVALID_REQUEST: 'Nhập mã đơn hoặc số điện thoại hợp lệ.',
    ORDER_REFUND_REVIEW_REQUIRED: 'Thiếu dữ liệu để hoàn đúng lô hoặc tính tiền. Cần kiểm tra đơn thủ công.',
    ORDER_NOT_RETURNABLE: 'Chỉ trả hàng cho đơn đã hoàn thành hoặc đã trả một phần.',
    RETURN_QUANTITY_CHANGED: 'Số lượng đã thay đổi. Đóng và mở lại đơn để kiểm tra.',
    RETURN_REQUEST_CONFLICT: 'Yêu cầu trả không khớp. Đóng và mở lại đơn để kiểm tra.',
    CONNECTION_FAILED: 'Chưa xác định được kết quả. Bấm lại nút xác nhận để kiểm tra cùng yêu cầu.',
    DATABASE_UNAVAILABLE: 'Chưa kết nối được dữ liệu. Vui lòng thử lại.',
    ORDER_NOT_FOUND: 'Không tìm thấy đơn hàng.' })[error.code] || 'Chưa thực hiện được thao tác. Vui lòng thử lại.';

export function setupEmployeeReturns({ getUser, onSessionError }) {
    let active = false, version = 0, detailVersion = 0, page = 1, busy = false, selected, pending;
    const owner = () => String(getUser()?.MaNguoiDung || '');
    const allowed = () => getUser()?.VaiTro === 1;
    const modal = setupEmployeeDialog($('return-detail'), { closeButton: $('return-close'),
        fallback: $('employee-returns-title'), canClose: () => !busy,
        onClose: () => { detailVersion++; selected = pending = null; } });
    function sessionError(error) { if (['UNAUTHENTICATED', 'SESSION_CHANGED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) onSessionError(); }
    async function load() {
        if (!active || !allowed()) return;
        const attempt = ++version, account = owner();
        $('return-state').textContent = 'Đang tải đơn hàng…'; $('return-orders').setAttribute('aria-busy', 'true');
        try {
            const data = await listReturnOrders($('employee-return-search').value.trim(), page);
            if (attempt !== version || account !== owner() || !active) return;
            if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total)) throw { code: 'INVALID_RESPONSE' };
            if (page > 1 && !data.items.length) { page = Math.max(1, Math.ceil(data.total / data.per_page)); return load(); }
            const rows = $('return-rows'); rows.replaceChildren();
            for (const item of data.items) {
                const row = node('tr'), reference = node('td'), button = node('button', `#${item.MaDonHang}`, 'quiet-link');
                row.className = 'employee-return-order';
                button.type = 'button'; button.setAttribute('aria-label', `Xem trả hàng đơn #${item.MaDonHang}`);
                button.addEventListener('click', () => open(item.MaDonHang)); reference.append(button);
                const purchased = node('time', dateText(item.NgayDat));
                if (item.NgayDat) purchased.dateTime = item.NgayDat;
                reference.append(purchased);
                row.addEventListener('click', event => {
                    if (event.target.closest('button')) return;
                    button.focus(); open(item.MaDonHang);
                });
                row.append(reference, node('td', `${item.KhachHang?.HoTen || ''} · ${item.KhachHang?.SDT || ''}`),
                    node('td', money(item.TongThanhToan)), node('td', item.TrangThaiDonHang === 5 ? 'Đã trả' : 'Đã hoàn thành'));
                rows.append(row);
            }
            $('return-state').textContent = data.total ? `${data.total} đơn hàng · Đơn đã trả được giữ lại để tiếp tục trả và xem lịch sử.` : 'Không có đơn hàng phù hợp.';
            $('return-page').textContent = `Trang ${page}`; $('return-prev').disabled = page <= 1; $('return-next').disabled = page * data.per_page >= data.total;
        } catch (error) { if (attempt === version) { $('return-state').textContent = errorText(error); sessionError(error); } }
        finally { if (attempt === version) $('return-orders').setAttribute('aria-busy', 'false'); }
    }
    function render(value) {
        selected = value;
        $('return-title').textContent = `Trả hàng · Đơn #${value.MaDonHang}`;
        const content = $('return-content'); content.replaceChildren();
        content.append(node('p', `${value.KhachHang?.HoTen || ''} · ${value.KhachHang?.SDT || ''}`));
        const purchased = node('time', `Ngày mua: ${dateText(value.NgayDat)}`, 'employee-order-placed');
        if (value.NgayDat) purchased.dateTime = value.NgayDat;
        content.append(purchased);
        const totals = node('dl', undefined, 'employee-order-totals'), paid = node('div');
        paid.append(node('dt', 'Tổng tiền đã thanh toán trước đó'), node('dd', money(value.TongThanhToan)));
        totals.append(paid); content.append(totals);
        if (!value.CanReturn) content.append(node('p', errorText({ code: 'ORDER_REFUND_REVIEW_REQUIRED' })));
        for (const item of value.items) {
            const form = node('form', undefined, 'employee-return-product');
            const info = node('div', undefined, 'employee-return-product-info');
            const visual = node('div', 'Chưa có ảnh', 'employee-product-image');
            if (validHttps(item.HinhAnh)) {
                const image = node('img'); image.src = item.HinhAnh; image.alt = item.TenThuoc;
                image.width = 56; image.height = 64; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
                image.addEventListener('error', () => visual.replaceChildren(node('span', 'Chưa có ảnh')), { once: true });
                visual.replaceChildren(image);
            }
            const description = node('div');
            description.append(node('h3', item.TenThuoc), node('p', `Đã mua ${item.SoLuong} ${item.DonViTinh} · Đã trả ${item.DaTra} · Còn ${item.ConLai}`));
            info.append(visual, description);
            form.append(info);
            if (value.CanReturn && item.ConLai > 0) {
                const field = node('div'), input = node('input'), label = node('label', 'Số lượng trả');
                input.id = `return-quantity-${item.MaChiTiet}`; input.type = 'number'; input.min = '1'; input.max = String(item.ConLai); input.step = '1'; input.value = String(item.ConLai); input.required = true; label.htmlFor = input.id;
                const preview = node('p');
                const update = () => { const quantity = Number(input.value); preview.textContent = input.validity.valid && Number.isInteger(quantity)
                    ? `Tiền hoàn: ${money((BigInt(item.TienSauGiam) * BigInt(item.DaTra + quantity) / BigInt(item.SoLuong) - BigInt(item.TienSauGiam) * BigInt(item.DaTra) / BigInt(item.SoLuong)).toString())}` : 'Nhập số lượng trong phạm vi còn lại.'; };
                update(); input.addEventListener('input', update);
                const button = node('button', 'Trả', 'button button-primary'); button.type = 'submit';
                field.append(label, input, preview); form.append(field, button);
                form.addEventListener('submit', event => {
                    event.preventDefault(); if (busy || pending || !form.reportValidity()) return;
                    pending = { MaChiTiet: item.MaChiTiet, SoLuong: Number(input.value), DaTra: item.DaTra, request_id: crypto.randomUUID() };
                    $('return-confirm-description').textContent = `Trả ${pending.SoLuong} ${item.DonViTinh} ${item.TenThuoc}. ${preview.textContent}. Hoàn số lượng về lô đã xuất và giữ nguyên xu.`;
                    $('return-confirm').hidden = false; $('return-confirm-submit').disabled = false;
                    for (const control of content.querySelectorAll('button,input')) control.disabled = true;
                    $('return-confirm-back').focus();
                });
            } else form.append(node('p', value.CanReturn ? 'Đã trả hết' : 'Cần kiểm tra thủ công'));
            content.append(form);
        }
        if (value.history.length) {
            content.append(node('h3', 'Lịch sử trả hàng'));
            const history = node('ul', undefined, 'employee-return-history');
            for (const receipt of value.history) {
                const item = value.items.find(line => line.MaChiTiet === receipt.MaChiTiet);
                history.append(node('li', `${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${receipt.at}+07:00`))} · ${item?.TenThuoc || receipt.MaChiTiet} × ${receipt.SoLuong} · Hoàn ${money(receipt.amount)}`));
            }
            content.append(history, node('p', `Tổng tiền đã trả lại khách: ${money(value.history.reduce((sum, receipt) => sum + BigInt(receipt.amount), 0n).toString())}`, 'employee-return-total'));
        }
    }
    async function open(id) {
        if (busy || !active || !allowed()) return;
        const attempt = ++detailVersion, account = owner(); selected = pending = null;
        $('return-content').replaceChildren(); $('return-confirm').hidden = true; $('return-detail-state').textContent = 'Đang tải sản phẩm…';
        modal.open($('return-title'));
        try {
            const data = await getReturnOrder(id);
            if (attempt !== detailVersion || account !== owner() || !active) return;
            if (data.code !== 'EMPLOYEE_RETURN_DETAIL' || !Array.isArray(data.order?.items) || !Array.isArray(data.order.history)) throw { code: 'INVALID_RESPONSE' };
            render(data.order); $('return-detail-state').textContent = '';
        } catch (error) { if (attempt === detailVersion) { $('return-detail-state').textContent = errorText(error); sessionError(error); } }
    }
    $('return-confirm-submit').addEventListener('click', async () => {
        if (!pending || !selected || busy || !allowed()) return;
        const attempt = detailVersion, account = owner(), id = selected.MaDonHang, values = { ...pending };
        busy = true; $('return-close').disabled = $('return-confirm-back').disabled = $('return-confirm-submit').disabled = true;
        $('return-detail-state').textContent = 'Đang xử lý trả hàng…';
        try {
            const data = await submitReturn(id, values, account);
            if (attempt !== detailVersion || account !== owner()) return;
            if (data.code !== 'EMPLOYEE_RETURNED' || !data.receipt || !Array.isArray(data.order?.items)) throw { code: 'INVALID_RESPONSE' };
            pending = null; $('return-confirm').hidden = true; render(data.order);
            $('return-detail-state').textContent = `Đã trả hàng. Số tiền trả lại khách hàng lần này: ${money(data.receipt.amount)}.`;
            $('return-title').focus(); load(); window.dispatchEvent(new Event('employee-orders-changed'));
        } catch (error) {
            if (attempt === detailVersion && account === owner()) {
                $('return-detail-state').textContent = errorText(error); sessionError(error);
                $('return-confirm-submit').disabled = ['RETURN_QUANTITY_CHANGED', 'RETURN_REQUEST_CONFLICT', 'ORDER_NOT_RETURNABLE', 'ORDER_REFUND_REVIEW_REQUIRED'].includes(error.code);
            }
        } finally { if (attempt === detailVersion && account === owner()) { busy = false; $('return-close').disabled = $('return-confirm-back').disabled = false; } }
    });
    $('return-confirm-back').addEventListener('click', () => { if (busy) return; pending = null; $('return-confirm').hidden = true; if (selected) open(selected.MaDonHang); });
    $('return-search-form').addEventListener('submit', event => { event.preventDefault(); page = 1; load(); });
    const cancelSearch = setupLiveSearch({ input: $('employee-return-search'), form: $('return-search-form'), isActive: () => active && allowed(), onSearch: () => { page = 1; load(); } });
    $('return-refresh').addEventListener('click', load);
    $('return-prev').addEventListener('click', () => { if (page > 1) { page--; load(); } });
    $('return-next').addEventListener('click', () => { page++; load(); });
    function deactivate() { active = false; version++; detailVersion++; busy = false; $('return-close').disabled = false; cancelSearch(); modal.close(true); }
    function clear() { deactivate(); busy = false; selected = pending = null; page = 1; $('employee-return-search').value = ''; $('return-rows').replaceChildren(); $('return-content').replaceChildren(); $('return-detail-state').textContent = ''; $('return-state').textContent = ''; $('return-confirm').hidden = true; $('return-close').disabled = false; }
    return { activate() { active = true; load(); }, deactivate, clear };
}
