import * as api from '../api/promotions.js';
import { getProducts, getProduct } from '../api/products.js';
import { ApiError } from '../api/auth.js';
import { validHttps } from '../utils/product-validation.js';
import { formatBatchDate, vietnamToday } from '../utils/batch-validation.js';
import { PROMOTION_STATUSES, promotionStatus, validatePromotion, validatePromotionItem, formatPromotionDiscount, promotionError } from '../utils/promotion-validation.js';
import { stockNode as n, setupStockTable } from '../components/stock-table.js';

export function setupPromotions({ root, onAccessError }) {
    const $ = id => document.getElementById(id), dialog = $('promotion-dialog');
    const programFields = [['TenChuongTrinh', 'Tên chương trình', 'text'], ['NgayBatDau', 'Ngày bắt đầu', 'date'], ['NgayKetThuc', 'Ngày kết thúc', 'date']];
    const fieldNames = [...programFields.map(item => item[0]), 'MaThuoc', 'LoaiGiamGia', 'GiaTriGiam', 'SoLuong'];
    let active = false, programs = [], listReady = false, page = 1, filters = { search: '', status: '' };
    let detailId, current, items = [], itemsReady = false, itemPage = 1, products = new Map();
    let mode, targetId, opener, ready = false, busy = false, pickerPage = 1, pickerPages = 0, pickerSearch = '', pickerReady = false;
    const slots = new Map();
    function begin(key) {
        const old = slots.get(key); old?.controller.abort();
        const value = { version: (old?.version || 0) + 1, controller: new AbortController() }; slots.set(key, value);
        return { version: value.version, signal: value.controller.signal };
    }
    function cancel(key) { const old = slots.get(key); old?.controller.abort(); slots.set(key, { version: (old?.version || 0) + 1, controller: new AbortController() }); }
    const alive = (key, attempt) => active && slots.get(key)?.version === attempt.version;
    function access(error) {
        if (['UNAUTHENTICATED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) { onAccessError(error); return true; }
        return false;
    }
    function feedback(text = '') { $('promotions-feedback').textContent = text; $('promotions-feedback').hidden = !text; }
    function checkProgram(value) { if (!value || !Number.isInteger(value.MaChuongTrinh) || value.MaChuongTrinh < 1 || Object.keys(validatePromotion(value).errors).length) throw new ApiError('INVALID_RESPONSE'); }
    function checkItem(value, id) {
        if (!value || value.MaChuongTrinh !== id || !Number.isInteger(value.MaThuoc) || value.MaThuoc < 1 || !Number.isInteger(value.SoLuong) || value.SoLuong < 0 || value.SoLuong > 2147483647) throw new ApiError('INVALID_RESPONSE');
        formatPromotionDiscount(value);
    }
    async function allPages(fetchPage, expected, signal) {
        const result = []; let expectedPages, expectedTotal;
        for (let next = 1; ; next++) {
            const data = await fetchPage({ page: next, per_page: 100 }, { signal });
            if (signal.aborted) throw new ApiError('REQUEST_ABORTED');
            if (data.code !== expected || !Array.isArray(data.items) || data.page !== next || !Number.isInteger(data.pages) || data.pages < 0 || !Number.isInteger(data.total) || data.total < 0) throw new ApiError('INVALID_RESPONSE');
            if (next === 1) { expectedPages = data.pages; expectedTotal = data.total; }
            if (data.pages !== expectedPages || data.total !== expectedTotal) throw new ApiError('INVALID_RESPONSE');
            result.push(...data.items);
            if (next >= expectedPages) break;
        }
        if (result.length !== expectedTotal) throw new ApiError('INVALID_RESPONSE');
        return result;
    }
    function listState(text, error = false) {
        $('promotions-state').hidden = false; $('promotions-scroll').hidden = true; $('promotions-state-text').textContent = text;
        $('promotions-retry').hidden = !error; $('promotions-prev').disabled = $('promotions-next').disabled = true;
    }
    function drawList() {
        if (!listReady) return;
        const today = vietnamToday(), term = filters.search.toLocaleLowerCase('vi');
        const found = programs.filter(item => item.TenChuongTrinh.toLocaleLowerCase('vi').includes(term) && (!filters.status || promotionStatus(item, today) === filters.status));
        const pages = Math.ceil(found.length / 20); page = Math.max(1, Math.min(page, pages || 1)); $('promotions-body').replaceChildren();
        for (const value of found.slice((page - 1) * 20, page * 20)) {
            const row = n('tr'), name = n('th'), actions = n('td'); name.scope = 'row'; name.append(n('strong', value.TenChuongTrinh), n('span', `#${value.MaChuongTrinh}`, 'product-row-meta'));
            for (const [action, label] of [['view', 'Xem'], ['edit', 'Sửa'], ['delete', 'Xóa']]) {
                const button = n('button', label, `categories-action${action === 'delete' ? ' categories-action--delete' : ''}`); button.type = 'button'; button.dataset.promotionAction = action; button.dataset.id = value.MaChuongTrinh; button.setAttribute('aria-label', `${label} chương trình ${value.TenChuongTrinh}`); actions.append(button);
            }
            row.append(name, n('td', formatBatchDate(value.NgayBatDau), 'stock-date'), n('td', formatBatchDate(value.NgayKetThuc), 'stock-date'), n('td', PROMOTION_STATUSES[promotionStatus(value, today)]), actions); $('promotions-body').append(row);
        }
        $('promotions-count').textContent = `${found.length} / ${programs.length} chương trình · Ngày Việt Nam: ${formatBatchDate(today)}`;
        $('promotions-page').textContent = pages ? `Trang ${page} / ${pages}` : '';
        if (!found.length) listState(programs.length ? 'Không có chương trình phù hợp. Thử đổi tên hoặc trạng thái.' : 'Chưa có chương trình. Tạo chương trình để bắt đầu.');
        else { $('promotions-state').hidden = true; $('promotions-scroll').hidden = false; }
        $('promotions-prev').disabled = page <= 1; $('promotions-next').disabled = page >= pages;
    }
    async function loadList() {
        if (!active) return;
        const attempt = begin('list'); listReady = false; programs = []; $('promotions-body').replaceChildren(); $('promotions-count').textContent = ''; $('promotions-page').textContent = '';
        $('promotions-list-view').setAttribute('aria-busy', 'true'); listState('Đang tải đầy đủ chương trình để tìm kiếm và lọc…');
        try {
            const data = await allPages(api.getPromotions, 'PROMOTIONS_LISTED', attempt.signal);
            if (!alive('list', attempt)) return;
            data.forEach(checkProgram); if (new Set(data.map(item => item.MaChuongTrinh)).size !== data.length) throw new ApiError('INVALID_RESPONSE');
            programs = data; listReady = true; drawList();
        } catch (error) { if (alive('list', attempt) && error.code !== 'REQUEST_ABORTED' && !access(error)) listState(promotionError(error), true); }
        finally { if (alive('list', attempt)) $('promotions-list-view').setAttribute('aria-busy', 'false'); }
    }
    const itemRow = item => {
        const row = n('tr'), name = n('th'), identity = n('div', undefined, 'promotion-item-identity'), product = products.get(item.MaThuoc); name.scope = 'row';
        if (validHttps(product?.HinhAnh)) { const image = n('img'); image.src = product.HinhAnh; image.alt = `Ảnh ${product.TenThuoc}`; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => { image.hidden = true; }); identity.append(image); }
        const text = n('div'); text.append(n('strong', product.TenThuoc), n('span', `#${item.MaThuoc}`), n('span', `Mã vạch: ${product.MaVach || 'Chưa có'}`)); identity.append(text); name.append(identity);
        const actions = n('td');
        for (const [action, label] of [['edit', 'Sửa'], ['delete', 'Xóa']]) {
            const button = n('button', label, `categories-action${action === 'delete' ? ' categories-action--delete' : ''}`); button.type = 'button'; button.dataset.itemAction = action; button.dataset.id = item.MaThuoc; button.setAttribute('aria-label', `${label} khuyến mãi của ${product.TenThuoc}`); actions.append(button);
        }
        row.append(name, n('td', item.LoaiGiamGia ? 'Phần trăm' : 'Tiền trực tiếp'), n('td', formatPromotionDiscount(item), 'stock-number'), n('td', new Intl.NumberFormat('vi-VN').format(item.SoLuong), 'stock-number'), n('td', item.SoLuong ? 'Còn số lượng áp dụng' : 'Hết số lượng áp dụng'), actions); return row;
    };
    itemRow.search = item => `${products.get(item.MaThuoc)?.TenThuoc || ''} ${products.get(item.MaThuoc)?.MaVach || ''}`;
    const itemTable = setupStockTable({ root: $('promotion-items-table'), id: 'promotion-items', title: 'Thuốc trong chương trình', description: 'Chỉ cấu hình mức giảm và số lượng; chưa tính giá sau giảm.', columns: [['Thuốc'], ['Loại giảm'], ['Giá trị giảm', true], ['Số lượng còn áp dụng', true], ['Trạng thái số lượng'], ['Thao tác']], filterLabel: 'Lọc tên / mã vạch trong trang này', onLoad: next => loadItems(next), renderRow: itemRow });
    async function loadItems(next = itemPage) {
        if (!active || !current) return;
        const id = detailId, attempt = begin('items'); itemsReady = false; $('promotion-item-add').disabled = true; itemTable.loading(); itemPage = next;
        try {
            const data = await allPages((query, options) => api.getPromotionItems(id, query, options), 'PROMOTION_ITEMS_LISTED', attempt.signal);
            if (!alive('items', attempt) || id !== detailId) return;
            data.forEach(item => checkItem(item, id)); if (new Set(data.map(item => item.MaThuoc)).size !== data.length) throw new ApiError('INVALID_RESPONSE');
            itemPage = Math.max(1, Math.min(next, Math.ceil(data.length / 20) || 1)); const visible = data.slice((itemPage - 1) * 20, itemPage * 20);
            await Promise.all(visible.map(async item => {
                if (products.has(item.MaThuoc)) return;
                const result = await getProduct(item.MaThuoc, { signal: attempt.signal });
                if (!alive('items', attempt) || id !== detailId) return;
                if (result.product?.MaThuoc !== item.MaThuoc || typeof result.product.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
                products.set(item.MaThuoc, result.product);
            }));
            if (!alive('items', attempt) || id !== detailId) return;
            items = data; itemsReady = true; itemTable.render({ items: visible, total: data.length, page: itemPage, pages: Math.ceil(data.length / 20) }); $('promotion-item-add').disabled = false;
        } catch (error) { if (alive('items', attempt) && error.code !== 'REQUEST_ABORTED' && !access(error)) itemTable.error(promotionError(error)); }
    }
    function drawIdentity() {
        const root = $('promotion-identity'); root.replaceChildren(); const heading = n('h2', current.TenChuongTrinh); heading.id = 'promotion-detail-title'; heading.tabIndex = -1;
        const dates = n('dl');
        for (const [label, value] of [['Bắt đầu', formatBatchDate(current.NgayBatDau)], ['Kết thúc', formatBatchDate(current.NgayKetThuc)], ['Trạng thái', PROMOTION_STATUSES[promotionStatus(current)]]]) { const wrap = n('div'); wrap.append(n('dt', label), n('dd', value)); dates.append(wrap); }
        root.append(n('p', `CHƯƠNG TRÌNH #${detailId}`, 'manager-eyebrow'), heading, dates);
    }
    async function openDetail(id) {
        if (!active || busy) return;
        feedback();
        closeDialog(); cancel('items'); const attempt = begin('detail'); detailId = id; current = undefined; items = []; products.clear(); itemsReady = false; itemPage = 1;
        $('promotions-list-view').hidden = true; $('promotion-detail-view').hidden = false; $('promotion-identity').replaceChildren(); $('promotion-item-add').disabled = true;
        $('promotion-detail-status').textContent = 'Đang tải thông tin chương trình…'; $('promotion-detail-retry').hidden = true; itemTable.clear('Đang chờ thông tin chương trình.');
        try {
            const data = await api.getPromotion(id, { signal: attempt.signal });
            if (!alive('detail', attempt)) return;
            checkProgram(data.promotion); if (data.promotion.MaChuongTrinh !== id) throw new ApiError('INVALID_RESPONSE');
            current = data.promotion; drawIdentity(); $('promotion-detail-status').textContent = ''; $('promotion-detail-title').focus(); loadItems(1);
        } catch (error) { if (alive('detail', attempt) && error.code !== 'REQUEST_ABORTED' && !access(error)) { $('promotion-detail-status').textContent = promotionError(error); $('promotion-detail-retry').hidden = false; } }
    }
    function showList() {
        if (busy) return; feedback(); cancel('detail'); cancel('items'); current = undefined; detailId = undefined; items = []; itemsReady = false;
        $('promotion-detail-view').hidden = true; $('promotions-list-view').hidden = false; $('promotions-list-title').focus(); loadList();
    }
    for (const [key, label, type] of programFields) {
        const wrap = n('div'), caption = n('label', `${label} *`), input = n('input', undefined, 'categories-input'), error = n('p', '', 'category-dialog__error');
        input.id = `promotion-${key}`; input.name = key; input.type = type; input.required = true; caption.htmlFor = input.id; error.id = `${input.id}-error`; error.setAttribute('role', 'status'); input.setAttribute('aria-describedby', error.id); wrap.append(caption, input, error); $('promotion-program-fields').append(wrap);
    }
    function clearErrors() { $('promotion-dialog-error').textContent = ''; for (const key of fieldNames) { $(`promotion-${key}-error`).textContent = ''; $(`promotion-${key}`).removeAttribute('aria-invalid'); } }
    function discountLabel() {
        const percent = $('promotion-LoaiGiamGia').value === 'true'; $('promotion-discount-label').textContent = `Giá trị giảm (${percent ? '%' : 'VND'}) *`;
        $('promotion-discount-help').textContent = percent ? 'Số nguyên từ 1 đến 100.' : 'Giảm tiền trực tiếp; tối đa hai chữ số lẻ, dùng dấu chấm thập phân. Không tự làm tròn.';
    }
    function setBusy(value) {
        busy = value; dialog.setAttribute('aria-busy', String(value)); for (const element of dialog.querySelectorAll('button,input,select')) element.disabled = value;
        $('promotion-dialog-save').disabled = value || !ready; $('promotion-delete-confirm').disabled = value || !ready;
        if (mode === 'item-create') $('promotion-MaThuoc').disabled = value || !pickerReady;
        $('promotion-picker-prev').disabled = value || !pickerReady || pickerPage <= 1; $('promotion-picker-next').disabled = value || !pickerReady || pickerPage >= pickerPages;
        $('promotion-dialog-save').textContent = value ? 'Đang lưu…' : 'Lưu'; $('promotion-delete-confirm').textContent = value ? 'Đang xóa…' : 'Xác nhận xóa';
    }
    function closeDialog() { cancel('dialog'); cancel('picker'); ready = false; busy = false; if (dialog.open) dialog.close(); document.body.classList.remove('category-modal-open'); }
    async function loadPicker() {
        if (!active || mode !== 'item-create' || !dialog.open || busy) return;
        const attempt = begin('picker'), dialogAttempt = slots.get('dialog').version; pickerReady = false; $('promotion-picker-status').textContent = 'Đang tải thuốc…';
        $('promotion-MaThuoc').replaceChildren(new Option('Chọn thuốc…', '')); $('promotion-MaThuoc').disabled = true; $('promotion-picker-prev').disabled = $('promotion-picker-next').disabled = true;
        try {
            const data = await getProducts({ search: pickerSearch, page: pickerPage, per_page: 20, sort_by: 'TenThuoc', sort_order: 'asc' }, { signal: attempt.signal });
            if (!alive('picker', attempt) || dialogAttempt !== slots.get('dialog').version || !dialog.open) return;
            if (data.code !== 'PRODUCTS_LISTED' || !Array.isArray(data.items)) throw new ApiError('INVALID_RESPONSE');
            const assigned = new Set(items.map(item => item.MaThuoc));
            for (const item of data.items) {
                if (!Number.isInteger(item.MaThuoc) || typeof item.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
                const option = new Option(`${item.TenThuoc} · #${item.MaThuoc} · Mã vạch: ${item.MaVach || 'Chưa có'}${assigned.has(item.MaThuoc) ? ' · Đã có trong chương trình' : ''}`, String(item.MaThuoc)); option.disabled = assigned.has(item.MaThuoc); $('promotion-MaThuoc').append(option); products.set(item.MaThuoc, item);
            }
            pickerReady = true; pickerPages = data.pages; $('promotion-MaThuoc').disabled = busy;
            $('promotion-picker-status').textContent = data.total ? `${data.total} thuốc · Trang ${data.page}/${data.pages}. Thuốc đã gán được vô hiệu hóa.` : 'Không có thuốc phù hợp.';
            $('promotion-picker-prev').disabled = data.page <= 1 || busy; $('promotion-picker-next').disabled = data.page >= data.pages || busy;
        } catch (error) { if (alive('picker', attempt) && error.code !== 'REQUEST_ABORTED' && !access(error)) $('promotion-picker-status').textContent = promotionError(error); }
    }
    async function openDialog(nextMode, id, source) {
        if (!active || busy || (nextMode.startsWith('item-') && (!current || !itemsReady))) return;
        cancel('picker'); const attempt = begin('dialog'); mode = nextMode; targetId = id; opener = source; ready = mode.endsWith('create');
        $('promotion-form').reset(); clearErrors(); const itemMode = mode.startsWith('item-'), removing = mode.endsWith('delete');
        $('promotion-dialog-title').textContent = ({ 'program-create': 'Tạo chương trình', 'program-edit': 'Sửa chương trình', 'program-delete': 'Xóa chương trình', 'item-create': 'Thêm thuốc vào chương trình', 'item-edit': 'Sửa khuyến mãi của thuốc', 'item-delete': 'Xóa thuốc khỏi chương trình' })[mode];
        $('promotion-dialog-context').textContent = itemMode ? current.TenChuongTrinh : 'Tên và thời gian áp dụng chương trình.';
        $('promotion-dialog-loading').textContent = ready ? '' : 'Đang lấy dữ liệu hiện tại…';
        $('promotion-program-fields').hidden = itemMode; $('promotion-item-fields').hidden = !itemMode;
        $('promotion-form').hidden = removing || !ready; $('promotion-delete-panel').hidden = !removing;
        $('promotion-product-picker').hidden = mode !== 'item-create'; $('promotion-selected-product').hidden = mode !== 'item-edit'; $('promotion-selected-product').textContent = '';
        $('promotion-delete-name').textContent = ''; $('promotion-delete-description').textContent = itemMode ? 'Xóa thuốc khỏi chương trình này? Thuốc và giá bán gốc được giữ nguyên.' : 'Xóa chương trình này? Nếu chương trình có thuốc áp dụng, Backend sẽ từ chối; không xóa dây chuyền.';
        pickerPage = 1; pickerSearch = ''; pickerReady = false; $('promotion-product-search').value = ''; discountLabel(); setBusy(false); dialog.showModal(); document.body.classList.add('category-modal-open');
        if (ready) { if (itemMode) { loadPicker(); $('promotion-product-search').focus(); } else $('promotion-TenChuongTrinh').focus(); return; }
        try {
            const data = itemMode ? await api.getPromotionItem(detailId, id, { signal: attempt.signal }) : await api.getPromotion(id, { signal: attempt.signal });
            if (!alive('dialog', attempt) || !dialog.open) return;
            if (itemMode) {
                checkItem(data.item, detailId); if (data.item.MaThuoc !== id) throw new ApiError('INVALID_RESPONSE');
                $('promotion-selected-product').textContent = `${products.get(id)?.TenThuoc || `Thuốc #${id}`} · #${id} · Mã vạch: ${products.get(id)?.MaVach || 'Chưa có'}`;
                for (const key of ['LoaiGiamGia', 'SoLuong']) $(`promotion-${key}`).value = String(data.item[key]);
                $('promotion-GiaTriGiam').value = data.item.LoaiGiamGia ? String(Number(data.item.GiaTriGiam)) : data.item.GiaTriGiam;
                $('promotion-delete-name').textContent = `${products.get(id)?.TenThuoc || `Thuốc #${id}`} · ${formatPromotionDiscount(data.item)} · Số lượng: ${data.item.SoLuong}`;
            } else {
                checkProgram(data.promotion); if (data.promotion.MaChuongTrinh !== id) throw new ApiError('INVALID_RESPONSE');
                for (const [key] of programFields) $(`promotion-${key}`).value = data.promotion[key]; $('promotion-delete-name').textContent = data.promotion.TenChuongTrinh;
            }
            ready = true; $('promotion-dialog-loading').textContent = ''; $('promotion-form').hidden = removing; discountLabel(); setBusy(false); (removing ? $('promotion-dialog-close') : itemMode ? $('promotion-LoaiGiamGia') : $('promotion-TenChuongTrinh')).focus();
        } catch (error) { if (alive('dialog', attempt) && error.code !== 'REQUEST_ABORTED' && !access(error)) { $('promotion-dialog-loading').textContent = ''; $('promotion-dialog-error').textContent = promotionError(error); } }
    }
    async function save(removing = false) {
        if (!active || busy || !ready) return;
        clearErrors(); const itemMode = mode.startsWith('item-'), create = mode.endsWith('create');
        const values = Object.fromEntries(fieldNames.map(key => [key, $(`promotion-${key}`).value]));
        const { data, errors } = itemMode ? validatePromotionItem(values, { create, quantityEditable: !create }) : validatePromotion(values);
        if (!removing && itemMode && create && (!pickerReady || items.some(item => item.MaThuoc === data.MaThuoc))) errors.MaThuoc = !pickerReady ? 'Chưa tải được thuốc. Nhấn Tìm thuốc để thử lại.' : 'Thuốc đã có trong chương trình.';
        if (!removing && Object.keys(errors).length) {
            for (const [key, text] of Object.entries(errors)) { $(`promotion-${key}-error`).textContent = text; $(`promotion-${key}`).setAttribute('aria-invalid', 'true'); }
            $(`promotion-${Object.keys(errors)[0]}`).focus(); return;
        }
        const attempt = slots.get('dialog').version, selectedProgram = detailId, selectedId = targetId; setBusy(true);
        try {
            let result;
            if (itemMode) result = removing ? await api.deletePromotionItem(selectedProgram, selectedId) : create ? await api.createPromotionItem(selectedProgram, data) : await api.updatePromotionItem(selectedProgram, selectedId, data);
            else result = removing ? await api.deletePromotion(selectedId) : create ? await api.createPromotion(data) : await api.updatePromotion(selectedId, data);
            if (!active || attempt !== slots.get('dialog').version) return;
            const expected = `${itemMode ? 'PROMOTION_ITEM' : 'PROMOTION'}_${removing ? 'DELETED' : create ? 'CREATED' : 'UPDATED'}`;
            if (result.code !== expected) throw new ApiError('INVALID_RESPONSE');
            if (!removing) { if (itemMode) { checkItem(result.item, selectedProgram); if (result.item.MaThuoc !== (create ? data.MaThuoc : selectedId)) throw new ApiError('INVALID_RESPONSE'); } else { checkProgram(result.promotion); if (!create && result.promotion.MaChuongTrinh !== selectedId) throw new ApiError('INVALID_RESPONSE'); } }
            closeDialog(); feedback(removing ? 'Đã xóa dữ liệu được chọn.' : 'Đã lưu thay đổi. Danh sách đang được tải lại.');
            if (itemMode) loadItems(itemPage); else loadList();
        } catch (error) {
            if (!active || attempt !== slots.get('dialog').version) return;
            if (!access(error)) { $('promotion-dialog-error').textContent = promotionError(error); if (['PROMOTION_NOT_FOUND', 'PROMOTION_ITEM_NOT_FOUND', 'PROMOTION_IN_USE'].includes(error.code)) ready = false; $('promotion-dialog-error').focus(); }
        } finally { if (attempt === slots.get('dialog')?.version) setBusy(false); }
    }
    $('promotion-form').addEventListener('submit', event => { event.preventDefault(); save(); }); $('promotion-delete-confirm').addEventListener('click', () => save(true));
    for (const id of ['promotion-dialog-close', 'promotion-dialog-cancel']) $(id).addEventListener('click', () => { if (!busy) closeDialog(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); }); document.addEventListener('keydown', event => { if (dialog.open && busy && event.key === 'Escape') event.preventDefault(); });
    dialog.addEventListener('close', () => { if (dialog.open) return; cancel('dialog'); cancel('picker'); ready = false; busy = false; document.body.classList.remove('category-modal-open'); if (active) (opener?.isConnected && opener.getClientRects().length ? opener : current ? $('promotion-item-add') : $('promotions-list-title')).focus(); });
    for (const key of fieldNames) $(`promotion-${key}`).addEventListener('input', () => { $(`promotion-${key}-error`).textContent = ''; $(`promotion-${key}`).removeAttribute('aria-invalid'); });
    $('promotion-LoaiGiamGia').addEventListener('change', discountLabel);
    $('promotion-product-find').addEventListener('click', () => { const value = $('promotion-product-search').value.trim(); if ([...value].length > 255 || value.includes('\0')) { $('promotion-picker-status').textContent = 'Từ khóa tối đa 255 ký tự, không chứa NUL.'; return; } pickerSearch = value; pickerPage = 1; loadPicker(); });
    $('promotion-product-search').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); $('promotion-product-find').click(); } });
    $('promotion-picker-prev').addEventListener('click', () => { pickerPage--; loadPicker(); }); $('promotion-picker-next').addEventListener('click', () => { pickerPage++; loadPicker(); });
    $('promotion-add').addEventListener('click', event => openDialog('program-create', undefined, event.currentTarget)); $('promotion-item-add').addEventListener('click', event => openDialog('item-create', undefined, event.currentTarget));
    $('promotions-body').addEventListener('click', event => { const button = event.target.closest('[data-promotion-action]'); if (!button) return; const id = Number(button.dataset.id); if (button.dataset.promotionAction === 'view') openDetail(id); else openDialog(`program-${button.dataset.promotionAction}`, id, button); });
    itemTable.body.addEventListener('click', event => { const button = event.target.closest('[data-item-action]'); if (button) openDialog(`item-${button.dataset.itemAction}`, Number(button.dataset.id), button); });
    $('promotions-filters').addEventListener('submit', event => { event.preventDefault(); filters = { search: $('promotions-search').value.trim(), status: $('promotions-status').value }; page = 1; drawList(); });
    $('promotions-prev').addEventListener('click', () => { page--; drawList(); }); $('promotions-next').addEventListener('click', () => { page++; drawList(); });
    for (const id of ['promotions-refresh', 'promotions-retry']) $(id).addEventListener('click', loadList);
    $('promotion-back').addEventListener('click', showList); for (const id of ['promotion-detail-refresh', 'promotion-detail-retry']) $(id).addEventListener('click', () => openDetail(detailId));
    let renderedDay = vietnamToday();
    function refreshDates() { const today = vietnamToday(); if (!active || today === renderedDay) return; renderedDay = today; if (listReady) drawList(); if (current) drawIdentity(); }
    const dateTimer = setInterval(refreshDates, 60000); window.addEventListener('pagehide', () => clearInterval(dateTimer), { once: true });
    window.addEventListener('focus', refreshDates); document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDates(); });
    function deactivate() { active = false; for (const key of slots.keys()) cancel(key); closeDialog(); }
    return {
        activate() { if (active) return; active = true; if (detailId) openDetail(detailId); else { $('promotion-detail-view').hidden = true; $('promotions-list-view').hidden = false; loadList(); } },
        deactivate,
        clear() {
            deactivate(); programs = []; items = []; products.clear(); current = undefined; detailId = undefined; listReady = itemsReady = false; page = itemPage = 1;
            filters = { search: '', status: '' }; $('promotions-filters').reset(); $('promotion-form').reset(); clearErrors(); feedback(); itemTable.clear();
            for (const id of ['promotions-body', 'promotion-identity']) $(id).replaceChildren();
            $('promotion-MaThuoc').replaceChildren(new Option('Chọn thuốc…', '')); $('promotion-MaThuoc').disabled = true; $('promotion-item-add').disabled = true;
            for (const id of ['promotions-count', 'promotions-page', 'promotion-detail-status', 'promotion-dialog-context', 'promotion-dialog-loading', 'promotion-selected-product', 'promotion-delete-name', 'promotion-picker-status']) $(id).textContent = '';
            $('promotion-product-search').value = ''; listState('Đăng nhập để tải chương trình.');
        }
    };
}
