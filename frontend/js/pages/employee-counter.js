import { getCompletedEmployeeOrders, getCounterCustomer, getCounterProducts, getPendingCounterOrders, getCounterOrder, quoteCounterOrder, createCounterOrder, completeCounterOrder, payCounterOrder } from '../api/employee-orders.js';
import { getPublicCategories } from '../api/public-catalog.js';
import { money } from '../components/cart.js';
import { rewardCoin } from '../components/reward-coin.js';
import { validHttps } from '../utils/product-validation.js';
import { submitCheckout, paymentMessage } from '../utils/sepay-checkout.js';
import { printEmployeeInvoice } from './employee-orders.js';
import { setupLiveSearch } from '../utils/live-search.js';
import { setupEmployeeDialog } from '../components/employee-dialog.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const value = document.createElement(tag); if (text !== undefined) value.textContent = text; if (className) value.className = className; return value; };
const dateText = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
const message = error => ({ INVALID_PHONE: 'Nhập đúng SĐT di động Việt Nam.', CUSTOMER_UNAVAILABLE: 'Tài khoản này không thể mua hàng tại quầy.', CUSTOMER_NAME_REQUIRED: 'Nhập tên khách hàng mới.', OUT_OF_STOCK: 'Số lượng đã vượt tồn kho khả dụng. Kiểm tra lại đơn.', POINTS_UNAVAILABLE: 'Số xu khả dụng đã thay đổi. Kiểm tra lại đơn.', QUOTE_CHANGED: 'Giá, xu hoặc khuyến mãi đã thay đổi. Hãy kiểm tra tổng tiền mới.', ORDER_AMOUNT_LIMIT: 'Giá trị đơn vượt giới hạn cho phép.', ORDER_POINTS_LIMIT: 'Số xu của đơn vượt giới hạn cho phép.', COUNTER_REQUEST_CHANGED: 'Đơn này đã được gửi với nội dung khác. Kiểm tra danh sách đơn trước khi tạo đơn mới.', PAYMENT_PENDING: 'Chưa ghi nhận thanh toán QR. Hệ thống sẽ kiểm tra lại.', QR_AMOUNT_INVALID: 'Đơn 0đ cần chọn tiền mặt để hoàn tất.', INVALID_REQUEST: 'Thông tin đơn chưa hợp lệ.', CONNECTION_FAILED: 'Mất kết nối. Kiểm tra lại kết quả trước khi tạo đơn khác.', DATABASE_UNAVAILABLE: 'Máy chủ chưa xử lý được đơn. Bạn có thể thử lại.', ORDER_NOT_FOUND: 'Không tìm thấy đơn hàng.' })[error.code] || paymentMessage(error);

export function setupEmployeeCounter({ getUser, onSessionError }) {
    let active = false, epoch = 0, quoteVersion = 0, catalogVersion = 0, historyVersion = 0, billVersion = 0;
    let busy = false, checking = false, customer = null, lines = [], quote = null, bill = null, submitted = null, requestId;
    let productPage = 1, historyPage = 1, quoteTimer, pollTimer;
    let returnBill = new URLSearchParams(location.search).get('bill');
    const owner = () => String(getUser()?.MaNguoiDung || '');
    const allowed = () => active && getUser()?.VaiTro === 1;
    const editorDialog = setupEmployeeDialog($('counter-editor'), { closeButton: $('counter-close-editor'), fallback: $('counter-new'), canClose: () => !busy && !submitted,
        onClose: () => { quoteVersion++; catalogVersion++; clearTimeout(quoteTimer); cancelProductSearch(); } });
    const billDialog = setupEmployeeDialog($('counter-bill'), { closeButton: $('counter-bill-close'), fallback: $('counter-new'), canClose: () => !busy,
        onClose: () => { billVersion++; clearTimeout(pollTimer); } });
    function setState(text) { for (const id of ['counter-state', 'counter-editor-state', 'counter-bill-state']) $(id).textContent = text; }
    function fail(error, target = 'counter-state') {
        if (target === 'counter-state') setState(message(error)); else $(target).textContent = message(error);
        if (['UNAUTHENTICATED', 'SESSION_CHANGED', 'FORBIDDEN', 'ACCOUNT_LOCKED'].includes(error.code)) onSessionError();
    }
    function lockDraft(locked) {
        for (const field of $('counter-editor').querySelectorAll('input,select,button')) field.disabled = locked;
        $('counter-new').disabled = busy || Boolean(submitted);
    }
    function renderCustomer() {
        if (!customer) return;
        const state = $('counter-customer-state'), balance = node('span', `(${new Intl.NumberFormat('vi-VN').format(BigInt(customer.SoXu))} `, 'counter-customer-balance');
        balance.id = 'counter-balance'; balance.append(rewardCoin(), document.createTextNode(')'));
        state.replaceChildren(node('strong', customer.exists ? customer.HoTen : 'Khách hàng mới'), document.createTextNode(' '), balance);
        if (!customer.exists) state.append(node('span', 'Nhập tên để tạo tài khoản khi hoàn tất đơn.', 'counter-customer-help'));
        const unavailable = BigInt(customer.SoXu) <= 0n;
        $('counter-coins-field').hidden = unavailable;
        $('counter-coins').disabled = unavailable || busy || Boolean(submitted);
        if (unavailable) $('counter-coins').checked = false;
    }
    function renderLines() {
        const focused = document.activeElement?.dataset.basketQuantity;
        const focusedUnit = document.activeElement?.dataset.basketUnit ? document.activeElement.value : null;
        $('counter-lines').replaceChildren();
        for (const line of lines) {
            const priced = quote?.items.find(value => value.MaDonGia === line.MaDonGia);
            const row = node('li'), visual = node('div', 'Chưa có ảnh', 'employee-product-image'), content = node('div', undefined, 'counter-line-content');
            if (validHttps(line.HinhAnh)) { const image = node('img'); image.src = line.HinhAnh; image.alt = line.TenThuoc; image.width = 52; image.height = 60; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => visual.replaceChildren(document.createTextNode('Chưa có ảnh')), { once: true }); visual.replaceChildren(image); }
            content.append(node('strong', line.TenThuoc, 'counter-line-name'));
            const base = priced?.GiaGoc ?? line.GiaBan, price = priced?.GiaBan ?? line.GiaKhuyenMai ?? line.GiaBan;
            const prices = node('div', undefined, 'counter-line-prices');
            if (BigInt(price) < BigInt(base)) prices.append(node('del', money(base), 'counter-original-price'));
            prices.append(node('strong', money(price), 'counter-sale-price')); content.append(prices);
            const controls = node('div', undefined, 'counter-line-controls'), quantityField = node('div'), unitField = node('div');
            const quantity = node('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = '2147483647'; quantity.value = String(line.SoLuong); quantity.dataset.basketQuantity = line.MaDonGia; quantity.id = `counter-quantity-${line.MaDonGia}`;
            const quantityLabel = node('label', 'Số lượng'); quantityLabel.htmlFor = quantity.id; quantityField.append(quantityLabel, quantity);
            quantity.addEventListener('change', () => { if (!Number.isSafeInteger(quantity.valueAsNumber) || quantity.valueAsNumber < 1 || quantity.valueAsNumber > 2147483647) { quantity.value = String(line.SoLuong); return; } line.SoLuong = quantity.valueAsNumber; requestQuote(); });
            const units = node('select'); units.id = `counter-basket-unit-${line.MaDonGia}`; units.dataset.basketUnit = line.MaDonGia; const unitLabel = node('label', 'Đơn vị tính'); unitLabel.htmlFor = units.id;
            for (const unit of line.DonViGia) { const option = node('option', unit.DonViTinh); option.value = unit.MaDonGia; units.append(option); } units.value = String(line.MaDonGia); unitField.append(unitLabel, units);
            units.addEventListener('change', () => {
                const unit = line.DonViGia.find(value => String(value.MaDonGia) === units.value); if (!unit) return;
                const existing = lines.find(value => value !== line && value.MaDonGia === unit.MaDonGia);
                if (existing) { existing.SoLuong += line.SoLuong; lines = lines.filter(value => value !== line); } else Object.assign(line, unit);
                requestQuote();
            });
            const remove = node('button', 'Bỏ', 'quiet-link'); remove.type = 'button'; remove.setAttribute('aria-label', `Bỏ ${line.TenThuoc}`); remove.addEventListener('click', () => { lines = lines.filter(value => value !== line); requestQuote(); });
            controls.append(quantityField, unitField, remove); content.append(controls);
            const total = priced ? priced.ThanhTien : BigInt(price) * BigInt(line.SoLuong);
            content.append(node('p', `${priced ? 'Thành tiền' : 'Thành tiền tạm tính'}: ${money(total)}`, 'counter-line-total'));
            if (priced?.SoLuongKhuyenMai > 0 && priced.SoLuongKhuyenMai < line.SoLuong) content.append(node('p', `Khuyến mãi áp dụng ${priced.SoLuongKhuyenMai}/${line.SoLuong} ${line.DonViTinh}.`, 'field-help'));
            row.append(visual, content); $('counter-lines').append(row);
        }
        if (!lines.length) $('counter-lines').append(node('li', 'Chọn thuốc bên phải để thêm vào đơn.', 'field-help'));
        if (focused) $('counter-lines').querySelector(`[data-basket-quantity="${focused}"]`)?.focus();
        else if (focusedUnit) $('counter-lines').querySelector(`[data-basket-unit="${focusedUnit}"]`)?.focus();
    }
    function renderTotals() {
        $('counter-totals').replaceChildren();
        let redeemable = 0n;
        if (quote) {
            const beforeCoins = BigInt(quote.TongThanhToan) + BigInt(quote.XuSuDung) * 10n;
            const balance = customer ? BigInt(customer.SoXu) : 0n;
            redeemable = balance < beforeCoins / 10n ? balance : beforeCoins / 10n;
            for (const [label, value] of [['Tiền hàng', quote.TongTien], ['Giảm giá / đổi xu', String(BigInt(quote.TongTien) - BigInt(quote.TongThanhToan))], ['Tổng thanh toán', quote.TongThanhToan]]) { const row = node('div'); row.append(node('dt', label), node('dd', money(value))); $('counter-totals').append(row); }
        }
        $('counter-coins-amount').replaceChildren(document.createTextNode(`(-${new Intl.NumberFormat('vi-VN').format(redeemable)} `), rewardCoin(), document.createTextNode(')'));
        $('counter-coins').disabled = busy || Boolean(submitted) || !quote || redeemable <= 0n;
        $('counter-finish').disabled = busy || !customer || !quote || !lines.length;
    }
    function payload() { return { SDT: customer?.SDT || '', DoiDiem: Boolean(customer) && $('counter-coins').checked, items: lines.map(({ MaThuoc, MaDonGia, SoLuong }) => ({ MaThuoc, MaDonGia, SoLuong })) }; }
    function requestQuote() {
        clearTimeout(quoteTimer); const attempt = ++quoteVersion, account = owner(), run = epoch;
        quote = null; renderLines(); renderTotals();
        if (!lines.length || submitted) return;
        quoteTimer = setTimeout(async () => {
            try {
                const data = await quoteCounterOrder(payload(), account);
                if (attempt !== quoteVersion || run !== epoch || account !== owner() || !allowed()) return;
                if (customer) { customer.SoXu = data.SoXu; renderCustomer(); }
                else $('counter-coins-field').hidden = true;
                if ($('counter-coins').checked && data.XuSuDung === 0) { $('counter-coins').checked = false; requestQuote(); return; }
                quote = data; renderLines(); renderTotals(); setState('');
            } catch (error) { if (attempt === quoteVersion && run === epoch) fail(error); }
        }, 200);
    }
    async function loadProducts() {
        if (!allowed() || $('counter-editor').hidden) return;
        const attempt = ++catalogVersion, run = epoch;
        $('counter-catalog-state').textContent = 'Đang tải thuốc…';
        try {
            const data = await getCounterProducts({ search: $('counter-product-search').value.trim(), category_id: $('counter-category').value || undefined, page: productPage, per_page: 12 });
            if (attempt !== catalogVersion || run !== epoch || !allowed() || busy || submitted) return;
            $('counter-products').replaceChildren(); $('counter-catalog-state').textContent = data.total ? `${data.total} sản phẩm phù hợp` : 'Không tìm thấy thuốc phù hợp.';
            for (const product of data.items) {
                const card = node('article', undefined, 'counter-product'), visual = node('div', 'Chưa có ảnh', 'counter-product-visual');
                if (validHttps(product.HinhAnh)) { const img = node('img'); img.src = product.HinhAnh; img.alt = product.TenThuoc; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.addEventListener('error', () => visual.replaceChildren(document.createTextNode('Chưa có ảnh')), { once: true }); visual.replaceChildren(img); }
                const description = node('div', undefined, 'counter-product-description'); description.append(node('h4', product.TenThuoc), node('p', `Mã vạch: ${product.MaVach || 'Chưa có'}`, 'field-help'));
                const units = node('select'); units.setAttribute('aria-label', `Đơn vị ${product.TenThuoc}`);
                const available = product.DonViGia.filter(unit => unit.ConHang && BigInt(unit.GiaBan) >= 0n);
                for (const unit of available) { const option = node('option', unit.DonViTinh); option.value = String(unit.MaDonGia); units.append(option); }
                const unitField = node('div', undefined, 'counter-product-unit'), unitLabel = node('label', 'Đơn vị tính'); units.id = `counter-unit-${product.MaThuoc}`; unitLabel.htmlFor = units.id; unitField.append(unitLabel, units); units.disabled = !available.length;
                const prices = node('div', undefined, 'counter-product-prices');
                function renderPrice() {
                    prices.replaceChildren(); const unit = available.find(value => String(value.MaDonGia) === units.value);
                    if (!unit) { prices.append(node('span', 'Hết hàng', 'field-help')); return; }
                    const discounted = unit.GiaKhuyenMai !== null && unit.GiaKhuyenMai !== undefined && BigInt(unit.GiaKhuyenMai) < BigInt(unit.GiaBan);
                    if (discounted) prices.append(node('del', money(unit.GiaBan), 'counter-original-price'));
                    prices.append(node('strong', money(discounted ? unit.GiaKhuyenMai : unit.GiaBan), 'counter-sale-price'));
                    if (discounted) prices.append(node('small', unit.KhuyenMai?.TenChuongTrinh || 'Khuyến mãi', 'counter-promotion-label'));
                }
                units.addEventListener('change', renderPrice); renderPrice();
                const add = node('button', 'Thêm', 'button button-outline'); add.type = 'button'; add.disabled = !available.length || Boolean(submitted); add.setAttribute('aria-label', `Thêm ${product.TenThuoc}`);
                add.addEventListener('click', () => { if (busy || submitted) return; const unit = available.find(value => String(value.MaDonGia) === units.value); if (!unit) return; const existing = lines.find(value => value.MaDonGia === unit.MaDonGia); if (existing) existing.SoLuong++; else if (lines.length < 100) lines.push({ ...unit, MaThuoc: product.MaThuoc, SoLuong: 1, TenThuoc: product.TenThuoc, HinhAnh: product.HinhAnh, DonViGia: available }); requestQuote(); });
                card.append(visual, description, unitField, prices, add); $('counter-products').append(card);
            }
            $('counter-products-page').textContent = `Trang ${productPage}`; $('counter-products-prev').disabled = productPage <= 1; $('counter-products-next').disabled = productPage * 12 >= data.total;
        } catch (error) { if (attempt === catalogVersion && run === epoch) fail(error, 'counter-catalog-state'); }
    }
    async function loadHistory() {
        if (!allowed()) return;
        const attempt = ++historyVersion, run = epoch;
        try {
            const [history, pending] = await Promise.all([getCompletedEmployeeOrders($('counter-history-search').value.trim(), historyPage), getPendingCounterOrders()]);
            if (attempt !== historyVersion || run !== epoch || !allowed()) return;
            for (const [target, items] of [['counter-history', history.items], ['counter-pending', pending.items]]) {
                $(target).replaceChildren();
                for (const order of items) {
                    const row = node('button', undefined, 'counter-history-row'); row.type = 'button'; row.dataset.counterOrder = order.MaDonHang;
                    row.append(node('strong', `#${order.MaDonHang}`), node('span', `${order.KhachHang?.HoTen || ''} · ${order.KhachHang?.SDT || ''}`), node('time', dateText(order.NgayDat)), node('strong', money(order.TongThanhToan)), node('span', order.TrangThaiThanhToan === 1 ? 'Đã thanh toán' : 'Chờ thanh toán QR'));
                    row.addEventListener('click', () => openBill(order.MaDonHang)); $(target).append(row);
                }
                if (!items.length && target === 'counter-history') $(target).append(node('p', 'Không có đơn hoàn tất phù hợp.', 'field-help'));
            }
            $('counter-pending-section').hidden = !pending.items.length;
            $('counter-history-page').textContent = `Trang ${historyPage} · ${history.total} đơn`; $('counter-history-prev').disabled = historyPage <= 1; $('counter-history-next').disabled = historyPage * 20 >= history.total;
        } catch (error) { if (attempt === historyVersion && run === epoch) fail(error); }
    }
    function renderBill(value) {
        bill = value; $('counter-bill-title').textContent = `Đơn hàng #${value.MaDonHang}`;
        const content = $('counter-bill-content'); content.replaceChildren();
        const info = node('div', undefined, 'employee-order-info'), badge = node('span', value.TrangThaiDonHang === 3 ? 'Đã hoàn tất' : value.TrangThaiDonHang === 4 ? 'Đã hủy' : 'Chờ hoàn tất', 'employee-order-badge'); badge.dataset.status = value.TrangThaiDonHang;
        info.append(badge, node('p', `Đặt lúc ${dateText(value.NgayDat)}`, 'employee-order-placed'), node('h4', value.KhachHang?.HoTen || 'Khách hàng'), node('p', value.KhachHang?.SDT || ''), node('p', value.GhiChu || '', 'employee-order-note')); content.append(info, node('h4', 'Sản phẩm trong đơn', 'employee-products-heading'));
        const products = node('ul', undefined, 'counter-bill-lines');
        for (const item of value.items) {
            const row = node('li'), visual = node('div', 'Chưa có ảnh', 'employee-product-image');
            if (validHttps(item.HinhAnh)) { const image = node('img'); image.src = item.HinhAnh; image.alt = item.TenThuoc; image.width = 72; image.height = 80; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'; image.addEventListener('error', () => visual.replaceChildren(document.createTextNode('Chưa có ảnh')), { once: true }); visual.replaceChildren(image); }
            const description = node('div', undefined, 'employee-product-description'); description.append(node('strong', item.TenThuoc), node('span', `${item.SoLuong} ${item.DonViTinh} × ${money(item.DonGia)}`), node('span', `Mã vạch: ${item.MaVach || 'Chưa có'}`, 'employee-product-barcode'));
            row.append(visual, description, node('strong', money(item.ThanhTien), 'employee-line-total')); products.append(row);
        } content.append(products);
        $('counter-bill-totals').replaceChildren();
        for (const [title, amount] of [['Tiền hàng', value.TongTien], ['Giảm giá / đổi xu', value.TienGiamGia], ['Tổng thanh toán', value.TongThanhToan]]) { const row = node('div'); row.append(node('dt', title), node('dd', money(amount))); $('counter-bill-totals').append(row); }
        $('counter-bill-payment').textContent = `${value.PhuongThucThanhToan === 1 ? 'QR / SePay' : value.KenhDatHang ? 'Tiền mặt' : 'COD'} · ${value.TrangThaiThanhToan === 1 ? 'Đã thanh toán' : 'Chưa thanh toán'}`;
        $('counter-bill-rewards').replaceChildren();
        if (value.TrangThaiDonHang === 3 && value.XuDaCong && BigInt(value.XuDaCong) > 0n) { const earned = node('p', `Đã cộng ${value.XuDaCong} `, 'employee-earned-points'); earned.append(rewardCoin(), document.createTextNode(' vào tài khoản khách hàng.')); $('counter-bill-rewards').append(earned); }
        $('counter-print').hidden = !value.CanPrint;
        $('counter-pay').hidden = !(value.KenhDatHang && value.TrangThaiDonHang === 0 && value.TrangThaiThanhToan === 0);
        $('counter-payment-check').hidden = !(value.KenhDatHang && [0, 1].includes(value.TrangThaiDonHang));
        billDialog.open();
        clearTimeout(pollTimer); if (!$('counter-payment-check').hidden && allowed()) pollTimer = setTimeout(() => openBill(value.MaDonHang, false), 5000);
    }
    async function openBill(id, focus = true) {
        if (!allowed() || busy) return;
        const attempt = ++billVersion, run = epoch, account = owner();
        try {
            let data = await getCounterOrder(id);
            if (attempt !== billVersion || run !== epoch || !allowed()) return;
            if (data.order.KenhDatHang && data.order.TrangThaiDonHang === 1 && data.order.TrangThaiThanhToan === 1) {
                data = await completeCounterOrder(id, account);
                if (attempt !== billVersion || run !== epoch || !allowed()) return;
                window.dispatchEvent(new Event('employee-orders-changed')); loadHistory();
            }
            renderBill(data.order); if (focus) $('counter-bill-title').focus();
        } catch (error) { if (run === epoch && attempt === billVersion) { fail(error); clearTimeout(pollTimer); if (allowed()) pollTimer = setTimeout(() => openBill(id, false), 10000); } }
    }
    $('counter-new').addEventListener('click', async () => {
        if (!allowed() || busy || submitted) return;
        billVersion++; clearTimeout(pollTimer); billDialog.close(true); bill = null; quoteVersion++; customer = quote = null; lines = []; requestId = crypto.randomUUID();
        productPage = 1; $('counter-product-search').value = ''; $('counter-category').value = '';
        $('counter-phone').value = $('counter-name').value = ''; $('counter-coins').checked = false; $('counter-name-field').hidden = $('counter-coins-field').hidden = true;
        $('counter-customer-state').textContent = ''; setState(''); lockDraft(false); renderLines(); renderTotals(); editorDialog.open($('counter-phone')); loadProducts();
        const run = epoch;
        try { const data = await getPublicCategories({ per_page: 100 }); if (run !== epoch || !allowed()) return; $('counter-category').replaceChildren(node('option', 'Tất cả loại thuốc')); $('counter-category').firstChild.value = ''; for (const category of data.items) { const option = node('option', category.TenLoaiThuoc); option.value = category.MaLoaiThuoc; $('counter-category').append(option); } } catch (error) { if (run === epoch) fail(error, 'counter-catalog-state'); }
    });
    $('counter-phone').addEventListener('input', () => { customer = null; $('counter-coins').checked = false; $('counter-coins-field').hidden = $('counter-name-field').hidden = true; $('counter-customer-state').textContent = 'Bấm Kiểm tra để xác nhận SĐT.'; requestQuote(); });
    $('counter-customer-form').addEventListener('submit', async event => {
        event.preventDefault(); if (!allowed() || busy || checking || submitted) return;
        const phone = $('counter-phone').value, run = epoch; checking = true; $('counter-check').disabled = true;
        try {
            const data = await getCounterCustomer(phone);
            if (run !== epoch || phone !== $('counter-phone').value || !allowed()) return;
            customer = data; $('counter-name-field').hidden = data.exists; renderCustomer(); requestQuote();
        } catch (error) { if (run === epoch && phone === $('counter-phone').value) fail(error, 'counter-customer-state'); }
        finally { if (run === epoch) { checking = false; $('counter-check').disabled = false; } }
    });
    $('counter-coins').addEventListener('change', requestQuote);
    $('counter-payment').addEventListener('change', () => { $('counter-cash-note').textContent = $('counter-payment').value === '0' ? 'Chỉ hoàn thành sau khi đã thu đủ tiền mặt.' : 'Đơn QR chỉ hoàn tất và cộng xu sau khi SePay xác nhận đã thanh toán.'; });
    $('counter-finish').addEventListener('click', async () => {
        if (!allowed() || busy || !customer || !quote) return;
        if (!customer.exists && !$('counter-name').value.trim()) { setState('Nhập tên khách hàng mới.'); $('counter-name').focus(); return; }
        const run = epoch, account = owner();
        submitted ||= { ...payload(), HoTen: $('counter-name').value.trim(), PhuongThucThanhToan: Number($('counter-payment').value), TongThanhToan: quote.TongThanhToan, request_id: requestId };
        busy = true; lockDraft(true); setState('Đang tạo đơn…');
        try {
            const data = await createCounterOrder(submitted, account);
            if (run !== epoch || account !== owner()) return;
            submitted = null; customer = quote = null; lines = []; editorDialog.close(true); setState(data.order.TrangThaiDonHang === 3 ? 'Đã hoàn tất đơn hàng.' : 'Đã tạo đơn chờ thanh toán QR. Mở QR để khách thanh toán.');
            if (allowed()) { renderBill(data.order); $('counter-bill-title').focus(); loadHistory(); } else bill = data.order;
            window.dispatchEvent(new Event('employee-orders-changed'));
        } catch (error) {
            if (run !== epoch) return;
            fail(error);
            if (!['CONNECTION_FAILED', 'INVALID_RESPONSE', 'SESSION_CHANGED', 'UNAUTHENTICATED'].includes(error.code)) { submitted = null; lockDraft(false); if (error.code === 'QUOTE_CHANGED' || error.code === 'POINTS_UNAVAILABLE') requestQuote(); }
        } finally { if (run === epoch) { busy = false; $('counter-new').disabled = Boolean(submitted); $('counter-finish').disabled = !quote; } }
    });
    $('counter-pay').addEventListener('click', async () => { if (!bill || busy || !allowed()) return; const selected = bill, run = epoch; busy = true; $('counter-pay').disabled = true; try { const data = await payCounterOrder(selected.MaDonHang, owner()); if (run === epoch && allowed()) { submitCheckout(data.payment, selected, true); setState('Thanh toán QR mở trong tab mới. Trang này sẽ tự cập nhật khi nhận xác nhận.'); } } catch (error) { if (run === epoch) fail(error); } finally { if (run === epoch) { busy = false; $('counter-pay').disabled = false; } } });
    $('counter-print').addEventListener('click', async () => { if (!bill || busy || !allowed()) return; const id = bill.MaDonHang, run = epoch; busy = true; try { const data = await getCounterOrder(id); if (run !== epoch || !allowed()) return; if (!data.order.CanPrint) throw { code: 'ORDER_NOT_PAYABLE' }; printEmployeeInvoice(data.order, getUser()); } catch (error) { if (run === epoch) fail(error); } finally { if (run === epoch) busy = false; } });
    $('counter-payment-check').addEventListener('click', () => { if (bill) openBill(bill.MaDonHang, false); });
    const cancelProductSearch = setupLiveSearch({ input: $('counter-product-search'), filters: [$('counter-category')],
        isActive: () => allowed() && !$('counter-editor').hidden && !busy && !submitted,
        onSearch: () => { productPage = 1; loadProducts(); } });
    const cancelHistorySearch = setupLiveSearch({ input: $('counter-history-search'), isActive: () => allowed() && !busy,
        onSearch: () => { historyPage = 1; loadHistory(); } });
    $('counter-products-prev').addEventListener('click', () => { if (productPage > 1) { productPage--; loadProducts(); } });
    $('counter-products-next').addEventListener('click', () => { productPage++; loadProducts(); });
    $('counter-history-prev').addEventListener('click', () => { if (historyPage > 1) { historyPage--; loadHistory(); } });
    $('counter-history-next').addEventListener('click', () => { historyPage++; loadHistory(); });
    $('counter-refresh').addEventListener('click', loadHistory);
    return {
        activate() {
            active = true; loadHistory();
            if (submitted && !$('counter-editor').open) editorDialog.open($('counter-finish'));
            if (returnBill && /^[1-9][0-9]{0,18}$/.test(returnBill)) { const id = returnBill; returnBill = null; const url = new URL(location.href); url.searchParams.delete('bill'); history.replaceState(null, '', url); openBill(id); }
            else if ($('counter-bill').open && bill && [0, 1].includes(bill.TrangThaiDonHang)) openBill(bill.MaDonHang, false);
            if ($('counter-editor').open && !submitted) { loadProducts(); requestQuote(); }
        },
        deactivate() { active = false; editorDialog.close(true); billDialog.close(true); cancelProductSearch(); cancelHistorySearch(); for (const timer of [quoteTimer, pollTimer]) clearTimeout(timer); },
        clear() {
            epoch++; quoteVersion++; catalogVersion++; historyVersion++; billVersion++;
            editorDialog.close(true); billDialog.close(true); active = busy = checking = false;
            customer = quote = bill = submitted = null; lines = []; productPage = historyPage = 1;
            cancelProductSearch(); cancelHistorySearch(); for (const timer of [quoteTimer, pollTimer]) clearTimeout(timer);
            for (const id of ['counter-history', 'counter-pending', 'counter-bill-content', 'counter-bill-totals', 'counter-bill-rewards', 'counter-lines', 'counter-products', 'counter-totals']) $(id).replaceChildren();
            for (const id of ['counter-phone', 'counter-name', 'counter-history-search', 'counter-product-search']) $(id).value = '';
            setState(''); $('counter-customer-state').textContent = $('counter-bill-payment').textContent = '';
            $('counter-pending-section').hidden = true; $('counter-new').disabled = false;
        },
        isBusy: () => busy
    };
}
