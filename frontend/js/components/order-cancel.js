import { cancelOrder } from '../api/orders.js';

const node = (tag, text) => { const element = document.createElement(tag); if (text) element.textContent = text; return element; };

export function setupOrderCancellation({ getUser, onCancelled, onClosed }) {
    const dialog = node('dialog'); dialog.className = 'feature-dialog'; dialog.id = 'order-cancel-dialog';
    dialog.setAttribute('aria-labelledby', 'order-cancel-title'); dialog.setAttribute('aria-describedby', 'order-cancel-description');
    const title = node('h2', 'Hủy đơn hàng?'); title.id = 'order-cancel-title';
    const description = node('p'); description.id = 'order-cancel-description';
    const feedback = node('p'); feedback.id = 'order-cancel-state'; feedback.setAttribute('role', 'status');
    const actions = node('div'); actions.className = 'order-cancel-actions';
    const back = node('button', 'Giữ đơn hàng'); back.type = 'button'; back.className = 'button button-outline';
    const confirm = node('button', 'Xác nhận hủy'); confirm.type = 'button'; confirm.id = 'order-cancel-confirm'; confirm.className = 'button button-primary';
    actions.append(back, confirm); dialog.append(title, description, feedback, actions); document.body.append(dialog);
    let order, owner, opener, generation = 0, busy = false;
    function clear() { generation++; order = owner = null; busy = false; feedback.textContent = ''; if (dialog.open) dialog.close(); }
    back.addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => { generation++; if (opener?.isConnected) opener.focus(); onClosed?.(); });
    confirm.addEventListener('click', async () => {
        if (busy || !order || owner !== String(getUser()?.MaNguoiDung)) return;
        const attempt = generation, account = owner, id = String(order.MaDonHang);
        let blocked = false;
        busy = true; back.disabled = confirm.disabled = true; dialog.setAttribute('aria-busy', 'true');
        feedback.textContent = 'Đang hủy đơn và hoàn xu, kho, hạn mức khuyến mãi…';
        try {
            const data = await cancelOrder(id, account);
            if (attempt !== generation || account !== String(getUser()?.MaNguoiDung)) return;
            if (data.code !== 'ORDER_CANCELLED' || String(data.order?.MaDonHang) !== id || data.order.TrangThaiDonHang !== 4) throw { code: 'INVALID_RESPONSE' };
            busy = false; dialog.close(); await onCancelled(data.order);
        } catch (error) {
            if (attempt !== generation) return;
            const messages = {
                ORDER_NOT_CANCELLABLE: 'Chỉ có thể hủy đơn ở trạng thái chờ duyệt hoặc đang xử lý. Hãy tải lại đơn hàng.',
                ORDER_REFUND_REVIEW_REQUIRED: 'Đơn này chưa đủ dữ liệu để hoàn chính xác. Vui lòng liên hệ nhà thuốc để đối soát và hủy đơn.',
                ORDER_NOT_FOUND: 'Không tìm thấy đơn thuộc tài khoản của bạn.',
                SESSION_CHANGED: 'Tài khoản đã thay đổi. Vui lòng đăng nhập lại.',
                UNAUTHENTICATED: 'Vui lòng đăng nhập lại.',
                CONNECTION_FAILED: 'Chưa xác định được kết quả hủy. Hãy đóng cửa sổ và tải lại đơn trước khi thử tiếp.',
                INVALID_RESPONSE: 'Chưa xác định được kết quả hủy. Hãy đóng cửa sổ và tải lại đơn trước khi thử tiếp.'
            };
            feedback.textContent = messages[error.code] || 'Chưa hủy được đơn hàng. Vui lòng thử lại.';
            blocked = ['CONNECTION_FAILED', 'INVALID_RESPONSE', 'ORDER_NOT_CANCELLABLE', 'ORDER_REFUND_REVIEW_REQUIRED'].includes(error.code);
        } finally {
            if (attempt === generation) { busy = false; back.disabled = false; confirm.disabled = blocked; dialog.setAttribute('aria-busy', 'false'); }
        }
    });
    window.addEventListener('auth-changed', event => { if (owner !== String(event.detail?.user?.MaNguoiDung)) clear(); });
    window.addEventListener('pagehide', clear);
    return {
        clear, isOpen: () => dialog.open,
        open(value, trigger) {
            clear(); if (![0, 1].includes(value.TrangThaiDonHang) || !getUser()) return;
            order = value; owner = String(getUser().MaNguoiDung); opener = trigger;
            description.textContent = `Hủy đơn #${value.MaDonHang}? Xu đã dùng, kho và hạn mức khuyến mãi sẽ được hoàn lại khi hủy thành công.`;
            if (value.PhuongThucThanhToan === 1 && value.TrangThaiThanhToan === 1) description.textContent += ' Tiền đã thanh toán qua QR cần nhà thuốc xử lý hoàn tiền riêng.';
            confirm.disabled = back.disabled = false; dialog.setAttribute('aria-busy', 'false'); dialog.showModal(); back.focus();
        }
    };
}
