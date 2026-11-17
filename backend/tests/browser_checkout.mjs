import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resetCartFixture, setCartMode, setSaleQuotes } from './browser_home.mjs';
import { resetAddressFixture, setAddressFixtureMode, addressSnapshot } from './browser_addresses.mjs';

const cart = [{ MaThuoc: 1, MaDonGia: 11, SoLuong: 1 }, { MaThuoc: 2, MaDonGia: 21, SoLuong: 2 }];
const addresses = [{ MaDiaChi: 1, DiaChiGiao: true, TinhThanh: 'Thành phố Huế', PhuongXa: 'Phường Vỹ Dạ', DiaChiCuThe: 'Nhà chính' }, { MaDiaChi: 2, DiaChiGiao: false, TinhThanh: 'Thành phố Hà Nội', PhuongXa: 'Phường B', DiaChiCuThe: '<b>Nhà phụ</b>' }];
export async function checkCheckout({ evaluate: run, waitFor, command, key, baseUrl, root, setScenario, requests }) {
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
        assert.equal(await run(`${$('checkout-complete')}.disabled`), true);
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
        assert.equal(requests.some(url => /\/api\/(orders|payments)/.test(url)), false, 'Confirmation never creates an order or submits a payment');
        console.log('PASS: cart-to-confirmation selected rows, guest/login merge, delivery/pickup, notes, primary/secondary address choice, COD/QR selection, authoritative/partial discounts, no fees invented, stock/error/retry/empty/missing selection, logout privacy and 1440–320px. No orders/payments; MOCK API.');
    } finally { setSaleQuotes(false); setCartMode('normal'); resetCartFixture([]); resetAddressFixture([]); setScenario('anonymous'); }
}
