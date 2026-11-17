import { getPublicPromotions, getPromotionProducts } from '../api/public-catalog.js';
import { productCard } from './public-catalog.js';
import { promotionCountdown } from '../utils/public-sale-format.js';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
const dateLabel = value => value.split('-').reverse().join('/');
const programState = program => program.TrangThai === 'ACTIVE' ? 'Đang diễn ra' : 'Sắp diễn ra';
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const errorText = error => error.code === 'CONNECTION_FAILED'
    ? 'Chưa kết nối được nhà thuốc. Vui lòng thử lại.'
    : error.code === 'PROMOTION_NOT_FOUND' ? 'Chương trình đã kết thúc hoặc không còn tồn tại. Hãy tải lại danh sách chương trình.'
    : 'Chưa tải được khuyến mãi. Vui lòng thử lại sau.';

export function setupPublicSale() {
    const $ = id => document.getElementById(id);
    if (!$('public-sale')) return;
    let programs = [], selectedId, page = 1, pages = 0, listController, productsController;
    const columns = () => window.matchMedia('(max-width: 600px)').matches ? 2
        : window.matchMedia('(max-width: 900px)').matches ? 3
        : window.matchMedia('(max-width: 1100px)').matches ? 4 : 5;
    let pageSize = columns();
    let listVersion = 0, productsVersion = 0;
    const countdownStates = new Map();
    function updateCountdowns() {
        let changed = false;
        for (const program of programs) {
            const countdown = promotionCountdown(program);
            if (!countdown) continue;
            const previous = countdownStates.get(program.MaChuongTrinh);
            if (previous && previous !== countdown.state) changed = true;
            countdownStates.set(program.MaChuongTrinh, countdown.state);
            if (program.MaChuongTrinh === selectedId) {
                const clock = $('sale-countdown');
                clock.replaceChildren(node('span', countdown.label));
                const labels = ['Ngày', 'Giờ', 'Phút', 'Giây'];
                clock.setAttribute('aria-label', `${countdown.label}, ${countdown.parts.map((value, index) => `${value} ${labels[index]}`).join(', ')}`);
                if (countdown.state !== 'ENDED') {
                    const digits = node('span', undefined, 'sale-countdown-digits'); digits.setAttribute('aria-hidden', 'true');
                    countdown.parts.forEach((value, index) => {
                        if (index) digits.append(node('span', ':', 'sale-countdown-separator'));
                        const unit = node('span', undefined, 'sale-countdown-unit');
                        unit.append(node('strong', value), node('span', labels[index], 'sale-countdown-caption')); digits.append(unit);
                    });
                    clock.append(digits);
                }
            }
        }
        if (changed && !document.hidden) {
            // Remove stale purchase controls before refreshing across a start/end boundary.
            $('sale-products-grid').replaceChildren();
            loadPrograms();
        }
    }
    function buttons() {
        for (const button of $('sale-programs').querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.programId) === selectedId));
    }
    function selectProgram(program) {
        selectedId = program.MaChuongTrinh; page = 1; buttons(); loadProducts();
    }
    async function loadPrograms() {
        listController?.abort(); listController = new AbortController(); const attempt = ++listVersion;
        productsVersion++; productsController?.abort();
        $('sale-products').hidden = true; $('sale-programs').hidden = true;
        $('public-sale').setAttribute('aria-busy', 'true');
        $('sale-program-state').textContent = 'Đang tải chương trình khuyến mãi…'; $('sale-program-retry').hidden = true;
        try {
            const records = []; let index = 1, last = 1;
            do {
                const data = await getPublicPromotions({ page: index, per_page: 100 }, { signal: listController.signal });
                if (data.code !== 'PROMOTIONS_LISTED' || !Array.isArray(data.items) || data.page !== index || !Number.isSafeInteger(data.pages) || data.pages < 0) throw new Error('INVALID_RESPONSE');
                records.push(...data.items); last = data.pages; index++;
            } while (index <= last);
            if (attempt !== listVersion) return;
            if (!records.every(program => positiveId(program.MaChuongTrinh) && typeof program.TenChuongTrinh === 'string' &&
                ['ACTIVE', 'UPCOMING'].includes(program.TrangThai) && /^\d{4}-\d{2}-\d{2}$/.test(program.NgayBatDau) && /^\d{4}-\d{2}-\d{2}$/.test(program.NgayKetThuc))) throw new Error('INVALID_RESPONSE');
            programs = records;
            const focused = document.activeElement?.dataset.programId;
            $('sale-programs').replaceChildren();
            for (const program of programs) {
                const li = node('li'), button = node('button', undefined, 'sale-program'); button.type = 'button';
                button.dataset.programId = program.MaChuongTrinh; button.setAttribute('aria-controls', 'sale-products');
                button.dataset.state = program.TrangThai;
                button.setAttribute('aria-label', `${program.TenChuongTrinh}, ${dateLabel(program.NgayBatDau)} đến ${dateLabel(program.NgayKetThuc)}, ${programState(program)}`);
                button.append(node('strong', program.TenChuongTrinh), node('span', `${dateLabel(program.NgayBatDau)} – ${dateLabel(program.NgayKetThuc)}`), node('span', programState(program), 'sale-program-state'));
                button.addEventListener('click', () => selectProgram(program)); li.append(button); $('sale-programs').append(li);
            }
            $('sale-programs').hidden = !programs.length;
            $('sale-program-state').textContent = programs.length ? '' : 'Chưa có chương trình khuyến mãi đang diễn ra hoặc sắp tới. Bạn có thể khám phá các danh mục bên dưới.';
            if (programs.length) {
                const program = programs.find(program => program.MaChuongTrinh === selectedId) || programs[0];
                selectedId = program.MaChuongTrinh; buttons(); loadProducts();
                updateCountdowns();
            } else {
                productsVersion++; productsController?.abort(); $('sale-products').hidden = true;
            }
            if (focused) $('sale-programs').querySelector(`[data-program-id="${focused}"]`)?.focus();
        } catch (error) {
            if (attempt !== listVersion || error.code === 'REQUEST_ABORTED') return;
            $('sale-program-state').textContent = errorText(error); $('sale-program-retry').hidden = false;
        } finally { if (attempt === listVersion) $('public-sale').setAttribute('aria-busy', 'false'); }
    }
    async function loadProducts() {
        const focusedArrow = [$('sale-products-prev'), $('sale-products-next')].includes(document.activeElement) ? document.activeElement : null;
        productsController?.abort(); productsController = new AbortController(); const attempt = ++productsVersion;
        const program = programs.find(program => program.MaChuongTrinh === selectedId);
        if (!program) return;
        $('sale-products').hidden = false; $('sale-products').setAttribute('aria-busy', 'true');
        $('sale-program-title').textContent = program.TenChuongTrinh;
        $('sale-program-dates').textContent = `${dateLabel(program.NgayBatDau)} – ${dateLabel(program.NgayKetThuc)}`;
        updateCountdowns();
        $('sale-products-state').textContent = 'Đang tải sản phẩm ưu đãi…'; $('sale-products-retry').hidden = true;
        $('sale-products-grid').hidden = true; $('sale-products-grid').replaceChildren(); $('sale-pagination').hidden = true;
        try {
            const data = await getPromotionProducts(selectedId, { page, per_page: pageSize }, { signal: productsController.signal });
            if (attempt !== productsVersion) return;
            if (data.code !== 'PROMOTION_PRODUCTS_LISTED' || !Array.isArray(data.items) || data.promotion?.MaChuongTrinh !== selectedId ||
                !Number.isSafeInteger(data.pages) || data.pages < 0 || data.page !== page) throw new Error('INVALID_RESPONSE');
            if (page > Math.max(1, data.pages)) { page = Math.max(1, data.pages); return loadProducts(); }
            pages = data.pages;
            $('sale-products-state').textContent = data.items.length ? '' : 'Chưa có sản phẩm được công bố trong chương trình này.';
            $('sale-products-grid').replaceChildren(...data.items.map(product => productCard(product)));
            $('sale-products-grid').hidden = !data.items.length; $('sale-pagination').hidden = pages <= 1;
            $('sale-carousel').classList.toggle('has-controls', pages > 1 && data.items.length > 0);
            $('sale-products-page').textContent = `Trang ${page} / ${pages}`;
            $('sale-products-prev').disabled = page <= 1; $('sale-products-next').disabled = page >= pages;
        } catch (error) {
            if (attempt !== productsVersion || error.code === 'REQUEST_ABORTED') return;
            $('sale-products-state').textContent = errorText(error); $('sale-products-retry').hidden = false;
        } finally {
            if (attempt === productsVersion) {
                $('sale-products').setAttribute('aria-busy', 'false');
                if (focusedArrow && document.activeElement === document.body) {
                    const target = $('sale-pagination').hidden ? $('sale-products-retry')
                        : focusedArrow.disabled ? (focusedArrow === $('sale-products-next') ? $('sale-products-prev') : $('sale-products-next')) : focusedArrow;
                    if (!target.hidden && !target.disabled) target.focus({ preventScroll: true });
                }
            }
        }
    }
    $('sale-program-retry').addEventListener('click', () => loadPrograms());
    $('sale-products-retry').addEventListener('click', () => loadProducts());
    $('sale-products-prev').addEventListener('click', () => { if (page > 1) { page--; loadProducts(); } });
    $('sale-products-next').addEventListener('click', () => { if (page < pages) { page++; loadProducts(); } });
    window.addEventListener('resize', () => {
        const size = columns();
        if (size === pageSize) return;
        page = Math.floor((page - 1) * pageSize / size) + 1; pageSize = size;
        if (selectedId) loadProducts();
    });
    window.addEventListener('pagehide', () => { listVersion++; productsVersion++; listController?.abort(); productsController?.abort(); });
    window.addEventListener('pageshow', event => { if (event.persisted) { pageSize = columns(); loadPrograms(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadPrograms(); });
    let day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    let clock;
    const watchDate = () => {
        clearInterval(clock);
        clock = setInterval(() => {
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
            if (today !== day && !document.hidden) { day = today; loadPrograms(); }
            else updateCountdowns();
        }, 1000);
    };
    watchDate();
    window.addEventListener('pagehide', () => clearInterval(clock));
    window.addEventListener('pageshow', event => { if (event.persisted) watchDate(); });
    loadPrograms();
}
