import { APP_CONFIG } from '../config/app.js';
import { ApiError, withAuthenticatedSession } from './auth.js';
import { parseJsonIntegers } from '../utils/json-integers.js';
import { withSessionRequest } from '../utils/session-requests.js';

async function request(path, method = 'GET', body, token) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    let response, data;
    try {
        response = await fetch(`${APP_CONFIG.API_BASE_URL}/orders${path}`, {
            method, credentials: 'include', cache: 'no-store', signal: controller.signal,
            headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        data = parseJsonIntegers(await response.text());
    } catch { throw new ApiError('CONNECTION_FAILED'); }
    finally { clearTimeout(timer); }
    if (!response.ok) throw new ApiError(data.code || 'REQUEST_FAILED', response.status);
    return data;
}
export const createOrder = (values, owner) => withAuthenticatedSession(owner, token => request('', 'POST', values, token));
export const getOrder = id => withSessionRequest(() => request(`/${encodeURIComponent(id)}`));
export const getOrderDetail = id => withSessionRequest(() => request(`/${encodeURIComponent(id)}/detail`));
export const getReorderOptions = id => withSessionRequest(() => request(`/${encodeURIComponent(id)}/reorder`));
export const reorderOrder = (id, lineIds, owner) => withAuthenticatedSession(owner, token => request(`/${encodeURIComponent(id)}/reorder`, 'POST', { MaChiTiet: lineIds }, token));
export const getOrders = (status = 'all', page = 1) => withSessionRequest(() => request(`?${new URLSearchParams({ status, page: String(page), per_page: '10' })}`));
export const initializePayment = (id, owner) => withAuthenticatedSession(owner, token => request(`/${encodeURIComponent(id)}/payment`, 'POST', undefined, token));
