import { getReorderOptions, reorderOrder } from '../api/orders.js';
import { reorderCheckoutUrl } from '../utils/checkout-selection.js';
import { money } from './cart.js';
import { validHttps } from '../utils/product-validation.js';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};

export function setupOrderReorder({ getUser, onAdded }) {
    const dialog = node('dialog', undefined, 'reorder-dialog'); dialog.id = 'reorder-dialog';
    dialog.setAttribute('aria-labelledby', 'reorder-title'); dialog.setAttribute('aria-describedby', 'reorder-note');
    const heading = node('header', undefined, 'reorder-heading'), title = node('h2', 'Chọn sản phẩm mua lại'); title.id = 'reorder-title';
    const close = node('button', '×', 'icon-button'); close.type = 'button'; close.setAttribute('aria-label', 'Đóng chọn sản phẩm mua lại');
    heading.append(title, close);
    const note = node('p', 'Giữ số lượng từ đơn cũ. Giá dưới đây là giá hiện tại trước khuyến mãi; ưu đãi được tính lại ở giỏ và trang xác nhận. Chọn “Mua ngay” để đến trang xác nhận; chọn “Thêm vào giỏ hàng” để cộng vào giỏ hiện tại.', 'reorder-note'); note.id = 'reorder-note';
    const state = node('p', '', 'reorder-state'); state.id = 'reorder-state'; state.setAttribute('role', 'status');
    const list = node('ul', undefined, 'reorder-list'); list.id = 'reorder-list'; list.setAttribute('aria-label', 'Sản phẩm có thể mua lại');
    const actions = node('footer', undefined, 'reorder-actions');
    const add = node('button', 'Thêm vào giỏ hàng', 'button button-outline'), buy = node('button', 'Mua ngay', 'button button-primary');
    add.id = 'reorder-add'; buy.id = 'reorder-buy'; add.type = buy.type = 'button';
    const cart = node('a', 'Kiểm tra giỏ hàng', 'quiet-link'); cart.href = 'cart.html'; cart.hidden = true;
    actions.append(add, buy); dialog.append(heading, note, state, list, cart, actions); document.body.append(dialog);
    let generation = 0, owner, orderId, opener, busy = false, uncertain = false;
    const selected = () => [...list.querySelectorAll('input:checked')].map(input => input.value);
    function sync() {
        add.disabled = buy.disabled = busy || uncertain || !selected().length;
        close.disabled = busy;
        for (const input of list.querySelectorAll('input')) input.disabled = busy || input.dataset.available !== 'true';
        dialog.setAttribute('aria-busy', String(busy));
    }
    function clear() {
        generation++; busy = false; owner = orderId = null; uncertain = false;
        list.replaceChildren(); state.textContent = ''; cart.hidden = true;
        if (dialog.open) dialog.close();
        sync();
    }
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => {
        generation++; list.replaceChildren(); state.textContent = ''; owner = orderId = null;
        if (opener?.isConnected) opener.focus();
    });
    close.addEventListener('click', () => dialog.close()); list.addEventListener('change', sync);
    function errorText(error) {
        return ({ OUT_OF_STOCK: 'Số lượng mua lại cộng với giỏ hiện tại vượt tồn kho. Hãy bỏ bớt sản phẩm hoặc điều chỉnh giỏ.',
            UNIT_NOT_FOUND: 'Có sản phẩm hoặc đơn vị không còn bán. Đóng và mở lại danh sách để kiểm tra.',
            UNIT_UNAVAILABLE: 'Có sản phẩm chưa có giá bán hợp lệ.', ORDER_NOT_REORDERABLE: 'Chỉ mua lại đơn đã giao hoặc đã hủy.',
            ORDER_NOT_FOUND: 'Không tìm thấy đơn thuộc tài khoản của bạn.', CART_QUANTITY_LIMIT: 'Số lượng vượt giới hạn của giỏ.',
            SESSION_CHANGED: 'Tài khoản đã thay đổi. Vui lòng mở lại đơn hàng.', UNAUTHENTICATED: 'Vui lòng đăng nhập lại.',
            CONNECTION_FAILED: 'Chưa xác định được kết quả. Hãy kiểm tra giỏ trước khi thêm lại để tránh cộng trùng số lượng.' })[error.code]
            || 'Chưa thực hiện được mua lại. Vui lòng thử lại.';
    }
    async function submit(immediate) {
        const ids = selected();
        if (busy || uncertain || !ids.length || !owner || String(getUser()?.MaNguoiDung) !== owner) return;
        if (immediate) {
            location.assign(reorderCheckoutUrl(orderId, ids));
            return;
        }
        const attempt = generation, account = owner, originalOrder = orderId;
        busy = true; sync(); state.textContent = 'Đang thêm các sản phẩm đã chọn…';
        try {
            const data = await reorderOrder(originalOrder, ids, account);
            if (attempt !== generation || account !== String(getUser()?.MaNguoiDung)) return;
            if (data.code !== 'ORDER_REORDERED' || !Array.isArray(data.unit_ids) || !data.unit_ids.length) throw { code: 'INVALID_RESPONSE' };
            window.dispatchEvent(new Event('cart-changed'));
            dialog.close(); onAdded();
        } catch (error) {
            if (attempt === generation) {
                state.textContent = errorText(error);
                uncertain = ['CONNECTION_FAILED', 'INVALID_RESPONSE'].includes(error.code);
                cart.hidden = !uncertain;
            }
        } finally { if (attempt === generation) { busy = false; sync(); } }
    }
    add.addEventListener('click', () => submit(false)); buy.addEventListener('click', () => submit(true));
    return {
        clear,
        isOpen: () => dialog.open,
        async open(value, trigger) {
            clear(); opener = trigger; owner = String(getUser()?.MaNguoiDung || ''); orderId = String(value.MaDonHang);
            if (!owner || ![3, 4].includes(value.TrangThaiDonHang)) return;
            const attempt = ++generation, account = owner;
            state.textContent = 'Đang kiểm tra sản phẩm và giá hiện tại…'; cart.hidden = true; uncertain = false;
            dialog.showModal(); close.focus(); sync();
            try {
                const data = await getReorderOptions(orderId);
                if (attempt !== generation || account !== String(getUser()?.MaNguoiDung) || !dialog.open) return;
                if (data.code !== 'REORDER_OPTIONS' || String(data.MaDonHang) !== orderId || !Array.isArray(data.items)) throw { code: 'INVALID_RESPONSE' };
                for (const item of data.items) {
                    const row = node('li'), label = node('label', undefined, 'reorder-row'), input = node('input'); input.type = 'checkbox';
                    input.value = item.MaChiTiet; input.checked = item.ConHang === true; input.dataset.available = String(item.ConHang === true);
                    const visual = node('span', 'Chưa có ảnh', 'orders-preview-image');
                    if (validHttps(item.HinhAnh)) {
                        const img = node('img'); img.src = item.HinhAnh; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
                        img.addEventListener('error', () => visual.replaceChildren(document.createTextNode('Chưa có ảnh')), { once: true }); visual.replaceChildren(img);
                    }
                    const description = node('span', undefined, 'reorder-description'); description.append(node('span', item.TenThuoc));
                    if (!item.ConHang) description.append(node('small', 'Không đủ tồn kho hoặc không còn bán'));
                    label.append(input, visual, description, node('strong', item.GiaBan === null ? 'Chưa có giá' : money(BigInt(item.GiaBan) * BigInt(item.SoLuong)), 'reorder-price'), node('span', `×${item.SoLuong} ${item.DonViTinh}`, 'reorder-quantity'));
                    row.append(label); list.append(row);
                }
                state.textContent = data.items.length ? 'Chọn những sản phẩm bạn muốn mua lại.' : 'Đơn không có sản phẩm có thể mua lại.';
                sync();
            } catch (error) { if (attempt === generation) { state.textContent = errorText(error); sync(); } }
        }
    };
}
