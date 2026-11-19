import { getSession } from '../api/auth.js';
import { getOrderDetail, initializePayment } from '../api/orders.js';
import { money } from '../components/cart.js';
import { submitCheckout, paymentMessage } from '../utils/sepay-checkout.js';
import { validHttps } from '../utils/product-validation.js';
import { setupOrderCancellation } from '../components/order-cancel.js';
import { rewardCoin } from '../components/reward-coin.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
const id = new URLSearchParams(location.search).get('order');
const validId = /^[1-9][0-9]{0,18}$/.test(id || '') && BigInt(id) <= 9223372036854775807n;
const steps = ['Đặt hàng', 'Đang xử lý đơn', 'Đang giao', 'Đã giao'];
const statusNames = [...steps, 'Đã hủy', 'Đổi trả'];
let order = null, user = null, version = 0, disposed = false, timer, opening = false, snapshot = '';
const cancellation = setupOrderCancellation({ getUser: () => user, onCancelled: async () => {
    await refresh(); $('order-load-state').textContent = 'Đã hủy đơn và hoàn xu, kho, hạn mức khuyến mãi.'; $('main').focus({ preventScroll: true });
}, onClosed: () => { clearTimeout(timer); if (!disposed && order && [0, 1, 2].includes(order.TrangThaiDonHang)) timer = setTimeout(refresh, 5000); } });

function dateText(value) {
    const parsed = new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(value || '') ? value : `${value}+07:00`);
    return Number.isNaN(parsed.getTime()) ? 'Chưa có thời gian đặt' : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'
    }).format(parsed);
}

function clearPrivate() {
    $('order-earned-points').hidden = true; $('order-earned-points').replaceChildren();
    cancellation.clear();
    clearTimeout(timer); order = null; user = null; snapshot = '';
    $('order-detail-layout').hidden = true;
    for (const name of ['order-number', 'order-date', 'order-status', 'order-recipient', 'order-address',
        'order-note', 'order-subtotal', 'order-discount', 'order-total', 'order-copy-state', 'order-gateway-state',
        'order-receipt-type', 'order-payment-method', 'order-payment-status', 'order-payment-message']) $(name).textContent = '';
    $('order-products').replaceChildren(); $('order-progress').replaceChildren();
    document.getElementById('sepay-checkout-form')?.remove();
}

function receiptInfo(note) {
    const lines = (note || '').split('\n');
    const known = lines[0]?.startsWith('Người nhận: ') && /^(Giao tận nơi: |Nhận tại nhà thuốc: )/.test(lines[1] || '');
    if (!known) return { recipient: 'Thông tin người nhận chưa được lưu trong đơn.', address: 'Thông tin nhận hàng chưa được lưu trong đơn.', pickup: false, type: 'Thông tin nhận hàng', note: note || '' };
    return { recipient: lines[0].slice('Người nhận: '.length).replace(/ · ([^·]+)$/, '\n$1'),
        address: lines[1].replace(/^(Giao tận nơi: |Nhận tại nhà thuốc: )/, ''),
        pickup: lines[1].startsWith('Nhận tại nhà thuốc:'),
        type: lines[1].startsWith('Nhận tại nhà thuốc:') ? 'Nhận tại nhà thuốc' : 'Giao hàng tận nơi', note: lines.slice(2).join('\n') };
}

function renderProgress(value) {
    const current = value.TrangThaiDonHang;
    $('order-progress').dataset.status = String(current);
    const standard = Number.isInteger(current) && current >= 0 && current <= 3;
    $('order-progress').hidden = !standard;
    $('order-progress').replaceChildren();
    if (standard) steps.forEach((label, index) => {
        const completed = index < current || (current === 3 && index === 3);
        const approaching = current > 0 && current < 3 && index === current - 1;
        const item = node('li', undefined, `order-step${completed ? ' is-complete' : ''}${index === current ? ' is-current' : ''}${approaching ? ' is-approaching' : ''}`);
        if (index === current) item.setAttribute('aria-current', 'step');
        const connector = node('span', undefined, 'order-step-connector'); connector.setAttribute('aria-hidden', 'true');
        if (approaching) connector.append(node('span', undefined, 'order-step-flow'));
        const marker = node('span', completed ? '✓' : '', 'order-step-marker'); marker.setAttribute('aria-hidden', 'true');
        item.append(connector, marker, node('span', label, 'order-step-label'));
        if (index === 0) item.append(node('span', dateText(value.NgayDat), 'order-step-caption'));
        else if (index === current) item.append(node('span', current === 3 ? 'Đã hoàn tất' : 'Đang thực hiện', 'order-step-caption'));
        $('order-progress').append(item);
    });
    const notes = [value.PhuongThucThanhToan === 1 && value.TrangThaiThanhToan === 0
        ? 'Đơn hàng đã được ghi nhận, đang chờ xác nhận thanh toán.' : 'Đơn hàng đã được ghi nhận.',
    'Nhà thuốc đang xử lý đơn hàng của bạn.', 'Đơn hàng đang được giao tới bạn.', 'Đơn hàng đã được giao.',
    'Đơn hàng đã hủy.', 'Đơn hàng đang được xử lý đổi trả.'];
    $('order-progress-note').textContent = notes[current] || 'Chưa xác định trạng thái đơn hàng.';
}

function renderProducts(items) {
    $('order-products').replaceChildren();
    $('order-products-empty').hidden = items.length > 0;
    $('order-products').hidden = items.length === 0;
    $('order-product-count').textContent = `${items.length} dòng sản phẩm`;
    for (const item of items) {
        const row = node('li', undefined, 'order-product');
        const visual = node('div', 'Chưa có ảnh', 'order-product-image');
        if (validHttps(item.HinhAnh)) {
            const img = node('img'); img.src = item.HinhAnh; img.alt = ''; img.width = 58; img.height = 68; img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', () => visual.replaceChildren(document.createTextNode('Chưa có ảnh')), { once: true }); visual.replaceChildren(img);
        }
        const description = node('div'); description.append(node('h3', item.TenThuoc), node('p', `Đơn giá ${money(item.DonGia)} · × ${item.SoLuong} ${item.DonViTinh}`));
        row.append(visual, description, node('span', money(item.ThanhTien), 'order-product-price'));
        $('order-products').append(row);
    }
}

function render(value) {
    $('order-cancel').hidden = ![0, 1].includes(value.TrangThaiDonHang);
    const receipt = receiptInfo(value.GhiChu);
    $('order-number').textContent = `#${value.MaDonHang}`;
    $('order-date').textContent = `Đặt lúc ${dateText(value.NgayDat)}`;
    $('order-status').textContent = statusNames[value.TrangThaiDonHang] || 'Chưa xác định';
    $('order-status').dataset.terminal = String(value.TrangThaiDonHang >= 4);
    $('order-receipt-type').textContent = receipt.type;
    $('order-recipient').textContent = receipt.recipient; $('order-address').textContent = receipt.address;
    $('order-note').textContent = receipt.note; $('order-note-section').hidden = !receipt.note;
    $('order-subtotal').textContent = money(value.TongTien);
    $('order-discount').textContent = `${BigInt(value.TienGiamGia) > 0n ? '−' : ''}${money(value.TienGiamGia)}`;
    $('order-discount').previousElementSibling.textContent = value.DoiDiem ? 'Giảm giá sản phẩm và đổi xu' : 'Giảm giá sản phẩm';
    $('order-total').textContent = money(value.TongThanhToan);
    const earned = $('order-earned-points'); earned.hidden = true; earned.replaceChildren();
    if (value.TrangThaiDonHang === 3 && value.XuDaCong !== null && value.XuDaCong !== undefined) {
        earned.append(document.createTextNode(`Đã cộng ${new Intl.NumberFormat('vi-VN').format(BigInt(value.XuDaCong))} `), rewardCoin(), document.createTextNode(' vào tài khoản của bạn.'));
        earned.hidden = false;
    }
    $('order-shipping').textContent = receipt.pickup ? 'Không áp dụng' : 'Chưa xác nhận';
    $('order-total-note').textContent = receipt.pickup ? 'Nhận hàng tại nhà thuốc Lan Yến.' : 'Phí giao hàng nếu có được nhà thuốc xác nhận riêng.';
    $('order-payment-method').textContent = value.PhuongThucThanhToan === 0 ? 'Thanh toán khi nhận hàng (COD)' : 'Chuyển khoản QR qua SePay';
    $('order-payment-status').textContent = value.TrangThaiThanhToan === 1 ? '✓ Đã thanh toán' : 'Chưa thanh toán';
    $('order-payment-status').dataset.paid = String(value.TrangThaiThanhToan === 1);
    const payable = value.PhuongThucThanhToan === 1 && value.TrangThaiThanhToan === 0 && value.TrangThaiDonHang === 0;
    $('order-open-payment').hidden = !payable || !['sandbox', 'production'].includes(value.payment_environment);
    $('order-open-payment').textContent = value.payment_environment === 'sandbox' ? 'Mở Checkout SePay Sandbox' : 'Thanh toán qua SePay';
    $('order-payment-message').textContent = value.TrangThaiThanhToan === 1 ? 'Thanh toán đã được ghi nhận cho đơn hàng này.'
        : value.PhuongThucThanhToan === 0 ? 'Bạn thanh toán khi nhận hàng. Thời gian nhận hàng sẽ được nhà thuốc xác nhận.'
        : payable ? (value.payment_environment ? 'Trạng thái sẽ cập nhật sau khi SePay xác nhận thanh toán.' : 'Đơn cũ chưa xác định môi trường thanh toán. Vui lòng liên hệ nhà thuốc.') : 'Đơn hiện không ở trạng thái chờ thanh toán QR.';
    renderProgress(value); renderProducts(value.items);
    $('order-detail-layout').hidden = false;
}

async function refresh() {
    if (opening || cancellation.isOpen()) return;
    clearTimeout(timer);
    const attempt = ++version;
    $('order-retry').hidden = true; $('order-login').hidden = true;
    if (!validId) { clearPrivate(); $('order-load-state').textContent = 'Mã đơn hàng chưa hợp lệ. Vui lòng kiểm tra lại đường dẫn.'; return; }
    if (!order) $('order-load-state').textContent = 'Đang tải thông tin đơn hàng…';
    try {
        const session = await getSession();
        if (disposed || attempt !== version) return;
        user = session.user;
        const data = await getOrderDetail(id);
        if (disposed || attempt !== version) return;
        if (data.code !== 'ORDER_DETAIL' || String(data.order?.MaDonHang) !== id || !Array.isArray(data.order?.items)) throw { code: 'INVALID_RESPONSE' };
        order = data.order;
        const next = JSON.stringify(order);
        if (next !== snapshot) { render(order); snapshot = next; }
        $('order-load-state').textContent = '';
        if ([0, 1, 2].includes(order.TrangThaiDonHang)) timer = setTimeout(refresh, 5000);
    } catch (error) {
        if (disposed || attempt !== version) return;
        const privateError = ['UNAUTHENTICATED', 'ACCOUNT_LOCKED', 'FORBIDDEN', 'ORDER_NOT_FOUND', 'SESSION_CHANGED'].includes(error.code);
        if (privateError) clearPrivate();
        $('order-load-state').textContent = error.code === 'ORDER_NOT_FOUND' ? 'Không tìm thấy đơn hàng thuộc tài khoản của bạn.'
            : privateError ? 'Đăng nhập đúng tài khoản khách hàng để xem đơn hàng.' : 'Chưa tải được trạng thái mới. Vui lòng thử lại.';
        $('order-retry').hidden = false; $('order-login').hidden = !['UNAUTHENTICATED', 'SESSION_CHANGED'].includes(error.code);
    }
}

$('order-open-payment').addEventListener('click', async () => {
    if (!order || !user || opening) return;
    opening = true; $('order-open-payment').disabled = true;
    clearTimeout(timer);
    const account = String(user.MaNguoiDung), attempt = version;
    $('order-gateway-state').textContent = 'Đang chuẩn bị trang thanh toán…';
    try {
        const data = await initializePayment(id, account);
        if (disposed || !user || String(user.MaNguoiDung) !== account || attempt !== version) return;
        if (data.code !== 'PAYMENT_INITIALIZED') throw { code: 'INVALID_RESPONSE' };
        submitCheckout(data.payment, order);
    } catch (error) {
        if (!disposed && user && String(user.MaNguoiDung) === account) $('order-gateway-state').textContent = paymentMessage(error);
    } finally {
        opening = false; $('order-open-payment').disabled = false;
        if (!disposed && order && [0, 1, 2].includes(order.TrangThaiDonHang)) timer = setTimeout(refresh, 5000);
    }
});
$('order-copy').addEventListener('click', async () => {
    if (!order) return;
    try { await navigator.clipboard.writeText(String(order.MaDonHang)); $('order-copy-state').textContent = 'Đã sao chép mã đơn.'; }
    catch { $('order-copy-state').textContent = 'Bạn có thể chọn mã đơn phía trên để sao chép.'; }
});
$('order-cancel').addEventListener('click', event => { if (order && !opening) cancellation.open(order, event.currentTarget); });
$('order-retry').addEventListener('click', refresh);
$('order-login').addEventListener('click', () => $('login-button').click());
window.addEventListener('auth-changed', event => {
    if (disposed || (user && String(event.detail?.user?.MaNguoiDung) === String(user.MaNguoiDung))) return;
    opening = false; version++; clearPrivate(); refresh();
});
window.addEventListener('pagehide', () => { disposed = true; version++; clearTimeout(timer); });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; refresh(); } });
refresh();
