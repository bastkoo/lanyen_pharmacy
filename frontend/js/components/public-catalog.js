import { getPublicCategories, getPublicProducts } from '../api/public-catalog.js';
import { categoryIcon } from '../utils/category-icons.js';
import { validHttps } from '../utils/product-validation.js';
import { readCatalogFilters, publicProductsUrl } from '../utils/public-catalog-filters.js';
import { purchaseControls } from './cart.js';
import { notify } from './customer-notice.js';
import { promotionBadge } from '../utils/public-sale-format.js';
import { openProductDetail } from './public-product-detail.js';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const icon = name => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    svg.classList.add('icon'); svg.setAttribute('aria-hidden', 'true');
    use.setAttribute('href', `../../assets/icons/catalog-icons.svg#${name}`); svg.append(use); return svg;
};
const readError = error => error.code === 'CONNECTION_FAILED' ? 'Chưa kết nối được nhà thuốc. Kiểm tra kết nối và thử lại.' :
    error.code === 'CATEGORY_NOT_FOUND' ? 'Danh mục này không còn tồn tại. Vui lòng chọn danh mục khác hoặc bỏ bộ lọc.' :
    'Chưa tải được dữ liệu. Bạn vui lòng thử lại sau.';

async function readCategories(signal) {
    const found = new Map(); let index = 1, lastPage = 1;
    do {
        const data = await getPublicCategories({ page: index, per_page: 100 }, { signal });
        if (data.code !== 'CATEGORIES_LISTED' || !Array.isArray(data.items) || !Number.isSafeInteger(data.pages) || data.pages < 0 || data.page !== index) throw new Error('INVALID_RESPONSE');
        for (const item of data.items) {
            if (!positiveId(item.MaLoaiThuoc) || typeof item.TenLoaiThuoc !== 'string') throw new Error('INVALID_RESPONSE');
            found.set(item.MaLoaiThuoc, item.TenLoaiThuoc);
        }
        lastPage = data.pages; index++;
    } while (index <= lastPage);
    return found;
}

export function setupPublicCatalog() {
    const $ = id => document.getElementById(id);
    let controller, version = 0;
    async function loadCategories(manual = false) {
        controller?.abort(); controller = new AbortController(); const attempt = ++version;
        $('categories').setAttribute('aria-busy', 'true'); $('public-categories-state').hidden = false; $('public-categories-grid').hidden = true;
        $('public-categories-state-title').textContent = 'Đang tải danh mục…'; $('public-categories-state-description').textContent = 'Các nhóm sản phẩm của Lan Yến sẽ hiển thị tại đây.'; $('public-categories-retry').hidden = true;
        try {
            const categories = await readCategories(controller.signal);
            if (attempt !== version) return;
            $('public-categories-grid').replaceChildren();
            for (const [id, name] of categories) {
                const item = node('li'), link = node('a', undefined, 'catalog-category');
                link.href = publicProductsUrl({ category_id: id }); link.dataset.categoryId = id;
                link.append(icon(categoryIcon(name)), node('span', name)); item.append(link); $('public-categories-grid').append(item);
            }
            $('public-categories-state').hidden = categories.size > 0; $('public-categories-grid').hidden = !categories.size;
            if (!categories.size) { $('public-categories-state-title').textContent = 'Chưa có danh mục sản phẩm'; $('public-categories-state-description').textContent = 'Bạn vui lòng quay lại sau để khám phá các nhóm sản phẩm của Lan Yến.'; }
            if (manual) notify('Đã cập nhật danh mục sản phẩm.');
        } catch (error) {
            if (attempt !== version || error.code === 'REQUEST_ABORTED') return;
            $('public-categories-state-title').textContent = 'Chưa tải được danh mục'; $('public-categories-state-description').textContent = readError(error); $('public-categories-retry').hidden = false;
            notify(readError(error), 'error');
        } finally { if (attempt === version) $('categories').setAttribute('aria-busy', 'false'); }
    }
    $('public-categories-retry').addEventListener('click', () => loadCategories(true));
    window.addEventListener('pagehide', () => { version++; controller?.abort(); });
    window.addEventListener('pageshow', event => { if (event.persisted) loadCategories(); });
    loadCategories();
}

export function productCard(product) {
    const item = node('li'), article = node('article', undefined, 'catalog-product');
    const visual = node('button', undefined, 'catalog-product-visual'), fallback = node('span', undefined, 'catalog-product-placeholder');
    visual.type = 'button'; visual.setAttribute('aria-label', `Xem chi tiết ${product.TenThuoc}`); visual.setAttribute('aria-haspopup', 'dialog');
    fallback.append(icon('medicine'), node('span', 'Chưa có ảnh')); visual.append(fallback);
    if (validHttps(product.HinhAnh)) {
        const image = node('img'); image.src = product.HinhAnh; image.alt = product.TenThuoc; image.width = 240; image.height = 200; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
        fallback.hidden = true; image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; }); visual.append(image);
    }
    const content = node('div', undefined, 'catalog-product-content');
    if (product.KhuyenMai) visual.append(node('span', promotionBadge(product.KhuyenMai), 'sale-label'));
    const packaging = product.QuyCachDongGoi?.trim();
    const heading = node('h3'), trigger = node('button', packaging ? `${product.TenThuoc} (${packaging})` : product.TenThuoc, 'product-detail-trigger');
    trigger.type = 'button'; trigger.setAttribute('aria-haspopup', 'dialog'); heading.append(trigger); content.append(heading);
    for (const button of [visual, trigger]) button.addEventListener('click', () => openProductDetail(product.MaThuoc, product.KhuyenMai?.MaChuongTrinh, button));
    content.append(purchaseControls(product));
    article.append(visual, content); item.append(article); return item;
}

export function setupPublicProducts() {
    const $ = id => document.getElementById(id);
    let categories = new Map(), categoryController, productController, categoryVersion = 0, productVersion = 0;
    let filters, validQuery = true, pages = 0;
    const defaults = () => ({ search: '', category_id: '', ke_don: '', sort_order: 'asc', page: 1 });
    function readLocation() {
        try { filters = readCatalogFilters(location.search); validQuery = true; }
        catch { filters = defaults(); validQuery = false; }
    }
    function updateTitle() {
        const title = filters.category_id ? categories.get(Number(filters.category_id)) || 'Thuốc theo danh mục' : filters.search ? 'Kết quả tìm kiếm' : 'Tất cả sản phẩm';
        $('catalog-products-title').textContent = title;
        $('catalog-active-search').textContent = filters.search ? `Từ khóa: “${filters.search}”` : '';
        document.title = `${title} · Lan Yến Pharmacy`;
    }
    function fillCategories() {
        const select = $('catalog-filter-category'); select.replaceChildren(new Option('Tất cả danh mục', ''));
        for (const [id, name] of categories) select.append(new Option(name, String(id)));
        if (filters.category_id && !categories.has(Number(filters.category_id))) select.append(new Option('Danh mục đang chọn — cần kiểm tra', filters.category_id));
        select.value = filters.category_id;
    }
    function syncControls() {
        $('public-search').value = filters.search;
        $('catalog-filter-prescription').value = filters.ke_don; $('catalog-filter-sort').value = filters.sort_order;
        fillCategories(); updateTitle();
    }
    function writeLocation(replace = false) {
        const url = new URL(publicProductsUrl(filters), location.href);
        if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](null, '', url);
    }
    async function loadCategories(manual = false) {
        categoryController?.abort(); categoryController = new AbortController(); const attempt = ++categoryVersion;
        $('catalog-filter-category').disabled = true; $('catalog-filter-category-status').textContent = 'Đang tải danh mục…'; $('catalog-filter-category-retry').hidden = true;
        try {
            const found = await readCategories(categoryController.signal);
            if (attempt !== categoryVersion) return;
            categories = found; fillCategories(); updateTitle(); $('catalog-filter-category').disabled = false;
            $('catalog-filter-category-status').textContent = categories.size ? '' : 'Chưa có danh mục. Bạn vẫn có thể tìm kiếm sản phẩm.';
            if (manual) notify('Đã cập nhật bộ lọc danh mục.');
        } catch (error) {
            if (attempt !== categoryVersion || error.code === 'REQUEST_ABORTED') return;
            $('catalog-filter-category-status').textContent = 'Chưa tải được danh mục. Các bộ lọc khác vẫn sử dụng được.'; $('catalog-filter-category-retry').hidden = false;
            notify('Chưa tải được danh mục. Các bộ lọc khác vẫn sử dụng được.', 'error');
        }
    }
    function resultsState(title, description, error = false) {
        $('catalog-products-state').hidden = false; $('catalog-products-grid').hidden = true;
        $('catalog-products-state-title').textContent = title; $('catalog-products-state-description').textContent = description;
        $('catalog-products-retry').hidden = !error; $('catalog-products-pagination').hidden = true;
    }
    async function loadProducts(manual = false) {
        productController?.abort(); productController = new AbortController(); const attempt = ++productVersion;
        $('catalog-products-grid').replaceChildren(); $('catalog-products-summary').textContent = '';
        $('catalog-products-prev').disabled = $('catalog-products-next').disabled = true;
        if (!validQuery) { resultsState('Đường dẫn tìm kiếm chưa hợp lệ', 'Bỏ bộ lọc để xem sản phẩm hoặc nhập lại từ khóa tìm kiếm.'); $('catalog-products').setAttribute('aria-busy', 'false'); return; }
        $('catalog-products').setAttribute('aria-busy', 'true'); updateTitle();
        resultsState('Đang tải sản phẩm…', 'Danh sách đang được cập nhật từ nhà thuốc.');
        const selected = { ...filters };
        try {
            const data = await getPublicProducts({ ...selected, category_id: selected.category_id || undefined, ke_don: selected.ke_don || undefined, per_page: 12 }, { signal: productController.signal });
            if (attempt !== productVersion) return;
            if (data.code !== 'PRODUCTS_LISTED' || !Array.isArray(data.items) || !['page', 'pages', 'per_page', 'total'].every(key => Number.isSafeInteger(data[key]) && data[key] >= 0) || data.page !== selected.page || data.per_page < 1) throw new Error('INVALID_RESPONSE');
            if (selected.page > Math.max(1, data.pages)) { filters.page = Math.max(1, data.pages); writeLocation(true); return loadProducts(manual); }
            if (!data.items.every(item => positiveId(item.MaThuoc) && positiveId(item.MaLoaiThuoc) && typeof item.TenThuoc === 'string' && (!selected.category_id || item.MaLoaiThuoc === Number(selected.category_id)) && (!selected.ke_don || item.KeDon === (selected.ke_don === 'true')))) throw new Error('INVALID_RESPONSE');
            pages = data.pages;
            if (manual || selected.search) notify(`Đã cập nhật kết quả: ${data.total} sản phẩm.`, data.total ? 'success' : 'info');
            $('catalog-products-summary').textContent = `${new Intl.NumberFormat('vi-VN').format(data.total)} sản phẩm`;
            if (!data.items.length) { resultsState('Chưa có sản phẩm phù hợp', 'Thử thay đổi danh mục, phân loại kê đơn hoặc từ khóa tìm kiếm.'); return; }
            $('catalog-products-grid').replaceChildren(...data.items.map(productCard));
            $('catalog-products-state').hidden = true; $('catalog-products-grid').hidden = false;
            $('catalog-products-pagination').hidden = false; $('catalog-products-page').textContent = `Trang ${data.page} / ${data.pages}`;
            $('catalog-products-prev').disabled = selected.page <= 1; $('catalog-products-next').disabled = selected.page >= pages;
        } catch (error) {
            if (attempt !== productVersion || error.code === 'REQUEST_ABORTED') return;
            resultsState('Chưa tải được danh sách sản phẩm', readError(error), true);
            notify(readError(error), 'error');
        } finally { if (attempt === productVersion) $('catalog-products').setAttribute('aria-busy', 'false'); }
    }
    function changeFilters() {
        filters = { ...filters, category_id: $('catalog-filter-category').disabled ? filters.category_id : $('catalog-filter-category').value,
            ke_don: $('catalog-filter-prescription').value, sort_order: $('catalog-filter-sort').value, page: 1 };
        validQuery = true; writeLocation(); updateTitle(); loadProducts(true);
    }
    for (const id of ['catalog-filter-category', 'catalog-filter-prescription', 'catalog-filter-sort']) $(id).addEventListener('change', changeFilters);
    $('catalog-filters').addEventListener('submit', event => { event.preventDefault(); changeFilters(); });
    $('catalog-products-reset').addEventListener('click', () => { filters = { ...defaults(), search: filters.search }; validQuery = true; syncControls(); writeLocation(); loadProducts(true); });
    function changePage(next) {
        if (next < 1 || next > pages) return;
        filters.page = next; writeLocation(); loadProducts(true);
        $('catalog-products-title').focus({ preventScroll: true }); $('catalog-products-title').scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    $('catalog-products-prev').addEventListener('click', () => changePage(filters.page - 1));
    $('catalog-products-next').addEventListener('click', () => changePage(filters.page + 1));
    $('catalog-products-retry').addEventListener('click', () => loadProducts(true));
    $('catalog-filter-category-retry').addEventListener('click', () => loadCategories(true));
    window.addEventListener('popstate', () => { readLocation(); syncControls(); loadProducts(); });
    window.addEventListener('pagehide', () => { categoryVersion++; productVersion++; categoryController?.abort(); productController?.abort(); });
    window.addEventListener('pageshow', event => { if (event.persisted) { readLocation(); syncControls(); loadCategories(); loadProducts(); } });
    readLocation(); syncControls(); loadCategories(); loadProducts();
}
