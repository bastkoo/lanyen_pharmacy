import { getSession } from '../api/auth.js';
import { getOrders, initializePayment } from '../api/orders.js';
import { money } from '../components/cart.js';
import { validHttps } from '../utils/product-validation.js';
import { submitCheckout, paymentMessage } from '../utils/sepay-checkout.js';
import { setupOrderReorder } from '../components/order-reorder.js';
import { setupOrderCancellation } from '../components/order-cancel.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
const filters = ['all', 'processing', 'shipping', 'delivered', 'cancelled', 'returns'];
const statusNames = ['Đang xử lý', 'Đang xử lý', 'Đang giao', 'Đã giao', 'Đã hủy', 'Đã trả'];
let status = 'all', page = 1, total = 0, perPage = 10, validQuery = true;
let version = 0, user = null, rows = new Map(), disposed = false, opening = false;
const reorder = setupOrderReorder({ getUser: () => user, onAdded: () => { $('orders-state').textContent = 'Đã thêm các sản phẩm đã chọn vào giỏ hàng.'; } });
const cancellation = setupOrderCancellation({ getUser: () => user, onCancelled: async () => {
    await load(); $('orders-state').textContent = 'Đã hủy đơn và hoàn xu, kho, hạn mức khuyến mãi.'; $('main').focus({ preventScroll: true });
} });

function readQuery() {
    const query = new URLSearchParams(location.search);
    status = query.get('status') || 'all';
    const number = query.get('page') || '1';
    validQuery = filters.includes(status) && /^[1-9][0-9]{0,9}$/.test(number) && Number(number) <= 2147483647
        && [...query.keys()].every(key => ['status', 'page'].includes(key) && query.getAll(key).length === 1);
    page = validQuery ? Number(number) : 1;
    for (const link of document.querySelectorAll('[data-order-filter]')) {
        if (link.dataset.orderFilter === status) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
}

function clearPrivate() {
    reorder.clear();
    cancellation.clear();
    rows.clear(); user = null;
    $('orders-list').replaceChildren(); $('orders-empty').hidden = true; $('orders-pagination').hidden = true;
    $('orders-processing-count').textContent = ''; $('orders-processing-count').hidden = true;
    document.getElementById('sepay-checkout-form')?.remove();
}

function dateText(value) {
    const parsed = new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(value || '') ? value : `${value}+07:00`);
    return Number.isNaN(parsed.getTime()) ? 'Chưa có ngày đặt' : new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh'
    }).format(parsed);
}

function card(value) {
    const li = node('li'), article = node('article', undefined, 'orders-card'); article.dataset.orderId = value.MaDonHang;
    const href = `order-detail.html?order=${encodeURIComponent(value.MaDonHang)}`;
    const heading = node('header', undefined, 'orders-card-heading'), reference = node('div', undefined, 'orders-card-reference');
    const title = node('h2'), titleLink = node('a', `Đơn hàng ${dateText(value.NgayDat)}`); titleLink.href = href; title.append(titleLink);
    const receipt = value.HinhThucNhanHang === 'pickup' ? 'Nhận tại nhà thuốc' : value.HinhThucNhanHang === 'delivery' ? 'Giao hàng tận nơi' : 'Đơn hàng';
    reference.append(title, node('p', `${receipt} · #${value.MaDonHang}`));
    const badge = node('span', statusNames[value.TrangThaiDonHang] || 'Chưa xác định', 'orders-status'); badge.dataset.status = value.TrangThaiDonHang;
    heading.append(reference, badge); article.append(heading);
    const products = node('ul', undefined, 'orders-products');
    for (const item of value.items.slice(0, 1)) {
        const preview = node('li', undefined, 'orders-preview'), visual = node('div', 'Chưa có ảnh', 'orders-preview-image');
        if (validHttps(item.HinhAnh)) {
            const img = node('img'); img.src = item.HinhAnh; img.alt = ''; img.width = 56; img.height = 66; img.referrerPolicy = 'no-referrer';
            img.addEventListener('error', () => visual.replaceChildren(document.createTextNode('Chưa có ảnh')), { once: true }); visual.replaceChildren(img);
        }
        const description = node('div'); description.append(node('h3', item.TenThuoc));
        if (value.items.length > 1) description.append(node('p', `+ ${value.items.length - 1} sản phẩm khác`));
        preview.append(visual, description, node('span', money(item.ThanhTien), 'orders-preview-price'),
            node('span', `×${item.SoLuong} ${item.DonViTinh}`, 'orders-preview-quantity'));
        products.append(preview);
    }
    if (!value.items.length) products.append(node('li', 'Chưa có chi tiết sản phẩm cho đơn hàng này.', 'orders-preview'));
    article.append(products);
    const summary = node('div', undefined, 'orders-card-summary'), detail = node('a', 'Xem chi tiết →', 'quiet-link'); detail.href = href;
    detail.setAttribute('aria-label', `Xem chi tiết đơn ${value.MaDonHang}`);
    const paymentTotal = node('div', 'Thành tiền:', 'orders-card-total'); paymentTotal.append(node('strong', money(value.TongThanhToan)));
    if (BigInt(value.TienGiamGia) > 0n) paymentTotal.append(node('span', `Giảm giá sản phẩm: −${money(value.TienGiamGia)}`, 'orders-card-discount'));
    summary.append(detail, paymentTotal); article.append(summary);
    const actions = node('div', undefined, 'orders-card-actions');
    let message = value.TrangThaiThanhToan === 1 ? 'Đã thanh toán.' : value.PhuongThucThanhToan === 0 ? 'Thanh toán khi nhận hàng.' : 'Chưa thanh toán.';
    if ([0, 1].includes(value.TrangThaiDonHang)) message = value.TrangThaiDonHang === 1 ? `Đơn hàng đang được xử lý. ${message}` : `Đơn hàng đang chờ xử lý. ${message}`;
    actions.append(node('p', message, 'orders-card-message'));
    if ([0, 1].includes(value.TrangThaiDonHang)) {
        const cancel = node('button', 'Hủy đơn', 'button button-outline'); cancel.type = 'button'; cancel.dataset.cancelOrder = value.MaDonHang;
        cancel.setAttribute('aria-label', `Hủy đơn ${value.MaDonHang}`); cancel.setAttribute('aria-haspopup', 'dialog'); cancel.setAttribute('aria-controls', 'order-cancel-dialog'); actions.append(cancel);
    }
    if ([3, 4].includes(value.TrangThaiDonHang) && !value.items.some(item => item.PhanLoai === true)) {
        const buy = node('button', 'Mua lại', 'button button-outline orders-buy-again'); buy.type = 'button';
        buy.dataset.reorder = value.MaDonHang; buy.setAttribute('aria-haspopup', 'dialog'); buy.setAttribute('aria-controls', 'reorder-dialog');
        buy.setAttribute('aria-label', `Mua lại đơn ${value.MaDonHang}`); actions.append(buy);
    }
    if (value.can_pay === true) {
        const pay = node('button', 'Thanh toán', 'button button-primary'); pay.type = 'button'; pay.dataset.payOrder = value.MaDonHang;
        pay.setAttribute('aria-label', `Thanh toán đơn ${value.MaDonHang}`); pay.disabled = opening; actions.append(pay);
    }
    article.append(actions);
    const feedback = node('p', '', 'orders-pay-state'); feedback.dataset.payState = value.MaDonHang; feedback.setAttribute('role', 'status'); article.append(feedback);
    li.append(article); return li;
}

async function load() {
    const attempt = ++version;
    $('orders-retry').hidden = true; $('orders-login').hidden = true; $('orders-reset').hidden = validQuery;
    $('orders-list').replaceChildren(); rows.clear(); $('orders-empty').hidden = true; $('orders-pagination').hidden = true;
    if (!validQuery) { $('orders-state').textContent = 'Đường dẫn bộ lọc chưa hợp lệ. Hãy chọn xem tất cả đơn hàng.'; $('orders-content').setAttribute('aria-busy', 'false'); return; }
    $('orders-state').textContent = 'Đang tải đơn hàng…'; $('orders-content').setAttribute('aria-busy', 'true');
    try {
        const session = await getSession();
        if (disposed || attempt !== version) return;
        user = session.user;
        const data = await getOrders(status, page);
        if (disposed || attempt !== version) return;
        if (data.code !== 'ORDERS_LISTED' || !Array.isArray(data.items) || !Number.isSafeInteger(data.total)
            || !Number.isSafeInteger(data.processing_count) || data.total < 0 || data.processing_count < 0
            || !Number.isSafeInteger(data.per_page) || data.per_page < 1 || data.per_page > 50
            || data.page !== page || data.status !== status || data.items.some(value => !Array.isArray(value.items))) throw { code: 'INVALID_RESPONSE' };
        total = data.total; perPage = data.per_page;
        rows = new Map(data.items.map(value => [String(value.MaDonHang), value]));
        $('orders-list').replaceChildren(...data.items.map(card));
        $('orders-processing-count').hidden = data.processing_count < 1; $('orders-processing-count').textContent = data.processing_count > 0 ? String(data.processing_count) : '';
        $('orders-processing-count').setAttribute('aria-label', `${data.processing_count} đơn đang xử lý`);
        $('orders-empty').hidden = data.items.length > 0;
        $('orders-empty-message').textContent = status === 'all' && page === 1 ? 'Bạn chưa có đơn hàng. Khám phá sản phẩm để bắt đầu mua sắm.' : 'Không có đơn hàng ở trang hoặc trạng thái này.';
        $('orders-state').textContent = '';
        $('orders-pagination').hidden = total <= perPage && page === 1;
        $('orders-page-info').textContent = `Trang ${page} · ${total} đơn hàng`;
        $('orders-previous').disabled = page <= 1; $('orders-next').disabled = page * perPage >= total;
    } catch (error) {
        if (disposed || attempt !== version) return;
        const privateError = ['UNAUTHENTICATED', 'ACCOUNT_LOCKED', 'FORBIDDEN', 'SESSION_CHANGED'].includes(error.code);
        if (privateError) clearPrivate();
        $('orders-state').textContent = error.code === 'FORBIDDEN' ? 'Chức năng này dành cho tài khoản khách hàng.'
            : privateError ? 'Đăng nhập đúng tài khoản để xem đơn hàng của bạn.' : 'Chưa tải được đơn hàng. Vui lòng thử lại.';
        $('orders-retry').hidden = false; $('orders-login').hidden = !['UNAUTHENTICATED', 'SESSION_CHANGED'].includes(error.code);
    } finally { if (!disposed && attempt === version) $('orders-content').setAttribute('aria-busy', 'false'); }
}

function navigate(nextStatus, nextPage) {
    const query = new URLSearchParams(); if (nextStatus !== 'all') query.set('status', nextStatus); if (nextPage !== 1) query.set('page', String(nextPage));
    history.pushState(null, '', `orders.html${query.size ? '?' + query : ''}`); readQuery(); load();
}
for (const link of document.querySelectorAll('[data-order-filter]')) link.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(link.dataset.orderFilter, 1);
});
$('orders-previous').addEventListener('click', () => { if (page > 1) navigate(status, page - 1); });
$('orders-next').addEventListener('click', () => { if (page * perPage < total) navigate(status, page + 1); });
$('orders-retry').addEventListener('click', load); $('orders-login').addEventListener('click', () => $('login-button').click());
$('orders-list').addEventListener('click', async event => {
    const cancel = event.target.closest('[data-cancel-order]');
    if (cancel) {
        const value = rows.get(cancel.dataset.cancelOrder);
        if (value && !opening) cancellation.open(value, cancel);
        return;
    }
    const buy = event.target.closest('[data-reorder]');
    if (buy && user && !opening) {
        const value = rows.get(buy.dataset.reorder);
        if (value) await reorder.open(value, buy);
        return;
    }
    const button = event.target.closest('[data-pay-order]');
    const value = button && rows.get(button.dataset.payOrder);
    if (!value?.can_pay || !user || opening) return;
    opening = true;
    for (const pay of document.querySelectorAll('[data-pay-order]')) pay.disabled = true;
    const feedback = button.closest('article').querySelector('[data-pay-state]'), account = String(user.MaNguoiDung), attempt = version;
    feedback.textContent = 'Đang mở trang thanh toán SePay…';
    try {
        const data = await initializePayment(value.MaDonHang, account);
        if (disposed || attempt !== version || !user || String(user.MaNguoiDung) !== account) return;
        if (data.code !== 'PAYMENT_INITIALIZED') throw { code: 'INVALID_RESPONSE' };
        submitCheckout(data.payment, value);
    } catch (error) {
        if (!disposed && attempt === version) {
            feedback.textContent = paymentMessage(error);
            if (error.code === 'ORDER_ALREADY_PAID') await load();
        }
    } finally { opening = false; for (const pay of document.querySelectorAll('[data-pay-order]')) pay.disabled = false; }
});
window.addEventListener('popstate', () => { readQuery(); load(); });
window.addEventListener('auth-changed', event => {
    if (disposed || (user && String(event.detail?.user?.MaNguoiDung) === String(user.MaNguoiDung))) return;
    version++; clearPrivate(); load();
});
window.addEventListener('focus', () => { if (!disposed && !opening && !reorder.isOpen() && !cancellation.isOpen()) load(); });
window.addEventListener('pagehide', () => { disposed = true; version++; clearPrivate(); });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; readQuery(); load(); } });
readQuery(); load();
