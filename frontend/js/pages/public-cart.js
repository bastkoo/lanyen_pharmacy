import { getCart, updateCartItem, removeCartItem, quoteCart } from '../api/cart.js';
import { money, cartErrorMessage } from '../components/cart.js';
import { notify } from '../components/customer-notice.js';
import { openProductDetail } from '../components/public-product-detail.js';
import { validHttps } from '../utils/product-validation.js';
import { checkoutUrl } from '../utils/checkout-selection.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
let items = [], selected = null, prices = new Map(), authenticated, busy = false, version = 0, quoteVersion = 0, disposed = false, pendingFocus;
let checkoutReady = false;
const selectionOverrides = new Map();
const usable = item => item.GiaBan !== null && item.ConHang === true;
function button(text, label, action, className) {
    const result = node('button', text, className); result.type = 'button'; result.setAttribute('aria-label', label);
    result.addEventListener('click', action); return result;
}
function renderRows() {
    const focus = document.activeElement?.dataset.focus || (document.activeElement === document.body ? pendingFocus : undefined);
    if (focus) pendingFocus = focus;
    $('cart-lines').replaceChildren();
    for (const item of items) {
        const priced = prices.get(item.MaDonGia) || item;
        const row = node('li', undefined, 'cart-row'); row.dataset.unitId = item.MaDonGia;
        const selectLabel = node('label', undefined, 'cart-select'), check = node('input'); check.type = 'checkbox';
        check.checked = selected.has(item.MaDonGia); check.disabled = busy || !usable(item); check.dataset.focus = `select-${item.MaDonGia}`;
        check.addEventListener('change', () => { if (check.checked) selected.add(item.MaDonGia); else selected.delete(item.MaDonGia); refreshQuote(); });
        selectLabel.append(check, node('span', `Chọn ${item.TenThuoc}, ${item.DonViTinh}`, 'sr-only'));
        const picture = button('', `Xem chi tiết ${item.TenThuoc}`, () => openProductDetail(item.MaThuoc, undefined, picture), 'cart-image');
        picture.disabled = busy;
        if (validHttps(item.HinhAnh)) {
            const image = node('img'); image.src = item.HinhAnh; image.alt = ''; image.width = 64; image.height = 76; image.referrerPolicy = 'no-referrer';
            image.addEventListener('error', () => picture.replaceChildren(node('span', 'Chưa có ảnh'))); picture.append(image);
        } else picture.textContent = 'Chưa có ảnh';
        const info = node('div', undefined, 'cart-product-info'), heading = node('h2');
        const name = button(item.TenThuoc, `Xem chi tiết ${item.TenThuoc}`, () => openProductDetail(item.MaThuoc, undefined, name), 'product-detail-trigger'); name.disabled = busy;
        heading.append(name); info.append(heading, node('p', item.QuyCachDongGoi || 'Chưa có quy cách đóng gói'));
        const price = node('div', priced.GiaBan === null ? 'Chưa có giá bán' : money(priced.GiaBan), 'cart-row-price');
        if (priced.KhuyenMai) price.append(node('s', money(priced.GiaGoc)));
        const quantity = node('div', undefined, 'cart-quantity'), input = node('input');
        const save = value => {
            const number = Number(value);
            if (!/^[0-9]+$/.test(String(value)) || !Number.isSafeInteger(number) || number < 1 || number > 2147483647) {
                input.value = item.SoLuong; notify('Số lượng phải là số nguyên từ 1 đến 2.147.483.647.', 'error'); return;
            }
            if (number !== item.SoLuong) mutate(() => updateCartItem(item.MaDonGia, item.MaDonGia, number), 'Đã cập nhật số lượng.');
        };
        const minus = button('−', `Giảm số lượng ${item.TenThuoc}`, () => save(item.SoLuong - 1));
        const plus = button('+', `Tăng số lượng ${item.TenThuoc}`, () => save(item.SoLuong + 1));
        minus.disabled = busy || item.SoLuong <= 1; plus.disabled = busy || item.SoLuong >= 2147483647;
        minus.dataset.focus = `minus-${item.MaDonGia}`; plus.dataset.focus = `plus-${item.MaDonGia}`;
        input.type = 'number'; input.min = 1; input.max = 2147483647; input.step = 1; input.inputMode = 'numeric'; input.value = item.SoLuong;
        input.setAttribute('aria-label', `Số lượng ${item.TenThuoc}`); input.dataset.focus = `quantity-${item.MaDonGia}`; input.disabled = busy;
        input.addEventListener('change', () => save(input.value));
        input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); save(input.value); } });
        quantity.append(minus, input, plus);
        const units = node('select'); units.setAttribute('aria-label', `Đơn vị ${item.TenThuoc}`); units.dataset.focus = `unit-${item.MaDonGia}`; units.disabled = busy;
        for (const unit of item.DonViGia || []) {
            const option = new Option(`${unit.DonViTinh}${unit.ConHang ? '' : ' (Hết hàng)'}`, String(unit.MaDonGia));
            option.disabled = !unit.ConHang; units.append(option);
        }
        if (![...units.options].some(option => option.value === String(item.MaDonGia))) units.append(new Option(item.DonViTinh || 'Không khả dụng', String(item.MaDonGia)));
        units.value = String(item.MaDonGia);
        units.addEventListener('change', () => {
            const destination = Number(units.value), wasSelected = selected.has(item.MaDonGia);
            mutate(() => updateCartItem(item.MaDonGia, destination, item.SoLuong), 'Đã cập nhật đơn vị tính.', () => {
                const selectDestination = selected.has(destination) || wasSelected;
                selected.delete(item.MaDonGia); selectionOverrides.set(destination, selectDestination);
                if (selectDestination) selected.add(destination);
            });
        });
        const remove = button('×', `Xóa ${item.TenThuoc}, ${item.DonViTinh}`, () => mutate(() => removeCartItem(item.MaDonGia), 'Đã xóa sản phẩm khỏi giỏ hàng.', () => selected.delete(item.MaDonGia)), 'cart-remove'); remove.disabled = busy;
        row.append(selectLabel, picture, info, price, quantity, units, remove);
        if (priced.KhuyenMai && BigInt(priced.GiaGoc) > BigInt(priced.GiaBan)) {
            const count = priced.SoLuongKhuyenMai, regular = item.SoLuong - count;
            const offer = node('div', undefined, 'cart-offer');
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
            // Inline paths keep the voucher visible even when an older icon sprite is cached.
            const ticket = document.createElementNS(icon.namespaceURI, 'path');
            ticket.setAttribute('d', 'M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Z M9 15l6-6');
            icon.append(ticket);
            for (const coordinate of [9, 15]) {
                const dot = document.createElementNS(icon.namespaceURI, 'circle');
                dot.setAttribute('cx', coordinate); dot.setAttribute('cy', coordinate); dot.setAttribute('r', '1'); icon.append(dot);
            }
            const description = node('div');
            const discount = priced.KhuyenMai.LoaiGiamGia === true
                ? `Giảm ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(priced.KhuyenMai.GiaTriGiam))}%`
                : `Giảm ${money(BigInt(priced.GiaGoc) - BigInt(priced.GiaBan))} / ${item.DonViTinh}`;
            description.append(node('strong', discount), node('p', `${priced.KhuyenMai.TenChuongTrinh}: ${count} ${item.DonViTinh} được ưu đãi${regular ? `; ${regular} ${item.DonViTinh} còn lại tính giá gốc` : ''}.`));
            offer.append(icon, description); row.append(offer);
        }
        if (!usable(item)) row.append(node('p', item.GiaBan === null ? 'Đơn vị này không còn khả dụng. Bạn có thể đổi đơn vị hoặc xóa khỏi giỏ.' : 'Tồn kho còn hạn không đủ số lượng này. Hãy giảm số lượng hoặc đổi đơn vị.', 'cart-unavailable'));
        $('cart-lines').append(row);
    }
    const candidates = items.filter(usable);
    $('cart-select-all').checked = candidates.length > 0 && candidates.every(item => selected.has(item.MaDonGia));
    $('cart-select-all').indeterminate = selected.size > 0 && !$('cart-select-all').checked;
    $('cart-select-all').disabled = busy || !candidates.length;
    document.querySelector('.cart-checkout').disabled = busy || !checkoutReady;
    $('cart-select-count').textContent = `Chọn tất cả (${items.length})`;
    if (focus && !busy) { ([...document.querySelectorAll('[data-focus]')].find(element => element.dataset.focus === focus && !element.disabled) || $('cart-select-all')).focus({ preventScroll: true }); pendingFocus = undefined; }
}
function renderTotals(data) {
    checkoutReady = data.items.length > 0 && data.items.every(usable);
    const total = BigInt(data.total);
    const original = data.items.reduce((sum, item) => sum + BigInt(item.GiaGoc ?? item.GiaBan ?? 0) * BigInt(item.SoLuong), 0n);
    const offers = new Set(data.items.filter(item => item.KhuyenMai).map(item => item.KhuyenMai.MaChuongTrinh));
    $('cart-original-total').textContent = money(original); $('cart-discount-total').textContent = `−${money(original - total)}`;
    $('cart-discount-total').parentElement.hidden = original <= total;
    $('cart-final-total').textContent = money(total);
    $('cart-offer-summary').textContent = offers.size ? `Đã áp dụng ${offers.size} ưu đãi cho sản phẩm được chọn.` : 'Chưa có ưu đãi áp dụng cho sản phẩm được chọn.';
    $('cart-offer-summary').hidden = original <= total;
    $('cart-selected-count').textContent = `Tạm tính (${data.items.length} sản phẩm)`;
}
async function refreshQuote(fullCart) {
    checkoutReady = false;
    const attempt = ++quoteVersion; busy = true; renderRows(); $('cart-summary').setAttribute('aria-busy', 'true');
    $('cart-discount-total').parentElement.hidden = true; $('cart-offer-summary').hidden = true;
    for (const id of ['cart-original-total', 'cart-discount-total', 'cart-final-total']) $(id).textContent = '…';
    try {
        const data = !selected.size ? { items: [], total: 0 } : fullCart && selected.size === items.length ? fullCart : await quoteCart([...selected]);
        if (attempt !== quoteVersion || disposed) return;
        if (!Array.isArray(data.items) || data.total === undefined) throw new Error('INVALID_RESPONSE');
        prices = new Map(data.items.map(item => [item.MaDonGia, item])); renderTotals(data);
    } catch (error) {
        if (attempt !== quoteVersion || disposed) return;
        $('cart-state').textContent = cartErrorMessage(error); $('cart-retry').hidden = false;
        for (const id of ['cart-original-total', 'cart-discount-total', 'cart-final-total']) $(id).textContent = '—';
    } finally {
        if (attempt === quoteVersion && !disposed) { busy = false; renderRows(); $('cart-summary').setAttribute('aria-busy', 'false'); }
    }
}
async function load() {
    if (busy || disposed) return;
    checkoutReady = false; document.querySelector('.cart-checkout').disabled = true;
    const attempt = ++version; $('cart-state').textContent = 'Đang tải giỏ hàng…'; $('cart-retry').hidden = true;
    try {
        const data = await getCart();
        if (attempt !== version || disposed) return;
        if (data.code !== 'CART_LISTED' || !Array.isArray(data.items)) throw new Error('INVALID_RESPONSE');
        const known = new Set(items.map(item => item.MaDonGia));
        if (selected === null || authenticated !== data.authenticated) selected = new Set(data.items.filter(usable).map(item => item.MaDonGia));
        else selected = new Set(data.items.filter(item => usable(item) && (selectionOverrides.has(item.MaDonGia) ? selectionOverrides.get(item.MaDonGia) : selected.has(item.MaDonGia) || !known.has(item.MaDonGia))).map(item => item.MaDonGia));
        selectionOverrides.clear();
        items = data.items; authenticated = data.authenticated; prices = new Map();
        window.dispatchEvent(new CustomEvent('cart-updated', { detail: data }));
        $('cart-account-note').textContent = authenticated ? 'Giỏ hàng của bạn.' : 'Đăng nhập để lưu giỏ hàng trong tài khoản.';
        $('cart-state').textContent = ''; $('cart-layout').hidden = !items.length; $('cart-empty').hidden = Boolean(items.length);
        renderRows(); await refreshQuote(data);
    } catch (error) {
        if (attempt !== version || disposed) return;
        $('cart-state').textContent = cartErrorMessage(error); $('cart-retry').hidden = false;
    }
}
async function mutate(task, message, committed) {
    if (busy) return;
    busy = true; version++; quoteVersion++; renderRows();
    try {
        await task(); if (disposed) return;
        committed?.(); notify(message); busy = false; await load();
    } catch (error) { if (!disposed) { notify(cartErrorMessage(error), 'error'); $('cart-state').textContent = cartErrorMessage(error); $('cart-retry').hidden = false; } }
    finally { if (!disposed) { busy = false; renderRows(); } }
}
$('cart-select-all').addEventListener('change', () => { selected = new Set($('cart-select-all').checked ? items.filter(usable).map(item => item.MaDonGia) : []); refreshQuote(); });
document.querySelector('.cart-checkout').addEventListener('click', () => {
    if (busy || !checkoutReady) return;
    try { window.location.assign(checkoutUrl([...selected])); }
    catch { $('cart-state').textContent = 'Chọn từ 1 đến 1.000 dòng sản phẩm để tiếp tục.'; }
});
$('cart-retry').addEventListener('click', load);
window.addEventListener('auth-changed', load);
window.addEventListener('cart-changed', load);
window.addEventListener('pagehide', () => { disposed = true; version++; quoteVersion++; });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; busy = false; load(); } });
load();
