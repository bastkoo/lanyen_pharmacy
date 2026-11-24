import { readChat, writeChat } from '../api/chat.js';
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
    AI_REQUEST_CHANGED: 'Nội dung gửi lại đã thay đổi. Vui lòng nhập câu hỏi mới.',
};

function sendIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', 'M4 4.5 21 3l-6.5 18-3-7-7.5-3.5L21 3M11.5 14 15 9');
    svg.append(path); return svg;
}

export function createAiChat({ getOwner, onConsult, onError }) {
    const element = node('div', undefined, 'chat-ai');
    const note = node('p', 'Lưu ý: AI không thay thế hoàn toàn dược sĩ!', 'chat-status chat-ai-note');
    const older = node('button', 'Xem tin nhắn trước', 'ai-history-button'); older.type = 'button'; older.hidden = true;
    const log = node('div', undefined, 'chat-log');
    log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-label', 'Trò chuyện với AI'); log.tabIndex = 0;
    const form = node('form', undefined, 'chat-composer ai-composer'), fieldset = node('fieldset');
    const label = node('label', 'Câu hỏi cho AI', 'sr-only'), input = node('textarea');
    input.id = 'chat-ai-input'; label.htmlFor = input.id; input.rows = 1; input.maxLength = 2000;
    input.placeholder = 'Nhắn cho trợ lý Lan Yến…';
    const send = node('button', undefined, 'ai-send'); send.type = 'submit';
    send.setAttribute('aria-label', 'Gửi câu hỏi cho AI'); send.title = 'Gửi câu hỏi'; send.append(sendIcon());
    const status = node('p'); status.setAttribute('role', 'status');
    fieldset.append(label, input, send); form.append(fieldset, status);
    fieldset.disabled = true;
    element.append(note, older, log, form);
    let generation = 0, busy = false, enabled = false, loading = false, pending;
    const items = new Map();
    function message(value) {
        const own = value.role === 'KHACH_HANG';
        const article = node('article', undefined, `chat-message${own ? ' is-own' : ''}`);
        const content = node('div', undefined, 'chat-message-content');
        content.append(node('strong', own ? 'Bạn' : 'Trợ lý AI', 'chat-sender'), node('p', value.text, 'chat-text'));
        for (const product of value.products || []) content.append(productCard(product));
        if (value.at) {
            const time = node('time', new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value.at)), 'chat-time');
            time.dateTime = value.at; content.append(time);
        }
        article.append(content); return article;
    }
    function productCard(product) {
        const card = node('div', undefined, 'ai-product-card'), description = node('div', undefined, 'ai-product-info');
        const picture = node('div', undefined, 'ai-product-image');
        if (validHttps(product.HinhAnh)) {
            const image = node('img'); image.src = product.HinhAnh; image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
            image.addEventListener('error', () => picture.replaceChildren(node('span', 'Lan Yến')), { once: true }); picture.append(image);
        } else picture.append(node('span', 'Chưa có ảnh'));
        const unit = product.DonViGia?.find(unit => unit.ConHang === true);
        description.append(node('span', unit ? 'Có hàng lúc trả lời' : 'Cần kiểm tra lại tồn kho', 'ai-stock'), node('strong', product.TenThuoc, 'ai-product-name'));
        if (product.QuyCachDongGoi) description.append(node('p', product.QuyCachDongGoi, 'ai-product-packaging'));
        if (unit && !product.PhanLoai) description.append(node('p', `${money(unit.GiaBan)} / ${unit.DonViTinh}`, 'ai-product-price'));
        if (unit?.KhuyenMai?.TrangThai === 'ACTIVE') description.append(node('p', unit.KhuyenMai.TenChuongTrinh, 'ai-product-promotion'));
        if (product.PhanLoai || product.KeDon) description.append(node('p', product.PhanLoai ? 'Cần dược sĩ tư vấn trước khi mua.' : 'Cần đơn thuốc hợp lệ và tư vấn của dược sĩ.', 'ai-product-consultation'));
        const actions = node('div', undefined, 'ai-product-actions');
        if (product.PhanLoai || product.KeDon) {
            const button = node('button', 'Liên hệ dược sĩ', 'ai-product-action ai-product-action-primary'); button.type = 'button';
            button.addEventListener('click', () => {
                onConsult(unit ? { MaThuoc: product.MaThuoc, MaDonGia: unit.MaDonGia } : undefined);
            }); actions.append(button);
        }
        const detail = node('a', 'Xem sản phẩm →', 'ai-product-action');
        detail.href = new URL(`../../pages/customer/products.html?search=${encodeURIComponent(product.TenThuoc)}`, import.meta.url).href;
        actions.append(detail); card.append(picture, description, actions, node('small', 'Giá và tồn kho ghi nhận lúc trả lời. Xem sản phẩm để cập nhật.', 'ai-product-caption')); return card;
    }
    function render() {
        const sorted = [...items.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
        log.replaceChildren(...sorted.map(message));
        if (!sorted.length) log.append(node('p', 'Bạn cần tìm sản phẩm nào? Hãy cho AI biết tên thuốc hoặc thông tin bạn muốn tra cứu.', 'ai-empty'));
    }
    async function load(before) {
        if (!enabled || loading || busy) return;
        const attempt = generation, owner = getOwner();
        if (!owner) return;
        loading = true; status.textContent = 'Đang tải lịch sử…';
        const height = log.scrollHeight, top = log.scrollTop;
        try {
            const result = await readChat(`/ai/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`);
            if (attempt !== generation || owner !== getOwner() || busy) return;
            const lastKnown = [...items.keys()].reduce((last, id) => BigInt(id) > BigInt(last) ? id : last, '0');
            if (!before && result.has_more && result.items.length && lastKnown !== '0' && BigInt(result.items[0].id) > BigInt(lastKnown)) items.clear();
            for (const item of result.items) items.set(item.id, item);
            if (before || items.size <= 50) older.hidden = !result.has_more;
            render(); log.scrollTop = before ? top + log.scrollHeight - height : log.scrollHeight;
            status.textContent = '';
        } catch (error) {
            if (attempt !== generation || owner !== getOwner()) return;
            status.textContent = 'Chưa tải được lịch sử. Bạn có thể mở lại Chat với AI để thử lại.';
            if (sessionFailed(error)) onError(error);
        } finally { if (attempt === generation) loading = false; }
    }
    older.addEventListener('click', () => load([...items.keys()].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1)[0]));
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (busy || !enabled) return;
        const text = input.value.trim(), owner = getOwner(), attempt = generation;
        if (!text) { status.textContent = 'Nhập câu hỏi để gửi cho AI.'; return; }
        if (!owner) return;
        if (!pending || pending.text !== text) pending = { text, request_id: crypto.randomUUID() };
        busy = true; fieldset.disabled = true; status.textContent = 'AI đang tra cứu…';
        try {
            const result = await writeChat('/ai', pending, owner);
            if (generation !== attempt || owner !== getOwner()) return;
            for (const item of result.messages) items.set(item.id, item);
            pending = null; render();
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
        load,
        setEnabled(value) { enabled = value; fieldset.disabled = busy || !enabled; },
        clear() { generation++; busy = loading = false; pending = null; items.clear(); input.value = ''; status.textContent = ''; log.replaceChildren(); older.hidden = true; fieldset.disabled = !enabled; },
    };
}
