import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resetCartFixture, setCartMode, setSaleQuotes } from './browser_home.mjs';
import { resetAddressFixture, setAddressFixtureMode, addressSnapshot } from './browser_addresses.mjs';

const cart = [{ MaThuoc: 1, MaDonGia: 11, SoLuong: 1 }, { MaThuoc: 2, MaDonGia: 21, SoLuong: 2 }];
const addresses = [{ MaDiaChi: 1, DiaChiGiao: true, TinhThanh: 'Thành phố Huế', PhuongXa: 'Phường Vỹ Dạ', DiaChiCuThe: 'Nhà chính' }, { MaDiaChi: 2, DiaChiGiao: false, TinhThanh: 'Thành phố Hà Nội', PhuongXa: 'Phường B', DiaChiCuThe: '<b>Nhà phụ</b>' }];
let fixtureOrder, paymentConfirmed = false, orderCreates = 0, orderMode = 'normal';
let gatewayInitializations = 0;
let fixtureEnvironment = 'sandbox';
export async function orderFixture(req, json) {
    if (/\/detail$/.test(req.url)) {
        if (orderMode === 'detail-error') return json(503, { code: 'DATABASE_UNAVAILABLE' });
        if (orderMode === 'detail-not-found') return json(404, { code: 'ORDER_NOT_FOUND' });
        return json(200, { code: 'ORDER_DETAIL', order: {
            ...fixtureOrder, TongTien: '50000', TienGiamGia: '0', NgayDat: '2026-11-18T09:15:00',
            GhiChu: 'Người nhận: Nguyễn Lan Yến · 0900000000\nGiao tận nơi: 126 Dương Văn An, Phường Vỹ Dạ, Thành phố Huế\nGọi trước khi giao hàng.',
            ...(paymentConfirmed ? { TrangThaiThanhToan: 1, TrangThaiDonHang: 1 } : {}),
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
        assert.equal(await run(`document.querySelector('#order-status').textContent`), 'Xử lý đơn');
        assert.equal(await run(`document.querySelector('#order-progress').children.length`), 4);
        assert.equal(await run(`document.querySelector('#order-products b')`), null);
        assert.equal(await run(`document.querySelector('#order-open-payment').hidden`), true);
        assert.equal(await run(`document.querySelector('#order-number').textContent`), '#' + fixtureOrder.MaDonHang);
        assert.equal(await run(`document.querySelector('#order-total').textContent`), '50.000 ₫');
        await click(`document.querySelector('#order-motion')`);
        assert.equal(await run(`getComputedStyle(document.querySelector('.is-current .order-step-flow')).animationPlayState`), 'paused');
        await click(`document.querySelector('#order-motion')`);
        await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await waitFor(`document.querySelector('#order-motion').disabled`);
        assert.equal(await run(`getComputedStyle(document.querySelector('.is-current .order-step-flow')).animationName`), 'none');
        await command('Emulation.setEmulatedMedia', { features: [] });
        for (const status of [0, 1, 2, 3]) {
            fixtureOrder.TrangThaiDonHang = status;
            await click(`document.querySelector('#order-refresh')`);
            await waitFor(`document.querySelector('#order-status').textContent===${JSON.stringify(['Đặt hàng','Xử lý đơn','Đang giao','Đã giao'][status])}`);
            assert.equal(await run(`Array.from(document.querySelector('#order-progress').children).indexOf(document.querySelector('[aria-current="step"]'))`), status);
            assert.equal(await run(`document.querySelector('#order-motion').hidden`), status === 3);
        }
        fixtureOrder.TrangThaiDonHang = 4; await click(`document.querySelector('#order-refresh')`);
        await waitFor(`document.querySelector('#order-status').textContent==='Đã hủy'`);
        assert.equal(await run(`document.querySelector('#order-progress').hidden`), true);
        fixtureOrder.TrangThaiDonHang = 1; await click(`document.querySelector('#order-refresh')`);
        await waitFor(`document.querySelector('#order-status').textContent==='Xử lý đơn'`);
        for (const width of [1440, 1024, 768, 375, 320]) {
            await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
            assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `Order detail fits ${width}px`);
            if ([1440, 375].includes(width)) {
                await run(`window.scrollTo({top:0,behavior:'instant'})`);
                const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                await writeFile(path.join(root, 'docs', `ORDER_DETAIL_${width}.png`), Buffer.from(screenshot.data, 'base64'));
            }
        }
        orderMode = 'detail-error'; await click(`document.querySelector('#order-refresh')`);
        await waitFor(`document.querySelector('#order-retry').hidden===false`);
        orderMode = 'normal'; await click(`document.querySelector('#order-retry')`);
        await waitFor(`document.querySelector('#order-load-state').textContent===''`);
        const savedUrl = await run('location.pathname+location.search');
        await command('Page.navigate', { url: baseUrl + savedUrl });
        await waitFor(`document.querySelector('#order-detail-layout')?.hidden===false`);
        assert.equal(orderCreates, 1, 'Reload reads existing order instead of recreating it');
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
        assert.equal(await run(`document.querySelector('#order-status').textContent`), 'Xử lý đơn');
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
        await click($('account-avatar-button')); await click($('logout-button'));
        await waitFor(`${$('checkout-result')}.hidden===true`);
        console.log('PASS: checkout selection, guest/login, address, pricing/errors, COD creation, QR/config failure/payment confirmation, double-click prevention, BIGINT order reload, logout privacy, responsive 1440–320px. API MOCK; no database or real payment.');
        console.log(`Order detail screenshots: ${path.join(root, 'docs')}`);
    } finally { fixtureEnvironment = 'sandbox'; setSaleQuotes(false); setCartMode('normal'); resetCartFixture([]); resetAddressFixture([]); setScenario('anonymous'); }
}
