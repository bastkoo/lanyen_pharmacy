import { getManagerData } from './manager.js';
export const getInventorySummary = (query, options) => getManagerData(`inventory/summary?${new URLSearchParams(query)}`, options);
export const getLowStock = (query, options) => getManagerData(`inventory/low-stock?${new URLSearchParams(query)}`, options);
export const getExpiry = (query, options) => getManagerData(`inventory/expiring?${new URLSearchParams(query)}`, options);
