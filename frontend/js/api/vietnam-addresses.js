const BASE = 'https://provinces.open-api.vn/api/v2';
const cache = new Map();
async function read(path, signal) {
    if (signal?.aborted) throw Object.assign(new Error(), { code: 'REQUEST_ABORTED' });
    if (cache.has(path)) return cache.get(path);
    const controller = new AbortController(), abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 15000);
    try {
        const response = await fetch(`${BASE}${path}`, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('PROVINCES_UNAVAILABLE');
        const data = await response.json();
        return data;
    } catch {
        throw Object.assign(new Error(), { code: signal?.aborted ? 'REQUEST_ABORTED' : 'PROVINCES_UNAVAILABLE' });
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
function valid(items) {
    return Array.isArray(items) && items.every(item => item && Number.isSafeInteger(item.code) && item.code > 0 && typeof item.name === 'string' && item.name.trim() && [...item.name].length <= 255) && new Set(items.map(item => item.code)).size === items.length;
}
export async function getProvinces({ signal } = {}) {
    const path = '/p/', data = await read(path, signal);
    if (!valid(data) || !data.length) throw Object.assign(new Error(), { code: 'PROVINCES_UNAVAILABLE' });
    cache.set(path, data); return data;
}
export async function getWards(code, { signal } = {}) {
    if (!Number.isSafeInteger(code) || code <= 0) throw Object.assign(new Error(), { code: 'PROVINCES_UNAVAILABLE' });
    const path = `/p/${code}?depth=2`, data = await read(path, signal);
    if (!data || data.code !== code || !valid(data.wards) || data.wards.some(ward => ward.province_code !== code)) throw Object.assign(new Error(), { code: 'PROVINCES_UNAVAILABLE' });
    cache.set(path, data); return data.wards;
}
