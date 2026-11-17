import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { catalogProducts, setSaleQuotes } from './browser_home.mjs';

let mode = 'normal';
const programs = [
    { MaChuongTrinh: 1, TenChuongTrinh: 'Ưu đãi tháng 11', NgayBatDau: '2026-11-17', NgayKetThuc: '2026-11-20', TrangThai: 'ACTIVE' },
    { MaChuongTrinh: 2, TenChuongTrinh: 'Chăm sóc mỗi ngày', NgayBatDau: '2026-11-21', NgayKetThuc: '2026-11-23', TrangThai: 'UPCOMING' }
];
export async function publicDetailFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local');
    const id = Number(url.pathname.split('/')[3]);
    if (mode === 'detail-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    if (mode === 'detail-slow' && id === 1) await new Promise(resolve => setTimeout(resolve, 300));
    const source = catalogProducts.find(product => product.MaThuoc === id);
    if (!source) return json(404, { code: 'PRODUCT_NOT_FOUND' });
    const product = { ...source, TenLoaiThuoc: 'Vitamin', MaDuoc: 'PUBLIC-7', MaVach: '0123456789012',
        SoDangKy: 'SĐK kiểm thử', DangBaoChe: 'Viên nén', PhanLoai: true,
        CachDung: 'Nội dung cách dùng từ CSDL.\n<img src=x onerror=alert(1)>', ChongChiDinh: 'Thông tin chống chỉ định từ CSDL.', BaoQuan: 'Thông tin bảo quản từ CSDL.',
        DonViGia: source.DonViGia.map(unit => ({ ...unit })) };
    const context = url.searchParams.get('promotion_id');
    const program = programs.find(program => program.MaChuongTrinh === Number(context));
    if (context && !program) return json(404, { code: 'PROMOTION_NOT_FOUND' });
    const offer = { MaChuongTrinh: program?.MaChuongTrinh || 1, TenChuongTrinh: program?.TenChuongTrinh || programs[0].TenChuongTrinh,
        LoaiGiamGia: true, GiaTriGiam: '20.00', SoLuong: 100, TrangThai: program?.TrangThai || 'ACTIVE' };
    if (context) product.KhuyenMai = offer;
    for (const unit of product.DonViGia) if (context || unit.MaDonGia === 21 || id === 1) {
        unit.GiaKhuyenMai = unit.GiaBan * .8; unit.SoLuongKhuyenMai = unit.MaDonGia === 23 && !context ? 0 : 10;
        if (!context) unit.KhuyenMai = offer;
    }
    return json(200, { code: 'PRODUCT_FOUND', product });
}
export async function publicSaleFixture(req, json) {
    const url = new URL(req.url, 'http://fixture.local');
    const page = Number(url.searchParams.get('page') || 1), per_page = Number(url.searchParams.get('per_page') || 10);
    if (url.pathname === '/api/promotions') {
        if (mode === 'list-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        const values = mode === 'empty' ? [] : programs;
        return json(200, { code: 'PROMOTIONS_LISTED', items: values, page, per_page, total: values.length, pages: values.length ? 1 : 0, as_of: '2026-11-17' });
    }
    if (mode === 'products-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    const program = programs.find(program => program.MaChuongTrinh === Number(url.pathname.split('/')[3]));
    if (!program) return json(404, { code: 'PROMOTION_NOT_FOUND' });
    if (mode === 'slow' && program.MaChuongTrinh === 1) await new Promise(resolve => setTimeout(resolve, 300));
    const products = mode === 'products-empty' ? [] : catalogProducts.slice(0, 12).map(product => ({ ...product,
        KhuyenMai: { MaChuongTrinh: program.MaChuongTrinh, LoaiGiamGia: product.MaThuoc !== 2, GiaTriGiam: product.MaThuoc === 2 ? '200.00' : '20.00', SoLuong: 100, TrangThai: program.TrangThai },
        DonViGia: product.DonViGia.map(unit => ({ ...unit, GiaKhuyenMai: unit.GiaBan * .8, SoLuongKhuyenMai: program.TrangThai === 'UPCOMING' ? (unit.MaDonGia === 23 ? 1 : 10) : product.MaThuoc === 5 || unit.MaDonGia === 23 ? 0 : 10 })) }));
    return json(200, { code: 'PROMOTION_PRODUCTS_LISTED', promotion: program, items: products.slice((page - 1) * per_page, page * per_page),
        page, per_page, total: products.length, pages: Math.ceil(products.length / per_page), as_of: '2026-11-17' });
}

export async function checkSale({ evaluate: run, waitFor, command, key, root, baseUrl }) {
    const navigate = async () => {
        await command('Page.navigate', { url: `${baseUrl}/pages/customer/home.html` });
        await new Promise(resolve => setTimeout(resolve, 50));
        await waitFor(`document.readyState==='complete' && document.querySelector('#sale-programs')?.children.length===2 && document.querySelector('#sale-products')?.getAttribute('aria-busy')==='false' && document.querySelector('#sale-products-grid')?.children.length===(innerWidth<=600?2:innerWidth<=900?3:innerWidth<=1100?4:5)`);
    };
    const select = id => run(`document.querySelector('#sale-programs [data-program-id="${id}"]').click()`);
    await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate();
    assert.match(await run(`document.querySelector('#sale-countdown').textContent`), /(?:Bắt đầu sau|Kết thúc sau|Đã kết thúc)/);
    assert.equal(await run(`document.querySelector('#sale-countdown').getAttribute('aria-live')`), 'off');
    assert.equal(await run(`document.querySelectorAll('#sale-programs [role="timer"]').length`), 0, 'Program buttons do not show duplicate countdowns');
    assert.deepEqual(await run(`Array.from(document.querySelectorAll('#sale-countdown .sale-countdown-caption')).map(node=>node.textContent)`), ['Ngày', 'Giờ', 'Phút', 'Giây']);
    assert.equal(await run(`document.querySelectorAll('#sale-countdown .sale-countdown-unit strong').length`), 4);
    assert.equal(await run(`getComputedStyle(document.querySelector('#sale-countdown strong')).backgroundColor`), 'rgb(16, 107, 72)', 'Countdown is green, discount labels are red');
    assert.equal(await run(`getComputedStyle(document.querySelector('#sale-programs [data-state="ACTIVE"] .sale-program-state')).backgroundColor`), 'rgb(16, 107, 72)');
    assert.equal(await run(`getComputedStyle(document.querySelector('#sale-programs [data-state="UPCOMING"] .sale-program-state')).backgroundColor`), 'rgb(255, 193, 7)');
    const before = await run(`document.querySelector('#sale-countdown').textContent`);
    await waitFor(`document.querySelector('#sale-countdown').textContent !== ${JSON.stringify(before)}`);
    assert.notEqual(await run(`document.querySelector('#sale-countdown').textContent`), before, 'Countdown ticks every second');
    assert.equal(await run(`document.querySelector('#sale-products-grid .sale-label').textContent`), '-20%');
    assert.equal(await run(`document.querySelector('#sale-products-grid input[value="21"]').closest('article').querySelector('.sale-label').textContent`), 'Ưu đãi');
    assert.equal(await run(`getComputedStyle(document.querySelector('#sale-products-grid .sale-label')).backgroundColor`), 'rgb(220, 53, 69)');
    assert.equal(await run(`document.querySelector('#public-sale').compareDocumentPosition(document.querySelector('#categories')) & Node.DOCUMENT_POSITION_FOLLOWING`), 4);
    assert.deepEqual(await run(`Array.from(document.querySelectorAll('#sale-programs strong')).map(node=>node.textContent)`), programs.map(program => program.TenChuongTrinh));
    assert.equal(await run(`document.querySelector('#sale-products-grid b')`), null);
    await run(`document.querySelector('#sale-products-grid .product-detail-trigger').click()`);
    await waitFor(`document.querySelector('#product-detail-dialog')?.open && document.querySelector('#product-detail-dialog').getAttribute('aria-busy')==='false'`);
    assert.match(await run(`document.querySelector('#product-detail-dialog .catalog-price').textContent`), /40\.000 ₫/);
    assert.equal(await run(`document.querySelector('#product-detail-dialog .product-detail-description img')`), null, 'Medical text is rendered without HTML injection');
    assert.match(await run(`document.querySelector('#product-detail-dialog').textContent`), /Thuốc kê đơn/);
    await key('Escape', 27); await waitFor(`!document.querySelector('#product-detail-dialog').open`);
    assert.equal(await run(`document.activeElement.classList.contains('product-detail-trigger')`), true);
    assert.match(await run(`document.querySelector('#sale-products-grid .catalog-price').textContent`), /40\.000 ₫ \/ Hộp/);
    assert.match(await run(`document.querySelector('#sale-products-grid .sale-original-price').textContent`), /50\.000 ₫/);
    assert.equal(await run(`document.querySelector('#sale-products-grid input[value="23"]').closest('article').querySelector('.catalog-buy').textContent`), 'Hết hàng');
    await run(`document.querySelector('#sale-products-grid input[value="21"]').click()`);
    assert.match(await run(`document.querySelector('#sale-products-grid input[value="21"]').closest('article').querySelector('.catalog-price').textContent`), /8\.000 ₫ \/ Vỉ/);
    assert.equal(await run(`Array.from(document.querySelectorAll('#sale-products-grid article')).find(card=>card.querySelector('h3').textContent.startsWith('Thuốc 5 ')).querySelector('.catalog-buy').textContent`), 'Hết ưu đãi');
    await run(`document.querySelector('#sale-products-next').click()`);
    await waitFor(`document.querySelector('#sale-products-page').textContent==='Trang 2 / 3' && document.querySelector('#sale-products-grid').children.length===5`);
    await run(`document.querySelector('#sale-products-next').click()`);
    await waitFor(`document.querySelector('#sale-products-grid').children.length===2`);
    assert.equal(await run(`document.querySelector('#sale-products-next').disabled`), true, 'Last group disables the next arrow');
    assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true, 'Paging promotions does not show a success notice');
    await run(`document.querySelector('#sale-products-prev').click()`);
    await waitFor(`document.querySelector('#sale-products-grid').children.length===5`);
    await run(`document.querySelector('#sale-products-prev').click()`);
    await waitFor(`document.querySelector('#sale-products-page').textContent==='Trang 1 / 3' && document.querySelector('#sale-products-grid').children.length===5`);
    assert.equal(await run(`document.querySelector('#sale-products-prev').disabled`), true);
    setSaleQuotes(true);
    await run(`document.querySelector('#sale-products-grid .catalog-buy').click()`);
    await waitFor(`document.querySelector('#sale-products-grid .catalog-purchase-status').textContent.includes('Đã thêm')`);
    const saleCart = await run(`(async()=>{const api=await import('/js/api/cart.js');const data=await api.getCart();await api.removeCartItem(11);return data;})()`);
    assert.equal(saleCart.items[0].KhuyenMai.TenChuongTrinh, 'Ưu đãi tháng 11');
    assert.equal(saleCart.items[0].GiaBan, 40000);
    await select(2); await waitFor(`document.querySelector('#sale-programs [aria-pressed="true"]').dataset.state==='UPCOMING' && document.querySelector('#sale-products').getAttribute('aria-busy')==='false'`);
    assert.equal(await run(`document.querySelector('#sale-program-status')`), null, 'Program state only appears on program selector');
    assert.equal(await run(`document.querySelector('#customer-notice')?.textContent.includes('Đã cập nhật sản phẩm khuyến mãi.') || false`), false, 'Switching programs does not announce a successful update');
    assert.match(await run(`document.querySelector('#sale-countdown').textContent`), /Bắt đầu sau/);
    assert.equal(await run(`document.querySelector('#sale-products-grid input[value="23"]').closest('article').querySelector('.sale-quota').textContent`), 'Dự kiến 1 Hộp ưu đãi', 'Upcoming quota is previewed even when current stock cannot fill a box');
    assert.equal(await run(`Array.from(document.querySelectorAll('#sale-products-grid .catalog-buy')).every(button=>button.disabled && button.textContent==='Sắp diễn ra')`), true);
    mode = 'slow'; await select(1); await select(2); await run(`new Promise(resolve=>setTimeout(resolve,400))`);
    assert.equal(await run(`document.querySelector('#sale-program-title').textContent`), programs[1].TenChuongTrinh);
    mode = 'products-error'; await select(1); await waitFor(`!document.querySelector('#sale-products-retry').hidden`);
    mode = 'normal'; await run(`document.querySelector('#sale-products-retry').click()`); await waitFor(`document.querySelector('#sale-products-grid').children.length===5`);
    mode = 'products-empty'; await select(2); await waitFor(`document.querySelector('#sale-products-state').textContent.includes('Chưa có sản phẩm')`);
    mode = 'list-error'; await command('Page.reload'); await waitFor(`!document.querySelector('#sale-program-retry')?.hidden`);
    mode = 'normal'; await run(`document.querySelector('#sale-program-retry').click()`); await waitFor(`document.querySelector('#sale-products-grid').children.length===5`);
    mode = 'empty'; await command('Page.reload'); await waitFor(`document.querySelector('#sale-program-state')?.textContent.includes('Chưa có chương trình')`);
    mode = 'normal';
    for (const width of [1440, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
        await navigate();
        assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`), true, `Sale overflow at ${width}`);
        assert.equal(await run(`(() => {const tops=[...document.querySelector('#sale-products-grid').children].map(item=>item.getBoundingClientRect().top);return Math.max(...tops)-Math.min(...tops)<1;})()`), true, `Sale always has one row at ${width}`);
        await run(`document.querySelector('#sale-products-next').focus()`);
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await waitFor(`document.querySelector('#sale-products-page').textContent.startsWith('Trang 2 /') && document.querySelector('#sale-products').getAttribute('aria-busy')==='false'`);
        await run(`document.querySelector('#sale-products-prev').click()`);
        await waitFor(`document.querySelector('#sale-products-page').textContent.startsWith('Trang 1 /') && document.querySelector('#sale-products').getAttribute('aria-busy')==='false'`);
        assert.equal(await run(`document.querySelector('#sale-countdown').scrollWidth<=document.querySelector('#sale-countdown').clientWidth`), true, `Countdown fits at ${width}`);
        await run(`document.querySelector('#sale-products-grid .catalog-product-visual').click()`);
        await waitFor(`document.querySelector('#product-detail-dialog')?.open && document.querySelector('#product-detail-dialog').getAttribute('aria-busy')==='false'`);
        assert.equal(await run(`document.querySelector('#product-detail-dialog').scrollWidth<=document.querySelector('#product-detail-dialog').clientWidth`), true, `Detail fits at ${width}`);
        assert.equal(await run(`Array.from(document.querySelectorAll('#product-detail-dialog dt')).some(item=>['Mã vạch','Số đăng ký','Mã dược'].includes(item.textContent))`), false, 'Public detail omits product identifiers');
        await run(`document.querySelector('#product-detail-dialog').scrollTop=document.querySelector('#product-detail-dialog').scrollHeight`);
        assert.equal(await run(`(() => {const dialog=document.querySelector('#product-detail-dialog'), close=dialog.querySelector('.product-detail-close'), rect=close.getBoundingClientRect(), box=dialog.getBoundingClientRect();return rect.top>=box.top && rect.bottom<=box.bottom && document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2)===close;})()`), true, `Close remains visible and clickable after scrolling at ${width}`);
        await run(`document.querySelector('#product-detail-dialog').scrollTop=0`);
        if (width === 375) {
            const detailShot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            await writeFile(path.join(root, 'docs', 'MODULE_03_3_DETAIL_MOBILE.png'), Buffer.from(detailShot.data, 'base64'));
        }
        await key('Escape', 27); await waitFor(`!document.querySelector('#product-detail-dialog').open`);
        await run(`document.querySelector('#public-sale').scrollIntoView({block:'start',behavior:'instant'})`);
        if (width === 1440 || width === 375) {
            const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            await writeFile(path.join(root, 'docs', `MODULE_03_2_SALE_${width}.png`), Buffer.from(shot.data, 'base64'));
        }
    }
    await command('Page.navigate', { url: `${baseUrl}/pages/customer/products.html?category_id=1` });
    await new Promise(resolve => setTimeout(resolve, 50));
    await waitFor(`document.querySelector('#catalog-products-grid')?.children.length===12 && document.querySelector('#catalog-products')?.getAttribute('aria-busy')==='false'`);
    await run(`document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.product-detail-trigger').click()`);
    await waitFor(`document.querySelector('#product-detail-dialog')?.getAttribute('aria-busy')==='false'`);
    await run(`document.querySelector('#product-detail-dialog input[value="21"]').click()`);
    assert.match(await run(`document.querySelector('#product-detail-dialog .catalog-price').textContent`), /8\.000 ₫/);
    await run(`document.querySelector('#product-detail-dialog input[value="22"]').click()`);
    assert.match(await run(`document.querySelector('#product-detail-dialog .catalog-price').textContent`), /1\.000 ₫/);
    assert.equal(await run(`document.querySelector('#product-detail-dialog .sale-original-price').hidden`), true, 'Units without an offer keep their normal price');
    await run(`document.querySelector('#product-detail-dialog input[value="21"]').click();document.querySelector('#product-detail-dialog .catalog-buy').click()`);
    await waitFor(`document.querySelector('#product-detail-dialog .catalog-purchase-status').textContent.includes('Đã thêm')`);
    await key('Escape', 27); await waitFor(`!document.querySelector('#product-detail-dialog').open`);
    assert.equal(await run(`document.querySelector('input[name="product-unit-2"]:checked').value`), '23', 'Modal unit choices do not change background radio groups');
    mode = 'detail-error'; await run(`document.querySelector('#catalog-products-grid .product-detail-trigger').click()`);
    await waitFor(`!document.querySelector('#product-detail-dialog > button:nth-of-type(2)').hidden`);
    mode = 'normal'; await run(`document.querySelector('#product-detail-dialog > button:nth-of-type(2)').click()`);
    await waitFor(`document.querySelector('#product-detail-dialog').textContent.includes('Viên nén')`);
    await key('Escape', 27); await waitFor(`!document.querySelector('#product-detail-dialog').open`);
    mode = 'detail-slow';
    await run(`document.querySelector('#catalog-products-grid .product-detail-trigger').click();document.querySelector('#product-detail-dialog').close();document.querySelector('input[name="product-unit-2"]').closest('article').querySelector('.product-detail-trigger').click()`);
    await waitFor(`document.querySelector('#product-detail-title').textContent==='Thuốc 2' && document.querySelector('#product-detail-dialog').getAttribute('aria-busy')==='false'`);
    await run(`new Promise(resolve=>setTimeout(resolve,400))`);
    assert.equal(await run(`document.querySelector('#product-detail-title').textContent`), 'Thuốc 2', 'Closing and rapidly opening another product discards stale detail responses');
    await key('Escape', 27); await waitFor(`!document.querySelector('#product-detail-dialog').open`);
    mode = 'normal';
    setSaleQuotes(false);
    console.log('PASS: sale frame position, chronological programs, active/upcoming, discounted prices, unit switch, quota exhaustion, cart pricing, paging, error/empty/retry, stale response and 1440–320px. API/AUTH MOCK.');
}
