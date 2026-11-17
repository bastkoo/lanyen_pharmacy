import { getPublicProduct } from '../api/public-catalog.js';
import { purchaseControls } from './cart.js';
import { validHttps } from '../utils/product-validation.js';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
let dialog, title, content, status, retry, controller, version = 0, opener, selection;

function buildDialog() {
    dialog = node('dialog', undefined, 'product-detail-dialog'); dialog.id = 'product-detail-dialog';
    dialog.setAttribute('aria-labelledby', 'product-detail-title');
    const close = node('button', 'Đóng', 'quiet-link product-detail-close'); close.type = 'button';
    title = node('h2', 'Chi tiết thuốc'); title.id = 'product-detail-title';
    status = node('p'); status.setAttribute('role', 'status');
    retry = node('button', 'Thử tải chi tiết lại', 'quiet-link'); retry.type = 'button'; retry.hidden = true;
    content = node('div', undefined, 'product-detail-content');
    dialog.append(close, title, status, retry, content); document.body.append(dialog);
    close.addEventListener('click', () => dialog.close()); retry.addEventListener('click', load);
    dialog.addEventListener('close', () => { if (dialog.open) return; version++; controller?.abort(); if (opener?.isConnected) opener.focus(); });
    window.addEventListener('pagehide', () => { version++; controller?.abort(); if (dialog.open) dialog.close(); });
}

function render(product) {
    const overview = node('div', undefined, 'product-detail-overview');
    const visual = node('div', undefined, 'product-detail-image');
    const fallback = node('p', 'Chưa có ảnh'); visual.append(fallback);
    if (validHttps(product.HinhAnh)) {
        const image = node('img'); image.src = product.HinhAnh; image.alt = product.TenThuoc;
        image.width = 360; image.height = 260; image.referrerPolicy = 'no-referrer';
        fallback.hidden = true; image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; }); visual.append(image);
    }
    const buying = node('div', undefined, 'product-detail-buying');
    buying.append(node('h3', 'Đơn vị và giá bán'), purchaseControls(product, { scope: 'detail-' }));
    if (product.KhuyenMai?.TrangThai === 'UPCOMING') buying.prepend(node('p', 'Xem trước ưu đãi sắp diễn ra.', 'detail-promotion-name'));
    overview.append(visual, buying);
    const specifications = node('dl', undefined, 'product-detail-specifications');
    const values = [
        ['Danh mục', product.TenLoaiThuoc], ['Quy cách đóng gói', product.QuyCachDongGoi],
        ['Kê đơn', product.KeDon === true ? 'Thuốc kê đơn' : product.KeDon === false ? 'Thuốc không kê đơn' : 'Chưa có thông tin'],
        ['Tư vấn dược sĩ', product.PhanLoai === true ? 'Cần dược sĩ tư vấn' : product.PhanLoai === false ? 'Không bắt buộc tư vấn' : 'Chưa có thông tin'],
        ['Dạng bào chế', product.DangBaoChe], ['Nhà sản xuất', product.NhaSanXuat], ['Nước sản xuất', product.NuocSanXuat]
    ];
    for (const [label, value] of values) { const row = node('div'); row.append(node('dt', label), node('dd', value || 'Chưa có thông tin')); specifications.append(row); }
    content.append(overview, specifications);
    for (const [label, key] of [['Mô tả', 'MoTa'], ['Cách dùng', 'CachDung'], ['Chống chỉ định', 'ChongChiDinh'], ['Bảo quản', 'BaoQuan']]) {
        const section = node('section', undefined, 'product-detail-description');
        section.append(node('h3', label), node('p', product[key] || 'Chưa có thông tin')); content.append(section);
    }
}

async function load() {
    controller?.abort(); controller = new AbortController(); const attempt = ++version;
    content.replaceChildren(); retry.hidden = true; status.textContent = 'Đang tải thông tin thuốc…';
    dialog.setAttribute('aria-busy', 'true');
    try {
        const data = await getPublicProduct(selection.productId, selection.promotionId ? { promotion_id: selection.promotionId } : {}, { signal: controller.signal });
        if (attempt !== version || !dialog.open) return;
        if (data.code !== 'PRODUCT_FOUND' || data.product?.MaThuoc !== selection.productId || typeof data.product.TenThuoc !== 'string' || !Array.isArray(data.product.DonViGia)) throw new Error('INVALID_RESPONSE');
        title.textContent = data.product.TenThuoc; status.textContent = ''; render(data.product);
    } catch (error) {
        if (attempt !== version || error.code === 'REQUEST_ABORTED') return;
        status.textContent = error.code === 'PRODUCT_NOT_FOUND' ? 'Thuốc không còn tồn tại.'
            : error.code === 'PROMOTION_NOT_FOUND' ? 'Thuốc không còn thuộc chương trình này hoặc chương trình đã kết thúc.'
            : 'Chưa tải được thông tin thuốc. Vui lòng thử lại.';
        retry.hidden = false;
    } finally { if (attempt === version) dialog.setAttribute('aria-busy', 'false'); }
}

export function openProductDetail(productId, promotionId, trigger) {
    if (!dialog) buildDialog();
    opener = trigger; selection = { productId, promotionId }; title.textContent = 'Chi tiết thuốc';
    if (!dialog.open) dialog.showModal(); dialog.querySelector('button').focus(); load();
}
