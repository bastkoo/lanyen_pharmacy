import { getProducts, getProduct, createProduct, updateProduct, deleteProduct, uploadProductImage } from '../api/products.js';
import { getCategories } from '../api/categories.js';
import { ApiError } from '../api/auth.js';
import { PRODUCT_GROUPS, PRODUCT_FIELDS, validateProduct, validateImageFile, validHttps, productErrorMessage } from '../utils/product-validation.js';

const node = (tag, text, className) => {
    const value = document.createElement(tag);
    if (text !== undefined) value.textContent = text;
    if (className) value.className = className;
    return value;
};
const classifications = value => value ? 'Cần dược sĩ tư vấn' : 'Không cần tư vấn';

export function setupProducts({ root, onAccessError }) {
    const $ = id => document.getElementById(id);
    const field = name => $(`product-${name}`);
    const dialog = $('product-delete-dialog');
    let active = false, page = 1, perPage = 20, filters = { sort_by: 'MaThuoc', sort_order: 'desc' }, categories = new Map(), categoriesReady = false;
    let listVersion = 0, detailVersion = 0, categoryVersion = 0, deleteVersion = 0;
    let listController, detailController, categoryController, deleteController;
    let mode = 'list', currentId, currentProduct, busy = false, ready = false, deleteReady = false, deleting = false, deleteId, opener;
    let selectedFile, objectUrl;

    // Static schema metadata generates labelled controls; API content is never interpreted as HTML.
    for (const group of PRODUCT_GROUPS) {
        const section = node('section', undefined, 'product-form-group');
        const title = node('h3', group.title); section.append(title);
        const grid = node('div', undefined, 'product-form-grid');
        for (const [name, label, type] of group.fields) {
            const wrap = node('div', undefined, 'products-field');
            const caption = node('label', `${label}${type === 'boolean' ? '' : ' *'}`); caption.htmlFor = `product-${name}`;
            const input = node(type === 'text' ? 'textarea' : ['category', 'boolean'].includes(type) ? 'select' : 'input');
            input.className = 'categories-input';
            input.id = `product-${name}`; input.name = name;
            if (input.tagName === 'INPUT') input.type = type === 'integer' ? 'number' : 'text';
            if (type === 'integer') { input.min = '0'; input.max = '2147483647'; input.step = '1'; input.inputMode = 'numeric'; }
            if (type === 'boolean') {
                for (const value of [false, true]) { const option = node('option', classifications(value)); option.value = String(value); input.append(option); }
            }
            input.required = type !== 'boolean';
            input.setAttribute('aria-describedby', `${input.id}-error`);
            const error = node('p', '', 'category-dialog__error'); error.id = `${input.id}-error`; error.setAttribute('role', 'status');
            input.addEventListener('input', () => { error.textContent = ''; input.removeAttribute('aria-invalid'); });
            wrap.append(caption, input, error);
            if (type === 'category') {
                const refresh = node('button', 'Làm mới danh mục', 'categories-action'); refresh.type = 'button';
                refresh.addEventListener('click', async () => {
                    refresh.disabled = true; error.textContent = 'Đang tải danh mục…';
                    await loadCategories(); refresh.disabled = busy;
                    if (!active) return;
                    if (!categoriesReady) showFieldError('MaLoaiThuoc', 'Chưa tải được danh mục. Vui lòng thử lại.');
                    else { error.textContent = ''; input.removeAttribute('aria-invalid'); }
                });
                wrap.append(refresh);
            }
            grid.append(wrap);
        }
        section.append(grid); $('product-field-groups').append(section);
    }

    function access(error) {
        if (['UNAUTHENTICATED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) { onAccessError(error); return true; }
        return false;
    }
    function feedback(text) { $('products-feedback').textContent = text; $('products-feedback').hidden = !text; }
    function showFieldError(name, text) {
        $(`product-${name}-error`).textContent = text;
        field(name).setAttribute('aria-invalid', 'true');
    }
    function clearErrors() {
        $('product-form-error').textContent = '';
        for (const name of [...PRODUCT_FIELDS.map(item => item[0]), 'HinhAnh']) {
            $(`product-${name}-error`).textContent = ''; field(name).removeAttribute('aria-invalid');
        }
    }
    function setBusy(value) {
        busy = value;
        $('product-form').setAttribute('aria-busy', String(value));
        for (const control of $('product-form').querySelectorAll('input,textarea,select,button')) control.disabled = value;
        $('product-back').disabled = value;
        $('product-add').disabled = value;
        $('product-save').disabled = value || !ready;
        $('product-upload').disabled = value || !selectedFile;
        field('MaLoaiThuoc').disabled = value || !categoriesReady;
        $('product-save').textContent = value ? 'Đang xử lý…' : mode === 'create' ? 'Thêm thuốc' : 'Lưu thay đổi';
    }
    function revokePreview() { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = undefined; }
    function showImage(url, image = $('product-image-preview'), placeholder = $('product-image-placeholder')) {
        const safe = url && (url === objectUrl || validHttps(url));
        image.hidden = !safe; placeholder.hidden = !!safe;
        if (safe) image.src = url; else image.removeAttribute('src');
    }
    $('product-image-preview').addEventListener('error', () => {
        $('product-image-preview').hidden = true; $('product-image-placeholder').hidden = false;
        $('product-image-placeholder').textContent = 'Không tải được ảnh từ URL';
    });
    function resetSelection() {
        revokePreview(); selectedFile = undefined; $('product-image-file').value = '';
        $('product-image-cancel').hidden = true; $('product-upload').disabled = true;
        $('product-image-placeholder').textContent = 'Chưa có ảnh thuốc'; showImage(field('HinhAnh').value);
    }
    function state(type, title = '', description = '') {
        $('products-list').setAttribute('aria-busy', String(type === 'loading'));
        $('products-state').hidden = type === 'ready'; $('products-table-wrap').hidden = type !== 'ready';
        $('products-state-title').textContent = title; $('products-state-description').textContent = description;
        $('products-retry').hidden = type !== 'error';
        if (type !== 'ready') { $('products-prev').disabled = true; $('products-next').disabled = true; }
    }
    function categoryName(id) { return categories.get(id) || `Danh mục #${id}`; }
    function fillCategories() {
        for (const id of ['products-category', 'product-MaLoaiThuoc']) {
            const select = $(id), previous = select.value;
            select.replaceChildren();
            const empty = node('option', id === 'products-category' ? 'Tất cả danh mục' : 'Chọn danh mục thuốc'); empty.value = ''; select.append(empty);
            for (const [value, text] of categories) { const option = node('option', text); option.value = value; select.append(option); }
            const selected = previous || (id === 'product-MaLoaiThuoc' && currentProduct ? String(currentProduct.MaLoaiThuoc) : '');
            if (selected && !categories.has(Number(selected))) {
                const option = node('option', `Danh mục #${selected} — cần kiểm tra lại`); option.value = selected; select.append(option);
            }
            select.value = selected;
        }
    }
    async function loadCategories() {
        categoryController?.abort(); categoryController = new AbortController(); const attempt = ++categoryVersion;
        categoriesReady = false; field('MaLoaiThuoc').disabled = true;
        $('products-categories-status').textContent = 'Đang tải danh mục thuốc…'; $('products-categories-retry').hidden = true;
        try {
            const found = new Map(); let index = 1, pages = 1;
            do {
                const data = await getCategories({ search: '', page: index, per_page: 100 }, { signal: categoryController.signal });
                if (!active || attempt !== categoryVersion) return;
                if (!Array.isArray(data.items) || !Number.isSafeInteger(data.pages) || data.pages < 0) throw new ApiError('INVALID_RESPONSE');
                for (const item of data.items) {
                    if (!Number.isSafeInteger(item.MaLoaiThuoc) || typeof item.TenLoaiThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
                    found.set(item.MaLoaiThuoc, item.TenLoaiThuoc);
                }
                pages = data.pages; index++;
            } while (index <= pages);
            categories = found; categoriesReady = true; fillCategories();
            field('MaLoaiThuoc').disabled = busy;
            $('products-categories-status').textContent = found.size ? '' : 'Chưa có danh mục. Vào mục Danh mục thuốc để tạo trước khi thêm thuốc.';
        } catch (error) {
            if (!active || attempt !== categoryVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) {
                $('products-categories-status').textContent = 'Chưa tải được danh mục. Mã danh mục vẫn được hiển thị khi có dữ liệu thuốc.';
                $('products-categories-retry').hidden = false;
            }
        }
    }
    async function loadList() {
        if (!active) return;
        listController?.abort(); listController = new AbortController(); const attempt = ++listVersion;
        state('loading', 'Đang tải hồ sơ thuốc…', 'Dữ liệu đang được lấy từ nhà thuốc.');
        $('products-result-count').textContent = ''; $('products-page-status').textContent = '';
        try {
            const data = await getProducts({ ...filters, page, per_page: perPage }, { signal: listController.signal });
            if (!active || attempt !== listVersion) return;
            if (!Array.isArray(data.items) || !['page', 'pages', 'total', 'per_page'].every(key => Number.isSafeInteger(data[key]) && data[key] >= 0)) throw new ApiError('INVALID_RESPONSE');
            if (page > Math.max(1, data.pages)) { page = Math.max(1, data.pages); return loadList(); }
            const body = $('products-body'); body.replaceChildren();
            for (const product of data.items) {
                if (!Number.isSafeInteger(product.MaThuoc) || typeof product.TenThuoc !== 'string' || typeof product.PhanLoai !== 'boolean') throw new ApiError('INVALID_RESPONSE');
                const row = node('tr'), identity = node('th'); identity.scope = 'row';
                const identityWrap = node('div', undefined, 'product-row-identity');
                const image = node('img'); image.alt = `Ảnh ${product.TenThuoc}`; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
                if (validHttps(product.HinhAnh)) image.src = product.HinhAnh;
                image.addEventListener('error', () => { image.hidden = true; });
                const text = node('div'); text.append(node('strong', product.TenThuoc), node('span', `#${product.MaThuoc}`, 'product-row-meta'));
                identityWrap.append(image, text); identity.append(identityWrap);
                const identifiers = node('td'); identifiers.append(node('span', product.MaDuoc), node('span', `SĐK: ${product.SoDangKy}`, 'product-row-meta'));
                const actions = node('td'), actionWrap = node('div', undefined, 'product-row-actions');
                for (const [action, label] of [['view', 'Xem'], ['edit', 'Sửa'], ['delete', 'Xóa']]) {
                    const button = node('button', label, `categories-action${action === 'delete' ? ' categories-action--delete' : ''}`);
                    button.type = 'button'; button.dataset.productAction = action; button.dataset.productId = product.MaThuoc;
                    button.setAttribute('aria-label', `${label} thuốc ${product.TenThuoc}`); actionWrap.append(button);
                }
                actions.append(actionWrap); row.append(identity, identifiers, node('td', categoryName(product.MaLoaiThuoc)), node('td', classifications(product.PhanLoai)), actions); body.append(row);
            }
            $('products-result-count').textContent = `${new Intl.NumberFormat('vi-VN').format(data.total)} thuốc${[filters.search, filters.category_id, filters.phan_loai].some(value => value !== undefined && value !== '') ? ' theo bộ lọc' : ' trong danh sách'}`;
            $('products-page-status').textContent = data.total ? `Trang ${data.page} / ${data.pages}` : 'Chưa có kết quả';
            $('products-prev').disabled = data.page <= 1; $('products-next').disabled = data.page >= data.pages;
            state(data.items.length ? 'ready' : 'empty', 'Chưa có thuốc phù hợp', 'Thử điều chỉnh bộ lọc hoặc thêm hồ sơ thuốc mới.');
        } catch (error) {
            if (!active || attempt !== listVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) state('error', 'Chưa tải được danh sách thuốc', productErrorMessage(error));
        }
    }
    function closeDelete() {
        deleteVersion++; deleteController?.abort(); deleteReady = false; deleting = false;
        if (dialog.open) dialog.close(); document.body.classList.remove('category-modal-open');
    }
    function showList() {
        if (busy) return;
        detailVersion++; detailController?.abort(); mode = 'list'; ready = false; currentProduct = undefined;
        resetSelection(); $('product-form').reset(); clearErrors();
        $('product-workspace').hidden = true; $('products-list').hidden = false; $('product-add').hidden = false;
        loadList(); $('products-list-title').focus();
    }
    function renderDetails(product) {
        const target = $('product-details'); target.replaceChildren();
        const intro = node('div', undefined, 'product-detail-intro'), image = node('img');
        image.alt = `Ảnh ${product.TenThuoc}`; image.referrerPolicy = 'no-referrer';
        if (validHttps(product.HinhAnh)) image.src = product.HinhAnh;
        image.addEventListener('error', () => { image.hidden = true; });
        const text = node('div'); text.append(node('p', `HỒ SƠ THUỐC #${product.MaThuoc}`, 'manager-eyebrow'), node('h3', product.TenThuoc), node('p', categoryName(product.MaLoaiThuoc), 'products-note'));
        intro.append(image, text); target.append(intro);
        const layout = node('div', undefined, 'product-details-layout');
        for (const group of PRODUCT_GROUPS) {
            const section = node('section', undefined, 'product-form-group'), list = node('dl'); section.append(node('h3', group.title));
            for (const [name, label] of group.fields) {
                const value = name === 'MaLoaiThuoc' ? categoryName(product[name]) : name === 'PhanLoai' ? classifications(product[name]) : String(product[name]);
                list.append(node('dt', label), node('dd', value));
            }
            section.append(list); layout.append(section);
        }
        target.append(layout);
    }
    async function openWorkspace(nextMode, id) {
        if (!active || busy) return;
        detailController?.abort(); const attempt = ++detailVersion;
        mode = nextMode; currentId = id; currentProduct = undefined; ready = nextMode === 'create';
        feedback(''); resetSelection(); $('product-form').reset(); clearErrors();
        $('product-upload-status').textContent = ''; $('product-image-error').textContent = '';
        $('products-list').hidden = true; $('product-workspace').hidden = false; $('product-add').hidden = true;
        $('product-workspace-title').textContent = mode === 'create' ? 'Thêm hồ sơ thuốc' : mode === 'edit' ? 'Chỉnh sửa hồ sơ thuốc' : 'Chi tiết thuốc';
        $('product-workspace-description').textContent = mode === 'view' ? 'Thông tin được lấy trực tiếp từ hồ sơ hiện tại.' : 'Hoàn thiện hồ sơ, kiểm tra ảnh trước khi lưu. Không bao gồm đơn vị giá hoặc lô thuốc.';
        $('product-detail-edit').hidden = true; $('product-details').hidden = true;
        $('product-detail-status').textContent = ready ? '' : 'Đang tải thông tin thuốc…'; $('product-detail-retry').hidden = true;
        $('product-form').hidden = !ready; field('NguongTonKho').value = '0'; field('PhanLoai').value = 'false'; field('MaLoaiThuoc').value = '';
        setBusy(false); showImage(''); $('product-workspace-title').focus();
        if (ready) { field('TenThuoc').focus(); return; }
        detailController = new AbortController();
        try {
            const data = await getProduct(id, { signal: detailController.signal });
            if (!active || attempt !== detailVersion) return;
            if (data.product?.MaThuoc !== id || typeof data.product.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
            currentProduct = data.product; ready = true; $('product-detail-status').textContent = '';
            if (mode === 'view') {
                renderDetails(currentProduct); $('product-details').hidden = false; $('product-detail-edit').hidden = false;
            } else {
                fillCategories();
                for (const [name] of PRODUCT_FIELDS) field(name).value = String(currentProduct[name]);
                field('HinhAnh').value = currentProduct.HinhAnh; showImage(currentProduct.HinhAnh);
                $('product-form').hidden = false; setBusy(false);
            }
        } catch (error) {
            if (!active || attempt !== detailVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) { $('product-detail-status').textContent = productErrorMessage(error); $('product-detail-retry').hidden = false; }
        }
    }
    async function openDelete(id, source) {
        if (!active || busy || deleting) return;
        const attempt = ++deleteVersion; deleteController?.abort(); deleteController = new AbortController();
        deleteId = id; opener = source; deleteReady = false;
        $('product-delete-name').textContent = ''; $('product-delete-error').textContent = ''; $('product-delete-status').textContent = 'Đang kiểm tra thông tin thuốc…';
        $('product-delete-confirm').disabled = true; $('product-delete-confirm').textContent = 'Xóa thuốc';
        $('product-delete-close').disabled = false; $('product-delete-cancel').disabled = false;
        dialog.showModal(); document.body.classList.add('category-modal-open');
        try {
            const data = await getProduct(id, { signal: deleteController.signal });
            if (!active || attempt !== deleteVersion || !dialog.open) return;
            if (data.product?.MaThuoc !== id || typeof data.product.TenThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
            $('product-delete-name').textContent = data.product.TenThuoc; $('product-delete-status').textContent = 'Xác nhận xóa hồ sơ thuốc sau đây:';
            deleteReady = true; $('product-delete-confirm').disabled = false; $('product-delete-cancel').focus();
        } catch (error) {
            if (!active || attempt !== deleteVersion || error.code === 'REQUEST_ABORTED') return;
            if (!access(error)) { $('product-delete-status').textContent = ''; $('product-delete-error').textContent = productErrorMessage(error); }
        }
    }

    $('product-form').addEventListener('submit', async event => {
        event.preventDefault(); if (!active || busy || !ready) return;
        clearErrors();
        const values = { HinhAnh: field('HinhAnh').value.trim() };
        for (const [name, , type] of PRODUCT_FIELDS) values[name] = type === 'boolean' ? field(name).value === 'true' : field(name).value;
        const { data, errors } = validateProduct(values);
        if (!categoriesReady) errors.MaLoaiThuoc = 'Chưa tải được danh mục. Nhấn Làm mới danh mục và chọn lại; các trường khác được giữ nguyên.';
        else if (!categories.has(data.MaLoaiThuoc)) errors.MaLoaiThuoc = 'Danh mục không còn tồn tại. Vui lòng chọn danh mục hợp lệ.';
        if (selectedFile) errors.HinhAnh = 'Ảnh mới chưa được upload. Nhấn Upload ảnh hoặc bỏ ảnh đã chọn trước khi lưu.';
        for (const [name, error] of Object.entries(errors)) showFieldError(name, error);
        if (Object.keys(errors).length) { field(Object.keys(errors)[0]).focus(); return; }
        const attempt = detailVersion, action = mode;
        setBusy(true);
        try {
            const result = action === 'create' ? await createProduct(data) : await updateProduct(currentId, data);
            if (!active || attempt !== detailVersion) return;
            if (result.code !== (action === 'create' ? 'PRODUCT_CREATED' : 'PRODUCT_UPDATED') || !Number.isSafeInteger(result.product?.MaThuoc)) throw new ApiError('INVALID_RESPONSE');
            setBusy(false); showList(); feedback(`Đã ${action === 'create' ? 'thêm' : 'cập nhật'} thuốc “${result.product.TenThuoc}” (#${result.product.MaThuoc}). Danh sách đã được tải lại theo bộ lọc hiện tại.`);
        } catch (error) {
            if (!active || attempt !== detailVersion) return;
            if (!access(error)) {
                $('product-form-error').textContent = productErrorMessage(error) + (field('HinhAnh').value ? ' URL ảnh được giữ lại; không cần upload lại nếu ảnh đã upload thành công.' : '');
                if (error.code === 'CATEGORY_NOT_FOUND') showFieldError('MaLoaiThuoc', productErrorMessage(error));
                $('product-form-error').tabIndex = -1; $('product-form-error').focus();
            }
        } finally { if (attempt === detailVersion) setBusy(false); }
    });
    $('product-image-file').addEventListener('change', () => {
        const file = $('product-image-file').files[0]; resetSelection();
        $('product-image-error').textContent = ''; $('product-upload-status').textContent = '';
        if (!file) return;
        const error = validateImageFile(file);
        if (error) { $('product-image-error').textContent = error; return; }
        selectedFile = file; objectUrl = URL.createObjectURL(file); showImage(objectUrl);
        $('product-upload').disabled = false; $('product-image-cancel').hidden = false;
        $('product-upload-status').textContent = `${file.name} — mới xem trước, chưa upload.`;
    });
    $('product-image-cancel').addEventListener('click', () => { resetSelection(); $('product-upload-status').textContent = 'Đã bỏ ảnh mới chọn. URL ảnh trước đó được giữ nguyên.'; $('product-image-error').textContent = ''; });
    field('HinhAnh').addEventListener('input', () => { if (!selectedFile) showImage(field('HinhAnh').value.trim()); field('HinhAnh').removeAttribute('aria-invalid'); $('product-HinhAnh-error').textContent = ''; });
    $('product-upload').addEventListener('click', async () => {
        if (!active || busy || !selectedFile) return;
        const attempt = detailVersion; setBusy(true); $('product-image-error').textContent = ''; $('product-upload-status').textContent = 'Đang upload ảnh qua máy chủ…';
        try {
            const result = await uploadProductImage(selectedFile);
            if (!active || attempt !== detailVersion) return;
            if (result.code !== 'UPLOAD_SUCCESS' || !validHttps(result.data?.url) || typeof result.data.public_id !== 'string') throw new ApiError('INVALID_RESPONSE');
            field('HinhAnh').value = result.data.url; resetSelection();
            $('product-HinhAnh-error').textContent = ''; field('HinhAnh').removeAttribute('aria-invalid');
            $('product-upload-status').textContent = 'Upload thành công. Ảnh đã sẵn sàng; nhấn lưu thuốc để ghi vào hồ sơ.';
        } catch (error) {
            if (!active || attempt !== detailVersion) return;
            if (!access(error)) { $('product-image-error').textContent = productErrorMessage(error); $('product-upload-status').textContent = 'Chưa xác nhận upload thành công. Thông tin thuốc và URL ảnh trước đó vẫn được giữ lại.'; }
        } finally { if (attempt === detailVersion) setBusy(false); }
    });
    $('product-delete-confirm').addEventListener('click', async () => {
        if (!active || deleting || !deleteReady) return;
        const attempt = deleteVersion; deleting = true;
        for (const id of ['product-delete-confirm', 'product-delete-cancel', 'product-delete-close']) $(id).disabled = true;
        $('product-delete-confirm').textContent = 'Đang xóa…';
        try {
            const result = await deleteProduct(deleteId);
            if (!active || attempt !== deleteVersion) return;
            if (result.code !== 'PRODUCT_DELETED') throw new ApiError('INVALID_RESPONSE');
            const name = $('product-delete-name').textContent; closeDelete(); feedback(`Đã xóa thuốc “${name}”.`); loadList();
        } catch (error) {
            if (!active || attempt !== deleteVersion) return;
            if (!access(error)) {
                $('product-delete-error').textContent = productErrorMessage(error);
                if (['PRODUCT_IN_USE', 'PRODUCT_NOT_FOUND'].includes(error.code)) deleteReady = false;
            }
        } finally {
            if (attempt === deleteVersion) {
                deleting = false; $('product-delete-confirm').disabled = !deleteReady;
                $('product-delete-confirm').textContent = 'Xóa thuốc'; $('product-delete-cancel').disabled = false; $('product-delete-close').disabled = false;
            }
        }
    });
    for (const id of ['product-delete-cancel', 'product-delete-close']) $(id).addEventListener('click', () => { if (!deleting) closeDelete(); });
    dialog.addEventListener('cancel', event => { if (deleting) event.preventDefault(); });
    dialog.addEventListener('close', () => {
        if (dialog.open) return;
        deleteVersion++; deleteController?.abort(); deleting = false; deleteReady = false; document.body.classList.remove('category-modal-open');
        if (active && opener?.isConnected && opener.getClientRects().length) opener.focus();
        else if (active) $('products-list-title').focus();
    });
    $('products-body').addEventListener('click', event => {
        const button = event.target.closest('[data-product-action]'); if (!button) return;
        const id = Number(button.dataset.productId), action = button.dataset.productAction;
        if (action === 'delete') openDelete(id, button); else openWorkspace(action, id);
    });
    $('product-add').addEventListener('click', () => openWorkspace('create'));
    $('product-detail-edit').addEventListener('click', () => openWorkspace('edit', currentId));
    $('product-detail-retry').addEventListener('click', () => openWorkspace(mode, currentId));
    for (const id of ['product-back', 'product-cancel']) $(id).addEventListener('click', showList);
    $('products-filters').addEventListener('submit', event => {
        event.preventDefault(); const search = $('products-search').value.trim();
        if ([...search].length > 255 || search.includes('\0')) { $('products-filter-error').textContent = 'Từ khóa tối đa 255 ký tự, không chứa NUL.'; $('products-search').focus(); return; }
        $('products-filter-error').textContent = '';
        const [sort_by, sort_order] = $('products-sort').value.split(':');
        filters = { search, category_id: $('products-category').value, phan_loai: $('products-classification').value, sort_by, sort_order }; page = 1; loadList();
    });
    $('products-reset').addEventListener('click', () => { $('products-filters').reset(); filters = { sort_by: 'MaThuoc', sort_order: 'desc' }; page = 1; $('products-filter-error').textContent = ''; loadList(); });
    $('products-per-page').addEventListener('change', () => { perPage = Number($('products-per-page').value); page = 1; loadList(); });
    $('products-prev').addEventListener('click', () => { if (page > 1) { page--; loadList(); } });
    $('products-next').addEventListener('click', () => { page++; loadList(); });
    for (const id of ['products-retry', 'products-reload']) $(id).addEventListener('click', loadList);
    $('products-categories-retry').addEventListener('click', async () => { await loadCategories(); if (active) loadList(); });

    function deactivate() {
        active = false; listVersion++; detailVersion++; categoryVersion++;
        listController?.abort(); detailController?.abort(); categoryController?.abort(); closeDelete();
        resetSelection(); busy = false; ready = false;
    }
    return {
        async activate() {
            if (active) return; active = true; mode = 'list'; $('products-list').hidden = false; $('product-workspace').hidden = true;
            setBusy(false);
            await loadCategories(); if (active) loadList();
        },
        deactivate,
        clear() {
            deactivate(); currentProduct = undefined; categories = new Map(); categoriesReady = false; page = 1; perPage = 20;
            filters = { sort_by: 'MaThuoc', sort_order: 'desc' }; $('products-filters').reset(); $('products-per-page').value = '20';
            $('product-form').reset(); clearErrors(); setBusy(false); $('products-body').replaceChildren(); $('product-details').replaceChildren();
            showImage(''); fillCategories(); currentId = undefined;
            $('product-delete-name').textContent = ''; $('product-upload-status').textContent = ''; $('product-image-error').textContent = '';
            $('product-detail-status').textContent = ''; $('product-delete-error').textContent = ''; $('products-filter-error').textContent = '';
            $('products-categories-status').textContent = ''; $('products-categories-retry').hidden = true;
            $('products-result-count').textContent = ''; $('products-page-status').textContent = ''; feedback('');
        }
    };
}
