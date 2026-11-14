import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { protocol: 'http:', hostname: 'localhost' };
const api = await import('../../frontend/js/api/manager.js');
const { formatCount, formatVnd, formatStoredDate } = await import('../../frontend/js/utils/dashboard-format.js');

test('manager GET client keeps session cookies and real endpoint/query contracts', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ total: 0 }) }; };
    await api.getDashboardSummary(7);
    await api.getRecentOrders(30);
    await api.getRevenue(90);
    await api.getProductCount();
    await api.getLowStock();
    await api.getExpiringBatches();
    for (const call of calls) { assert.equal(call.options.credentials, 'include'); assert.equal(call.options.method, 'GET'); assert.equal(call.options.cache, 'no-store'); }
    assert.ok(calls[0].url.endsWith('/manager/dashboard/summary?days=7'));
    assert.ok(calls[1].url.endsWith('/manager/dashboard/recent-orders?days=30&limit=5'));
    assert.ok(calls[2].url.endsWith('/manager/dashboard/revenue?days=90'));
    assert.ok(calls[3].url.includes('products?page=1&per_page=1'));
    assert.ok(calls[4].url.includes('low-stock'));
    assert.ok(calls[5].url.includes('status=expiring&days=30'));
});

test('API propagates authentication and independent service failures', async () => {
    for (const [status, code] of [[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [503, 'DATABASE_UNAVAILABLE']]) {
        globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ code }) });
        await assert.rejects(api.getDashboardSummary(30), error => error.code === code && error.status === status);
    }
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(api.getDashboardSummary(30), error => error.code === 'CONNECTION_FAILED');
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.getDashboardSummary(30, { signal: controller.signal }), error => error.code === 'REQUEST_ABORTED');
});

test('VND and BIGINT order values retain integer precision', () => {
    assert.match(formatVnd('250000'), /250\.000/);
    assert.match(formatVnd('9007199254740993123'), /9\.007\.199\.254\.740\.993\.123/);
    assert.match(formatVnd('0'), /0/);
    assert.throws(() => formatVnd(250000));
    assert.equal(formatCount(0), '0');
    assert.throws(() => formatCount(-1));
});

test('stored Vietnam wall time is not shifted by browser timezone', () => {
    assert.match(formatStoredDate('2026-11-14T14:30:00', true), /14:30/);
    assert.match(formatStoredDate('2026-11-14'), /14\/11\/2026/);
    assert.equal(formatStoredDate(null), 'Không rõ thời gian');
});
