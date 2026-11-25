import { addCartItem, getCart } from '../api/cart.js';
import { notify } from './customer-notice.js';
import { promotionBadge } from '../utils/public-sale-format.js';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
export const money = value => `${new Intl.NumberFormat('vi-VN').format(BigInt(value))} ₫`;
const errorMessage = error => ({
    CONSULTATION_REQUIRED: 'Sản phẩm cần dược sĩ tư vấn trước khi mua. Hãy mở Nhắn tin.',
    CART_ITEM_NOT_FOUND: 'Sản phẩm không còn trong giỏ. Vui lòng tải lại giỏ hàng.',
    OUT_OF_STOCK: 'Đơn vị này đã hết hàng hoặc không còn lô đủ tồn và còn hạn. Vui lòng chọn đơn vị khác hoặc tải lại danh sách.',
    UNIT_NOT_FOUND: 'Đơn vị này không còn tồn tại. Hãy tải lại danh sách sản phẩm.',
    UNIT_UNAVAILABLE: 'Đơn vị này chưa có giá bán hợp lệ.',
    GUEST_CART_FULL: 'Giỏ khách đã có 50 đơn vị sản phẩm. Đăng nhập để lưu thêm hoặc xóa bớt trong giỏ.',
    CART_QUANTITY_LIMIT: 'Số lượng vượt giới hạn lưu trữ của giỏ hàng.',
    ACCOUNT_LOCKED: 'Tài khoản đang bị khóa. Vui lòng đăng xuất để tiếp tục với giỏ khách.',
    UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.',
    CSRF_FAILED: 'Phiên làm việc đã thay đổi. Vui lòng thử lại.',
    CONNECTION_FAILED: 'Chưa kết nối được nhà thuốc. Vui lòng kiểm tra kết nối và xem lại giỏ trước khi thêm lại.'
}[error.code] || 'Chưa cập nhật được giỏ hàng. Vui lòng thử lại.');

// Serialize mutations across cards so concurrent guest cookie updates do not overwrite each other.
let queue = Promise.resolve();
const serialize = work => {
    const task = queue.then(work);
    queue = task.catch(() => {});
    return task;
};
export function purchaseControls(product, { scope = '' } = {}) {
    const block = node('div', undefined, 'catalog-purchase');
    const units = (product.DonViGia || []).filter(unit => Number.isSafeInteger(unit.MaDonGia) && unit.MaDonGia > 0 &&
        Number.isSafeInteger(unit.GiaBan) && unit.GiaBan >= 0 && typeof unit.DonViTinh === 'string')
        .sort((a, b) => b.GiaBan - a.GiaBan || a.MaDonGia - b.MaDonGia);
    let selected = units[0];
    const contextSale = product.KhuyenMai;
    const hasSales = Boolean(contextSale || units.some(unit => unit.KhuyenMai));
    let sale = contextSale || selected?.KhuyenMai;
    const price = node('p', '', 'catalog-price');
    const original = node('p', '', 'sale-original-price'), quota = node('p', '', 'sale-quota');
    const promotionName = node('p', '', 'detail-promotion-name');
    const updatePrice = () => {
        const discounted = sale && Number.isSafeInteger(selected?.GiaKhuyenMai) && selected.GiaKhuyenMai < selected.GiaBan;
        price.textContent = product.PhanLoai === true ? 'Cần dược sĩ tư vấn' : selected ? `${money(discounted ? selected.GiaKhuyenMai : selected.GiaBan)} / ${selected.DonViTinh}` : 'Chưa có giá bán';
        original.replaceChildren();
        if (discounted && product.PhanLoai !== true) original.append(node('span', 'Giá gốc: ', 'sr-only'), node('s', money(selected.GiaBan)));
        original.hidden = !sale || product.PhanLoai === true;
        quota.textContent = selected && sale ? `${sale.TrangThai === 'UPCOMING' ? 'Dự kiến' : 'Còn'} ${selected.SoLuongKhuyenMai || 0} ${selected.DonViTinh} ưu đãi` : '';
        quota.hidden = !sale;
        promotionName.textContent = sale ? `${promotionBadge(sale)} · ${sale.TenChuongTrinh || 'Chương trình khuyến mãi'}` : '';
    };
    updatePrice();
    price.setAttribute('aria-live', 'polite');
    const status = node('p', '', 'catalog-purchase-status'); status.setAttribute('role', 'status');
    block.append(status);
    if (units.length > 1) {
        const fieldset = node('fieldset', undefined, 'catalog-unit-options');
        fieldset.append(node('legend', `Chọn đơn vị tính cho ${product.TenThuoc}`, 'sr-only'));
        for (const unit of units) {
            const label = node('label', undefined, 'catalog-unit-option'), radio = node('input');
            radio.type = 'radio'; radio.name = `${scope}product-unit-${product.MaThuoc}${contextSale ? `-sale-${contextSale.MaChuongTrinh}` : ''}`; radio.value = unit.MaDonGia;
            radio.setAttribute('aria-label', `${unit.DonViTinh}${unit.ConHang === true ? '' : ', hết hàng'}`);
            radio.checked = selected === unit;
            radio.addEventListener('change', () => { selected = unit; sale = contextSale || unit.KhuyenMai; updatePrice(); });
            label.append(radio, node('span', unit.DonViTinh)); fieldset.append(label);
        }
        block.append(fieldset);
    }
    let adding = false;
    const buy = node('button', undefined, 'button button-primary catalog-buy'); buy.type = 'button';
    if (product.PhanLoai === true) buy.classList.add('catalog-consult');
    const updateBuy = () => {
        const upcoming = sale?.TrangThai === 'UPCOMING';
        const hasOffer = !sale || selected?.SoLuongKhuyenMai > 0;
        const available = selected?.ConHang === true && hasOffer && !upcoming;
        buy.disabled = adding || !available;
        buy.textContent = upcoming ? 'Sắp diễn ra' : selected?.ConHang !== true ? 'Hết hàng' : !hasOffer ? 'Hết ưu đãi' : product.PhanLoai === true ? 'Nhắn tin' : 'Chọn mua';
        buy.setAttribute('aria-label', `${buy.textContent} ${product.TenThuoc}${selected ? `, ${selected.DonViTinh}` : ''}`);
    };
    block.addEventListener('change', updateBuy);
    updateBuy();
    buy.addEventListener('click', async () => {
        if (product.PhanLoai === true) {
            const dialog = buy.closest('dialog'); if (dialog?.open) dialog.close();
            window.dispatchEvent(new CustomEvent('chat-product', { detail: { MaThuoc: product.MaThuoc, MaDonGia: selected.MaDonGia } }));
            return;
        }
        adding = true; updateBuy(); const chosen = selected;
        status.textContent = 'Đang thêm vào giỏ…';
        try {
            await serialize(() => addCartItem(product.MaThuoc, chosen.MaDonGia));
            status.textContent = `Đã thêm 1 ${chosen.DonViTinh} vào giỏ hàng.`;
            notify(status.textContent);
            window.dispatchEvent(new Event('cart-changed'));
        } catch (error) {
            status.textContent = errorMessage(error);
            notify(status.textContent, 'error');
            if (error.code === 'OUT_OF_STOCK') chosen.ConHang = false;
        }
        finally { adding = false; updateBuy(); }
    });
    block.append(price);
    if (hasSales) block.append(original, quota);
    if (scope) block.append(promotionName);
    block.append(buy); return block;
}

export { errorMessage as cartErrorMessage };

export function setupCartBadge() {
    const link = document.querySelector('[data-cart]');
    if (!link || link.querySelector('.cart-count')) return;
    const icon = link.querySelector('svg');
    const wrapper = node('span', undefined, 'cart-header-icon');
    const badge = node('span', '', 'cart-count'); badge.hidden = true; badge.setAttribute('aria-hidden', 'true');
    icon.replaceWith(wrapper); wrapper.append(icon, badge);
    let version = 0, disposed = false;
    function render(data) {
        if (!Array.isArray(data.items)) return;
        const count = new Set(data.items.map(item => String(item.MaThuoc))).size;
        badge.textContent = String(count); badge.hidden = count === 0;
        link.setAttribute('aria-label', `Giỏ hàng, ${count} loại sản phẩm`);
    }
    async function refresh() {
        const attempt = ++version;
        try {
            const data = await getCart();
            if (!disposed && attempt === version) render(data);
        } catch {
            if (!disposed && attempt === version) { badge.hidden = true; link.setAttribute('aria-label', 'Giỏ hàng'); }
        }
    }
    window.addEventListener('cart-updated', event => { if (!disposed) { version++; render(event.detail); } });
    window.addEventListener('cart-changed', refresh);
    window.addEventListener('auth-changed', refresh);
    window.addEventListener('pagehide', () => { disposed = true; version++; });
    window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; refresh(); } });
    refresh();
}
