import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resetCartFixture, setCartMode, setSaleQuotes, appendAccountCart } from './browser_home.mjs';
import { resetAddressFixture, setAddressFixtureMode, addressSnapshot } from './browser_addresses.mjs';
import { setPointsFixtureMode } from './browser_points.mjs';

const cart = [{ MaThuoc: 1, MaDonGia: 11, SoLuong: 1 }, { MaThuoc: 2, MaDonGia: 21, SoLuong: 2 }];
const addresses = [{ MaDiaChi: 1, DiaChiGiao: true, TinhThanh: 'Thành phố Huế', PhuongXa: 'Phường Vỹ Dạ', DiaChiCuThe: 'Nhà chính' }, { MaDiaChi: 2, DiaChiGiao: false, TinhThanh: 'Thành phố Hà Nội', PhuongXa: 'Phường B', DiaChiCuThe: '<b>Nhà phụ</b>' }];
let fixtureOrder = { MaDonHang: '9007199254741000', TongThanhToan: '50000', PhuongThucThanhToan: 0,
    TrangThaiThanhToan: 0, TrangThaiDonHang: 1 }, paymentConfirmed = false, orderCreates = 0, orderMode = 'normal';
let gatewayInitializations = 0;
let fixtureEnvironment = 'sandbox';
let listMode = 'normal';
let reorderCalls = [], reorderMode = 'normal';
let cancelMode = 'normal', cancelCalls = 0;
const cancelledIds = new Set();
export async function orderFixture(req, json) {
    if (req.url.endsWith('/cancel') && req.method === 'POST') {
        assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
        if (cancelMode === 'legacy') return json(409, { code: 'ORDER_REFUND_REVIEW_REQUIRED' });
        const id = req.url.split('/')[3];
        if (cancelledIds.has(id)) return json(409, { code: 'ORDER_NOT_CANCELLABLE' });
        cancelCalls++; cancelledIds.add(id);
        if (id === fixtureOrder.MaDonHang) fixtureOrder.TrangThaiDonHang = 4;
        return json(200, { code: 'ORDER_CANCELLED', order: { ...fixtureOrder, MaDonHang: id, TrangThaiDonHang: 4 } });
    }
    if (/\/reorder(?:\/quote)?$/.test(new URL(req.url, 'http://fixture').pathname)) {
        const id = new URL(req.url, 'http://fixture').pathname.split('/')[3];
        const options = [{ MaChiTiet: '9007199254741001', MaThuoc: 1, MaDonGia: 11, SoLuong: 1,
            TenThuoc: '<b>Vitamin tổng hợp</b>', DonViTinh: 'Hộp', HinhAnh: null, GiaBan: '50000', ConHang: true },
        { MaChiTiet: '9007199254741002', MaThuoc: 2, MaDonGia: 21, SoLuong: 2,
            TenThuoc: 'Vitamin thứ hai', DonViTinh: 'Vỉ', HinhAnh: null, GiaBan: '12000', ConHang: reorderMode !== 'unavailable' }];
        if (reorderMode === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        if (req.method === 'GET') return json(200, { code: 'REORDER_OPTIONS', MaDonHang: id, items: options });
        assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
        let raw = ''; for await (const chunk of req) raw += chunk;
        const values = JSON.parse(raw);
        const selected = options.filter(row => values.MaChiTiet.includes(row.MaChiTiet));
        if (new URL(req.url, 'http://fixture').pathname.endsWith('/quote')) {
            const items = selected.map(row => ({ ...row, ThanhTien: String(BigInt(row.GiaBan) * BigInt(row.SoLuong)) }));
            return json(200, { code: 'CART_LISTED', items,
                total: items.reduce((sum, row) => sum + Number(row.ThanhTien), 0) });
        }
        reorderCalls.push(values.MaChiTiet);
        appendAccountCart(selected.map(row => ({ MaThuoc: row.MaThuoc, MaDonGia: row.MaDonGia, SoLuong: row.SoLuong })));
        return json(200, { code: 'ORDER_REORDERED', unit_ids: selected.map(row => row.MaDonGia) });
    }
    if (req.method === 'GET' && new URL(req.url, 'http://fixture').pathname === '/api/orders') {
        if (listMode === 'error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        const query = new URL(req.url, 'http://fixture').searchParams;
        const status = query.get('status') || 'all', page = Number(query.get('page') || 1);
        const filters = { all: [0, 1, 2, 3, 4, 5], processing: [0, 1], shipping: [2], delivered: [3], cancelled: [4], returns: [5] };
        const items = listMode === 'empty' ? [] : [0, 1, 2, 3, 4, 5].map(state => ({
            ...fixtureOrder, MaDonHang: state === 0 ? fixtureOrder.MaDonHang : String(100 + state),
            NgayDat: '2026-11-18T09:15:00', HinhThucNhanHang: 'delivery',
            TrangThaiDonHang: state, TrangThaiThanhToan: 0, can_pay: state === 0,
            TongTien: '60000', TienGiamGia: '10000', item_count: 2,
            preview: { TenThuoc: '<b>Vitamin tổng hợp</b>', HinhAnh: 'javascript:alert(1)',
                DonViTinh: 'Hộp', SoLuong: 1, ThanhTien: '50000' },
            items: [{ MaThuoc: 1, TenThuoc: '<b>Vitamin tổng hợp</b>', HinhAnh: 'javascript:alert(1)',
                DonViTinh: 'Hộp', SoLuong: 1, ThanhTien: '30000' },
            { MaThuoc: 2, TenThuoc: 'Vitamin thứ hai', HinhAnh: null,
                DonViTinh: 'Vỉ', SoLuong: 2, ThanhTien: '20000' }]
        })).map(item => cancelledIds.has(item.MaDonHang) ? { ...item, TrangThaiDonHang: 4, can_pay: false } : item)
            .filter(item => filters[status].includes(item.TrangThaiDonHang));
        return json(200, { code: 'ORDERS_LISTED', items: page === 1 ? items : [], total: items.length,
            processing_count: listMode === 'empty' ? 0 : 2 - [fixtureOrder.MaDonHang, '101'].filter(id => cancelledIds.has(id)).length, page, per_page: 10, status });
    }
    if (/\/detail$/.test(req.url)) {
        if (orderMode === 'detail-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        if (orderMode === 'detail-not-found') return json(404, { code: 'ORDER_NOT_FOUND' });
        return json(200, { code: 'ORDER_DETAIL', order: {
            ...fixtureOrder, TongTien: '50000', TienGiamGia: '0', NgayDat: '2026-11-18T09:15:00',
            GhiChu: 'Người nhận: Nguyễn Lan Yến · 0900000000\nGiao tận nơi: 126 Dương Văn An, Phường Vỹ Dạ, Thành phố Huế\nGọi trước khi giao hàng.',
            ...(paymentConfirmed ? { TrangThaiThanhToan: 1, TrangThaiDonHang: 1 } : {}),
            ...(fixtureOrder.TrangThaiDonHang === 3 ? { XuDaCong: '500' } : {}),
            items: [{ MaChiTiet: '9007199254741001', MaThuoc: 1, MaDonGia: 11, TenThuoc: '<b>Vitamin tổng hợp</b>',
                HinhAnh: 'javascript:alert(1)', DonViTinh: 'Hộp', SoLuong: 1, DonGia: '50000', ThanhTien: '50000' }] } });
    }
    if (req.url.endsWith('/payment') && req.method === 'POST') {
        assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
        if (orderMode === 'initialize-error') return json(503, { code: 'GATEWAY_NOT_CONFIGURED' });
        gatewayInitializations++;
        return json(200, { code: 'PAYMENT_INITIALIZED', payment: {
            environment: fixtureEnvironment, action: fixtureEnvironment === 'sandbox' ? 'https://pay-sandbox.sepay.vn/v1/checkout/init' : 'https://pay.sepay.vn/v1/checkout/init', method: 'POST', fields: {
                signature: 'A'.repeat(43) + '=', payment_method: 'BANK_TRANSFER', customer_id: '12',
                order_invoice_number: `${fixtureEnvironment === 'sandbox' ? 'LYSGTEST' : 'LYSGLIVE'}${fixtureOrder.MaDonHang}`, order_description: 'Thanh toán đơn kiểm thử',
                operation: 'PURCHASE', currency: 'VND', merchant: fixtureEnvironment === 'sandbox' ? 'SP-TEST-FIXTURE' : 'MERCHANT_PRODUCTION_TEST', order_amount: fixtureOrder.TongThanhToan } } });
    }
    if (req.method === 'POST') {
        assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
        let body = ''; for await (const chunk of req) body += chunk;
        const values = JSON.parse(body);
        if (orderMode === 'config-error') return json(503, { code: 'GATEWAY_NOT_CONFIGURED' });
        orderCreates++;
        fixtureOrder = { MaDonHang: String(9007199254741000n + BigInt(orderCreates)), TongThanhToan: values.TongThanhToan, payment_environment: fixtureEnvironment,
            DoiDiem: values.DoiDiem === true,
            PhuongThucThanhToan: values.PhuongThucThanhToan, TrangThaiThanhToan: 0,
            TrangThaiDonHang: values.PhuongThucThanhToan === 0 ? 1 : 0 };
        return json(201, { code: 'ORDER_CREATED', order: fixtureOrder });
    }
    if (orderMode === 'read-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
    return json(200, { code: 'ORDER_READ', order: paymentConfirmed
        ? { ...fixtureOrder, TrangThaiThanhToan: 1, TrangThaiDonHang: 1 } : fixtureOrder });
}
export async function checkCheckout({ evaluate: run, waitFor: waitInPage, command, key, baseUrl, root, setScenario, requests }) {
    const waitFor = async expression => {
        for (let attempt = 0; attempt < 4; attempt++) {
            try { return await waitInPage(expression); }
            catch (error) {
                if (attempt === 3 || !/navigated|context.*destroyed|Cannot find context/i.test(error.message)) throw error;
                await new Promise(resolve => setTimeout(resolve, 80));
            }
        }
    };
    const click = expression => run(`${expression}.click()`);
    const $ = id => `document.querySelector('#${id}')`;
    const ready = amount => waitFor(`${$('checkout-layout')}?.hidden===false && ${$('checkout-total')}.textContent===${JSON.stringify(amount)}`);
    const navigate = async file => { await command('Page.navigate', { url: `${baseUrl}/pages/customer/${file}` }); await new Promise(resolve => setTimeout(resolve, 50)); };
    try {
        setScenario('anonymous'); setCartMode('normal'); setSaleQuotes(true); resetCartFixture(cart); resetAddressFixture(addresses); requests.length = 0;
        await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
        await navigate('cart.html'); await waitFor(`document.querySelector('#cart-final-total')?.textContent==='60.000 ₫' && !document.querySelector('.cart-checkout').disabled`);
        await click(`document.querySelector('[data-unit-id="21"] input[type="checkbox"]')`);
        await waitFor(`document.querySelector('#cart-final-total').textContent==='40.000 ₫' && !document.querySelector('.cart-checkout').disabled`);
        await click(`document.querySelector('.cart-checkout')`); await ready('40.000 ₫');
        assert.equal(await run('location.pathname+location.search'), '/pages/customer/checkout.html?unit=11');
        assert.equal(await run(`${$('checkout-products')}.children.length`), 1);
        assert.equal(await run(`${$('checkout-original')}.textContent`), '50.000 ₫');
        assert.equal(await run(`${$('checkout-discount')}.textContent`), '−10.000 ₫');
        assert.equal(await run(`${$('checkout-complete')}.disabled`), false);
        assert.equal(await run(`${$('checkout-products')}.querySelector('h3 b')`), null);
        assert.match(await run(`document.querySelector('.checkout-shipping-note').textContent`), /2–3 giờ.*3–4 ngày/s);
        await waitFor(`${$('checkout-login')}.hidden===false`);
        await run(`${$('checkout-note')}.value='Gọi trước khi giao'`);
        await click(`document.querySelector('input[name="receipt"][value="pickup"]')`);
        assert.equal(await run(`${$('checkout-pickup')}.hidden`), false);
        assert.match(await run(`${$('checkout-pickup')}.textContent`), /126 Dương Văn An.*Phường Vỹ Dạ, TP Huế/s);
        assert.equal(await run(`${$('checkout-shipping')}.textContent`), 'Không áp dụng');
        await click(`document.querySelector('input[name="payment"][value="qr"]')`);
        assert.equal(await run(`${$('checkout-qr-state')}.hidden`), false);
        assert.equal(await run(`!document.querySelector('#customer-notice') || document.querySelector('#customer-notice').hidden`), true, 'Viewing/changing receipt/payment does not show a toast');
        await click(`document.querySelector('input[name="receipt"][value="delivery"]')`);
        await click($('checkout-login')); await waitFor(`document.querySelector('#auth-dialog').open`);
        await run(`document.querySelector('#phone').value='0900000000';document.querySelector('#phone-form').requestSubmit()`);
        await waitFor(`!document.querySelector('#otp-form').hidden && !document.querySelector('#otp').disabled`);
        await run(`document.querySelector('#otp').value='123456';document.querySelector('#otp-form').requestSubmit()`);
        await ready('40.000 ₫'); await waitFor(`${$('checkout-street')}.textContent==='Nhà chính'`);
        await waitFor(`!document.querySelector('#checkout-use-points').disabled`);
        assert.equal(await run(`document.querySelector('#checkout-points-balance').textContent`), '195');
        assert.equal(await run(`document.querySelector('#checkout-use-points').checked`), false);
        await click($('checkout-use-points')); await ready('38.050 ₫');
        assert.equal(await run(`document.querySelector('#checkout-points-discount').textContent`), '−1.950 ₫');
        assert.equal(await run(`document.querySelector('#checkout-points-option').textContent.trim()`), 'Sử dụng xu: 195');
        assert.equal(await run(`document.querySelector('#checkout-points-option .reward-coin').getAttribute('aria-label')`), 'xu');
        assert.equal(await run(`document.querySelector('#checkout-use-points').getAttribute('role')`), 'switch');
        assert.equal(await run(`document.querySelector('#checkout-points-state').hidden`), true);
        await click($('checkout-use-points')); await ready('40.000 ₫');
        assert.equal(orderCreates, 0, 'Toggling redemption must not create an order');
        assert.equal(await run(`${$('checkout-note')}.value`), 'Gọi trước khi giao');
        await click($('checkout-change-address')); await waitFor(`${$('checkout-address-dialog')}.open`);
        await click(`document.querySelector('input[name="delivery-address"][value="2"]')`); await click($('checkout-address-done'));
        assert.equal(await run(`${$('checkout-street')}.textContent`), '<b>Nhà phụ</b>');
        assert.equal(await run(`${$('checkout-street')}.querySelector('b')`), null);
        assert.deepEqual(addressSnapshot().map(address => address.DiaChiGiao), [true, false], 'Choosing a receipt address does not mutate the primary address');
        await click(`document.querySelector('input[name="payment"][value="cod"]')`);
        assert.equal(await run(`${$('checkout-qr-state')}.hidden`), true);
        for (const width of [1440, 1280, 1024, 768, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Checkout fits ${width}px`);
            await click($('checkout-change-address')); await waitFor(`${$('checkout-address-dialog')}.open`);
            assert.equal(await run(`${$('checkout-address-dialog')}.scrollWidth<=${$('checkout-address-dialog')}.clientWidth`), true);
            await key('Escape', 27);
            if (width === 1440 || width === 375) {
                await run(`window.scrollTo({top:0,behavior:'instant'})`);
                const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `MODULE_03_8_CHECKOUT_${width}.png`), Buffer.from(screenshot.data, 'base64'));
            }
        }
        setCartMode('cart-quote-error'); await navigate('checkout.html?unit=11'); await waitFor(`${$('checkout-retry')}.hidden===false`);
        assert.equal(await run(`${$('checkout-layout')}.hidden`), true);
        setCartMode('normal'); await click($('checkout-retry')); await ready('40.000 ₫');
        setAddressFixtureMode('read-error'); await navigate('checkout.html?unit=11'); await ready('40.000 ₫'); await waitFor(`${$('checkout-address-retry')}.hidden===false`);
        setAddressFixtureMode('normal'); await click($('checkout-address-retry')); await waitFor(`${$('checkout-street')}.textContent==='Nhà chính'`);
        resetCartFixture([], [{ MaThuoc: 1, MaDonGia: 11, SoLuong: 2 }]); setSaleQuotes('partial');
        await navigate('checkout.html?unit=11'); await ready('90.000 ₫');
        assert.match(await run(`${$('checkout-products')}.textContent`), /1 Hộp còn lại tính giá gốc/);
        setSaleQuotes(false); await navigate('checkout.html?unit=11'); await ready('100.000 ₫');
        assert.equal(await run(`${$('checkout-discount-row')}.hidden`), true);
        resetCartFixture([], [{ MaThuoc: 1, MaDonGia: 11, SoLuong: 21 }]);
        await navigate('checkout.html?unit=11'); await waitFor(`document.querySelector('.checkout-product-unavailable')!==null`);
        assert.equal(await run(`${$('checkout-total')}.textContent`), '—');
        await navigate('checkout.html?unit=11&unit=999'); await waitFor(`${$('checkout-state')}.textContent.includes('Giỏ hàng đã thay đổi')`);
        assert.equal(await run(`${$('checkout-layout')}.hidden`), true);
        await navigate('checkout.html'); await waitFor(`${$('checkout-state')}.textContent.includes('Chưa có sản phẩm được chọn')`);
        await navigate('checkout.html?unit=-1'); await waitFor(`${$('checkout-state')}.textContent.includes('chưa hợp lệ')`);
        resetCartFixture([], cart); resetAddressFixture([]);
        await navigate('checkout.html?unit=11'); await ready('50.000 ₫'); await waitFor(`${$('checkout-add-address')}.hidden===false && ${$('checkout-address-state')}.textContent.includes('chưa có địa chỉ')`);
        await run(`${$('checkout-note')}.value='Nội dung riêng tư'`);
        await click($('account-avatar-button')); await click($('logout-button'));
        await waitFor(`${$('checkout-login')}.hidden===false && ${$('checkout-note')}.value===''`);
        assert.equal(requests.some(url => /^\/api\/(orders|payments)/.test(url)), false, 'Viewing confirmation does not create orders or payments');
        setScenario('manager'); resetCartFixture([], cart); resetAddressFixture(addresses);
        await navigate('checkout.html?unit=11'); await ready('50.000 ₫');
        await waitFor(`${$('checkout-street')}.textContent==='Nhà chính'`);
        await click($('checkout-complete'));
        await waitFor(`document.querySelector('#order-detail-layout')?.hidden===false`);
        assert.equal(await run('location.pathname'), '/pages/customer/order-detail.html');
        assert.equal(orderCreates, 1);
        assert.equal(gatewayInitializations, 0);
        assert.equal(await run(`document.querySelector('#order-status').textContent`), 'Đang xử lý đơn');
        assert.equal(await run(`document.querySelectorAll('#order-progress .is-complete').length`), 1);
        assert.equal(await run(`document.querySelector('#order-progress .is-current').classList.contains('is-complete')`), false);
        assert.equal(await run(`document.querySelector('#order-progress').children.length`), 4);
        assert.equal(await run(`document.querySelector('#order-products b')`), null);
        assert.equal(await run(`document.querySelector('#order-open-payment').hidden`), true);
        assert.equal(await run(`document.querySelector('#order-number').textContent`), '#' + fixtureOrder.MaDonHang);
        assert.equal(await run(`document.querySelector('#order-total').textContent`), '50.000 ₫');
        assert.equal(await run(`document.querySelector('#order-motion, #order-refresh, #order-updated')`), null);
        await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        assert.equal(await run(`getComputedStyle(document.querySelector('.is-approaching .order-step-flow')).animationName`), 'none');
        await command('Emulation.setEmulatedMedia', { features: [] });
        for (const status of [0, 1, 2, 3]) {
            fixtureOrder.TrangThaiDonHang = status;
            await navigate(`order-detail.html?order=${fixtureOrder.MaDonHang}`);
            await waitFor(`document.querySelector('#order-status').textContent===${JSON.stringify(['Đặt hàng','Đang xử lý đơn','Đang giao','Đã giao'][status])}`);
            assert.equal(await run(`document.querySelector('#order-earned-points').hidden`), status !== 3);
            assert.equal(await run(`document.querySelector('#order-cancel').hidden`), status > 1);
            assert.equal(await run(`Array.from(document.querySelector('#order-progress').children).indexOf(document.querySelector('[aria-current="step"]'))`), status);
            assert.equal(await run(`document.querySelectorAll('.is-approaching').length`), status === 1 || status === 2 ? 1 : 0);
            assert.equal(await run(`Array.from(document.querySelector('#order-progress').children).findIndex(e=>e.classList.contains('is-approaching'))`), status === 1 || status === 2 ? status - 1 : -1);
            assert.equal(await run(`document.querySelectorAll('#order-progress .is-complete').length`), status === 3 ? 4 : status);
            assert.equal(await run(`Array.from(document.querySelectorAll('.order-step-flow')).filter(e=>getComputedStyle(e).animationName==='order-flow').length`), status === 1 || status === 2 ? 1 : 0);
            if (status === 2) {
                // Change the API result on the same page: polling must remove
                // the old moving segment, not merely style a fresh page.
                fixtureOrder.TrangThaiDonHang = 3;
                await waitFor(`document.querySelector('#order-progress').dataset.status==='3'`);
                assert.equal(await run(`document.querySelectorAll('#order-progress .order-step-flow').length`), 0);
                assert.equal(await run(`document.querySelector('#order-progress').getAnimations({subtree:true}).length`), 0);
                assert.equal(await run(`document.querySelectorAll('#order-progress .is-complete').length`), 4);
            }
        }
        fixtureOrder.TrangThaiDonHang = 4; await navigate(`order-detail.html?order=${fixtureOrder.MaDonHang}`);
        await waitFor(`document.querySelector('#order-status').textContent==='Đã hủy'`);
        assert.equal(await run(`document.querySelector('#order-progress').hidden`), true);
        fixtureOrder.TrangThaiDonHang = 1; await navigate(`order-detail.html?order=${fixtureOrder.MaDonHang}`);
        await waitFor(`document.querySelector('#order-status').textContent==='Đang xử lý đơn'`);
        for (const width of [1440, 1024, 768, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Order detail fits ${width}px`);
            if ([1440, 375].includes(width)) {
                await run(`window.scrollTo({top:0,behavior:'instant'})`);
                const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `ORDER_DETAIL_${width}.png`), Buffer.from(screenshot.data, 'base64'));
            }
        }
        orderMode = 'detail-error'; await navigate(`order-detail.html?order=${fixtureOrder.MaDonHang}`);
        await waitFor(`document.querySelector('#order-retry').hidden===false`);
        orderMode = 'normal'; await click(`document.querySelector('#order-retry')`);
        await waitFor(`document.querySelector('#order-load-state').textContent===''`);
        const savedUrl = await run('location.pathname+location.search');
        await command('Page.navigate', { url: baseUrl + savedUrl });
        await waitFor(`document.querySelector('#order-detail-layout')?.hidden===false`);
        assert.equal(orderCreates, 1, 'Reload reads existing order instead of recreating it');
        orderMode = 'detail-not-found'; await navigate(`order-detail.html?order=${fixtureOrder.MaDonHang}`);
        await waitFor(`document.querySelector('#order-detail-layout').hidden===true`);
        assert.equal(await run(`document.querySelector('#order-products').children.length`), 0);
        assert.equal(await run(`document.querySelector('#order-recipient').textContent`), '');
        orderMode = 'normal';
        await navigate('checkout.html?unit=11'); await ready('50.000 ₫');
        await waitFor(`${$('checkout-street')}.textContent==='Nhà chính'`);
        await click(`document.querySelector('input[name="payment"][value="qr"]')`);
        orderMode = 'config-error'; await click($('checkout-complete'));
        await waitFor(`${$('checkout-complete-note')}.textContent.includes('chưa được cấu hình')`);
        assert.equal(orderCreates, 1);
        // Automatic navigation after creation must be captured BEFORE clicking.
        await run(`HTMLFormElement.prototype.submit=function(){window.__sepaySubmitted={action:this.action,method:this.method,fields:Array.from(this.elements).map(x=>[x.name,x.value])}}`);
        orderMode = 'normal'; await click($('checkout-complete'));
        await waitFor(`${$('checkout-result')}.hidden===false && !${$('checkout-open-payment')}.hidden`);
        await waitFor(`Boolean(window.__sepaySubmitted)`);
        assert.equal(gatewayInitializations, 1, 'Completing a QR order opens Checkout automatically');
        assert.equal(orderCreates, 2);
        assert.match(await run(`${$('checkout-transfer-details')}.textContent`), /50.000 ₫/);
        assert.equal(await run(`${$('checkout-transfer-details')}.querySelector('b')`), null);
        assert.equal(await run(`document.querySelector('#checkout-payment-qr')`), null);
        // Capture form submission in this test only; never leave for real SePay.
        await run(`HTMLFormElement.prototype.submit=function(){window.__sepaySubmitted={action:this.action,method:this.method,fields:Array.from(this.elements).map(x=>[x.name,x.value])}}`);
        orderMode = 'initialize-error'; await click($('checkout-open-payment'));
        await waitFor(`${$('checkout-gateway-state')}.textContent.includes('chưa được cấu hình')`);
        assert.equal(gatewayInitializations, 1);
        orderMode = 'normal';
        await run(`${$('checkout-open-payment')}.click();${$('checkout-open-payment')}.click()`);
        await waitFor(`Boolean(window.__sepaySubmitted)`);
        await waitFor(`${$('checkout-open-payment')}.disabled===false`);
        assert.equal(gatewayInitializations, 2);
        const submitted = await run('window.__sepaySubmitted');
        assert.equal(submitted.action, 'https://pay-sandbox.sepay.vn/v1/checkout/init');
        assert.equal(submitted.method, 'post');
        assert.deepEqual(submitted.fields.map(pair => pair[0]), ['order_amount','merchant','currency','operation','order_description','order_invoice_number','customer_id','payment_method','signature']);
        assert.equal(submitted.fields[0][1], '50000');
        assert.match(await run(`${$('checkout-result-status')}.textContent`), /chờ thanh toán/);
        await run(`history.replaceState(null,'',location.pathname+location.search+'&status=success')`);
        await click($('checkout-payment-check'));
        assert.equal(await run(`${$('checkout-result-status')}.textContent.includes('Đã thanh toán')`), false);
        orderMode = 'read-error'; await click($('checkout-payment-check'));
        await waitFor(`${$('checkout-result-status')}.textContent.includes('Chưa kiểm tra được')`);
        orderMode = 'normal'; await click($('checkout-payment-check'));
        await waitFor(`${$('checkout-result-status')}.textContent.includes('chờ thanh toán')`);
        for (const width of [1440, 768, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Payment result fits ${width}px`);
        }
        paymentConfirmed = true; await click($('checkout-payment-check'));
        await waitFor(`${$('checkout-result-status')}.textContent.includes('Đã thanh toán')`);
        assert.equal(await run(`${$('checkout-open-payment')}.hidden`), true);
        await command('Page.navigate', { url: `${baseUrl}/api/payments/sepay/return?order=${fixtureOrder.MaDonHang}&status=success` });
        await waitFor(`document.querySelector('#order-payment-status')?.textContent.includes('Đã thanh toán')`);
        assert.equal(await run(`document.querySelector('#order-status').textContent`), 'Đang xử lý đơn');
        // Production response is mocked; intercept submit before any real network request.
        fixtureEnvironment = 'production'; paymentConfirmed = false;
        resetCartFixture([], cart);
        await navigate('checkout.html?unit=11'); await ready('50.000 ₫');
        await waitFor(`${$('checkout-street')}.textContent==='Nhà chính'`);
        await click(`document.querySelector('input[name="payment"][value="qr"]')`);
        await run(`HTMLFormElement.prototype.submit=function(){window.__sepayProductionAction=this.action}`);
        await click($('checkout-complete'));
        await waitFor(`${$('checkout-open-payment')}.hidden===false`);
        assert.equal(await run(`${$('checkout-open-payment')}.textContent`), 'Thanh toán qua SePay');
        assert.equal(await run(`${$('checkout-transfer-details')}.textContent.includes('mô phỏng')`), false);
        await waitFor(`Boolean(window.__sepayProductionAction)`);
        assert.equal(await run('window.__sepayProductionAction'), 'https://pay.sepay.vn/v1/checkout/init');
        fixtureOrder.payment_environment = null;
        await navigate(`checkout.html?order=${fixtureOrder.MaDonHang}`);
        await waitFor(`${$('checkout-result')}.hidden===false`);
        assert.equal(await run(`${$('checkout-open-payment')}.hidden`), true);
        assert.match(await run(`${$('checkout-transfer-details')}.textContent`), /chưa xác định môi trường/);
        fixtureEnvironment = 'sandbox'; fixtureOrder.payment_environment = 'sandbox';
        fixtureOrder.PhuongThucThanhToan = 1; fixtureOrder.TrangThaiDonHang = 0;
        fixtureOrder.TrangThaiThanhToan = 0;
        await navigate('orders.html');
        await waitFor(`document.querySelectorAll('.orders-card').length===6`);
        assert.equal(await run(`document.querySelectorAll('[data-pay-order]').length`), 1);
        assert.equal(await run(`document.querySelector('.orders-preview h3 b')`), null);
        assert.equal(await run(`document.querySelectorAll('.orders-preview').length`), 6);
        assert.equal(await run(`document.querySelector('.orders-preview p').textContent`), '+ 1 sản phẩm khác');
        assert.equal(await run(`document.querySelectorAll('.orders-buy-again').length`), 2);
        assert.equal(await run(`Array.from(document.querySelectorAll('.orders-card')).every(e=>[3,4].includes(Number(e.querySelector('.orders-status').dataset.status)) || !e.querySelector('.orders-buy-again'))`), true);
        assert.equal(await run(`document.querySelector('#orders-processing-count').textContent`), '2');
        assert.equal(await run(`document.querySelectorAll('.orders-filters .orders-count').length`), 1);
        for (const [filter, expected] of [['processing', [0, 1]], ['shipping', [2]], ['delivered', [3]], ['cancelled', [4]], ['returns', [5]], ['all', [0, 1, 2, 3, 4, 5]]]) {
            await run(`document.querySelector('[data-order-filter="${filter}"]').click()`);
            await waitFor(`document.querySelector('#orders-content').getAttribute('aria-busy')==='false' && document.querySelectorAll('.orders-card').length===${expected.length}`);
            assert.deepEqual(await run(`Array.from(document.querySelectorAll('.orders-status')).map(e=>Number(e.dataset.status))`), expected);
            assert.equal(await run(`document.querySelector('#orders-processing-count').textContent`), '2');
            assert.equal(await run(`document.querySelectorAll('[data-pay-order]').length`), expected.includes(0) ? 1 : 0);
        }
        for (const width of [1440, 768, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Orders fits ${width}px`);
            if (width === 1440 || width === 375) {
                const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `MY_ORDERS_${width}.png`), Buffer.from(shot.data, 'base64'));
            }
        }
        await click(`document.querySelector('.orders-buy-again')`);
        await waitFor(`document.querySelector('#reorder-list input:checked') && !document.querySelector('#reorder-add').disabled`);
        assert.equal(await run(`document.querySelectorAll('#reorder-list input:checked').length`), 2);
        assert.equal(await run(`document.querySelector('#reorder-list b')`), null);
        for (const width of [1440, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run(`document.querySelector('#reorder-dialog').scrollWidth<=document.querySelector('#reorder-dialog').clientWidth`), true);
            if (width !== 320) {
                const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `REORDER_${width}.png`), Buffer.from(shot.data, 'base64'));
            }
        }
        await run(`document.querySelectorAll('#reorder-list input').forEach(e=>{e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}))})`);
        assert.equal(await run(`document.querySelector('#reorder-buy').disabled && document.querySelector('#reorder-add').disabled`), true);
        await run(`document.querySelectorAll('#reorder-list input')[1].click();document.querySelector('#reorder-add').click();document.querySelector('#reorder-add').click()`);
        await waitFor(`!document.querySelector('#reorder-dialog').open`);
        assert.deepEqual(reorderCalls, [['9007199254741002']]);
        await click(`document.querySelector('.orders-buy-again')`);
        await waitFor(`!document.querySelector('#reorder-buy').disabled`);
        await run(`document.querySelector('#reorder-list input').click();document.querySelector('#reorder-buy').click()`);
        await waitFor(`location.pathname.endsWith('/checkout.html') && document.querySelector('#checkout-layout')?.hidden===false`);
        assert.match(await run('location.search'), /^\?reorder=[1-9][0-9]*&line=9007199254741002$/);
        assert.deepEqual(reorderCalls, [['9007199254741002']], 'Buy now must not call the cart-adding reorder endpoint');
        assert.equal(await run(`document.querySelector('#checkout-products').children.length`), 1);
        assert.equal(orderCreates, 3, 'Buy now only opens confirmation; does not create another order');
        await navigate('orders.html'); await waitFor(`document.querySelectorAll('.orders-preview').length===6`);
        reorderMode = 'unavailable'; await click(`document.querySelector('.orders-buy-again')`);
        await waitFor(`document.querySelectorAll('#reorder-list input').length===2`);
        assert.equal(await run(`document.querySelectorAll('#reorder-list input')[1].disabled`), true);
        await key('Escape', 27);
        await waitFor(`!document.querySelector('#reorder-dialog').open`);
        assert.equal(await run(`document.activeElement.classList.contains('orders-buy-again')`), true);
        reorderMode = 'error'; await click(`document.querySelector('.orders-buy-again')`);
        await waitFor(`document.querySelector('#reorder-state').textContent.includes('Chưa thực hiện')`);
        assert.equal(await run(`document.querySelector('#reorder-add').disabled`), true);
        await key('Escape', 27); reorderMode = 'normal';
        await run(`HTMLFormElement.prototype.submit=function(){window.__listPayment={action:this.action,fields:Object.fromEntries(new FormData(this))}};document.querySelector('[data-pay-order]').click()`);
        await waitFor(`Boolean(window.__listPayment)`);
        assert.equal(await run('window.__listPayment.action'), 'https://pay-sandbox.sepay.vn/v1/checkout/init');
        assert.equal(await run('window.__listPayment.fields.order_invoice_number'), `LYSGTEST${fixtureOrder.MaDonHang}`);
        assert.equal(await run(`document.querySelector('.orders-status').dataset.status`), '0');
        listMode = 'error'; await run(`window.dispatchEvent(new Event('focus'))`);
        await waitFor(`document.querySelector('#orders-retry').hidden===false`);
        assert.equal(await run(`document.querySelectorAll('.orders-card').length`), 0);
        listMode = 'empty'; await run(`document.querySelector('#orders-retry').click()`);
        await waitFor(`document.querySelector('#orders-empty').hidden===false`);
        assert.equal(await run(`document.querySelector('#orders-processing-count').textContent`), '');
        assert.equal(await run(`document.querySelector('#orders-processing-count').hidden`), true);
        listMode = 'normal'; await run(`window.dispatchEvent(new Event('focus'))`);
        await waitFor(`document.querySelectorAll('.orders-card').length===6`);
        await click($('account-avatar-button')); await click($('logout-button'));
        await waitFor(`document.querySelectorAll('.orders-card').length===0 && document.querySelector('#orders-processing-count').hidden`);
        console.log('PASS: My Orders filters 0–5, global processing count, pending QR payment form, safe text, network retry, empty state, logout privacy, responsive 1440–320px.');
        setScenario('manager'); resetCartFixture([], cart); setSaleQuotes(true);
        setPointsFixtureMode('empty');
        await navigate('checkout.html?unit=11'); await ready('40.000 ₫');
        await waitFor(`document.querySelector('#checkout-points-balance').textContent==='0'`);
        assert.equal(await run(`document.querySelector('#checkout-points').hidden`), true);
        setPointsFixtureMode('normal');
        await navigate('checkout.html?unit=11'); await ready('40.000 ₫');
        await waitFor(`!document.querySelector('#checkout-use-points').disabled`);
        await click($('checkout-use-points')); await ready('38.050 ₫');
        for (const width of [1440, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Redemption fits ${width}px`);
        }
        await click(`document.querySelector('input[name="receipt"][value="pickup"]')`);
        await click($('checkout-complete'));
        await waitFor(`document.querySelector('#order-detail-layout')?.hidden===false`);
        assert.equal(fixtureOrder.DoiDiem, true);
        assert.equal(fixtureOrder.TongThanhToan, '38050');
        assert.equal(await run(`document.querySelector('#order-total').textContent`), '38.050 ₫');
        await navigate('orders.html'); await waitFor(`document.querySelectorAll('[data-cancel-order]').length===2`);
        assert.deepEqual(await run(`Array.from(document.querySelectorAll('[data-cancel-order]')).map(button => ({ label: button.textContent, status: button.closest('article').querySelector('.orders-status').dataset.status, visible: button.getClientRects().length > 0 }))`),
            [{ label: 'Hủy đơn', status: '0', visible: true }, { label: 'Hủy đơn', status: '1', visible: true }]);
        await click(`document.querySelector('[data-cancel-order]')`);
        await waitFor(`document.querySelector('#order-cancel-dialog').open`);
        await key('Escape', 27);
        assert.equal(cancelCalls, 0, 'Dismissed confirmation must not cancel an order');
        await navigate(`order-detail.html?order=${fixtureOrder.MaDonHang}`);
        await waitFor(`document.querySelector('#order-cancel')?.hidden===false`);
        cancelMode = 'legacy'; await click($('order-cancel')); await click($('order-cancel-confirm'));
        await waitFor(`document.querySelector('#order-cancel-state').textContent.includes('đối soát')`);
        assert.equal(await run(`document.querySelector('#order-cancel-confirm').disabled`), true);
        await key('Escape', 27); cancelMode = 'normal';
        await click($('order-cancel'));
        for (const width of [1440, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run(`document.querySelector('#order-cancel-dialog').scrollWidth<=document.querySelector('#order-cancel-dialog').clientWidth`), true);
        }
        await run(`document.querySelector('#order-cancel-confirm').click();document.querySelector('#order-cancel-confirm').click()`);
        await waitFor(`document.querySelector('#order-status').textContent==='Đã hủy'`);
        assert.equal(await run(`document.querySelector('#order-cancel').hidden`), true);
        assert.equal(cancelCalls, 1, 'Duplicate clicks issue one cancellation request');
        await navigate('orders.html'); await waitFor(`document.querySelectorAll('[data-cancel-order]').length===1`);
        await click(`document.querySelector('[data-cancel-order]')`); await click($('order-cancel-confirm'));
        await waitFor(`document.querySelectorAll('[data-cancel-order]').length===0`);
        assert.equal(cancelCalls, 2);
        console.log('PASS: cancellation on list/detail only for states 0/1, confirmation dismissal, legacy review, duplicate-submit prevention, 1440–320px. API MOCK.');
        console.log('PASS: gold coins, optional maximum redemption, live discount and total, confirmed DoiDiem payload, 1440–320px. API MOCK.');
        console.log('PASS: checkout selection, guest/login, address, pricing/errors, COD creation, QR/config failure/payment confirmation, double-click prevention, BIGINT order reload, logout privacy, responsive 1440–320px. API MOCK; no database or real payment.');
        console.log(`Order detail screenshots: ${path.join(root, 'docs')}`);
    } finally { fixtureEnvironment = 'sandbox'; setSaleQuotes(false); setCartMode('normal'); resetCartFixture([]); resetAddressFixture([]); setScenario('anonymous'); }
}
