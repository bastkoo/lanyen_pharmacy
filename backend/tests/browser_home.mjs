// Isolated homepage QA. Auth is supplied by browser_manager's local fixture server.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

let catalogMode = 'normal';
const categoryNames = ['Thiết bị y tế', 'Chăm sóc da mặt', 'Mắt - Thị lực', 'Tiêu hóa', 'Vitamin', 'Kháng sinh & nấm', 'Tim mạch & huyết áp', 'Thần kinh', 'Cơ xương khớp', 'Hô hấp - Tai mũi họng', 'Sinh lý - nội tiết tố', 'Chăm sóc cá nhân', 'Thuốc giảm đau - Hạ sốt - Kháng viêm'];
const catalogCategories = categoryNames.map((name, index) => ({ MaLoaiThuoc: index + 1, TenLoaiThuoc: name }));
export const catalogProducts = Array.from({ length: 26 }, (_, index) => ({ MaThuoc: index + 1, MaLoaiThuoc: index < 14 ? 1 : index - 12, TenThuoc: index ? `Thuốc ${index + 1}` : '<b>Thuốc 1</b>', HinhAnh: index ? 'https://example.invalid/catalog.png' : 'javascript:alert(1)', MoTa: 'Mô tả sản phẩm trong dữ liệu kiểm thử.', QuyCachDongGoi: 'Hộp 10 viên', NhaSanXuat: 'Nhà sản xuất kiểm thử', NuocSanXuat: 'Việt Nam', KeDon: index % 2 === 0 }));
let saleQuotes = false;
export const setSaleQuotes = value => { saleQuotes = value; };
for (const product of catalogProducts) product.DonViGia = product.MaThuoc === 3 ? [] : product.MaThuoc === 2 ? [
    { MaDonGia: 21, DonViTinh: 'Vỉ', GiaBan: 10000 }, { MaDonGia: 22, DonViTinh: 'Viên', GiaBan: 1000 }, { MaDonGia: 23, DonViTinh: 'Hộp', GiaBan: 100000 }
] : [{ MaDonGia: product.MaThuoc * 10 + 1, DonViTinh: 'Hộp', GiaBan: 50000 }];
for (const product of catalogProducts) for (const unit of product.DonViGia) unit.ConHang = product.MaThuoc !== 4 && unit.MaDonGia !== 23;
let guestCart = [], accountCart = [];
export const setCartMode = value => { catalogMode = value; };
export const resetCartFixture = (guest, account = []) => { guestCart = guest.map(row => ({ ...row })); accountCart = account.map(row => ({ ...row })); };
export function mergeCartFixture() {
    for (const item of guestCart) {
        const match = accountCart.find(row => row.MaDonGia === item.MaDonGia);
        if (match) match.SoLuong += item.SoLuong; else accountCart.push({ ...item });
    }
    guestCart = [];
}
export async function cartFixture(req, json, authenticated) {
    const url = new URL(req.url, 'http://fixture.local');
    const items = authenticated ? accountCart : guestCart;
    const readRows = entries => entries.map(item => {
            const product = catalogProducts.find(product => product.MaThuoc === item.MaThuoc);
            const unit = product.DonViGia.find(unit => unit.MaDonGia === item.MaDonGia);
            return { ...item, ...unit, HinhAnh: product.HinhAnh, ConHang: unit.ConHang && item.SoLuong <= 20, DonViGia: product.DonViGia,
                TenThuoc: product.TenThuoc, QuyCachDongGoi: product.QuyCachDongGoi, ThanhTien: unit.GiaBan * item.SoLuong,
                ...(saleQuotes && product.MaThuoc === 1 ? { GiaBan: 40000, GiaGoc: unit.GiaBan, SoLuongKhuyenMai: item.SoLuong,
                    ThanhTien: 40000 * item.SoLuong, KhuyenMai: { MaChuongTrinh: 1, TenChuongTrinh: 'Ưu đãi tháng 11', LoaiGiamGia: saleQuotes !== 'direct', GiaTriGiam: saleQuotes === 'direct' ? '1000' : '20' } } : {}) };
        });
    const reply = entries => {
        const rows = readRows(entries);
        return json(200, { code: 'CART_LISTED', csrf_token: 'fixture-csrf', authenticated, items: rows, total_quantity: rows.reduce((s, r) => s + r.SoLuong, 0), total: rows.reduce((s, r) => s + r.ThanhTien, 0) });
    };
    if (req.method === 'GET') {
        if (catalogMode === 'cart-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        return reply(items);
    }
    assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
    if (req.method === 'DELETE') {
        const index = items.findIndex(item => item.MaDonGia === Number(url.pathname.split('/').at(-1)));
        if (index >= 0) items.splice(index, 1);
        return json(200, { code: 'CART_ITEM_REMOVED' });
    }
    let body = ''; for await (const chunk of req) body += chunk;
    const item = JSON.parse(body);
    if (url.pathname.endsWith('/quote')) {
        if (catalogMode === 'cart-quote-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        return reply(items.filter(row => item.MaDonGia.includes(row.MaDonGia)));
    }
    if (req.method === 'PUT') {
        if (catalogMode === 'cart-write-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        assert.deepEqual(Object.keys(item).sort(), ['MaDonGia', 'SoLuong']);
        const sourceId = Number(url.pathname.split('/').at(-1)), source = items.find(row => row.MaDonGia === sourceId);
        if (!source) return json(404, { code: 'CART_ITEM_NOT_FOUND' });
        const product = catalogProducts.find(product => product.MaThuoc === source.MaThuoc);
        const destination = product.DonViGia.find(unit => unit.MaDonGia === item.MaDonGia);
        if (!destination) return json(404, { code: 'UNIT_NOT_FOUND' });
        if (!destination.ConHang || item.SoLuong > 20) return json(409, { code: 'OUT_OF_STOCK' });
        const other = items.find(row => row !== source && row.MaThuoc === source.MaThuoc && row.MaDonGia === item.MaDonGia);
        source.MaDonGia = item.MaDonGia; source.SoLuong = item.SoLuong + (other?.SoLuong || 0);
        if (other) items.splice(items.indexOf(other), 1);
        return json(200, { code: 'CART_ITEM_UPDATED' });
    }
    assert.deepEqual(Object.keys(item).sort(), ['MaDonGia', 'MaThuoc']);
    const product = catalogProducts.find(product => product.MaThuoc === item.MaThuoc);
    assert.ok(product.DonViGia.some(unit => unit.MaDonGia === item.MaDonGia));
    if (catalogMode === 'stock-changed') return json(409, { code: 'OUT_OF_STOCK' });
    const match = items.find(row => row.MaDonGia === item.MaDonGia);
    if (match) match.SoLuong++; else items.push({ ...item, SoLuong: 1 });
    return json(200, { code: 'CART_ITEM_ADDED' });
}
export async function publicCatalogFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local');
    const page = Number(url.searchParams.get('page') || 1), per_page = Number(url.searchParams.get('per_page') || 12);
    if (url.pathname.endsWith('/categories') && catalogMode === 'categories-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (url.pathname.endsWith('/products') && catalogMode === 'products-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (catalogMode === 'slow' && url.searchParams.get('category_id') === '1') await new Promise(resolve => setTimeout(resolve, 400));
    let values, code;
    if (url.pathname.endsWith('/categories')) { values = catalogMode === 'categories-empty' ? [] : catalogCategories; code = 'CATEGORIES_LISTED'; }
    else {
        if (url.searchParams.has('category_id') && !catalogCategories.some(item => item.MaLoaiThuoc === Number(url.searchParams.get('category_id')))) return json(404, { code: 'CATEGORY_NOT_FOUND' });
        values = catalogMode === 'products-empty' ? [] : catalogProducts.filter(item => (!url.searchParams.has('category_id') || item.MaLoaiThuoc === Number(url.searchParams.get('category_id'))) && (!url.searchParams.has('ke_don') || item.KeDon === (url.searchParams.get('ke_don') === 'true')) && item.TenThuoc.toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()));
        values = [...values].sort((left, right) => left.TenThuoc.localeCompare(right.TenThuoc, 'vi') * (url.searchParams.get('sort_order') === 'desc' ? -1 : 1) || left.MaThuoc - right.MaThuoc); code = 'PRODUCTS_LISTED';
    }
    return json(200, { code, items: values.slice((page - 1) * per_page, page * per_page), page, per_page, total: values.length, pages: Math.ceil(values.length / per_page) });
}

export async function checkHomepage({ evaluate: run, waitFor, key, command, root, baseUrl, requests, setScenario }) {
    const click = id => run(`document.getElementById('${id}').click()`);
    const guest = () => waitFor(`document.querySelector('#header-status')?.textContent==='Bạn chưa đăng nhập'`);
    const productsReady = count => waitFor(`document.querySelector('#catalog-products')?.getAttribute('aria-busy')==='false' && !document.querySelector('#catalog-products-grid').hidden && document.querySelector('#catalog-products-grid').children.length===${count}`);
    const categoriesReady = () => waitFor(`document.querySelector('#public-categories-grid')?.children.length===13 && !document.querySelector('#public-categories-grid').hidden`);
    const filtersReady = () => waitFor(`!document.querySelector('#catalog-filter-category')?.disabled && document.querySelector('#catalog-filter-category').options.length===14`);
    async function landed(relative) {
        const expected = new URL(relative, baseUrl); let ready = false;
        for (let attempt = 0; attempt < 100 && !ready; attempt++) {
            try { ready = await run(`location.pathname===${JSON.stringify(expected.pathname)} && location.search===${JSON.stringify(expected.search)} && document.readyState==='complete' && Boolean(document.querySelector('#public-search-form'))`); }
            catch (error) { if (!/navigated|context|Cannot find/i.test(error.message)) throw error; }
            if (!ready) await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert.equal(ready, true, `Navigation to ${relative}`);
    }
    async function navigate(relative) {
        await command('Page.navigate', { url: new URL(relative, baseUrl).href });
        await new Promise(resolve => setTimeout(resolve, 50));
        await landed(relative === '/' ? '/pages/customer/home.html' : relative);
    }
    async function change(id, value) {
        await run(`document.getElementById('${id}').value=${JSON.stringify(value)};document.getElementById('${id}').dispatchEvent(new Event('change'))`);
    }
    async function search(value) {
        await run(`document.querySelector('#public-search').value=${JSON.stringify(value)};document.querySelector('#public-search-form').requestSubmit()`);
        await landed('/pages/customer/products.html?' + new URLSearchParams({ search: value }));
    }
    async function shot(name) {
        await run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const data = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        await writeFile(path.join(root, 'docs', `MODULE_03_1_${name}.png`), Buffer.from(data.data, 'base64'));
    }
    async function checkCardLayout() {
        assert.equal(await run(`(() => {
            const cards = [...document.querySelectorAll('.catalog-product')];
            const rows = new Map();
            for (const card of cards) {
                const top = Math.round(card.getBoundingClientRect().top);
                if (!rows.has(top)) rows.set(top, []);
                rows.get(top).push(card);
                if (card.querySelector('.catalog-prescription, .catalog-product-meta, .catalog-product-description')) return false;
                const options = [...card.querySelectorAll('.catalog-unit-option')];
                if (options.length) {
                    const rects = options.map(option => option.getBoundingClientRect());
                    if (Math.max(...rects.map(rect => rect.width)) - Math.min(...rects.map(rect => rect.width)) > 1) return false;
                    const field = card.querySelector('fieldset').getBoundingClientRect();
                    if (Math.abs(rects[0].left - field.left) > 1 || Math.abs(rects.at(-1).right - field.right) > 1) return false;
                }
            }
            return [...rows.values()].every(row => ['.catalog-price', '.catalog-buy'].every(selector => {
                const bottoms = row.map(card => card.querySelector(selector).getBoundingClientRect().bottom);
                return Math.max(...bottoms) - Math.min(...bottoms) < 1;
            }));
        })()`), true, 'Card prices/buttons align along each row and unit options share full width equally');
    }
    async function checkImageFrames() {
        assert.equal(await run(`(async () => {
            const images = [...document.querySelectorAll('.catalog-product-visual img')].slice(0, 4);
            const shapes = [[5000, 30], [30, 5000], [2400, 2400], [2, 2]];
            const originals = images.map(image => ({ src: image.src, width: image.width, height: image.height,
                frame: image.parentElement.getBoundingClientRect(), card: image.closest('article').getBoundingClientRect() }));
            for (let index = 0; index < images.length; index++) {
                const [width, height] = shapes[index];
                images[index].loading = 'eager'; images[index].width = width; images[index].height = height;
                images[index].src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '"><rect width="100%" height="100%" fill="#16865b"/></svg>');
            }
            await Promise.all(images.map(image => image.decode()));
            const stable = images.every((image, index) => {
                const frame = image.parentElement.getBoundingClientRect(), rect = image.getBoundingClientRect();
                return Math.abs(frame.height - originals[index].frame.height) < 1 &&
                    Math.abs(image.closest('article').getBoundingClientRect().height - originals[index].card.height) < 1 &&
                    rect.left >= frame.left && rect.right <= frame.right + 1 && rect.top >= frame.top && rect.bottom <= frame.bottom + 1 &&
                    getComputedStyle(image).objectFit === 'contain';
            });
            for (let index = 0; index < images.length; index++) {
                const image = images[index], original = originals[index];
                image.dispatchEvent(new Event('error'));
                if (Math.abs(image.parentElement.getBoundingClientRect().height - original.frame.height) >= 1) return false;
                image.src = original.src; image.width = original.width; image.height = original.height;
                image.hidden = false; image.parentElement.querySelector('.catalog-product-placeholder').hidden = true;
            }
            return stable;
        })()`), true, 'Wide/tall/large/tiny images and error placeholders stay inside equal frames without resizing cards');
    }
    async function stickySearch() {
        await run(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
        assert.equal(await run(`(()=>{const header=document.querySelector('.site-header').getBoundingClientRect(),search=document.querySelector('#public-search-form').getBoundingClientRect();return header.top===0 && search.top>=0 && search.bottom<=header.bottom})()`), true, 'Header search stays visible while scrolling');
    }
    setScenario('anonymous'); catalogMode = 'normal'; requests.length = 0;
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/'); await guest(); await categoriesReady(); await run('document.fonts.ready');
    assert.equal(await run(`document.querySelector('header nav')`), null);
    assert.equal(await run(`document.querySelector('#nav-toggle')`), null);
    assert.equal(await run(`document.querySelector('#catalog-products')`), null, 'Homepage has no embedded search results');
    assert.equal(await run(`document.querySelector('.site-header').contains(document.querySelector('#public-search-form'))`), true);
    for (const id of ['welcome-title', 'categories', 'about', 'health-journal', 'login-button']) assert.equal(await run(`Boolean(document.getElementById('${id}'))`), true, 'Homepage content is preserved');
    assert.equal(await run(`getComputedStyle(document.body).fontFamily.includes('Be Vietnam Pro')`), true);
    assert.equal(requests.some(url => url.startsWith('/api/products?')), false, 'Homepage only loads categories');
    for (let id = 1; id <= 13; id++) assert.equal(await run(`new URL(document.querySelector('#public-categories-grid [data-category-id="${id}"]').href).searchParams.get('category_id')`), String(id));
    await run(`document.querySelector('#public-search-form').requestSubmit()`);
    assert.equal(await run(`document.querySelector('#public-search').getAttribute('aria-invalid')`), 'true');
    assert.equal(await run('location.pathname'), '/pages/customer/home.html');
    await search('Thuốc 26'); await productsReady(1); await filtersReady();
    assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true, 'Searching and loading results do not show a notice');
    assert.equal(await run('location.pathname'), '/pages/customer/products.html');
    assert.equal(await run(`document.querySelector('#public-search').value`), 'Thuốc 26');
    assert.match(await run(`document.querySelector('#catalog-products-grid').textContent`), /Thuốc 26/);
    assert.equal(await run(`document.querySelector('#welcome-title')`), null, 'Results page contains only browsing content');
    await run('history.back()'); await landed('/pages/customer/home.html'); await categoriesReady();
    await run(`document.querySelector('#public-categories-grid [data-category-id="1"]').click()`);
    await landed('/pages/customer/products.html?category_id=1'); await productsReady(12); await filtersReady();
    assert.deepEqual(await run(`Array.from(document.querySelectorAll('input[name="product-unit-2"]')).map(input=>Number(input.value))`), [23, 21, 22], 'Unit buttons run from highest to lowest price');
    assert.equal(await run(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-buy').textContent`), 'Hết hàng', 'Large unit exceeds usable stock');
    assert.equal(await run(`Array.from(document.querySelectorAll('.catalog-product')).find(card=>card.querySelector('h3').textContent==='<b>Thuốc 1</b> (Hộp 10 viên)').querySelector('fieldset')`), null, 'One unit has no selector');
    assert.equal(await run(`Array.from(document.querySelectorAll('.catalog-product')).find(card=>card.querySelector('h3').textContent==='Thuốc 3 (Hộp 10 viên)').querySelector('.catalog-buy').disabled`), true, 'Unpriced product cannot be added');
    await checkCardLayout();
    await run(`document.querySelector('input[name="product-unit-2"][value="21"]').click()`);
    assert.equal(await run(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-buy').disabled`), false, 'Small unit remains available');
    assert.match(await run(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-price').textContent`), /10\.000 ₫ \/ Vỉ/);
    for (let i = 0; i < 2; i++) {
        await run(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-buy').click()`);
        await waitFor(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-purchase-status').textContent==='Đã thêm 1 Vỉ vào giỏ hàng.' && !document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-buy').disabled`);
        assert.equal(await run(`document.querySelector('#customer-notice').dataset.type`), 'success');
        assert.equal(await run(`document.querySelector('#customer-notice').getAttribute('role')`), 'status');
        assert.equal(await run(`document.querySelector('#customer-notice').contains(document.activeElement)`), false, 'Notices never steal focus');
        if (i === 0) await run(`new Promise(resolve=>setTimeout(resolve,3000))`);
    }
    await run(`new Promise(resolve=>setTimeout(resolve,2300))`);
    assert.equal(await run(`document.querySelector('#customer-notice').hidden`), false, 'A new notice gets its own five seconds');
    assert.equal(await run(`(() => { const rect=document.querySelector('#customer-notice').getBoundingClientRect();return Math.abs(document.documentElement.clientWidth-rect.right-16)<1 && Math.abs(innerHeight-rect.bottom-16)<1; })()`), true, 'Notice is fixed at bottom right');
    await run(`new Promise(resolve=>setTimeout(resolve,2800))`);
    assert.equal(await run(`document.querySelector('#customer-notice').hidden`), true, 'Notice disappears after five seconds');
    await run(`document.querySelector('input[name="product-unit-2"][value="22"]').click();document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-buy').click()`);
    await waitFor(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-purchase-status').textContent==='Đã thêm 1 Viên vào giỏ hàng.'`);
    assert.equal(await run(`document.querySelector('[data-cart]').getAttribute('href')`), 'cart.html');
    const guestCartData = await run(`(async()=>{const api=await import('/js/api/cart.js');const data=await api.getCart();await api.removeCartItem(22);return data;})()`);
    assert.equal(guestCartData.items.length, 2); assert.equal(guestCartData.total, 21000);
    await waitFor(`document.querySelector('.cart-count')?.textContent==='1'`, 2000);
    catalogMode = 'stock-changed';
    await run(`document.querySelector('input[name="product-unit-2"][value="21"]').click();document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-buy').click()`);
    await waitFor(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-buy').textContent==='Hết hàng' && document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-purchase-status').textContent.includes('đã hết hàng')`);
    assert.equal(await run(`document.querySelector('#customer-notice').dataset.type`), 'error');
    assert.equal(await run(`document.querySelector('#customer-notice').getAttribute('role')`), 'alert');
    assert.match(await run(`document.querySelector('#customer-notice').textContent`), /đã hết hàng/);
    await run(`document.querySelector('input[name="product-unit-2"][value="22"]').click()`);
    assert.equal(await run(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.catalog-buy').disabled`), false, 'Stock rejection for one unit does not disable another available unit');
    catalogMode = 'normal';
    assert.equal(await run(`document.querySelector('#catalog-products-title').textContent`), categoryNames[0]);
    assert.equal(await run(`document.querySelector('#catalog-filter-category').value`), '1');
    assert.match(await run(`document.querySelector('#catalog-products-grid h3').textContent`), /\(Hộp 10 viên\)$/);
    await checkCardLayout();
    assert.equal(await run(`document.querySelector('#catalog-products-grid b')`), null);
    await click('catalog-products-next'); await productsReady(2);
    assert.equal(await run(`new URLSearchParams(location.search).get('page')`), '2');
    assert.equal(await run(`new URLSearchParams(location.search).get('category_id')`), '1');
    await command('Page.reload'); await new Promise(resolve => setTimeout(resolve, 50));
    await landed('/pages/customer/products.html?category_id=1&page=2'); await productsReady(2); await filtersReady();
    await run('history.back()'); await waitFor(`!new URLSearchParams(location.search).has('page')`); await productsReady(12);
    await change('catalog-filter-prescription', 'true'); await productsReady(7);
    assert.equal(await run(`new URLSearchParams(location.search).get('ke_don')`), 'true');
    assert.deepEqual(await run(`Array.from(document.querySelectorAll('#catalog-products-grid h3')).map(item=>item.textContent)`), catalogProducts.filter(item => item.MaLoaiThuoc === 1 && item.KeDon).sort((a,b)=>a.TenThuoc.localeCompare(b.TenThuoc,'vi')).map(item=>`${item.TenThuoc} (${item.QuyCachDongGoi})`));
    await change('catalog-filter-sort', 'desc'); await productsReady(7);
    assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true, 'Paging, prescription filters and sorting do not show a notice');
    const names = await run(`Array.from(document.querySelectorAll('#catalog-products-grid h3')).map(node=>node.textContent)`);
    assert.deepEqual(names, [...names].sort((left,right)=>right.localeCompare(left,'vi')));
    await run('history.back()'); await waitFor(`document.querySelector('#catalog-filter-sort').value==='asc'`); await productsReady(7);
    assert.equal(await run(`document.querySelector('#catalog-filter-prescription').value`), 'true');
    await run('history.forward()'); await waitFor(`document.querySelector('#catalog-filter-sort').value==='desc'`); await productsReady(7);
    await click('catalog-products-reset'); await productsReady(12);
    assert.equal(await run('location.search'), '');
    for (let id = 2; id <= 13; id++) {
        await change('catalog-filter-category', String(id)); await productsReady(1);
        assert.equal(await run(`document.querySelector('#catalog-products-title').textContent`), categoryNames[id-1]);
    }
    await search('Thuốc'); await productsReady(12); await filtersReady();
    await change('catalog-filter-prescription', 'false'); await productsReady(12);
    await click('catalog-products-next'); await productsReady(1);
    assert.equal(await run(`new URLSearchParams(location.search).get('ke_don')`), 'false');
    assert.equal(await run(`new URLSearchParams(location.search).get('search')`), 'Thuốc');
    assert.equal(await run(`document.querySelector('.catalog-prescription')`), null, 'Compact cards omit prescription badge; prescription remains a list filter');
    await change('catalog-filter-category', '1'); await productsReady(7);
    assert.equal(await run(`new URLSearchParams(location.search).has('page')`), false, 'Changing a filter resets page');
    await click('catalog-products-reset'); await productsReady(12);
    assert.equal(await run(`document.querySelector('#public-search').value`), 'Thuốc', 'Reset keeps the search keyword');
    catalogMode = 'slow'; await change('catalog-filter-category', '1'); await change('catalog-filter-category', '2'); await productsReady(1);
    await run('new Promise(r=>setTimeout(r,500))');
    assert.equal(await run(`document.querySelector('#catalog-products-title').textContent`), categoryNames[1], 'Stale responses do not overwrite current filters');
    catalogMode = 'products-error'; await change('catalog-filter-category', '3');
    await waitFor(`!document.querySelector('#catalog-products-retry').hidden`);
    assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true, 'Read errors stay inline without a notice');
    catalogMode = 'normal'; await click('catalog-products-retry'); await productsReady(1);
    catalogMode = 'products-empty'; await change('catalog-filter-category', '4');
    await waitFor(`document.querySelector('#catalog-products-state-title').textContent==='Chưa có sản phẩm phù hợp' && !document.querySelector('#catalog-products-state').hidden`);
    catalogMode = 'categories-error'; await navigate('/pages/customer/products.html?category_id=1'); await productsReady(12);
    await waitFor(`!document.querySelector('#catalog-filter-category-retry').hidden`);
    await change('catalog-filter-prescription', 'false'); await productsReady(7);
    assert.equal(await run(`new URLSearchParams(location.search).get('category_id')`), '1', 'A failed category load does not clear the active category');
    catalogMode = 'normal'; await click('catalog-filter-category-retry'); await filtersReady();
    await navigate('/pages/customer/products.html?page=0');
    await waitFor(`document.querySelector('#catalog-products-state-title').textContent==='Đường dẫn tìm kiếm chưa hợp lệ'`);
    await click('catalog-products-reset'); await productsReady(12);
    await navigate('/pages/customer/products.html?category_id=999');
    await waitFor(`document.querySelector('#catalog-products-state-description').textContent.includes('không còn tồn tại')`);
    await click('catalog-products-reset'); await productsReady(12);
    await search('<img src=x onerror=alert(1)>');
    await waitFor(`document.querySelector('#catalog-products-state-title').textContent==='Chưa có sản phẩm phù hợp'`);
    assert.equal(await run(`document.querySelector('#catalog-active-search img')`), null);
    catalogMode = 'categories-error'; await navigate('/pages/customer/home.html');
    await waitFor(`!document.querySelector('#public-categories-retry').hidden`);
    catalogMode = 'normal'; await click('public-categories-retry'); await categoriesReady();
    catalogMode = 'categories-empty'; await command('Page.reload');
    await waitFor(`document.querySelector('#public-categories-state-title').textContent==='Chưa có danh mục sản phẩm'`);
    catalogMode = 'normal'; await navigate('/pages/customer/home.html'); await guest(); await categoriesReady();
    for (const feature of ['shopping', 'privacy', 'terms']) {
        await run(`document.querySelector('[data-coming="${feature}"]').click()`);
        assert.equal(await run(`document.querySelector('#feature-dialog').open`), true);
        await key('Tab', 9); assert.equal(await run(`document.querySelector('#feature-dialog').contains(document.activeElement)`), true);
        await key('Escape', 27); await waitFor(`!document.querySelector('#feature-dialog').open`);
        assert.equal(await run(`document.activeElement.dataset.coming`), feature);
    }
    for (const width of [1440, 1280, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width<768 });
        await navigate('/pages/customer/home.html'); await categoriesReady();
        assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Home overflow at ${width}`);
        assert.equal(await run(`document.querySelector('.site-footer').textContent.includes('Sắp có')`), false);
        assert.equal(await run(`parseFloat(getComputedStyle(document.querySelector('.site-footer nav a')).fontSize)>=15 && parseFloat(getComputedStyle(document.querySelector('.site-footer h2')).fontSize)>=17`), true, 'Footer navigation and headings are comfortably readable');
        if (width === 1440 || width === 375) {
            await run(`document.querySelector('.site-footer').scrollIntoView({block:'start',behavior:'instant'})`);
            await shot(`FOOTER_${width===1440?'DESKTOP':'MOBILE'}`);
        }
        await stickySearch();
        if (width===1440 || width===375) { await run(`window.scrollTo({top:0,behavior:'instant'})`); await shot(`HOME_${width===1440?'DESKTOP':'MOBILE'}`); }
        await navigate('/pages/customer/products.html?category_id=1&ke_don=false'); await productsReady(7); await filtersReady();
        assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Products overflow at ${width}`);
        await checkCardLayout();
        await checkImageFrames();
        await run(`document.querySelector('#public-search').value='';document.querySelector('#public-search-form').requestSubmit()`);
        assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true, 'Search validation remains inline');
        await run(`import('/js/components/customer-notice.js').then(({notify})=>notify('Notification layout check'))`);
        assert.equal(await run(`(() => {const rect=document.querySelector('#customer-notice').getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth && rect.bottom<=innerHeight && rect.width>0;})()`), true, `Notice fits viewport at ${width}`);
        if (width === 375) await shot('CUSTOMER_NOTICE_MOBILE');
        assert.equal(await run(`document.querySelector('[data-cart]').getAttribute('href')`), 'cart.html');
        await stickySearch();
        if (width===1440 || width===375) {
            await run(`window.scrollTo({top:0,behavior:'instant'})`); await shot(`PRODUCTS_${width===1440?'DESKTOP':'MOBILE'}`);
            if (width===375) {
                await run(`document.querySelector('#catalog-products').scrollIntoView({block:'start',behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
                assert.equal(await run(`document.querySelector('.site-header').getBoundingClientRect().top`), 0, 'Search stays fixed when jumping to results');
                assert.equal(await run(`Boolean(document.elementFromPoint(20,20)?.closest('.site-header'))`), true, 'Fixed header remains on top and interactive after scrolling');
                await shot('PRODUCTS_GRID_MOBILE');
                await run(`document.querySelector('input[name="product-unit-2"]').closest('article').scrollIntoView({block:'center',behavior:'instant'})`);
                await shot('PRODUCT_UNIT_OPTIONS_MOBILE');
            }
        }
        await click('login-button');
        assert.equal(await run(`document.querySelector('#auth-dialog').open`), true);
        assert.equal(await run(`document.querySelector('#main').inert`), true);
        assert.equal(await run(`document.querySelector('#auth-dialog').scrollWidth<=document.querySelector('#auth-dialog').clientWidth`), true);
        await key('Escape', 27); await waitFor(`!document.querySelector('#auth-dialog').open`);
    }
    setScenario('manager'); await run(`window.dispatchEvent(new Event('focus'))`);
    await waitFor(`document.querySelector('#login-button').hidden && !document.querySelector('#logout-button').hidden`);
    assert.equal(await run('location.pathname'), '/pages/customer/products.html');
    await click('logout-button'); await guest();
    await click('login-button'); await run(`document.querySelector('#phone').value='0900000000';document.querySelector('#phone-form').requestSubmit()`);
    await waitFor(`!document.querySelector('#otp-form').hidden && !document.querySelector('#otp').disabled`);
    await run(`document.querySelector('#otp').value='123456';document.querySelector('#otp-form').requestSubmit()`);
    await waitFor(`!document.querySelector('#auth-dialog').open && !document.querySelector('#logout-button').hidden`);
    const savedCart = await run(`(async()=>{const api=await import('/js/api/cart.js');return api.getCart();})()`);
    assert.equal(savedCart.authenticated, true); assert.equal(savedCart.items[0].SoLuong, 2);
    setScenario('error'); await run(`window.dispatchEvent(new Event('focus'))`); await waitFor(`!document.querySelector('#retry-session').hidden`);
    assert.equal(await run(`document.querySelector('#catalog-products-grid').children.length`), 7);
    setScenario('anonymous'); await click('retry-session'); await guest();
    await navigate('/pages/customer/home.html'); await guest(); await categoriesReady();
    await click('login-button'); await key('Escape', 27); await waitFor(`!document.querySelector('#auth-dialog').open`);
    assert.equal(await run('document.activeElement.id'), 'login-button');
    assert.equal(requests.some(url=>url.startsWith('/api/manager/')), false);
    assert.equal(requests.filter(url=>url.startsWith('/api/')).every(url=>['/api/auth/','/api/categories?','/api/products?','/api/cart','/api/promotions'].some(prefix=>url.startsWith(prefix))), true);
    console.log('PASS: sticky header search without nav links; separate category/search page, combined category/prescription/sort, URL reload/back/forward, paging, reset, stale/error/empty/retry, shared OTP/session, safe DOM, 1440–320px. API/AUTH MOCK; no PostgreSQL writes.');
    console.log(`Public page QA screenshots: ${path.join(root,'docs')}`);
}
