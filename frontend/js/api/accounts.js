import { getManagerData, requestManager } from './manager.js';
import { accountId } from '../utils/json-integers.js';
const path = id => `accounts/${encodeURIComponent(accountId(id))}`;
export const getAccounts = (filters = {}, options) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== undefined) query.set(key, value);
    return getManagerData(`accounts?${query}`, options);
};
export const getAccount = (id, options) => getManagerData(path(id), options);
export const createAccount = body => requestManager('accounts', { method: 'POST', body });
export const updateAccount = (id, body) => requestManager(path(id), { method: 'PUT', body });
export const setAccountStatus = (id, locked) => requestManager(`${path(id)}/status`, { method: 'PATCH', body: { TrangThai: locked } });
