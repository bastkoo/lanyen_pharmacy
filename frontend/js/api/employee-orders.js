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
export const getEmployeePendingCount = () => withSessionRequest(() => request('/pending-count'));
export const listReturnOrders = (search, page) => withSessionRequest(() => request(`/returns?${new URLSearchParams({ search, page: String(page), per_page: '20' })}`));
export const getReturnOrder = id => withSessionRequest(() => request(`/${encodeURIComponent(id)}/returns`));
export const submitReturn = (id, values, owner) => withAuthenticatedSession(owner,
    token => request(`/${encodeURIComponent(id)}/returns`, 'POST', values, token));
export const getCompletedEmployeeOrders = (search = '', page = 1) => withSessionRequest(() => request(`/completed?${new URLSearchParams({ search, page: String(page), per_page: '20' })}`));
export const getCounterCustomer = phone => withSessionRequest(() => request(`/counter/customer?${new URLSearchParams({ phone })}`));
export const getCounterProducts = filters => withSessionRequest(() => request(`/counter/products?${new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined))}`));
export const getPendingCounterOrders = () => withSessionRequest(() => request('/counter/pending'));
export const getCounterOrder = id => withSessionRequest(() => request(`/counter/${encodeURIComponent(id)}`));
export const quoteCounterOrder = (values, owner) => withAuthenticatedSession(owner, token => request('/counter/quote', 'POST', values, token));
export const createCounterOrder = (values, owner) => withAuthenticatedSession(owner, token => request('/counter', 'POST', values, token));
export const completeCounterOrder = (id, owner) => withAuthenticatedSession(owner, token => request(`/counter/${encodeURIComponent(id)}/complete`, 'POST', {}, token));
export const payCounterOrder = (id, owner) => withAuthenticatedSession(owner, token => request(`/counter/${encodeURIComponent(id)}/payment`, 'POST', {}, token));
export const updateEmployeeOrder = (id, from, to, owner) => withAuthenticatedSession(owner,
    token => request(`/${encodeURIComponent(id)}/status`, 'POST', { from_status: from, to_status: to }, token));
export const cancelEmployeeOrder = (id, owner) => withAuthenticatedSession(owner,
    token => request(`/${encodeURIComponent(id)}/cancel`, 'POST', {}, token));
