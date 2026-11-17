import { setupPublicCatalog } from '../components/public-catalog.js';
import { publicProductsUrl } from '../utils/public-catalog-filters.js';
import { setupCartBadge } from '../components/cart.js';

import { setupPublicSale } from '../components/public-sale.js';


setupPublicSale();
setupCartBadge();

const $ = id => document.getElementById(id);
if ($('public-categories-grid')) setupPublicCatalog();

const header = document.querySelector('.site-header');
const headerSize = new ResizeObserver(() => {
    const height = Math.ceil(header.getBoundingClientRect().height);
    document.body.style.setProperty('--public-header-height', `${height}px`);
    document.body.style.setProperty('--public-header-offset', `${height + 16}px`);
});
headerSize.observe(header);
window.addEventListener('pagehide', () => headerSize.disconnect());
window.addEventListener('pageshow', event => { if (event.persisted) headerSize.observe(header); });

$('public-search-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('public-search'), value = input.value.trim();
    if (!value || [...value].length > 255 || value.includes('\0')) {
        $('public-search-status').textContent = 'Nhập từ khóa từ 1 đến 255 ký tự để tìm kiếm, không chứa ký tự NUL.';
        input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    input.removeAttribute('aria-invalid');
    window.location.assign(`../customer/${publicProductsUrl({ search: value })}`);
});
$('public-search').addEventListener('input', () => { $('public-search').removeAttribute('aria-invalid'); $('public-search-status').textContent = ''; });
const comingSoon = {
    orders: ['Đơn hàng của tôi', 'Chức năng xem đơn hàng đang được hoàn thiện.'],
    addresses: ['Địa chỉ nhận hàng', 'Chức năng quản lý địa chỉ nhận hàng đang được hoàn thiện.'],
    shopping: ['Hướng dẫn mua hàng', 'Hướng dẫn mua hàng đang được chuẩn bị và sẽ được công bố khi chức năng mua hàng trực tuyến sẵn sàng.'],
    privacy: ['Chính sách bảo mật', 'Nội dung chính sách bảo mật đang được chuẩn bị để công bố.'],
    terms: ['Điều khoản sử dụng', 'Nội dung điều khoản sử dụng đang được chuẩn bị để công bố.']
};
const dialog = $('feature-dialog');
let opener;
for (const button of document.querySelectorAll('[data-coming]')) {
    button.addEventListener('click', () => {
        const content = comingSoon[button.dataset.coming];
        if (!content) return;
        opener = button.closest('.customer-account')?.querySelector('#account-avatar-button') || button;
        $('feature-title').textContent = content[0];
        $('feature-description').textContent = content[1];
        dialog.showModal(); $('feature-done').focus();
    });
}
for (const id of ['feature-close', 'feature-done']) $(id).addEventListener('click', () => dialog.close());
dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const first = $('feature-close'), last = $('feature-done');
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
dialog.addEventListener('close', () => { if (!dialog.open && opener?.isConnected) opener.focus(); });
