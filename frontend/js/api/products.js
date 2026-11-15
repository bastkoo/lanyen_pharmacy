import { getManagerData, requestManager } from './manager.js';

export const getProducts = (filters, options) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value !== '' && value !== undefined) query.set(key, value);
    return getManagerData(`products?${query}`, options);
};
export const getProduct = (id, options) => getManagerData(`products/${encodeURIComponent(id)}`, options);
export const createProduct = body => requestManager('products', { method: 'POST', body });
export const updateProduct = (id, body) => requestManager(`products/${encodeURIComponent(id)}`, { method: 'PUT', body });
export const deleteProduct = id => requestManager(`products/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const uploadProductImage = image => {
    const body = new FormData(); body.append('image', image);
    return requestManager('uploads/products', { method: 'POST', body, timeout: 45000 });
};
