import { readChat, writeChat } from '../api/chat.js';
import { getCounterProducts } from '../api/employee-orders.js';
import { node, chatError, sessionFailed, renderChatMessage, createChatComposer, chatIcon } from '../components/chat.js';
import { setupLiveSearch } from '../utils/live-search.js';
import { setupEmployeeDialog } from '../components/employee-dialog.js';
import { money } from '../components/cart.js';
import { validHttps } from '../utils/product-validation.js';

function productImage(url, className = 'chat-offer-image') {
    const visual = node('div', 'Chưa có ảnh', className);
    if (validHttps(url)) {
        const image = node('img'); image.src = url; image.alt = ''; image.width = 72; image.height = 80; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => visual.replaceChildren(node('span', 'Chưa có ảnh')), { once: true }); visual.replaceChildren(image);
    }
    return visual;
}

export function setupEmployeeChat({ getUser, onSessionError }) {
    const root = document.querySelector('#employee-messages .employee-message-layout'); root.replaceChildren();
    root.dataset.chatOpen = 'false';
    const sidebar = node('aside', undefined, 'employee-chat-queue'), main = node('div', undefined, 'employee-chat-main');
    const searchLabel = node('label', 'Tìm tên hoặc số điện thoại'), search = node('input'); search.id = 'employee-chat-search'; search.type = 'search'; search.maxLength = 100; searchLabel.htmlFor = search.id;
    const list = node('div', undefined, 'employee-chat-threads'), queueState = node('p'); queueState.setAttribute('role', 'status');
    const pages = node('nav', undefined, 'chat-card-actions'); pages.setAttribute('aria-label', 'Phân trang hội thoại');
    const prev = node('button', 'Trang trước', 'quiet-link'), next = node('button', 'Trang sau', 'quiet-link'), pageText = node('span'); prev.type = next.type = 'button'; pages.append(prev, pageText, next);
    sidebar.append(node('h2', 'Hội thoại'), searchLabel, search, queueState, list, pages);
    const header = node('header', undefined, 'employee-chat-heading'), title = node('h2', 'Chọn hội thoại để tư vấn'), claim = node('button', 'Tiếp nhận', 'button button-primary'), finish = node('button', 'Kết thúc tư vấn', 'button button-outline'); claim.type = finish.type = 'button'; claim.hidden = finish.hidden = true;
    const back = node('button', 'Hội thoại', 'quiet-link employee-chat-back'); back.type = 'button'; back.setAttribute('aria-label', 'Trở về danh sách hội thoại');
    title.tabIndex = -1;
    header.append(back, title, claim, finish);
    const state = node('p'); state.setAttribute('role', 'status');
    const retry = node('button', 'Làm mới hội thoại', 'quiet-link'); retry.type = 'button';
    const older = node('button', 'Xem tin nhắn cũ', 'quiet-link'); older.type = 'button'; older.hidden = true;
    const log = node('div', undefined, 'chat-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-label', 'Nội dung tư vấn'); log.setAttribute('aria-live', 'off'); log.tabIndex = 0;
    let active = false, version = 0, selectionVersion = 0, timer, page = 1, selected, busy = false, messageLoading = false, queueLoading = false;
    const history = new Map(), owner = () => String(getUser()?.MaNguoiDung || ''), allowed = () => active && getUser()?.VaiTro === 1;
    const context = () => selected ? { messages: `/threads/${selected.id}/messages`, images: `/threads/${selected.id}/images` } : null;
    const composer = createChatComposer({ getOwner: owner, getContext: context, onSent: () => loadMessages(), onError: fail, employee: true });
    const offerButton = node('button', undefined, 'chat-tool-button'); offerButton.type = 'button'; offerButton.setAttribute('aria-label', 'Thêm sản phẩm tư vấn'); offerButton.setAttribute('aria-haspopup', 'dialog'); offerButton.setAttribute('aria-controls', 'chat-offer-dialog'); offerButton.title = 'Thêm sản phẩm tư vấn'; offerButton.append(chatIcon('product')); composer.tools.append(offerButton);
    const picker = node('dialog', undefined, 'employee-modal chat-offer-dialog'), pickerTitle = node('h2', 'Gửi sản phẩm cho khách hàng');
    picker.id = 'chat-offer-dialog'; picker.setAttribute('aria-labelledby', 'chat-offer-title'); pickerTitle.id = 'chat-offer-title'; pickerTitle.tabIndex = -1;
    const pickerHeader = node('header', undefined, 'employee-modal-heading'), pickerClose = node('button', '×', 'employee-modal-close'); pickerClose.type = 'button'; pickerClose.setAttribute('aria-label', 'Đóng danh sách sản phẩm'); pickerHeader.append(pickerTitle, pickerClose);
    const pickerDialog = setupEmployeeDialog(picker, { closeButton: pickerClose, fallback: offerButton, canClose: () => !busy });
    const productLabel = node('label', 'Tìm sản phẩm theo tên hoặc mã vạch'), productSearch = node('input'); productSearch.id = 'chat-offer-search'; productSearch.type = 'search'; productSearch.maxLength = 255; productLabel.htmlFor = productSearch.id;
    const productState = node('p'); productState.setAttribute('role', 'status');
    const products = node('div', undefined, 'chat-offer-products'), basket = node('ul', undefined, 'chat-offer-basket');
    const sendOffer = node('button', 'Gửi thẻ sản phẩm', 'button button-primary'); sendOffer.type = 'button';
    const productPrev = node('button', 'Trang trước', 'quiet-link'), productNext = node('button', 'Trang sau', 'quiet-link'); productPrev.type = productNext.type = 'button';
    const productPages = node('div', undefined, 'chat-card-actions'); productPages.append(productPrev, productNext);
    const pickerIntro = node('p', 'Chọn sản phẩm, đơn vị và số lượng để gửi cho khách. Hệ thống sẽ kiểm tra lại tồn kho trước khi gửi.', 'chat-offer-intro');
    const pickerLayout = node('div', undefined, 'chat-offer-layout'), catalog = node('section', undefined, 'chat-offer-catalog'), selection = node('aside', undefined, 'chat-offer-selection');
    catalog.setAttribute('aria-label', 'Tìm và chọn sản phẩm'); selection.setAttribute('aria-label', 'Sản phẩm đã chọn');
    const selectionHeading = node('div', undefined, 'chat-offer-selection-heading'), basketCount = node('span', '0 mục'); selectionHeading.append(node('h3', 'Đã chọn'), basketCount);
    const basketSummary = node('dl', undefined, 'chat-offer-summary'), basketTotal = node('dd', money('0')); basketSummary.append(node('dt', 'Tổng tạm tính'), basketTotal);
    catalog.append(productLabel, productSearch, productState, products, productPages);
    selection.append(selectionHeading, basket, basketSummary, node('p', 'Giá và tồn kho được kiểm tra lại khi khách mua.', 'chat-help'), sendOffer);
    pickerLayout.append(catalog, selection); picker.append(pickerHeader, pickerIntro, pickerLayout); picker.hidden = true;
    const toolbar = node('div', undefined, 'employee-chat-toolbar'); toolbar.append(state, retry, older);
    main.append(header, toolbar, log, composer.element, picker); root.append(sidebar, main);
    let productPage = 1, productVersion = 0, offerRequest; const offerItems = new Map();
    renderBasket();
    function fail(error) {
        state.textContent = chatError(error);
        if (sessionFailed(error)) onSessionError();
        else if (error.code === 'CHAT_NOT_FOUND') clearSelection();
    }
    function schedule() { clearTimeout(timer); if (allowed()) timer = setTimeout(async () => { if (!document.hidden) { await loadQueue(); if (selected) await loadMessages(); } schedule(); }, 5000); }
    function updateActions() {
        const assigned = selected?.status === 1 && selected.assigned === owner();
        root.dataset.chatOpen = selected ? 'true' : 'false';
        claim.hidden = !selected || assigned; finish.hidden = !assigned; claim.disabled = finish.disabled = busy;
        composer.setEnabled(!!assigned); offerButton.hidden = !assigned; offerButton.disabled = busy;
        if (!assigned) pickerDialog.close(true);
    }
    function clearSelection() {
        selectionVersion++; productVersion++; messageLoading = false; selected = null; history.clear(); log.replaceChildren(); title.textContent = 'Chọn hội thoại để tư vấn';
        composer.clear(); pickerDialog.close(true); offerItems.clear(); offerRequest = null; renderBasket(); products.replaceChildren(); older.hidden = true; updateActions();
    }
    async function loadQueue() {
        if (!allowed() || queueLoading) return;
        queueLoading = true; const attempt = version;
        try {
            const data = await readChat(`/threads?${new URLSearchParams({ search: search.value.trim(), page: String(page) })}`);
            if (attempt !== version || !allowed()) return;
            list.replaceChildren(); queueState.textContent = data.total ? `${data.total} hội thoại chờ tiếp nhận hoặc đang phụ trách` : 'Không có hội thoại phù hợp.';
            for (const value of data.items) {
                const button = node('button', undefined, 'employee-chat-thread'); button.type = 'button'; button.setAttribute('aria-pressed', String(selected?.id === value.id));
                button.append(node('strong', value.customer.HoTen), node('span', value.customer.SDT), node('small', value.status === 0 ? 'Chờ tiếp nhận' : 'Bạn đang tư vấn'));
                button.addEventListener('click', () => { if (busy) return; clearSelection(); selected = value; title.textContent = `${value.customer.HoTen} · ${value.customer.SDT}`; for (const entry of list.children) entry.setAttribute('aria-pressed', String(entry === button)); updateActions(); title.focus(); loadMessages(); }); list.append(button);
            }
            prev.disabled = page <= 1; next.disabled = page * data.per_page >= data.total; pageText.textContent = `Trang ${page}`;
        } catch (error) { if (attempt === version) { queueState.textContent = chatError(error); if (sessionFailed(error)) onSessionError(); } }
        finally { if (attempt === version) queueLoading = false; }
    }
    async function loadMessages(before) {
        if (!allowed() || !selected || messageLoading) return;
        messageLoading = true; const attempt = selectionVersion, id = selected.id;
        try {
            const data = await readChat(`/threads/${id}/messages${before ? `?before=${before}` : ''}`);
            if (attempt !== selectionVersion || !allowed()) return;
            selected = { ...selected, ...data.thread }; updateActions();
            const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80, height = log.scrollHeight, top = log.scrollTop;
            const lastKnown = [...history.keys()].reduce((last, id) => BigInt(id) > BigInt(last) ? id : last, '0');
            if (!before && data.has_more && data.items.length && lastKnown !== '0' && BigInt(data.items[0].id) > BigInt(lastKnown)) history.clear();
            for (const value of data.items) history.set(value.id, value);
            if (before || history.size <= 50) older.hidden = !data.has_more;
            const items = [...history.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
            log.replaceChildren(...items.map(value => renderChatMessage(value)));
            log.scrollTop = before ? top + log.scrollHeight - height : nearBottom ? log.scrollHeight : top;
            state.textContent = selected.status === 0 ? 'Tiếp nhận để trả lời. Các nhân viên khác sẽ không còn truy cập hội thoại này.' : 'Bạn đang tư vấn cho khách hàng.';
            if (items.length && data.items.some(item => item.role === 0 && !item.read) && document.hasFocus() && !document.hidden) await writeChat(`/threads/${id}/read`, { last_id: items.at(-1).id }, owner());
        } catch (error) { if (attempt === selectionVersion) fail(error); }
        finally { if (attempt === selectionVersion) messageLoading = false; }
    }
    async function action(ending) {
        if (!selected || busy || !allowed()) return;
        const attempt = selectionVersion, id = selected.id; busy = true; updateActions();
        try {
            const result = await writeChat(`/threads/${id}/${ending ? 'finish' : 'claim'}`, {}, owner());
            if (attempt !== selectionVersion || !allowed()) return;
            window.dispatchEvent(new Event('employee-chats-changed'));
            if (ending) { clearSelection(); state.textContent = 'Đã kết thúc tư vấn. Khách hàng vẫn xem được lịch sử.'; }
            else { selected = { ...selected, ...result.thread }; updateActions(); await loadMessages(); }
            loadQueue();
        } catch (error) { if (attempt === selectionVersion) fail(error); }
        finally { busy = false; updateActions(); }
    }
    function renderBasket() {
        basket.replaceChildren();
        for (const [key, value] of offerItems) {
            const line = node('li'), description = node('div'), remove = node('button', 'Bỏ', 'quiet-link'); remove.type = 'button'; remove.setAttribute('aria-label', `Bỏ ${value.TenThuoc}, ${value.DonViTinh}`);
            description.append(node('strong', value.TenThuoc), node('p', `${value.SoLuong} ${value.DonViTinh}`), node('strong', money(value.ThanhTien), 'chat-offer-selected-price'));
            remove.addEventListener('click', () => { if (offerRequest || busy) return; offerItems.delete(key); renderBasket(); }); line.append(productImage(value.HinhAnh, 'chat-offer-selected-image'), description, remove); basket.append(line);
        }
        if (!offerItems.size) basket.append(node('li', 'Chưa chọn sản phẩm. Chọn trong danh sách để thêm vào thẻ tư vấn.', 'chat-offer-empty'));
        basketCount.textContent = `${offerItems.size} mục`;
        basketTotal.textContent = money([...offerItems.values()].reduce((sum, item) => sum + BigInt(item.ThanhTien), 0n));
        sendOffer.disabled = busy || !offerItems.size;
    }
    async function loadProducts() {
        if (!allowed() || !selected || picker.hidden) return;
        const attempt = ++productVersion, selection = selectionVersion;
        products.setAttribute('aria-busy', 'true'); productState.textContent = 'Đang tìm sản phẩm…';
        try {
            const data = await getCounterProducts({ search: productSearch.value.trim(), page: productPage, per_page: 12 });
            if (attempt !== productVersion || selection !== selectionVersion || !allowed()) return;
            products.replaceChildren(); productState.textContent = data.total ? `${data.total} sản phẩm phù hợp` : 'Không tìm thấy sản phẩm phù hợp. Thử tên hoặc mã vạch khác.';
            for (const value of data.items) {
                const row = node('article', undefined, 'chat-offer-product'), units = node('select'); units.setAttribute('aria-label', `Đơn vị tính ${value.TenThuoc}`);
                for (const unit of value.DonViGia) { const option = node('option', `${unit.DonViTinh}${unit.ConHang ? '' : ' · Hết hàng'}`); option.value = String(unit.MaDonGia); option.disabled = !unit.ConHang; units.append(option); }
                const availableUnit = value.DonViGia.find(unit => unit.ConHang);
                row.dataset.available = String(!!availableUnit);
                units.value = availableUnit ? String(availableUnit.MaDonGia) : '';
                const quantity = node('input'); quantity.type = 'number'; quantity.min = '1'; quantity.max = '2147483647'; quantity.step = '1'; quantity.value = '1'; quantity.setAttribute('aria-label', `Số lượng ${value.TenThuoc}`);
                units.disabled = quantity.disabled = !availableUnit;
                const description = node('div', undefined, 'chat-offer-description'), heading = node('div', undefined, 'chat-offer-product-heading'), stock = node('span', availableUnit ? 'Còn hàng' : 'Hết hàng', 'chat-stock-badge');
                stock.dataset.available = String(!!availableUnit); heading.append(node('h3', value.TenThuoc), stock); description.append(heading);
                if (value.MaVach) description.append(node('p', `Mã vạch: ${value.MaVach}`, 'chat-offer-barcode'));
                const controls = node('div', undefined, 'chat-offer-controls'), unitField = node('div'), quantityField = node('div');
                units.id = `chat-offer-unit-${value.MaThuoc}`; quantity.id = `chat-offer-quantity-${value.MaThuoc}`;
                const unitLabel = node('label', 'Đơn vị'), quantityLabel = node('label', 'Số lượng'); unitLabel.htmlFor = units.id; quantityLabel.htmlFor = quantity.id;
                unitField.append(unitLabel, units); quantityField.append(quantityLabel, quantity); controls.append(unitField, quantityField);
                const price = node('p', undefined, 'chat-offer-price');
                function amount(unit, count) {
                    const discounted = unit.GiaKhuyenMai !== null && unit.GiaKhuyenMai !== undefined && BigInt(unit.GiaKhuyenMai) < BigInt(unit.GiaBan);
                    const promotionCount = discounted ? Math.min(count, unit.SoLuongKhuyenMai ?? count) : 0;
                    return BigInt(promotionCount) * BigInt(discounted ? unit.GiaKhuyenMai : unit.GiaBan) + BigInt(count - promotionCount) * BigInt(unit.GiaBan);
                }
                function updatePrice() { const unit = value.DonViGia.find(item => String(item.MaDonGia) === units.value), count = Number(quantity.value); price.textContent = !availableUnit ? 'Sản phẩm hiện không có đơn vị còn hàng.' : unit && Number.isSafeInteger(count) && count > 0 && count <= 2147483647 ? `Tạm tính: ${money(amount(unit, count))}` : 'Nhập số lượng hợp lệ.'; }
                units.addEventListener('change', updatePrice); quantity.addEventListener('input', updatePrice); updatePrice();
                const add = node('button', availableUnit ? 'Chọn' : 'Hết hàng', 'button button-outline'); add.type = 'button'; add.disabled = !availableUnit; add.setAttribute('aria-label', availableUnit ? `Chọn ${value.TenThuoc}` : `${value.TenThuoc} đã hết hàng`);
                add.addEventListener('click', () => {
                    if (busy || offerRequest || offerItems.size >= 30) return;
                    const unit = value.DonViGia.find(item => String(item.MaDonGia) === units.value), count = Number(quantity.value);
                    if (!Number.isSafeInteger(count) || count < 1 || count > 2147483647) { productState.textContent = 'Số lượng phải là số nguyên từ 1 đến 2147483647.'; quantity.focus(); return; }
                    if (unit?.ConHang) { offerItems.set(unit.MaDonGia, { MaThuoc: value.MaThuoc, MaDonGia: unit.MaDonGia, TenThuoc: value.TenThuoc, HinhAnh: value.HinhAnh, DonViTinh: unit.DonViTinh, SoLuong: count, ThanhTien: String(amount(unit, count)) }); renderBasket(); productState.textContent = `Đã chọn ${count} ${unit.DonViTinh} ${value.TenThuoc}.`; }
                });
                const purchaseRow = node('div', undefined, 'chat-offer-purchase-row'); purchaseRow.append(price, add); description.append(controls, purchaseRow);
                row.append(productImage(value.HinhAnh), description); products.append(row);
            }
            productPrev.disabled = productPage <= 1; productNext.disabled = productPage * 12 >= data.total;
        } catch (error) { if (attempt === productVersion) { productState.textContent = chatError(error); if (sessionFailed(error)) onSessionError(); } }
        finally { if (attempt === productVersion) products.setAttribute('aria-busy', 'false'); }
    }
    sendOffer.addEventListener('click', async () => {
        if (!selected || busy || !offerItems.size || !allowed()) return;
        const attempt = selectionVersion, id = selected.id; busy = true;
        offerRequest ||= { kind: 'offer', items: [...offerItems.values()].map(({ MaThuoc, MaDonGia, SoLuong }) => ({ MaThuoc, MaDonGia, SoLuong })), request_id: crypto.randomUUID() };
        sendOffer.disabled = true;
        try { await writeChat(`/threads/${id}/messages`, offerRequest, owner()); if (attempt === selectionVersion) { offerRequest = null; offerItems.clear(); renderBasket(); pickerDialog.close(true); await loadMessages(); } }
        catch (error) { if (attempt === selectionVersion) { productState.textContent = chatError(error); if (!['CONNECTION_FAILED', 'INVALID_RESPONSE'].includes(error.code)) offerRequest = null; fail(error); } }
        finally { busy = false; updateActions(); renderBasket(); }
    });
    claim.addEventListener('click', () => action(false)); finish.addEventListener('click', () => action(true));
    back.addEventListener('click', () => { if (!busy) { clearSelection(); search.focus(); } });
    retry.addEventListener('click', () => { loadQueue(); loadMessages(); });
    older.addEventListener('click', () => loadMessages([...history.keys()].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1)[0]));
    prev.addEventListener('click', () => { if (page > 1) { page--; loadQueue(); } }); next.addEventListener('click', () => { page++; loadQueue(); });
    offerButton.addEventListener('click', () => { if (!allowed() || busy || selected?.status !== 1) return; pickerDialog.open(pickerTitle); loadProducts(); });
    productPrev.addEventListener('click', () => { if (productPage > 1) { productPage--; loadProducts(); } }); productNext.addEventListener('click', () => { productPage++; loadProducts(); });
    const cancelSearch = setupLiveSearch({ input: search, isActive: allowed, onSearch: () => { page = 1; loadQueue(); } });
    const cancelProductSearch = setupLiveSearch({ input: productSearch, isActive: allowed, onSearch: () => { productPage = 1; loadProducts(); } });
    return { activate() { active = true; loadQueue(); schedule(); }, deactivate() { active = false; version++; queueLoading = false; clearTimeout(timer); cancelSearch(); cancelProductSearch(); clearSelection(); },
        clear() { active = false; version++; queueLoading = busy = false; clearTimeout(timer); cancelSearch(); cancelProductSearch(); clearSelection(); list.replaceChildren(); queueState.textContent = state.textContent = ''; search.value = productSearch.value = ''; page = productPage = 1; } };
}
