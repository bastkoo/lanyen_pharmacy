import { getProducts, getProduct } from '../api/products.js';
import { getBatches, getBatch, createBatch, updateBatch, deleteBatch } from '../api/batches.js';
import { ApiError } from '../api/auth.js';
import { setupLiveSearch } from '../utils/live-search.js';
import { validHttps } from '../utils/product-validation.js';
import { formatUnitPrice } from '../utils/unit-validation.js';
import { BATCH_FIELDS, validateBatch, formatBatchDate, expiryText, vietnamToday, dateValue, stockError } from '../utils/batch-validation.js';
import { stockNode as n, setupStockTable } from '../components/stock-table.js';

export function setupBatches({ root, onAccessError }) {
    const $ = id => document.getElementById(id), dialog = $('batch-dialog');
    let active = false, productId, product, pendingId, productsPage = 1, search = '', page = 1;
    let pickerVersion = 0, selectionVersion = 0, listVersion = 0, dialogVersion = 0;
    let pickerController, selectionController, listController, dialogController;
    let busy = false, ready = false, mode, batchId, opener;
    const cancelSearch = setupLiveSearch({ input: $('batch-search'), form: $('batch-product-search'), isActive: () => active });
    const count = value => new Intl.NumberFormat('vi-VN').format(value);
    function checkBatch(batch, id) {
        if (!batch || !Number.isInteger(batch.MaLo) || batch.MaThuoc !== id || typeof batch.SoLoSanXuat !== 'string' || dateValue(batch.NgaySanXuat) === null || dateValue(batch.HanSuDung) === null || ![batch.SoLuongNhap, batch.SoLuongTon, batch.GiaNhap].every(Number.isSafeInteger)) throw new ApiError('INVALID_RESPONSE');
    }
    function access(error) {
        if (['UNAUTHENTICATED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) { onAccessError(error); return true; }
        return false;
    }
    function feedback(text = '') { $('batch-feedback').textContent = text; $('batch-feedback').hidden = !text; }
    const row = batch => {
        checkBatch(batch, productId);
        const tr = n('tr'), actions = n('td');
        for (const [action, label] of [['view', 'Xem'], ['edit', 'Sửa'], ['delete', 'Yêu cầu xóa']]) {
            const button = n('button', label, `categories-action${action === 'delete' ? ' categories-action--delete' : ''}`);
            button.type = 'button'; button.dataset.batchAction = action; button.dataset.id = batch.MaLo;
            button.setAttribute('aria-label', `${label} lô ${batch.SoLoSanXuat}`); actions.append(button);
        }
        const name = n('th', batch.SoLoSanXuat); name.scope = 'row';
        tr.append(name, n('td', formatBatchDate(batch.NgaySanXuat), 'stock-date'), n('td', formatBatchDate(batch.HanSuDung), 'stock-date'), n('td', count(batch.SoLuongNhap), 'stock-number'), n('td', count(batch.SoLuongTon), 'stock-number'), n('td', formatUnitPrice(batch.GiaNhap), 'stock-number'), n('td', expiryText(batch.HanSuDung, vietnamToday())), actions);
        return tr;
    };
    row.search = batch => batch.SoLoSanXuat;
    const table = setupStockTable({ root: $('batch-table'), id: 'batches', title: 'Các lô của thuốc đang chọn', description: 'Trạng thái hạn theo ngày Việt Nam trên thiết bị. Backend hiện không cho phép xóa lô.', columns: [['Số lô sản xuất'], ['Ngày sản xuất'], ['Hạn sử dụng'], ['SL nhập', true], ['SL tồn', true], ['Giá nhập (VND)', true], ['Trạng thái hạn'], ['Thao tác']], filterLabel: 'Lọc số lô trong trang này', onLoad: loadList, renderRow: row });
    table.clear('Chọn một thuốc để tải danh sách lô.');
    for (const [name, label, type] of BATCH_FIELDS) {
        const wrap = n('div'), caption = n('label', `${label} *`), input = n('input', undefined, 'categories-input'), error = n('p', '', 'category-dialog__error');
        input.id = `batch-${name}`; input.name = name; input.type = type; input.required = true;
        if (['GiaNhap', 'SoLuongNhap'].includes(name)) input.inputMode = 'numeric';
        caption.htmlFor = input.id; error.id = `${input.id}-error`; error.setAttribute('role', 'status'); input.setAttribute('aria-describedby', error.id);
        input.addEventListener('input', () => { error.textContent = ''; input.removeAttribute('aria-invalid'); });
        wrap.append(caption, input, error); $('batch-fields').append(wrap);
    }
    async function loadProducts() {
        pickerController?.abort(); pickerController = new AbortController(); const attempt = ++pickerVersion;
        $('batch-picker-status').textContent = 'Đang tìm thuốc…'; $('batch-product-select').disabled = true;
        $('batch-product-select').replaceChildren(new Option('Chọn thuốc…', ''));
        $('batch-products-prev').disabled = $('batch-products-next').disabled = true;
        try {
            const data = await getProducts({ search, page: productsPage, per_page: 20, sort_by: 'TenThuoc', sort_order: 'asc' }, { signal: pickerController.signal });
            if (!active || attempt !== pickerVersion) return;
            if (data.code !== 'PRODUCTS_LISTED' || !Array.isArray(data.items)) throw new ApiError('INVALID_RESPONSE');
            for (const item of data.items) {
                if (!Number.isInteger(item.MaThuoc) || typeof item.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
                $('batch-product-select').append(new Option(`${item.TenThuoc} · Mã vạch: ${item.MaVach || 'Chưa có'}`, String(item.MaThuoc)));
            }
            $('batch-product-select').value = String(productId || ''); $('batch-product-select').disabled = !data.items.length;
            $('batch-picker-status').textContent = data.total ? `${data.total} thuốc · Trang ${data.page} / ${data.pages}` : 'Không tìm thấy thuốc phù hợp.';
            $('batch-products-prev').disabled = data.page <= 1; $('batch-products-next').disabled = data.page >= data.pages;
        } catch (error) {
            if (!active || attempt !== pickerVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) $('batch-picker-status').textContent = stockError(error);
        }
    }
    async function selectProduct(id) {
        if (!active || busy || !Number.isInteger(id) || id <= 0) return;
        closeDialog(); listVersion++; listController?.abort(); selectionController?.abort();
        selectionController = new AbortController(); const attempt = ++selectionVersion;
        productId = id; pendingId = id; product = undefined; page = 1; feedback(); table.loading();
        $('batch-product-identity').replaceChildren(); $('batch-product-identity').hidden = true; $('batch-add').disabled = true;
        try {
            const data = await getProduct(id, { signal: selectionController.signal });
            if (!active || attempt !== selectionVersion) return;
            if (data.code !== 'PRODUCT_FOUND' || data.product?.MaThuoc !== id || typeof data.product.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
            product = data.product; const identity = n('div'); identity.append(n('h3', product.TenThuoc), n('p', `Mã dược: ${product.MaDuoc} · SĐK: ${product.SoDangKy}`), n('p', `Mã vạch: ${product.MaVach || 'Chưa có'}`));
            if (validHttps(product.HinhAnh)) { const image = n('img'); image.alt = `Ảnh ${product.TenThuoc}`; image.referrerPolicy = 'no-referrer'; image.src = product.HinhAnh; image.addEventListener('error', () => { image.hidden = true; }); $('batch-product-identity').append(image); }
            $('batch-product-identity').append(identity); $('batch-product-identity').hidden = false; $('batch-add').disabled = false;
            $('batch-product-select').value = String(id); loadList(1);
        } catch (error) {
            if (!active || attempt !== selectionVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) table.error(stockError(error));
        }
    }
    async function loadList(nextPage = page) {
        if (!active) return;
        if (!product) { if (productId) selectProduct(productId); return; }
        listController?.abort(); listController = new AbortController(); const attempt = ++listVersion, id = productId;
        page = nextPage; table.loading();
        try {
            const data = await getBatches(id, { page, per_page: 20 }, { signal: listController.signal });
            if (!active || attempt !== listVersion || id !== productId) return;
            if (data.code !== 'BATCHES_LISTED' || !Array.isArray(data.items)) throw new ApiError('INVALID_RESPONSE');
            data.items.forEach(batch => checkBatch(batch, id));
            if (!data.items.length && page > 1) return loadList(Math.max(1, data.pages));
            table.render(data);
        } catch (error) {
            if (!active || attempt !== listVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) table.error(stockError(error));
        }
    }
    function clearErrors() {
        $('batch-dialog-error').textContent = '';
        for (const [name] of BATCH_FIELDS) { $(`batch-${name}-error`).textContent = ''; $(`batch-${name}`).removeAttribute('aria-invalid'); }
    }
    function setBusy(value) {
        busy = value; dialog.setAttribute('aria-busy', String(value));
        for (const control of dialog.querySelectorAll('input,button')) control.disabled = value;
        $('batch-SoLuongNhap').disabled = value || mode !== 'create';
        $('batch-save').disabled = value || !ready; $('batch-delete-confirm').disabled = value || !ready;
        $('batch-save').textContent = value ? 'Đang lưu…' : mode === 'create' ? 'Thêm lô thuốc' : 'Lưu thay đổi';
        $('batch-delete-confirm').textContent = value ? 'Đang gửi…' : 'Xác nhận yêu cầu xóa';
    }
    function closeDialog() { dialogVersion++; dialogController?.abort(); ready = false; busy = false; if (dialog.open) dialog.close(); document.body.classList.remove('category-modal-open'); }
    async function openDialog(action, id, source) {
        if (!active || !product || busy) return;
        dialogController?.abort(); dialogController = new AbortController(); const attempt = ++dialogVersion, selectedId = productId;
        mode = action; batchId = id; opener = source; ready = action === 'create'; clearErrors(); $('batch-form').reset();
        $('batch-dialog-title').textContent = ({ create: 'Thêm lô thuốc', edit: 'Sửa thông tin lô', view: 'Chi tiết lô thuốc', delete: 'Yêu cầu xóa lô' })[action];
        $('batch-dialog-context').textContent = product.TenThuoc;
        $('batch-dialog-status').textContent = ready ? '' : 'Đang lấy dữ liệu hiện tại…';
        $('batch-form').hidden = !ready; $('batch-detail-panel').hidden = true; $('batch-delete-panel').hidden = action !== 'delete';
        $('batch-detail-panel').replaceChildren(); $('batch-delete-name').textContent = '';
        setBusy(false); dialog.showModal(); document.body.classList.add('category-modal-open');
        if (ready) { $('batch-SoLoSanXuat').focus(); return; }
        try {
            const data = await getBatch(selectedId, id, { signal: dialogController.signal });
            if (!active || attempt !== dialogVersion || !dialog.open) return;
            if (data.code !== 'BATCH_FOUND' || data.batch?.MaLo !== id) throw new ApiError('INVALID_RESPONSE'); checkBatch(data.batch, selectedId);
            const batch = data.batch; ready = true; $('batch-dialog-status').textContent = `SL nhập: ${count(batch.SoLuongNhap)} · SL tồn: ${count(batch.SoLuongTon)}`;
            if (action === 'edit') { for (const [name] of BATCH_FIELDS) $(`batch-${name}`).value = batch[name]; $('batch-form').hidden = false; }
            if (action === 'view') {
                const dl = n('dl');
                for (const [name, label] of [...BATCH_FIELDS, ['SoLuongTon', 'Số lượng tồn']]) {
                    const value = ['NgaySanXuat', 'HanSuDung'].includes(name) ? formatBatchDate(batch[name]) : name === 'GiaNhap' ? formatUnitPrice(batch[name]) : String(batch[name]);
                    dl.append(n('dt', label), n('dd', value));
                }
                dl.append(n('dt', 'Trạng thái hạn theo ngày Việt Nam'), n('dd', expiryText(batch.HanSuDung, vietnamToday()))); $('batch-detail-panel').append(dl); $('batch-detail-panel').hidden = false;
            }
            if (action === 'delete') $('batch-delete-name').textContent = `${batch.SoLoSanXuat} · ${product.TenThuoc}`;
            setBusy(false); (action === 'edit' ? $('batch-SoLoSanXuat') : $('batch-close')).focus();
        } catch (error) {
            if (!active || attempt !== dialogVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) { $('batch-dialog-status').textContent = ''; $('batch-dialog-error').textContent = stockError(error); }
        }
    }
    async function save(remove = false) {
        if (!active || !ready || busy || !product) return;
        clearErrors(); const create = mode === 'create';
        const { data, errors } = validateBatch(Object.fromEntries(BATCH_FIELDS.map(([name]) => [name, $(`batch-${name}`).value])), create);
        if (!remove && Object.keys(errors).length) {
            for (const [name, message] of Object.entries(errors)) { $(`batch-${name}-error`).textContent = message; $(`batch-${name}`).setAttribute('aria-invalid', 'true'); }
            $(`batch-${Object.keys(errors)[0]}`).focus(); return;
        }
        const attempt = dialogVersion, id = productId, selectedBatch = batchId; setBusy(true);
        try {
            if (remove) {
                // Module 02.4 deliberately has no successful DELETE response.
                await deleteBatch(id, selectedBatch); throw new ApiError('INVALID_RESPONSE');
            }
            const result = create ? await createBatch(id, data) : await updateBatch(id, selectedBatch, data);
            if (!active || attempt !== dialogVersion || id !== productId) return;
            if (result.code !== (create ? 'BATCH_CREATED' : 'BATCH_UPDATED') || (!create && result.batch?.MaLo !== selectedBatch)) throw new ApiError('INVALID_RESPONSE');
            checkBatch(result.batch, id); closeDialog(); feedback(create ? 'Đã thêm lô. Backend khởi tạo lượng tồn từ lượng nhập.' : 'Đã cập nhật thông tin lô. Lượng nhập và lượng tồn được giữ nguyên.'); loadList(page);
        } catch (error) {
            if (!active || attempt !== dialogVersion) return;
            if (!access(error)) {
                $('batch-dialog-error').textContent = stockError(error);
                if (['BATCH_NOT_FOUND', 'PRODUCT_NOT_FOUND', 'BATCH_DELETE_UNSAFE', 'BATCH_STOCK_INCONSISTENT'].includes(error.code)) ready = false;
                $('batch-dialog-error').focus();
            }
        } finally { if (attempt === dialogVersion) setBusy(false); }
    }
    $('batch-form').addEventListener('submit', event => { event.preventDefault(); save(); });
    $('batch-delete-confirm').addEventListener('click', () => save(true));
    for (const id of ['batch-close', 'batch-cancel']) $(id).addEventListener('click', () => { if (!busy) closeDialog(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    document.addEventListener('keydown', event => { if (dialog.open && busy && event.key === 'Escape') event.preventDefault(); });
    dialog.addEventListener('close', () => { if (dialog.open) return; dialogVersion++; dialogController?.abort(); ready = false; busy = false; document.body.classList.remove('category-modal-open'); if (active) (opener?.isConnected && opener.getClientRects().length ? opener : $('batch-add')).focus(); });
    $('batch-add').addEventListener('click', event => openDialog('create', undefined, event.currentTarget));
    table.body.addEventListener('click', event => { const button = event.target.closest('[data-batch-action]'); if (button) openDialog(button.dataset.batchAction, Number(button.dataset.id), button); });
    $('batch-product-select').addEventListener('change', () => selectProduct(Number($('batch-product-select').value)));
    $('batch-product-search').addEventListener('submit', event => {
        event.preventDefault(); const value = $('batch-search').value.trim();
        $('batch-search-error').textContent = [...value].length > 255 || value.includes('\0') ? 'Từ khóa tối đa 255 ký tự, không chứa NUL.' : '';
        if ($('batch-search-error').textContent) return;
        search = value; productsPage = 1; loadProducts();
    });
    $('batch-products-prev').addEventListener('click', () => { productsPage--; loadProducts(); }); $('batch-products-next').addEventListener('click', () => { productsPage++; loadProducts(); }); $('batch-products-retry').addEventListener('click', loadProducts);
    function deactivate() { cancelSearch(); active = false; pickerVersion++; selectionVersion++; listVersion++; pickerController?.abort(); selectionController?.abort(); listController?.abort(); closeDialog(); }
    return {
        activate() { if (active) return; active = true; loadProducts(); if (pendingId) selectProduct(pendingId); },
        openProduct(id) { pendingId = id; if (active) selectProduct(id); },
        deactivate,
        clear() {
            deactivate(); productId = product = pendingId = undefined; productsPage = page = 1; search = '';
            $('batch-product-search').reset(); $('batch-product-select').replaceChildren(new Option('Chọn thuốc…', '')); $('batch-product-select').disabled = true; $('batch-add').disabled = true;
            $('batch-product-identity').replaceChildren(); $('batch-product-identity').hidden = true; $('batch-form').reset(); $('batch-detail-panel').replaceChildren();
            for (const id of ['batch-picker-status', 'batch-search-error', 'batch-dialog-context', 'batch-dialog-status', 'batch-delete-name']) $(id).textContent = '';
            clearErrors(); feedback(); table.clear('Chọn một thuốc để tải danh sách lô.');
        }
    };
}
