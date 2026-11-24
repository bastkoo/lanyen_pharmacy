import { writeChat } from '../api/chat.js';
import { node, sessionFailed } from './chat.js';
import { validHttps } from '../utils/product-validation.js';
import { money } from './cart.js';

const errors = {
    AI_NOT_CONFIGURED: 'Nhà thuốc chưa cấu hình trợ lý AI. Bạn có thể chat với dược sĩ.',
    AI_UNAVAILABLE: 'AI đang gián đoạn. Vui lòng thử lại hoặc chat với dược sĩ.',
    AI_RATE_LIMITED: 'AI đang bận. Bạn vui lòng thử lại sau ít phút.',
    RATE_LIMITED: 'Bạn đã gửi nhiều câu hỏi. Vui lòng đợi một phút rồi thử lại.',
    AUTH_UNAVAILABLE: 'Chưa kết nối được dịch vụ chat. Vui lòng thử lại.',
    DATABASE_UNAVAILABLE: 'Chưa tải được danh mục thuốc. Vui lòng thử lại.',
};

export function createAiChat({ getOwner, onConsult, onError }) {
    const element = node('div', undefined, 'chat-ai');
    const note = node('p', 'AI tra cứu thông tin thuốc và khuyến mãi, không thay thế dược sĩ. Nội dung được gửi đến Groq để trả lời; hệ thống không lưu lịch sử AI. Đóng khung chat sẽ xóa nội dung tạm.', 'chat-status');
    const log = node('div', undefined, 'chat-log');
    log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-label', 'Trò chuyện với AI'); log.tabIndex = 0;
    const form = node('form', undefined, 'chat-composer'), fieldset = node('fieldset');
    const label = node('label', 'Câu hỏi cho AI'), input = node('textarea');
    input.id = 'chat-ai-input'; label.htmlFor = input.id; input.rows = 2; input.maxLength = 2000;
    input.placeholder = 'Hỏi về tên thuốc, mô tả hoặc khuyến mãi…';
    const send = node('button', 'Gửi cho AI', 'button button-primary'); send.type = 'submit';
    const status = node('p'); status.setAttribute('role', 'status');
    const consult = node('button', 'Chat với dược sĩ', 'quiet-link'); consult.type = 'button'; consult.addEventListener('click', () => onConsult());
    fieldset.append(label, input, send); form.append(fieldset, status, consult);
    fieldset.disabled = true;
    element.append(note, log, form);
    let generation = 0, busy = false, enabled = false;
    function message(text, own = false) {
        const article = node('article', undefined, `chat-message${own ? ' is-own' : ''}`);
        const content = node('div', undefined, 'chat-message-content');
        content.append(node('strong', own ? 'Bạn' : 'Trợ lý AI', 'chat-sender'), node('p', text, 'chat-text'));
        article.append(content); log.append(article); return content;
    }
    function productCard(product) {
        const card = node('div', undefined, 'chat-product'), description = node('div');
        const picture = node('div', undefined, 'chat-product-image');
        if (validHttps(product.HinhAnh)) {
            const image = node('img'); image.src = product.HinhAnh; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; picture.append(image);
        } else picture.append(node('span', 'Chưa có ảnh'));
        description.append(node('strong', product.TenThuoc));
        if (product.PhanLoai || product.KeDon) description.append(node('p', product.PhanLoai ? 'Liên hệ dược sĩ để được tư vấn.' : 'Cần đơn thuốc hợp lệ và tư vấn của dược sĩ.'));
        for (const unit of product.DonViGia || []) {
            description.append(node('p', `${money(unit.GiaBan)} / ${unit.DonViTinh}${unit.ConHang ? '' : ' · Hết hàng'}`));
            if (unit.KhuyenMai?.TrangThai === 'ACTIVE') description.append(node('p', `Khuyến mãi: ${unit.KhuyenMai.TenChuongTrinh}`));
        }
        if (product.PhanLoai || product.KeDon) {
            const button = node('button', 'Liên hệ dược sĩ', 'quiet-link'); button.type = 'button';
            button.addEventListener('click', () => {
                const unit = product.DonViGia?.[0];
                onConsult(unit ? { MaThuoc: product.MaThuoc, MaDonGia: unit.MaDonGia } : undefined);
            }); description.append(button);
        }
        const detail = node('a', 'Xem sản phẩm', 'quiet-link');
        detail.href = new URL(`../../pages/customer/products.html?search=${encodeURIComponent(product.TenThuoc)}`, import.meta.url).href;
        description.append(detail); card.append(picture, description); return card;
    }
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (busy || !enabled) return;
        const text = input.value.trim(), owner = getOwner(), attempt = generation;
        if (!text) { status.textContent = 'Nhập câu hỏi để gửi cho AI.'; return; }
        if (!owner) return;
        busy = true; fieldset.disabled = true; status.textContent = 'AI đang tra cứu…';
        try {
            const result = await writeChat('/ai', { text }, owner);
            if (generation !== attempt || owner !== getOwner()) return;
            message(text, true);
            const reply = message(result.text);
            for (const product of result.products) reply.append(productCard(product));
            // Bound temporary DOM content without persisting any conversation.
            while (log.children.length > 20) log.firstElementChild.remove();
            input.value = ''; status.textContent = ''; log.scrollTop = log.scrollHeight;
        } catch (error) {
            if (generation !== attempt || owner !== getOwner()) return;
            status.textContent = errors[error.code] || 'Chưa gửi được câu hỏi. Vui lòng thử lại hoặc chat với dược sĩ.';
            if (sessionFailed(error)) onError(error);
        } finally {
            if (generation === attempt) { busy = false; fieldset.disabled = !enabled; }
        }
    });
    return { element,
        setEnabled(value) { enabled = value; fieldset.disabled = busy || !enabled; },
        clear() { generation++; busy = false; input.value = ''; status.textContent = ''; log.replaceChildren(); fieldset.disabled = !enabled; },
    };
}
