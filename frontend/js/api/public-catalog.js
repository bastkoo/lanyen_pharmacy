import { APP_CONFIG } from '../config/app.js';
import { ApiError } from './auth.js';

async function readCatalog(path, filters, { signal } = {}) {
    const controller = new AbortController(), abort = () => controller.abort();
    if (signal?.aborted) throw new ApiError('REQUEST_ABORTED');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 20000);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== undefined) query.set(key, value);
    try {
        const response = await fetch(`${APP_CONFIG.API_BASE_URL}/${path}?${query}`, {
            method: 'GET', credentials: 'omit', cache: 'no-store', signal: controller.signal
        });
        const data = JSON.parse(await response.text());
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ApiError('INVALID_RESPONSE');
        if (!response.ok) throw new ApiError(data.code || 'REQUEST_FAILED', response.status);
        return data;
    } catch (error) {
        if (signal?.aborted) throw new ApiError('REQUEST_ABORTED');
        if (error instanceof ApiError) throw error;
        throw new ApiError('CONNECTION_FAILED');
    } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
    }
}

export const getPublicCategories = (filters, options) => readCatalog('categories', filters, options);
export const getPublicProducts = (filters, options) => readCatalog('products', filters, options);
export const getPublicProduct = (id, filters = {}, options) => readCatalog(`products/${id}`, filters, options);
export const getPublicPromotions = (filters, options) => readCatalog('promotions', filters, options);
export const getPromotionProducts = (id, filters, options) => readCatalog(`promotions/${id}/products`, filters, options);
