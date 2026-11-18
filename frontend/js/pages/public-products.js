import { setupPublicProducts } from '../components/public-catalog.js';
import { openProductDetail } from '../components/public-product-detail.js';

setupPublicProducts();

// Order history links reuse the existing product detail and buying controls.
function openLinkedProduct() {
    const match = /^#product=([1-9][0-9]{0,9})$/.exec(location.hash);
    if (match && Number(match[1]) <= 2147483647) {
        openProductDetail(Number(match[1]), undefined, document.querySelector('#catalog-products-title'));
    }
}
window.addEventListener('hashchange', openLinkedProduct);
openLinkedProduct();
