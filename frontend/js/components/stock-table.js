import { ApiError } from '../api/auth.js';

export const stockNode = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
export function setupStockTable({ root, id, title, description, columns, filterLabel, onLoad, renderRow }) {
    const n = stockNode;
    const header = n('header', undefined, 'categories-list-header'), intro = n('div');
    const heading = n('h2', title); heading.id = `${id}-title`; root.setAttribute('aria-labelledby', heading.id);
    intro.append(heading, n('p', description));
    const refresh = n('button', 'Làm mới', 'button button-outline'); refresh.type = 'button'; refresh.id = `${id}-refresh`;
    header.append(intro, refresh);
    const toolbar = n('div', undefined, 'stock-local-filter'), label = n('label', filterLabel);
    const search = n('input', undefined, 'categories-input'); search.id = `${id}-filter`; search.type = 'search'; label.htmlFor = search.id;
    const count = n('p'); count.id = `${id}-count`; count.setAttribute('role', 'status'); toolbar.append(label, search, count);
    const state = n('div', undefined, 'categories-state'); state.id = `${id}-state`; state.setAttribute('role', 'status');
    const message = n('p'), retry = n('button', 'Thử lại', 'button button-outline'); retry.type = 'button'; retry.id = `${id}-retry`; retry.hidden = true; state.append(message, retry);
    const scroll = n('div', undefined, 'stock-table-scroll'); scroll.id = `${id}-scroll`; scroll.tabIndex = 0; scroll.hidden = true;
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', `${title}, cuộn ngang khi màn hình hẹp`);
    const table = n('table', undefined, 'stock-table'), caption = n('caption', 'Bộ lọc tại đây chỉ áp dụng cho trang đang tải; dùng phân trang để xem các bản ghi khác.');
    const thead = n('thead'), tr = n('tr'), body = n('tbody'); body.id = `${id}-body`;
    for (const [text, numeric] of columns) { const th = n('th', text, numeric ? 'stock-number' : ''); th.scope = 'col'; tr.append(th); }
    thead.append(tr); table.append(caption, thead, body); scroll.append(table);
    const footer = n('footer', undefined, 'categories-pagination'), pageText = n('p'), nav = n('nav'); pageText.id = `${id}-page`; pageText.setAttribute('role', 'status'); nav.setAttribute('aria-label', `Phân trang ${title.toLocaleLowerCase('vi')}`);
    const prev = n('button', 'Trang trước', 'button button-outline'), next = n('button', 'Trang sau', 'button button-outline');
    prev.type = next.type = 'button'; prev.id = `${id}-prev`; next.id = `${id}-next`; prev.disabled = next.disabled = true;
    nav.append(prev, next); footer.append(pageText, nav); root.append(header, toolbar, state, scroll, footer);
    let items = [], metadata, page = 1;
    function draw() {
        body.replaceChildren(); const term = search.value.trim().toLocaleLowerCase('vi');
        const visible = items.filter(item => !term || renderRow.search(item).toLocaleLowerCase('vi').includes(term));
        for (const item of visible) body.append(renderRow(item));
        count.textContent = metadata ? `${metadata.total} bản ghi · Hiển thị ${visible.length}/${items.length} bản ghi trong trang này` : '';
        state.hidden = visible.length > 0; scroll.hidden = !visible.length;
        message.textContent = items.length ? 'Không có kết quả trong trang này. Xóa bộ lọc hoặc chuyển trang.' : 'Chưa có dữ liệu phù hợp.';
        retry.hidden = true;
    }
    function status(text, error = false) {
        items = []; metadata = undefined; body.replaceChildren(); state.hidden = false; scroll.hidden = true; message.textContent = text; retry.hidden = !error;
        count.textContent = ''; pageText.textContent = ''; prev.disabled = next.disabled = true; search.disabled = true;
    }
    refresh.addEventListener('click', () => onLoad(page)); retry.addEventListener('click', () => onLoad(page));
    prev.addEventListener('click', () => onLoad(page - 1)); next.addEventListener('click', () => onLoad(page + 1)); search.addEventListener('input', () => { if (metadata) draw(); });
    return {
        body,
        loading() { root.setAttribute('aria-busy', 'true'); status('Đang tải dữ liệu…'); },
        error(text) { root.setAttribute('aria-busy', 'false'); status(text, true); },
        render(data) {
            if (!Array.isArray(data.items) || !Number.isInteger(data.total) || !Number.isInteger(data.page) || !Number.isInteger(data.pages)) throw new ApiError('INVALID_RESPONSE');
            root.setAttribute('aria-busy', 'false'); items = data.items; metadata = data; page = data.page; search.disabled = false; draw();
            pageText.textContent = data.pages ? `Trang ${data.page} / ${data.pages}` : '';
            prev.disabled = page <= 1; next.disabled = page >= data.pages;
        },
        clear(text = 'Chưa có dữ liệu.') { search.value = ''; page = 1; root.setAttribute('aria-busy', 'false'); status(text); }
    };
}
