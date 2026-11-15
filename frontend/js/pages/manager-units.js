import { getProducts, getProduct } from '../api/products.js';
import { getUnits, getUnit, createUnit, updateUnit, deleteUnit } from '../api/units.js';
import { ApiError } from '../api/auth.js';
import { validHttps } from '../utils/product-validation.js';
import { validateUnit, formatUnitPrice, unitErrorMessage } from '../utils/unit-validation.js';

const fields = ['DonViTinh', 'GiaBan', 'SoLuongQuyDoi'];
const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
const integer = value => Number.isInteger(value) && value > 0;
const validUnit = (unit, productId) => unit && integer(unit.MaDonGia) && unit.MaThuoc === productId &&
    Object.keys(validateUnit(unit).errors).length === 0;

export function setupUnits({ root, onAccessError }) {
    const $ = id => document.getElementById(id), dialog = $('unit-dialog');
    let active = false, productId, product, productPage = 1, search = '', page = 1;
    let pickerVersion = 0, selectionVersion = 0, listVersion = 0, dialogVersion = 0;
    let pickerController, selectionController, listController, dialogController;
    let mode, unitId, opener, busy = false, ready = false;

    function access(error) {
        if (['UNAUTHENTICATED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) { onAccessError(error); return true; }
        return false;
    }
    function feedback(text = '') { $('units-feedback').textContent = text; $('units-feedback').hidden = !text; }
    function state(type, title = '', description = '') {
        $('units-workspace').setAttribute('aria-busy', String(type === 'loading'));
        $('units-state').hidden = type === 'ready'; $('units-table-wrap').hidden = type !== 'ready';
        $('units-state-title').textContent = title; $('units-state-description').textContent = description;
        $('units-retry').hidden = type !== 'error';
        if (type !== 'ready') { $('units-prev').disabled = true; $('units-next').disabled = true; }
    }
    function markSelection() {
        for (const button of $('units-products').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.id) === productId));
    }
    async function loadProducts() {
        pickerController?.abort(); pickerController = new AbortController(); const attempt = ++pickerVersion;
        $('units-picker-status').textContent = 'Đang tìm thuốc…'; $('units-picker-retry').hidden = true;
        $('units-products').replaceChildren(); $('units-products-prev').disabled = true; $('units-products-next').disabled = true;
        $('units-products-page').textContent = '';
        try {
            const data = await getProducts({ search, page: productPage, per_page: 10, sort_by: 'TenThuoc', sort_order: 'asc' }, { signal: pickerController.signal });
            if (!active || attempt !== pickerVersion) return;
            if (data.code !== 'PRODUCTS_LISTED' || !Array.isArray(data.items)) throw new ApiError('INVALID_RESPONSE');
            for (const item of data.items) {
                if (!integer(item.MaThuoc) || typeof item.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
                const li = node('li'), button = node('button'); button.type = 'button'; button.dataset.id = item.MaThuoc;
                button.append(node('strong', item.TenThuoc), node('span', `#${item.MaThuoc} · ${item.MaDuoc || 'Chưa có mã dược'}`), node('span', `Mã vạch: ${item.MaVach || 'Chưa có'}`));
                li.append(button); $('units-products').append(li);
            }
            markSelection(); $('units-picker-status').textContent = data.total ? `${data.total} thuốc phù hợp` : 'Không tìm thấy thuốc. Thử từ khóa khác.';
            $('units-products-page').textContent = data.pages ? `${data.page} / ${data.pages}` : '';
            $('units-products-prev').disabled = data.page <= 1; $('units-products-next').disabled = data.page >= data.pages;
        } catch (error) {
            if (!active || attempt !== pickerVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) { $('units-picker-status').textContent = unitErrorMessage(error); $('units-picker-retry').hidden = false; }
        }
    }
    async function loadList() {
        if (!active || !product) return;
        listController?.abort(); listController = new AbortController(); const attempt = ++listVersion, id = productId;
        state('loading', 'Đang tải bảng giá…'); $('units-count').textContent = ''; $('units-page').textContent = '';
        $('units-body').replaceChildren();
        try {
            const data = await getUnits(id, { page, per_page: 20 }, { signal: listController.signal });
            if (!active || attempt !== listVersion || id !== productId) return;
            if (data.code !== 'UNITS_LISTED' || !Array.isArray(data.items) || !data.items.every(item => validUnit(item, id))) throw new ApiError('INVALID_RESPONSE');
            if (!data.items.length && page > 1) { page = Math.max(1, data.pages); return loadList(); }
            for (const item of data.items) {
                const row = node('tr'), actions = node('td');
                const name = node('th', item.DonViTinh); name.scope = 'row';
                for (const [action, label] of [['edit', 'Sửa'], ['delete', 'Xóa']]) {
                    const button = node('button', label, `categories-action${action === 'delete' ? ' categories-action--delete' : ''}`);
                    button.type = 'button'; button.dataset.action = action; button.dataset.id = item.MaDonGia;
                    button.setAttribute('aria-label', `${label} đơn vị ${item.DonViTinh}`); actions.append(button);
                }
                row.append(name, node('td', new Intl.NumberFormat('vi-VN').format(item.SoLuongQuyDoi), 'units-number'), node('td', formatUnitPrice(item.GiaBan), 'units-number'), actions);
                $('units-body').append(row);
            }
            state(data.items.length ? 'ready' : 'empty', 'Thuốc chưa có đơn vị bán', 'Thêm đơn vị tính, giá bán và số lượng quy đổi cho thuốc này.');
            $('units-count').textContent = `${data.total} đơn vị bán`;
            $('units-page').textContent = data.pages ? `Trang ${data.page} / ${data.pages}` : '';
            $('units-prev').disabled = data.page <= 1; $('units-next').disabled = data.page >= data.pages;
        } catch (error) {
            if (!active || attempt !== listVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) state('error', 'Chưa tải được bảng giá', unitErrorMessage(error));
        }
    }
    async function selectProduct(id) {
        if (!active || busy) return;
        closeDialog(); selectionController?.abort(); listController?.abort(); listVersion++;
        selectionController = new AbortController(); const attempt = ++selectionVersion;
        productId = id; product = undefined; page = 1; feedback(); markSelection();
        $('units-product').replaceChildren(); $('units-product').hidden = true;
        $('units-add').disabled = true; $('units-reload').disabled = true; $('units-count').textContent = ''; $('units-page').textContent = '';
        $('units-body').replaceChildren(); state('loading', 'Đang tải thông tin thuốc…');
        try {
            const data = await getProduct(id, { signal: selectionController.signal });
            if (!active || attempt !== selectionVersion) return;
            if (data.code !== 'PRODUCT_FOUND' || data.product?.MaThuoc !== id || typeof data.product.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
            product = data.product;
            const identity = node('div'); identity.append(node('h3', product.TenThuoc), node('p', `#${id} · Mã dược: ${product.MaDuoc} · SĐK: ${product.SoDangKy}`), node('p', `Mã vạch: ${product.MaVach || 'Chưa có'}`));
            if (validHttps(product.HinhAnh)) {
                const image = node('img'); image.alt = `Ảnh ${product.TenThuoc}`; image.referrerPolicy = 'no-referrer'; image.src = product.HinhAnh;
                image.addEventListener('error', () => { image.hidden = true; }); $('units-product').append(image);
            }
            $('units-product').append(identity); $('units-product').hidden = false;
            $('units-add').disabled = false; $('units-reload').disabled = false; loadList();
        } catch (error) {
            if (!active || attempt !== selectionVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) state('error', 'Chưa tải được thông tin thuốc', unitErrorMessage(error));
        }
    }
    function clearErrors() {
        $('unit-error').textContent = '';
        for (const name of fields) { $(`unit-${name}-error`).textContent = ''; $(`unit-${name}`).removeAttribute('aria-invalid'); }
    }
    function setBusy(value) {
        busy = value; dialog.setAttribute('aria-busy', String(value));
        for (const control of dialog.querySelectorAll('button,input')) control.disabled = value;
        $('unit-save').disabled = value || !ready; $('unit-delete-confirm').disabled = value || !ready;
        $('unit-save').textContent = value ? 'Đang lưu…' : mode === 'create' ? 'Thêm đơn vị' : 'Lưu thay đổi';
        $('unit-delete-confirm').textContent = value ? 'Đang xóa…' : 'Xóa đơn vị';
    }
    function closeDialog() {
        dialogVersion++; dialogController?.abort(); ready = false; busy = false;
        if (dialog.open) dialog.close(); document.body.classList.remove('category-modal-open');
    }
    async function openDialog(action, id, source) {
        if (!active || !product || busy) return;
        dialogController?.abort(); dialogController = new AbortController(); const attempt = ++dialogVersion, selectedId = productId;
        mode = action; unitId = id; opener = source; ready = action === 'create';
        $('unit-form').reset(); clearErrors(); $('unit-delete-summary').textContent = '';
        $('unit-dialog-title').textContent = action === 'create' ? 'Thêm đơn vị bán' : action === 'edit' ? 'Sửa đơn vị & giá bán' : 'Xóa đơn vị bán';
        $('unit-dialog-context').textContent = `${product.TenThuoc} · #${productId}`;
        $('unit-dialog-status').textContent = ready ? '' : 'Đang lấy dữ liệu hiện tại…';
        $('unit-form').hidden = action === 'delete' || !ready; $('unit-delete-panel').hidden = action !== 'delete';
        setBusy(false); dialog.showModal(); document.body.classList.add('category-modal-open');
        if (ready) { $('unit-DonViTinh').focus(); return; }
        try {
            const data = await getUnit(selectedId, id, { signal: dialogController.signal });
            if (!active || attempt !== dialogVersion || !dialog.open) return;
            if (data.code !== 'UNIT_FOUND' || !validUnit(data.unit, selectedId) || data.unit.MaDonGia !== id) throw new ApiError('INVALID_RESPONSE');
            ready = true; $('unit-dialog-status').textContent = '';
            if (action === 'delete') { $('unit-delete-summary').textContent = `${data.unit.DonViTinh} · ${formatUnitPrice(data.unit.GiaBan)} · Quy đổi: ${data.unit.SoLuongQuyDoi}`; $('unit-delete-cancel').focus(); }
            else { for (const name of fields) $(`unit-${name}`).value = data.unit[name]; $('unit-form').hidden = false; $('unit-DonViTinh').focus(); }
            setBusy(false);
        } catch (error) {
            if (!active || attempt !== dialogVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) { $('unit-dialog-status').textContent = ''; $('unit-error').textContent = unitErrorMessage(error); }
        }
    }
    async function save(remove = false) {
        if (!active || busy || !ready || !product) return;
        clearErrors();
        const { data, errors } = validateUnit(Object.fromEntries(fields.map(name => [name, $(`unit-${name}`).value])));
        if (!remove && Object.keys(errors).length) {
            for (const [name, message] of Object.entries(errors)) { $(`unit-${name}-error`).textContent = message; $(`unit-${name}`).setAttribute('aria-invalid', 'true'); }
            $(`unit-${Object.keys(errors)[0]}`).focus(); return;
        }
        const attempt = dialogVersion, selectedId = productId, action = mode, selectedUnit = unitId;
        setBusy(true);
        try {
            const result = remove ? await deleteUnit(selectedId, selectedUnit) : action === 'create' ? await createUnit(selectedId, data) : await updateUnit(selectedId, selectedUnit, data);
            if (!active || attempt !== dialogVersion || selectedId !== productId) return;
            const expected = remove ? 'UNIT_DELETED' : action === 'create' ? 'UNIT_CREATED' : 'UNIT_UPDATED';
            if (result.code !== expected || (!remove && (!validUnit(result.unit, selectedId) || (action !== 'create' && result.unit.MaDonGia !== selectedUnit)))) throw new ApiError('INVALID_RESPONSE');
            closeDialog(); feedback(remove ? 'Đã xóa đơn vị bán. Đang tải lại bảng giá.' : 'Đã lưu đơn vị tính và giá bán. Đang tải lại bảng giá.'); await loadList();
        } catch (error) {
            if (!active || attempt !== dialogVersion) return;
            if (!access(error)) {
                $('unit-error').textContent = unitErrorMessage(error);
                if (['UNIT_NOT_FOUND', 'PRODUCT_NOT_FOUND'].includes(error.code) || (remove && error.code === 'UNIT_IN_USE')) ready = false;
                $('unit-error').focus();
            }
        } finally { if (attempt === dialogVersion) setBusy(false); }
    }
    $('unit-form').addEventListener('submit', event => { event.preventDefault(); save(); });
    $('unit-delete-confirm').addEventListener('click', () => save(true));
    for (const id of ['unit-close', 'unit-cancel', 'unit-delete-cancel']) $(id).addEventListener('click', () => { if (!busy) closeDialog(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    document.addEventListener('keydown', event => {
        if (dialog.open && busy && event.key === 'Escape') event.preventDefault();
    });
    dialog.addEventListener('close', () => {
        if (dialog.open) return;
        dialogVersion++; dialogController?.abort(); ready = false; busy = false; document.body.classList.remove('category-modal-open');
        if (active) { if (opener?.isConnected && opener.getClientRects().length) opener.focus(); else $('units-title').focus(); }
    });
    for (const name of fields) $(`unit-${name}`).addEventListener('input', () => { $(`unit-${name}-error`).textContent = ''; $(`unit-${name}`).removeAttribute('aria-invalid'); });
    $('units-add').addEventListener('click', event => openDialog('create', undefined, event.currentTarget));
    $('units-body').addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button) openDialog(button.dataset.action, Number(button.dataset.id), button); });
    $('units-products').addEventListener('click', event => { const button = event.target.closest('button[data-id]'); if (button) selectProduct(Number(button.dataset.id)); });
    $('units-search-form').addEventListener('submit', event => {
        event.preventDefault(); const value = $('units-search').value.trim();
        $('units-search-error').textContent = [...value].length > 255 || value.includes('\0') ? 'Từ khóa tối đa 255 ký tự, không chứa NUL.' : '';
        if ($('units-search-error').textContent) { $('units-search').focus(); return; }
        search = value; productPage = 1; loadProducts();
    });
    $('units-picker-retry').addEventListener('click', loadProducts);
    $('units-products-prev').addEventListener('click', () => { productPage--; loadProducts(); });
    $('units-products-next').addEventListener('click', () => { productPage++; loadProducts(); });
    $('units-prev').addEventListener('click', () => { page--; loadList(); });
    $('units-next').addEventListener('click', () => { page++; loadList(); });
    $('units-reload').addEventListener('click', loadList);
    $('units-retry').addEventListener('click', () => product ? loadList() : selectProduct(productId));
    function deactivate() {
        active = false; pickerVersion++; selectionVersion++; listVersion++;
        pickerController?.abort(); selectionController?.abort(); listController?.abort(); closeDialog();
    }
    return {
        activate() { if (active) return; active = true; loadProducts(); if (productId) selectProduct(productId); },
        deactivate,
        clear() {
            deactivate(); productId = undefined; product = undefined; productPage = 1; page = 1; search = '';
            root.querySelectorAll('input').forEach(input => { input.value = ''; });
            for (const id of ['units-products', 'units-body', 'units-product']) $(id).replaceChildren();
            for (const id of ['units-count', 'units-page', 'units-picker-status', 'units-products-page', 'units-search-error', 'unit-dialog-context', 'unit-dialog-status', 'unit-delete-summary']) $(id).textContent = '';
            $('units-product').hidden = true; $('units-add').disabled = true; $('units-reload').disabled = true;
            clearErrors(); feedback(); state('empty', 'Chọn một thuốc để bắt đầu', 'Tìm và chọn thuốc ở danh sách để quản lý đơn vị bán.');
        }
    };
}
