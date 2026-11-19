import { APP_CONFIG } from '../config/app.js';
import { ApiError, withAuthenticatedSession } from './auth.js';
import { parseJsonIntegers } from '../utils/json-integers.js';
import { withSessionRequest } from '../utils/session-requests.js';

async function request(path, method = 'GET', body, token) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    let response, data;
    try {
        response = await fetch(`${APP_CONFIG.API_BASE_URL}/employee/orders${path}`, {
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
export const listEmployeeOrders = (status, search, page) => withSessionRequest(() => request(`?${new URLSearchParams({ status, search, page: String(page), per_page: '20' })}`));
export const getEmployeeOrder = id => withSessionRequest(() => request(`/${encodeURIComponent(id)}`));
export const updateEmployeeOrder = (id, from, to, owner) => withAuthenticatedSession(owner,
    token => request(`/${encodeURIComponent(id)}/status`, 'POST', { from_status: from, to_status: to }, token));
export const cancelEmployeeOrder = (id, owner) => withAuthenticatedSession(owner,
    token => request(`/${encodeURIComponent(id)}/cancel`, 'POST', {}, token));
