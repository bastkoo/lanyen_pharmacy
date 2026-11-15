import { getManagerData, requestManager } from './manager.js';
const path = (product, batch) => `products/${encodeURIComponent(product)}/batches${batch === undefined ? '' : `/${encodeURIComponent(batch)}`}`;
export const getBatches = (product, query, options) => getManagerData(`${path(product)}?${new URLSearchParams(query)}`, options);
export const getBatch = (product, batch, options) => getManagerData(path(product, batch), options);
export const createBatch = (product, body) => requestManager(path(product), { method: 'POST', body });
export const updateBatch = (product, batch, body) => requestManager(path(product, batch), { method: 'PUT', body });
export const deleteBatch = (product, batch) => requestManager(path(product, batch), { method: 'DELETE' });
