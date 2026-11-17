import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const homePath = path.join(root, 'frontend/pages/customer/home.html');
const html = readFileSync(homePath, 'utf8');
const read = file => readFileSync(path.join(root, file), 'utf8');

test('public homepage uses real local links, assets, labels and unique accessible landmarks', () => {
    assert.match(html, /<html lang="vi">/);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const [file, fragment] = match[1].split('#');
        if (!file) { assert.ok(ids.includes(fragment), match[1]); continue; }
        const resolved = path.resolve(path.dirname(homePath), file);
        assert.ok(existsSync(resolved), match[1]);
        if (fragment && file.endsWith('.svg')) assert.ok(readFileSync(resolved, 'utf8').includes(`id="${fragment}"`));
    }
    for (const match of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(match[1]));
    for (const match of html.matchAll(/\baria-(?:labelledby|describedby|controls)="([^"]+)"/g)) {
        for (const id of match[1].split(' ')) assert.ok(ids.includes(id), id);
    }
    assert.doesNotMatch(html, /id="nav-toggle"|id="public-nav"/);
    assert.match(html.slice(html.indexOf('<header'), html.indexOf('</header>')), /id="public-search-form"/);
    assert.match(html, /action="products.html" method="get"/);
    assert.match(html, /id="public-search"[^>]*type="search"/);
    assert.match(html, /id="public-search-status"[^>]*role="status"/);
});

test('public data states are honest and no manager client, invented contacts or tracking are introduced', () => {
    const ui = read('frontend/js/pages/public-home.js');
    const catalog = read('frontend/js/components/public-catalog.js');
    assert.doesNotMatch(ui + catalog, /\/manager\/|localStorage|sessionStorage|innerHTML|insertAdjacentHTML|eval\(/);
    assert.doesNotMatch(html, /href="(?:tel:|mailto:|javascript:|#")|data-product-id|data-cart-count/);
    assert.equal([...html.matchAll(/data-public-state="unavailable"/g)].length, 1);
    assert.match(html, /id="public-categories-grid"/);
    assert.doesNotMatch(html, /id="catalog-products-grid"/);
    assert.match(html, /Chưa có bài viết công khai/);
    assert.match(html, /Thông tin liên hệ đang được cập nhật/);
    assert.match(html, /Không phải sản phẩm đang bán/);
    assert.ok(html.includes('id="auth-dialog"'));
    assert.ok(html.includes('id="start-login"'));
    assert.match(ui, /location\.assign\(publicProductsUrl/);
});

test('separate product page has accessible filters, local assets and header search without homepage promotions', () => {
    const file = path.join(root, 'frontend/pages/customer/products.html'), productHtml = readFileSync(file, 'utf8');
    const ids = [...productHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal([...productHtml.matchAll(/<h1\b/g)].length, 1);
    for (const match of productHtml.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const [target, fragment] = match[1].split('#');
        if (!target) assert.ok(ids.includes(fragment), fragment);
        else assert.ok(existsSync(path.resolve(path.dirname(file), target)), target);
    }
    for (const match of productHtml.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(match[1]));
    for (const match of productHtml.matchAll(/\baria-(?:labelledby|describedby|controls)="([^"]+)"/g)) for (const id of match[1].split(' ')) assert.ok(ids.includes(id), id);
    for (const id of ['catalog-filter-category', 'catalog-filter-prescription', 'catalog-filter-sort', 'catalog-products-grid']) assert.ok(ids.includes(id));
    assert.doesNotMatch(productHtml, /id="public-nav"|id="welcome-title"|id="public-categories-grid"/);
    assert.match(productHtml.slice(productHtml.indexOf('<header'), productHtml.indexOf('</header>')), /id="public-search-form"/);
});

test('homepage colors and typography remain scoped to public UI with local fonts', () => {
    const css = read('frontend/css/pages/home.css');
    assert.match(css, /\.public-home\s*\{/);
    assert.match(css, /--font-family: 'Be Vietnam Pro'/);
    assert.match(css, /var\(--primary-color\)/);
    assert.match(css, /var\(--primary-dark\)/);
    assert.match(css, /var\(--primary-light\)/);
    assert.doesNotMatch(css, /@import|https?:|overflow-x:\s*hidden/);
    assert.match(css, /focus-visible/);
    assert.match(read('frontend/css/base/global.css'), /prefers-reduced-motion/);
    assert.match(read('frontend/index.html'), /url=pages\/customer\/home\.html/);
});
