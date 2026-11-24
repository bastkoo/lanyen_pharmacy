import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('localhost and 127.0.0.1 use the local API; deployed hosts use HTTPS Render API', async () => {
    const previous = globalThis.location;
    try {
        for (const [hostname, protocol, expected] of [
            ['localhost', 'http:', 'http://127.0.0.1:5000/api'],
            ['127.0.0.1', 'http:', 'http://127.0.0.1:5000/api'],
            ['localhost', 'https:', 'http://127.0.0.1:5000/api'],
            ['lanyenpharmacy.onrender.com', 'https:', 'https://lanyenpharmacy-api.onrender.com/api'],
            ['shop.example.com', 'https:', 'https://lanyenpharmacy-api.onrender.com/api'],
            ['localhost.example.com', 'https:', 'https://lanyenpharmacy-api.onrender.com/api'],
        ]) {
            globalThis.location = { hostname, protocol };
            const { APP_CONFIG } = await import(`../../frontend/js/config/app.js?host=${hostname}&protocol=${protocol}`);
            assert.equal(APP_CONFIG.API_BASE_URL, expected);
        }
    } finally { globalThis.location = previous; }
});

test('deployed API requests preserve credentials, CSRF, public requests and one /api prefix', async () => {
    const previous = { location: globalThis.location, fetch: globalThis.fetch };
    const calls = [];
    try {
        globalThis.location = { hostname: 'lanyenpharmacy.onrender.com', protocol: 'https:' };
        globalThis.fetch = async (url, options) => {
            calls.push({ url, options });
            return { ok: true, status: 200, text: async () => JSON.stringify({
                csrf_token: 'deploy-csrf', user: { MaNguoiDung: 12 },
            }) };
        };
        const auth = await import('../../frontend/js/api/auth.js');
        const manager = await import('../../frontend/js/api/manager.js');
        const cart = await import('../../frontend/js/api/cart.js');
        const orders = await import('../../frontend/js/api/orders.js');
        const chat = await import('../../frontend/js/api/chat.js');
        const employee = await import('../../frontend/js/api/employee-orders.js');
        const catalog = await import('../../frontend/js/api/public-catalog.js');
        await auth.getSession();
        await auth.requestOtp('+84901234567');
        await manager.requestManager('categories', { method: 'POST', body: { TenLoaiThuoc: 'Test' } });
        await cart.addCartItem(1, 2);
        await orders.initializePayment('4', 12);
        await chat.writeChat('/messages', { NoiDung: 'Test' }, 12);
        await employee.updateEmployeeOrder('4', 0, 1, 12);
        await catalog.getPublicProducts({});
        assert.ok(calls.some(call => call.url.endsWith('/api/orders/4/payment')));
        assert.ok(calls.some(call => call.url.endsWith('/api/manager/categories')));
        for (const { url, options } of calls) {
            const parsed = new URL(url);
            assert.equal(parsed.origin, 'https://lanyenpharmacy-api.onrender.com');
            assert.equal((parsed.pathname.match(/\/api\b/g) || []).length, 1);
            const isPublic = parsed.pathname === '/api/products';
            assert.equal(options.credentials, isPublic ? 'omit' : 'include');
            if (options.method !== 'GET') assert.equal(options.headers['X-CSRF-Token'], 'deploy-csrf');
        }
        globalThis.fetch = async () => ({ ok: false, status: 403, text: async () => '{"code":"FORBIDDEN"}' });
        await assert.rejects(manager.getManagerData('products'), error => error.code === 'FORBIDDEN' && error.status === 403);
        globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => '{"code":"UNAUTHENTICATED","csrf_token":"guest"}' });
        await assert.rejects(auth.getSession(), error => error.code === 'UNAUTHENTICATED' && error.status === 401);
    } finally { Object.assign(globalThis, previous); }
});

test('static HTML assets and JS module imports resolve inside the publish directory', () => {
    const root = new URL('../../frontend/', import.meta.url);
    const files = readdirSync(root, { recursive: true }).filter(file => /\.(html|js|css)$/.test(file));
    let checked = 0;
    for (const file of files) {
        const base = new URL(file.replaceAll('\\', '/'), root);
        const source = readFileSync(base, 'utf8');
        const references = file.endsWith('.html') ? [...source.matchAll(/(?:src|href|action)="([^"]+)"/g)]
            : file.endsWith('.js') ? [...source.matchAll(/(?:from\s*|import\s*)['"]([.][^'"]+)['"]/g)]
            : [...source.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)];
        for (const [, reference] of references) {
            if (reference.startsWith('#') || /^(?:[a-z]+:|\/\/)/i.test(reference)) continue;
            const resolved = new URL(reference, base);
            resolved.hash = ''; resolved.search = '';
            assert.ok(resolved.href.startsWith(root.href), `${file}: ${reference} escapes frontend/`);
            assert.ok(existsSync(fileURLToPath(resolved)), `${file}: missing ${reference}`);
            checked++;
        }
    }
    assert.ok(checked > 100);
});
