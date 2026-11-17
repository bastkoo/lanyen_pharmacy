import { quoteCart } from '../api/cart.js';
import { getSession, getAddresses } from '../api/auth.js';
import { money, cartErrorMessage } from '../components/cart.js';
import { authMessage } from '../components/auth-dialog.js';
import { validHttps } from '../utils/product-validation.js';
import { readCheckoutSelection } from '../utils/checkout-selection.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result; };
let selectedUnits, invalidSelection = false;
try { selectedUnits = readCheckoutSelection(location.search); } catch { selectedUnits = []; invalidSelection = true; }
let user, known = false, currentKey, addresses = [], addressId = null, addressChoice = null;
let quoteVersion = 0, addressVersion = 0, sessionVersion = 0, disposed = false;
const key = value => value ? String(value.MaNguoiDung) : 'guest';

function showReceipt() {
    const delivery = document.querySelector('input[name="receipt"]:checked').value === 'delivery';
    $('checkout-delivery').hidden = !delivery; $('checkout-pickup').hidden = delivery;
    $('checkout-shipping').textContent = delivery ? 'Xác nhận theo địa chỉ' : 'Không áp dụng';
    $('checkout-total-note').textContent = delivery ? 'Chưa bao gồm phí giao hàng nếu có.' : 'Nhận hàng tại nhà thuốc Lan Yến.';
}
function showPayment() { $('checkout-qr-state').hidden = document.querySelector('input[name="payment"]:checked').value !== 'qr'; }
function renderAddress() {
    const selected = addresses.find(address => String(address.MaDiaChi) === addressId);
    $('checkout-address').hidden = !selected;
    $('checkout-change-address').hidden = !addresses.length;
    $('checkout-login').hidden = Boolean(user); $('checkout-add-address').hidden = !user;
    $('checkout-recipient').textContent = user ? `${user.HoTen} · ${user.SDT}` : '';
    $('checkout-address-badge').textContent = selected?.DiaChiGiao ? 'Địa chỉ chính' : 'Địa chỉ nhận hàng đã chọn';
    $('checkout-street').textContent = selected?.DiaChiCuThe || '';
    $('checkout-locality').textContent = selected ? `${selected.PhuongXa}, ${selected.TinhThanh}` : '';
    $('checkout-address-state').textContent = !user ? 'Đăng nhập để sử dụng địa chỉ nhận hàng trong tài khoản.' : selected ? '' : 'Bạn chưa có địa chỉ nhận hàng. Hãy thêm địa chỉ trước khi giao hàng tận nơi.';
}
async function loadAddresses() {
    const attempt = ++addressVersion, account = currentKey;
    $('checkout-address-retry').hidden = true;
    if (!user) { addresses = []; addressId = null; renderAddress(); return; }
    $('checkout-address-state').textContent = 'Đang tải địa chỉ nhận hàng…'; $('checkout-address').hidden = true; $('checkout-change-address').hidden = true;
    try {
        const data = await getAddresses(user.MaNguoiDung);
        if (disposed || attempt !== addressVersion || account !== currentKey) return;
        if (data.code !== 'ADDRESSES_LISTED' || !Array.isArray(data.items)) throw { code: 'INVALID_RESPONSE' };
        addresses = data.items;
        const selected = addresses.find(address => String(address.MaDiaChi) === addressId) || addresses.find(address => address.DiaChiGiao) || addresses[0];
        addressId = selected ? String(selected.MaDiaChi) : null; renderAddress();
    } catch (error) {
        if (disposed || attempt !== addressVersion || account !== currentKey) return;
        addresses = []; addressId = null; renderAddress();
        $('checkout-address-state').textContent = error.code === 'SESSION_CHANGED' ? 'Tài khoản đăng nhập đã thay đổi. Vui lòng tải lại thông tin.' : authMessage(error);
        $('checkout-address-retry').hidden = false;
        if (['SESSION_CHANGED', 'UNAUTHENTICATED', 'ACCOUNT_LOCKED'].includes(error.code)) window.dispatchEvent(new Event('focus'));
    }
}
function renderProducts(data) {
    $('checkout-products').replaceChildren();
    for (const item of data.items) {
        const row = node('li', undefined, 'checkout-product'); row.dataset.unitId = item.MaDonGia;
        const visual = node('div', 'Chưa có ảnh', 'checkout-product-image');
        if (validHttps(item.HinhAnh)) {
            const image = node('img'); image.src = item.HinhAnh; image.alt = ''; image.width = 64; image.height = 76; image.referrerPolicy = 'no-referrer';
            image.addEventListener('error', () => visual.replaceChildren(document.createTextNode('Chưa có ảnh')), { once: true }); visual.replaceChildren(image);
        }
        const detail = node('div', undefined, 'checkout-product-description');
        detail.append(node('h3', item.QuyCachDongGoi ? `${item.TenThuoc} (${item.QuyCachDongGoi})` : item.TenThuoc));
        detail.append(node('p', item.GiaBan === null ? 'Chưa có giá bán' : `${money(item.GiaBan)} / ${item.DonViTinh}`));
        const price = node('div', item.ThanhTien === null ? '—' : money(item.ThanhTien), 'checkout-product-price');
        if (item.KhuyenMai) price.append(node('s', money(BigInt(item.GiaGoc) * BigInt(item.SoLuong))));
        price.append(node('span', `× ${item.SoLuong} ${item.DonViTinh}`)); row.append(visual, detail, price);
        if (item.KhuyenMai && BigInt(item.GiaGoc) > BigInt(item.GiaBan)) {
            const value = Number(item.KhuyenMai.GiaTriGiam);
            const discount = item.KhuyenMai.LoaiGiamGia === true && Number.isFinite(value)
                ? `Giảm ${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)}%`
                : `Giảm ${money(BigInt(item.GiaGoc) - BigInt(item.GiaBan))} / ${item.DonViTinh}`;
            const regular = item.SoLuong - item.SoLuongKhuyenMai;
            row.append(node('p', `${discount} · ${item.KhuyenMai.TenChuongTrinh}: ${item.SoLuongKhuyenMai} ${item.DonViTinh} được ưu đãi${regular ? `; ${regular} ${item.DonViTinh} còn lại tính giá gốc` : ''}.`, 'checkout-product-offer'));
        }
        if (!item.ConHang) row.append(node('p', 'Không đủ tồn kho còn hạn cho số lượng này. Hãy trở về giỏ hàng để điều chỉnh.', 'checkout-product-unavailable'));
        $('checkout-products').append(row);
    }
    $('checkout-product-count').textContent = `${new Set(data.items.map(item => String(item.MaThuoc))).size} loại sản phẩm`;
    const total = BigInt(data.total);
    const original = data.items.reduce((sum, item) => sum + BigInt(item.GiaGoc ?? item.GiaBan ?? 0) * BigInt(item.SoLuong), 0n);
    const available = data.items.every(item => item.GiaBan !== null && item.ConHang === true);
    $('checkout-original').textContent = available ? money(original) : '—'; $('checkout-total').textContent = available ? money(total) : '—';
    $('checkout-discount').textContent = `−${money(original - total)}`; $('checkout-discount-row').hidden = !available || original <= total;
    const offers = new Set(data.items.filter(item => item.KhuyenMai).map(item => item.KhuyenMai.MaChuongTrinh));
    $('checkout-offers').textContent = `Đã áp dụng ${offers.size} ưu đãi cho sản phẩm được chọn.`; $('checkout-offers').hidden = !available || original <= total;
    $('checkout-state').textContent = available ? '' : 'Một số sản phẩm đã thay đổi tình trạng tồn kho. Vui lòng kiểm tra lại giỏ hàng.';
}
async function loadQuote() {
    const attempt = ++quoteVersion;
    $('checkout-layout').hidden = true; $('checkout-retry').hidden = true;
    if (!selectedUnits.length) { $('checkout-state').textContent = invalidSelection ? 'Đường dẫn sản phẩm chưa hợp lệ. Trở về giỏ hàng để chọn lại.' : 'Chưa có sản phẩm được chọn. Trở về giỏ hàng và chọn sản phẩm muốn mua.'; return; }
    $('checkout-state').textContent = 'Đang kiểm tra giá và sản phẩm đã chọn…';
    try {
        const data = await quoteCart(selectedUnits);
        if (disposed || attempt !== quoteVersion) return;
        if (data.code !== 'CART_LISTED' || !Array.isArray(data.items) || data.total === undefined) throw { code: 'INVALID_RESPONSE' };
        if (data.items.length !== selectedUnits.length || data.items.some(item => !selectedUnits.includes(item.MaDonGia))) {
            $('checkout-state').textContent = 'Giỏ hàng đã thay đổi hoặc sản phẩm đã được xóa. Trở về giỏ hàng để chọn lại.'; return;
        }
        renderProducts(data); $('checkout-layout').hidden = false;
    } catch (error) {
        if (disposed || attempt !== quoteVersion) return;
        $('checkout-state').textContent = cartErrorMessage(error); $('checkout-retry').hidden = false;
    }
}
function receive(next, force = false) {
    sessionVersion++;
    const changed = !known || currentKey !== key(next);
    if (known && changed) {
        if (currentKey !== 'guest') $('checkout-note').value = '';
        addresses = []; addressId = null;
        $('checkout-products').replaceChildren(); $('checkout-layout').hidden = true;
        if ($('checkout-address-dialog').open) $('checkout-address-dialog').close();
        $('checkout-address-options').replaceChildren();
        for (const id of ['checkout-original', 'checkout-discount', 'checkout-total']) $(id).textContent = '—';
    }
    user = next || null; currentKey = key(user); known = true;
    if (changed || force) { renderAddress(); loadQuote(); loadAddresses(); }
    else $('checkout-recipient').textContent = user ? `${user.HoTen} · ${user.SDT}` : '';
}
async function initialize() {
    const attempt = ++sessionVersion;
    try { const data = await getSession(); if (!disposed && attempt === sessionVersion) receive(data.user, true); }
    catch (error) {
        if (disposed || attempt !== sessionVersion) return;
        if (['UNAUTHENTICATED', 'ACCOUNT_LOCKED', 'FORBIDDEN'].includes(error.code)) receive(null, true);
        else { $('checkout-state').textContent = authMessage(error); $('checkout-retry').hidden = false; }
    }
}
$('checkout-change-address').addEventListener('click', () => {
    $('checkout-address-options').replaceChildren(node('legend', 'Địa chỉ nhận hàng của bạn', 'sr-only'));
    addressChoice = addressId;
    for (const address of addresses) {
        const label = node('label'), input = node('input'); input.type = 'radio'; input.name = 'delivery-address'; input.value = String(address.MaDiaChi); input.checked = input.value === addressId;
        input.addEventListener('change', () => { addressChoice = input.value; });
        label.append(input, node('span', `${address.DiaChiCuThe}, ${address.PhuongXa}, ${address.TinhThanh}${address.DiaChiGiao ? ' · Địa chỉ chính' : ''}`)); $('checkout-address-options').append(label);
    }
    $('checkout-address-dialog').showModal(); ($('checkout-address-options').querySelector('input:checked') || $('checkout-address-close')).focus();
});
$('checkout-address-done').addEventListener('click', () => { if (addresses.some(address => String(address.MaDiaChi) === addressChoice)) { addressId = addressChoice; renderAddress(); } $('checkout-address-dialog').close(); });
$('checkout-address-close').addEventListener('click', () => $('checkout-address-dialog').close());
$('checkout-address-dialog').addEventListener('close', () => { if (!$('checkout-change-address').hidden) $('checkout-change-address').focus({ preventScroll: true }); });
$('checkout-login').addEventListener('click', () => $('login-button').click());
$('checkout-address-retry').addEventListener('click', loadAddresses);
$('checkout-retry').addEventListener('click', initialize);
for (const input of document.querySelectorAll('input[name="receipt"]')) input.addEventListener('change', showReceipt);
for (const input of document.querySelectorAll('input[name="payment"]')) input.addEventListener('change', showPayment);
window.addEventListener('auth-changed', event => { if (!disposed) receive(event.detail?.user); });
window.addEventListener('cart-changed', loadQuote);
window.addEventListener('pagehide', () => { disposed = true; quoteVersion++; addressVersion++; sessionVersion++; });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; initialize(); } });
showReceipt(); showPayment(); initialize();
