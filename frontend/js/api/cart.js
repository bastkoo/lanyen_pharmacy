import { APP_CONFIG } from '../config/app.js';
import { ApiError } from './auth.js';
import { parseJsonIntegers } from '../utils/json-integers.js';
import { withSessionRequest } from '../utils/session-requests.js';

let token = '';
async function request(path = '', method = 'GET', body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response, data;
    try {
        response = await fetch(`${APP_CONFIG.API_BASE_URL}/cart${path}`, {
            method, credentials: 'include', cache: 'no-store', signal: controller.signal,
            headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        data = parseJsonIntegers(await response.text());
    } catch { throw new ApiError('CONNECTION_FAILED'); }
    finally { clearTimeout(timeout); }
    if (typeof data.csrf_token === 'string') token = data.csrf_token;
    if (!response.ok) throw new ApiError(data.code || 'REQUEST_FAILED', response.status);
    return data;
}
export const getCart = () => withSessionRequest(() => request());
export function addCartItem(productId, unitId) {
    return withSessionRequest(async () => {
        await request();
        return request('/items', 'POST', { MaThuoc: productId, MaDonGia: unitId });
    });
}
export function removeCartItem(unitId) {
    return withSessionRequest(async () => {
        await request();
        return request(`/items/${unitId}`, 'DELETE');
    });
}
export function updateCartItem(unitId, destinationId, quantity) {
    return withSessionRequest(async () => {
        await request();
        return request(`/items/${unitId}`, 'PUT', { MaDonGia: destinationId, SoLuong: quantity });
    });
}
export function quoteCart(unitIds) {
    return withSessionRequest(async () => {
        await request();
        return request('/quote', 'POST', { MaDonGia: unitIds });
    });
}
