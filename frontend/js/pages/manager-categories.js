import { getCategories, getCategory, createCategory, updateCategory, deleteCategory } from '../api/categories.js';
import { ApiError } from '../api/auth.js';
import { normalizeCategoryName, categoryErrorMessage } from '../utils/category-validation.js';

const accessErrors = new Set(['UNAUTHENTICATED', 'FORBIDDEN', 'ACCOUNT_LOCKED']);
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };

export function setupCategories({ root, onAccessError }) {
    const $ = id => document.getElementById(id);
    const dialog = $('category-dialog');
    let active = false, page = 1, perPage = 20, search = '', listVersion = 0, dialogVersion = 0;
    let listController, detailController, mode = 'create', currentId = null, currentName = '', busy = false, ready = false, opener;

    function feedback(message, error = false) {
        $('categories-feedback').textContent = message;
        $('categories-feedback').hidden = !message;
        $('categories-feedback').dataset.error = String(error);
    }

    function listState(type, title, description) {
        root.setAttribute('aria-busy', String(type === 'loading'));
        $('categories-state').hidden = type === 'ready';
        $('categories-table-wrap').hidden = type !== 'ready';
        $('categories-state-title').textContent = title;
        $('categories-state-description').textContent = description;
        $('categories-retry').hidden = type !== 'error';
        if (type !== 'ready') {
            $('categories-prev').disabled = true;
            $('categories-next').disabled = true;
        }
    }

    function setBusy(value) {
        busy = value;
        dialog.setAttribute('aria-busy', String(value));
        $('category-save').disabled = value || !ready;
        $('category-save').textContent = value ? (mode === 'delete' ? 'Đang xóa…' : 'Đang lưu…') :
            mode === 'delete' ? 'Xóa danh mục' : mode === 'edit' ? 'Lưu thay đổi' : 'Thêm danh mục';
        for (const id of ['category-name', 'category-cancel', 'category-close']) $(id).disabled = value;
    }

    function fieldError(message) {
        $('category-name-error').textContent = message;
        $('category-name').setAttribute('aria-invalid', 'true');
        $('category-name').focus();
    }

    function closeDialog() {
        detailController?.abort(); dialogVersion++;
        busy = false; ready = false;
        if (dialog.open) dialog.close();
        document.body.classList.remove('category-modal-open');
    }

    function handleError(error) {
        if (accessErrors.has(error.code)) { onAccessError(error); return true; }
        return false;
    }

    async function loadList() {
        if (!active) return;
        listController?.abort(); listController = new AbortController();
        const attempt = ++listVersion;
        $('categories-result-count').textContent = '';
        $('categories-page-status').textContent = '';
        listState('loading', 'Đang tải danh mục…', 'Danh sách đang được cập nhật từ nhà thuốc.');
        try {
            const data = await getCategories({ search, page, per_page: perPage }, { signal: listController.signal });
            if (!active || attempt !== listVersion) return;
            if (!Array.isArray(data.items) || !['total', 'pages', 'page', 'per_page'].every(key => Number.isSafeInteger(data[key]) && data[key] >= 0)) throw new ApiError('INVALID_RESPONSE');
            if (page > Math.max(1, data.pages)) { page = Math.max(1, data.pages); return loadList(); }
            const body = $('categories-body'); body.replaceChildren();
            for (const item of data.items) {
                if (!Number.isInteger(item.MaLoaiThuoc) || typeof item.TenLoaiThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
                const row = element('tr');
                const id = element('th', `#${item.MaLoaiThuoc}`); id.scope = 'row';
                const name = element('td', item.TenLoaiThuoc, 'categories-table__name');
                const actions = element('td'); const group = element('div', undefined, 'categories-actions');
                for (const action of ['edit', 'delete']) {
                    const button = element('button', action === 'edit' ? 'Sửa' : 'Xóa', `categories-action${action === 'delete' ? ' categories-action--delete' : ''}`);
                    button.type = 'button'; button.dataset.categoryAction = action; button.dataset.categoryId = String(item.MaLoaiThuoc);
                    button.setAttribute('aria-label', `${action === 'edit' ? 'Sửa' : 'Xóa'} danh mục ${item.TenLoaiThuoc}`);
                    group.append(button);
                }
                actions.append(group); row.append(id, name, actions); body.append(row);
            }
            $('categories-result-count').textContent = `${new Intl.NumberFormat('vi-VN').format(data.total)} danh mục${search ? ' phù hợp' : ' trong danh sách'}`;
            $('categories-page-status').textContent = data.total ? `Trang ${data.page} / ${data.pages} · ${data.items.length} mục đang hiển thị` : 'Chưa có kết quả';
            $('categories-prev').disabled = data.page <= 1;
            $('categories-next').disabled = data.page >= data.pages;
            listState(data.items.length ? 'ready' : 'empty', search ? 'Không tìm thấy danh mục' : 'Chưa có danh mục thuốc',
                search ? 'Thử từ khóa khác hoặc bỏ tìm kiếm để xem toàn bộ danh mục.' : 'Thêm danh mục đầu tiên để tổ chức các nhóm thuốc của nhà thuốc.');
        } catch (error) {
            if (!active || attempt !== listVersion || error.code === 'REQUEST_ABORTED') return;
            if (!handleError(error)) listState('error', 'Chưa tải được danh sách', categoryErrorMessage(error));
        }
    }

    async function openDialog(nextMode, id, source) {
        if (!active || busy) return;
        detailController?.abort(); const attempt = ++dialogVersion;
        mode = nextMode; currentId = id; currentName = ''; opener = source; ready = nextMode === 'create';
        feedback(''); $('category-form').reset();
        $('category-form-error').textContent = ''; $('category-name-error').textContent = '';
        $('category-name').removeAttribute('aria-invalid');
        $('category-dialog-title').textContent = mode === 'create' ? 'Thêm danh mục thuốc' : mode === 'edit' ? 'Sửa danh mục thuốc' : 'Xóa danh mục thuốc?';
        $('category-name-field').hidden = mode === 'delete' || !ready;
        $('category-delete-summary').hidden = true;
        $('category-detail-status').hidden = ready;
        $('category-detail-status').textContent = 'Đang lấy thông tin danh mục…';
        $('category-save').classList.toggle('button-danger', mode === 'delete');
        $('category-save').classList.toggle('button-primary', mode !== 'delete');
        setBusy(false);
        document.body.classList.add('category-modal-open'); dialog.showModal();
        if (ready) { $('category-name').focus(); return; }
        detailController = new AbortController();
        try {
            const data = await getCategory(id, { signal: detailController.signal });
            if (!active || attempt !== dialogVersion || !dialog.open) return;
            if (data.category?.MaLoaiThuoc !== id || typeof data.category?.TenLoaiThuoc !== 'string') throw new ApiError('INVALID_RESPONSE');
            currentName = data.category.TenLoaiThuoc; ready = true;
            $('category-detail-status').hidden = true;
            $('category-name-field').hidden = mode === 'delete';
            $('category-delete-summary').hidden = mode !== 'delete';
            $('category-name').value = currentName;
            $('category-delete-name').textContent = currentName;
            setBusy(false);
            $(mode === 'delete' ? 'category-cancel' : 'category-name').focus();
        } catch (error) {
            if (!active || attempt !== dialogVersion || error.code === 'REQUEST_ABORTED') return;
            if (!handleError(error)) {
                $('category-detail-status').hidden = true;
                $('category-form-error').textContent = categoryErrorMessage(error);
                if (error.code === 'CATEGORY_NOT_FOUND') loadList();
            }
        }
    }

    $('category-form').addEventListener('submit', async event => {
        event.preventDefault();
        if (!active || busy || !ready) return;
        const name = mode === 'delete' ? currentName : normalizeCategoryName($('category-name').value);
        $('category-form-error').textContent = '';
        if (name === null) { fieldError('Nhập tên danh mục từ 1 đến 255 ký tự, không chứa ký tự NUL.'); return; }
        const attempt = dialogVersion, action = mode;
        setBusy(true);
        try {
            const result = action === 'create' ? await createCategory(name) : action === 'edit' ? await updateCategory(currentId, name) : await deleteCategory(currentId);
            if (!active || attempt !== dialogVersion) return;
            const expected = { create: 'CATEGORY_CREATED', edit: 'CATEGORY_UPDATED', delete: 'CATEGORY_DELETED' }[action];
            if (result.code !== expected) throw new ApiError('INVALID_RESPONSE');
            if (action !== 'delete' && (typeof result.category?.TenLoaiThuoc !== 'string' || !Number.isInteger(result.category?.MaLoaiThuoc))) throw new ApiError('INVALID_RESPONSE');
            setBusy(false);
            const savedName = result.category?.TenLoaiThuoc || name;
            if (action === 'create') { search = savedName; page = 1; $('categories-search-input').value = search; }
            closeDialog();
            feedback(`${action === 'create' ? 'Đã thêm' : action === 'edit' ? 'Đã cập nhật' : 'Đã xóa'} danh mục “${savedName}”.${action === 'create' ? ' Danh sách đang tìm theo tên vừa tạo.' : ''}`);
            loadList();
        } catch (error) {
            if (!active || attempt !== dialogVersion) return;
            if (!handleError(error)) {
                if (error.code === 'CATEGORY_NAME_EXISTS' || error.code === 'INVALID_REQUEST') fieldError(categoryErrorMessage(error));
                else $('category-form-error').textContent = categoryErrorMessage(error);
                if (error.code === 'CATEGORY_IN_USE' || error.code === 'CATEGORY_NOT_FOUND') ready = false;
            }
        } finally { if (attempt === dialogVersion) setBusy(false); }
    });

    $('category-name').addEventListener('input', () => { $('category-name-error').textContent = ''; $('category-name').removeAttribute('aria-invalid'); });
    $('category-add').addEventListener('click', event => openDialog('create', null, event.currentTarget));
    $('categories-body').addEventListener('click', event => {
        const button = event.target.closest('[data-category-action]');
        if (button) openDialog(button.dataset.categoryAction, Number(button.dataset.categoryId), button);
    });
    for (const id of ['category-close', 'category-cancel']) $(id).addEventListener('click', () => { if (!busy) closeDialog(); });
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => {
        if (dialog.open) return;
        detailController?.abort(); dialogVersion++; busy = false; ready = false;
        document.body.classList.remove('category-modal-open');
        if (active) {
            if (opener?.isConnected && opener.getClientRects().length) opener.focus();
            else $('categories-list-title').focus();
        }
    });
    $('categories-search-form').addEventListener('submit', event => {
        event.preventDefault();
        const value = $('categories-search-input').value.trim().replace(/\s+/gu, ' ');
        if ([...value].length > 255) { $('categories-search-error').textContent = 'Từ khóa tối đa 255 ký tự.'; $('categories-search-input').focus(); return; }
        $('categories-search-error').textContent = ''; search = value; page = 1; loadList();
    });
    $('categories-clear-search').addEventListener('click', () => { search = ''; page = 1; $('categories-search-input').value = ''; $('categories-search-error').textContent = ''; loadList(); });
    $('categories-per-page').addEventListener('change', () => { perPage = Number($('categories-per-page').value); page = 1; loadList(); });
    $('categories-prev').addEventListener('click', () => { if (page > 1) { page--; loadList(); } });
    $('categories-next').addEventListener('click', () => { page++; loadList(); });
    for (const id of ['categories-retry', 'categories-reload']) $(id).addEventListener('click', loadList);

    return {
        activate() { if (!active) { active = true; loadList(); } },
        deactivate() { active = false; listVersion++; listController?.abort(); closeDialog(); },
        clear() {
            active = false; listVersion++; listController?.abort(); opener = null; closeDialog();
            page = 1; search = ''; perPage = 20;
            $('categories-search-input').value = ''; $('categories-per-page').value = '20';
            $('category-form').reset(); $('category-delete-name').textContent = '';
            $('category-form-error').textContent = ''; $('category-name-error').textContent = '';
            $('categories-body').replaceChildren(); $('categories-result-count').textContent = '';
            $('categories-page-status').textContent = ''; feedback('');
        }
    };
}
