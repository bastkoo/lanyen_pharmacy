import { APP_CONFIG } from '../config/app.js';
import { ApiError, getCsrfToken } from './auth.js';


export async function requestManager(path, { signal, method = 'GET', body } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) throw new ApiError('REQUEST_ABORTED');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 20000);
    try {
        const headers = {};
        if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrfToken();
        if (signal?.aborted) throw new ApiError('REQUEST_ABORTED');
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const response = await fetch(`${APP_CONFIG.API_BASE_URL}/manager/${path}`, {
            method, credentials: 'include', cache: 'no-store', signal: controller.signal, headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        const data = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError('INVALID_RESPONSE');
        if (!response.ok) throw new ApiError(data.code || 'REQUEST_FAILED', response.status);
        return data;
    } catch (error) {
        if (signal?.aborted) throw new ApiError('REQUEST_ABORTED');
        if (error instanceof ApiError) throw error;
        throw new ApiError('CONNECTION_FAILED');
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
    }
}

export const getManagerData = (path, options) => requestManager(path, { ...options, method: 'GET' });

export const getDashboardSummary = (days, options) => getManagerData(`dashboard/summary?${new URLSearchParams({ days })}`, options);
export const getRecentOrders = (days, options) => getManagerData(`dashboard/recent-orders?${new URLSearchParams({ days, limit: 5 })}`, options);
export const getRevenue = (days, options) => getManagerData(`dashboard/revenue?${new URLSearchParams({ days })}`, options);
export const getProductCount = options => getManagerData('products?page=1&per_page=1', options);
export const getLowStock = options => getManagerData('inventory/low-stock?page=1&per_page=5', options);
export const getExpiringBatches = options => getManagerData('inventory/expiring?status=expiring&days=30&page=1&per_page=5', options);
