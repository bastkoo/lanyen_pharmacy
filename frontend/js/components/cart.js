import { getCart, addCartItem, removeCartItem } from '../api/cart.js';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
export const money = value => `${new Intl.NumberFormat('vi-VN').format(BigInt(value))} ₫`;
const errorMessage = error => ({
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
export function purchaseControls(product) {
    const block = node('div', undefined, 'catalog-purchase');
    const units = (product.DonViGia || []).filter(unit => Number.isSafeInteger(unit.MaDonGia) && unit.MaDonGia > 0 &&
        Number.isSafeInteger(unit.GiaBan) && unit.GiaBan >= 0 && typeof unit.DonViTinh === 'string')
        .sort((a, b) => b.GiaBan - a.GiaBan || a.MaDonGia - b.MaDonGia);
    let selected = units[0];
    const price = node('p', selected ? `${money(selected.GiaBan)} / ${selected.DonViTinh}` : 'Chưa có giá bán', 'catalog-price');
    price.setAttribute('aria-live', 'polite');
    const status = node('p', '', 'catalog-purchase-status'); status.setAttribute('role', 'status');
    block.append(status);
    if (units.length > 1) {
        const fieldset = node('fieldset', undefined, 'catalog-unit-options');
        fieldset.append(node('legend', `Chọn đơn vị tính cho ${product.TenThuoc}`, 'sr-only'));
        for (const unit of units) {
            const label = node('label', undefined, 'catalog-unit-option'), radio = node('input');
            radio.type = 'radio'; radio.name = `product-unit-${product.MaThuoc}`; radio.value = unit.MaDonGia;
            radio.setAttribute('aria-label', `${unit.DonViTinh}${unit.ConHang === true ? '' : ', hết hàng'}`);
            radio.checked = selected === unit;
            radio.addEventListener('change', () => { selected = unit; price.textContent = `${money(unit.GiaBan)} / ${unit.DonViTinh}`; });
            label.append(radio, node('span', unit.DonViTinh)); fieldset.append(label);
        }
        block.append(fieldset);
    }
    let adding = false;
    const buy = node('button', undefined, 'button button-primary catalog-buy'); buy.type = 'button';
    const updateBuy = () => {
        const available = selected?.ConHang === true;
        buy.disabled = adding || !available;
        buy.textContent = available ? 'Chọn mua' : 'Hết hàng';
        buy.setAttribute('aria-label', `${available ? 'Chọn mua' : 'Hết hàng'} ${product.TenThuoc}${selected ? `, ${selected.DonViTinh}` : ''}`);
    };
    block.addEventListener('change', updateBuy);
    updateBuy();
    buy.addEventListener('click', async () => {
        adding = true; updateBuy(); const chosen = selected;
        status.textContent = 'Đang thêm vào giỏ…';
        try {
            await serialize(() => addCartItem(product.MaThuoc, chosen.MaDonGia));
            status.textContent = `Đã thêm 1 ${chosen.DonViTinh} vào giỏ hàng.`;
            window.dispatchEvent(new Event('cart-changed'));
        } catch (error) {
            status.textContent = errorMessage(error);
            if (error.code === 'OUT_OF_STOCK') chosen.ConHang = false;
        }
        finally { adding = false; updateBuy(); }
    });
    block.append(price, buy); return block;
}

export function setupCart() {
    const triggers = document.querySelectorAll('[data-cart]');
    if (!triggers.length) return;
    const dialog = node('dialog', undefined, 'cart-dialog'); dialog.id = 'cart-dialog';
    dialog.setAttribute('aria-labelledby', 'cart-title');
    const close = node('button', 'Đóng', 'quiet-link'); close.type = 'button';
    const title = node('h2', 'Giỏ hàng'); title.id = 'cart-title';
    const status = node('p'); status.setAttribute('role', 'status');
    const note = node('p', '', 'catalog-product-meta'), list = node('ul', undefined, 'cart-items');
    const total = node('p', '', 'catalog-price'), retry = node('button', 'Tải lại giỏ hàng', 'button button-secondary'); retry.type = 'button';
    dialog.append(close, title, status, note, list, total, retry); document.body.append(dialog);
    let opener, version = 0;
    async function load() {
        const attempt = ++version; status.textContent = 'Đang tải giỏ hàng…'; retry.hidden = true;
        list.replaceChildren(); total.textContent = ''; note.textContent = '';
        try {
            await queue;
            const data = await getCart();
            if (attempt !== version || !dialog.open) return;
            if (!Array.isArray(data.items) || data.code !== 'CART_LISTED') throw new Error('INVALID_RESPONSE');
            status.textContent = data.items.length ? '' : 'Giỏ hàng chưa có sản phẩm.';
            note.textContent = data.authenticated ? 'Giỏ hàng được lưu trong tài khoản của bạn.' : 'Giỏ hàng đang lưu trong phiên truy cập. Khi đăng nhập, các sản phẩm sẽ được thêm vào giỏ tài khoản.';
            for (const item of data.items) {
                const row = node('li'), heading = node('h3', item.TenThuoc);
                const remove = node('button', 'Xóa', 'quiet-link'); remove.type = 'button'; remove.setAttribute('aria-label', `Xóa ${item.TenThuoc}, ${item.DonViTinh}`);
                remove.addEventListener('click', async () => {
                    remove.disabled = true;
                    try { await serialize(() => removeCartItem(item.MaDonGia)); await load(); retry.hidden = false; retry.focus(); }
                    catch (error) { status.textContent = errorMessage(error); remove.disabled = false; }
                });
                row.append(heading, node('p', `Quy cách đóng gói: ${item.QuyCachDongGoi || 'Chưa có thông tin'}`),
                    node('p', `${item.SoLuong} ${item.DonViTinh}${item.GiaBan === null ? ' · Không còn khả dụng' : ` × ${money(item.GiaBan)} = ${money(item.ThanhTien)}`}`), remove);
                list.append(row);
            }
            total.textContent = `Tạm tính: ${money(data.total)}`;
        } catch (error) { if (attempt === version) { status.textContent = errorMessage(error); retry.hidden = false; } }
    }
    for (const trigger of triggers) trigger.addEventListener('click', () => { opener = trigger; dialog.showModal(); close.focus(); load(); });
    close.addEventListener('click', () => dialog.close());
    retry.addEventListener('click', load);
    dialog.addEventListener('close', () => { version++; opener?.focus(); });
    window.addEventListener('cart-changed', () => { if (dialog.open) load(); });
    window.addEventListener('auth-changed', () => { if (dialog.open) load(); });
}
