import { readChat, writeChat, uploadChatImage } from '../api/chat.js';
import { validHttps, validateImageFile } from '../utils/product-validation.js';
import { chatOfferCheckoutUrl } from '../utils/checkout-selection.js';
import { money } from './cart.js';

export const node = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
export const chatError = error => ({ UNAUTHENTICATED: 'Đăng nhập để nhắn tin với dược sĩ.', FORBIDDEN: 'Tài khoản không có quyền dùng cuộc trò chuyện này.', SESSION_CHANGED: 'Tài khoản đã thay đổi. Vui lòng mở lại cuộc trò chuyện.', ACCOUNT_LOCKED: 'Tài khoản đã bị khóa.',
    CHAT_OFFER_NOT_FOUND: 'Không tìm thấy thẻ tư vấn thuộc tài khoản này.',
    CHAT_NOT_FOUND: 'Hội thoại đã được nhân viên khác tiếp nhận hoặc đã kết thúc.', CHAT_NOT_ASSIGNED: 'Tiếp nhận hội thoại trước khi trả lời.', CHAT_REQUEST_CHANGED: 'Nội dung gửi lại đã thay đổi. Hãy mở lại hội thoại.',
    CONNECTION_FAILED: 'Mất kết nối. Thử gửi lại để kiểm tra kết quả.', OUT_OF_STOCK: 'Sản phẩm không còn đủ hàng. Vui lòng nhờ dược sĩ kiểm tra.', UNIT_NOT_FOUND: 'Đơn vị sản phẩm không còn khả dụng.',
    CONSULTATION_REQUIRED: 'Sản phẩm cần dược sĩ tư vấn trước khi mua.', DATABASE_UNAVAILABLE: 'Chưa kết nối được dữ liệu. Vui lòng thử lại.', CLOUDINARY_NOT_CONFIGURED: 'Chưa cấu hình dịch vụ gửi ảnh.', CLOUDINARY_UNAVAILABLE: 'Chưa gửi được ảnh. Vui lòng thử lại.',
    IMAGE_TOO_LARGE: 'Ảnh tối đa 5 MiB.', INVALID_IMAGE: 'Ảnh không hợp lệ.', UNSUPPORTED_IMAGE_FORMAT: 'Chọn ảnh JPEG, PNG hoặc WebP.', INVALID_REQUEST: 'Kiểm tra lại nội dung tin nhắn.' })[error.code] || 'Chưa thực hiện được thao tác. Vui lòng thử lại.';
export const sessionFailed = error => ['UNAUTHENTICATED', 'FORBIDDEN', 'SESSION_CHANGED', 'ACCOUNT_LOCKED'].includes(error.code);
const dateText = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));

export function chatIcon(kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', kind === 'product' ? 'M3 7l9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M16 14h6m-3-3v6' : 'M8 13l7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2a4 4 0 0 1 6 6L8 19a2 2 0 0 1-3-3L15 6');
    svg.append(path); return svg;
}

export function pharmacistAvatar() {
    const avatar = node('span', undefined, 'chat-avatar'); avatar.setAttribute('aria-hidden', 'true');
    // Local, code-native pharmacist pictogram: head, coat and pharmacy cross.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 32 32');
    for (const [tag, attributes] of [['circle', { cx: '16', cy: '10', r: '5' }], ['path', { d: 'M6 29v-5a10 10 0 0 1 20 0v5M12 19l4 5 4-5M23 23v6m-3-3h6' }]]) {
        const part = document.createElementNS(svg.namespaceURI, tag); for (const [key, value] of Object.entries(attributes)) part.setAttribute(key, value); svg.append(part);
    }
    avatar.append(svg); return avatar;
}

function image(url, alt, className) {
    const holder = node('div', undefined, className);
    if (validHttps(url)) { const img = node('img'); img.src = url; img.alt = alt; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.addEventListener('error', () => holder.replaceChildren(node('span', 'Ảnh không khả dụng')), { once: true }); holder.append(img); }
    else holder.append(node('span', 'Chưa có ảnh'));
    return holder;
}

export function renderChatMessage(value, { customer = false, getOwner, onError = () => {} } = {}) {
    const line = node('article', undefined, 'chat-message'); line.dataset.messageId = value.id;
    const own = customer ? value.role === 0 : value.role === 1;
    line.classList.toggle('is-own', own);
    if (value.role === 1) line.append(pharmacistAvatar());
    const content = node('div', undefined, 'chat-message-content');
    content.append(node('strong', value.role === 1 ? 'Dược sĩ' : 'Khách hàng', 'chat-sender'));
    if (value.kind === 'text') content.append(node('p', value.text, 'chat-text'));
    if (value.kind === 'image') content.append(image(value.url, `Ảnh do ${value.role === 1 ? 'dược sĩ' : 'khách hàng'} gửi`, 'chat-photo'));
    if (['product', 'offer'].includes(value.kind)) {
        content.append(node('p', value.kind === 'offer' ? 'Sản phẩm dược sĩ tư vấn' : 'Tôi cần tư vấn sản phẩm này', 'chat-card-title'));
        for (const item of value.items) {
            const card = node('div', undefined, 'chat-product'), description = node('div'), quantity = item.SoLuong ?? 1;
            description.append(node('strong', item.TenThuoc), node('p', `Số lượng: ${quantity} ${item.DonViTinh}`));
            if (item.DonGia !== undefined) description.append(node('p', `Đơn giá lúc gửi: ${money(item.DonGia)}`));
            if (item.ThanhTien !== undefined) description.append(node('strong', `Thành tiền: ${money(item.ThanhTien)}`));
            if (item.SoLuongKhuyenMai > 0 && item.SoLuongKhuyenMai < quantity) description.append(node('p', `Khuyến mãi áp dụng ${item.SoLuongKhuyenMai}/${quantity} ${item.DonViTinh}.`));
            card.append(image(item.HinhAnh, '', 'chat-product-image'), description); content.append(card);
        }
        if (customer && value.kind === 'offer' && value.role === 1) {
            content.append(node('p', 'Giá, khuyến mãi và tồn kho được kiểm tra khi mua.', 'chat-help'));
            const actions = node('div', undefined, 'chat-card-actions chat-purchase-actions'), state = node('p'); state.setAttribute('role', 'status');
            let busy = false;
            const buy = node('button', 'Mua ngay', 'button button-primary'); buy.type = 'button';
            buy.addEventListener('click', async () => {
                if (busy) return; busy = true; const owner = getOwner();
                buy.disabled = true; state.textContent = 'Đang kiểm tra sản phẩm…';
                try {
                    await readChat(`/offers/${encodeURIComponent(value.id)}/quote`);
                    if (owner !== getOwner()) return;
                    state.textContent = 'Đang mở trang thanh toán…';
                    location.assign(new URL(`../../pages/customer/${chatOfferCheckoutUrl(value.id)}`, import.meta.url).href);
                } catch (error) { if (owner === getOwner()) { state.textContent = chatError(error); onError(error); } }
                finally { busy = false; buy.disabled = false; }
            }); actions.append(buy);
            content.append(actions, state);
        }
    }
    const time = node('time', dateText(value.at), 'chat-time'); time.dateTime = value.at; content.append(time); line.append(content); return line;
}

export function createChatComposer({ getContext, getOwner, onSent, onError = () => {}, employee = false }) {
    const form = node('form', undefined, 'chat-composer'), fieldset = node('fieldset');
    const label = node('label', 'Nội dung tin nhắn'), text = node('textarea');
    text.id = `chat-input-${crypto.randomUUID()}`; label.htmlFor = text.id; text.rows = 2; text.maxLength = 4000; text.placeholder = 'Nhập tin nhắn…';
    const fileLabel = node('label', 'Ảnh JPEG, PNG, WebP; tối đa 5 MiB', 'sr-only'), file = node('input', undefined, 'chat-file-input');
    file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp'; file.id = `chat-image-${crypto.randomUUID()}`; fileLabel.htmlFor = file.id;
    file.tabIndex = -1;
    const attachment = node('button', undefined, 'chat-tool-button'); attachment.type = 'button'; attachment.setAttribute('aria-label', 'Gửi tệp ảnh'); attachment.title = 'Gửi ảnh JPEG, PNG, WebP; tối đa 5 MiB';
    attachment.append(chatIcon('attachment')); if (!employee) attachment.append(node('span', 'Gửi tệp'));
    attachment.addEventListener('click', () => file.click());
    const fileName = node('span', '', 'chat-file-name'); file.addEventListener('change', () => { fileName.textContent = file.files[0]?.name || ''; });
    const submit = node('button', 'Gửi', 'button button-primary'); submit.type = 'submit';
    const status = node('p'); status.setAttribute('role', 'status');
    const tools = node('div', undefined, 'chat-composer-tools'); tools.append(attachment);
    fieldset.append(label, text, fileLabel, file, tools, fileName, submit); form.append(fieldset, status);
    let pending, busy = false, generation = 0, enabled = false;
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (busy || !enabled) return;
        const context = getContext(), owner = getOwner(), attempt = generation;
        if (!context || !owner) return;
        if (!pending) {
            if (file.files[0]) { const error = validateImageFile(file.files[0]); if (error) { status.textContent = error; return; } pending = { kind: 'image', request_id: crypto.randomUUID() }; }
            else if (text.value.trim()) pending = { kind: 'text', text: text.value.trim(), request_id: crypto.randomUUID() };
            else { status.textContent = 'Nhập nội dung hoặc chọn ảnh để gửi.'; return; }
        }
        busy = true; fieldset.disabled = true; status.textContent = 'Đang gửi…';
        try {
            if (pending.kind === 'image' && !pending.url) { const result = await uploadChatImage(context.images, file.files[0], owner); if (attempt !== generation) return; pending.url = result.data.url; }
            const result = await writeChat(context.messages, pending, owner);
            if (attempt !== generation || owner !== getOwner()) return;
            pending = null; text.value = file.value = ''; fileName.textContent = ''; status.textContent = 'Đã gửi.'; await onSent(result.message);
        } catch (error) { if (attempt === generation && owner === getOwner()) { status.textContent = chatError(error); submit.textContent = 'Thử gửi lại'; onError(error); } }
        finally { if (attempt === generation) { busy = false; fieldset.disabled = !enabled; text.disabled = file.disabled = attachment.disabled = !!pending; if (!pending) submit.textContent = 'Gửi'; } }
    });
    fieldset.disabled = true;
    return { element: form, tools, setEnabled(value) { enabled = value; fieldset.disabled = busy || !enabled; },
        clear() { generation++; pending = null; busy = false; text.value = file.value = ''; fileName.textContent = ''; text.disabled = file.disabled = attachment.disabled = false; status.textContent = ''; submit.textContent = 'Gửi'; fieldset.disabled = !enabled; } };
}
