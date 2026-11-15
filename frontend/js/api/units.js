import { getManagerData, requestManager } from './manager.js';

const path = (productId, unitId) => `products/${encodeURIComponent(productId)}/units${unitId === undefined ? '' : `/${encodeURIComponent(unitId)}`}`;
export const getUnits = (productId, filters, options) => getManagerData(`${path(productId)}?${new URLSearchParams(filters)}`, options);
export const getUnit = (productId, unitId, options) => getManagerData(path(productId, unitId), options);
export const createUnit = (productId, body) => requestManager(path(productId), { method: 'POST', body });
export const updateUnit = (productId, unitId, body) => requestManager(path(productId, unitId), { method: 'PUT', body });
export const deleteUnit = (productId, unitId) => requestManager(path(productId, unitId), { method: 'DELETE' });
