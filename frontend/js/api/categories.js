import { getManagerData, requestManager } from './manager.js';

export const getCategories = ({ search, page, per_page }, options) =>
    getManagerData(`categories?${new URLSearchParams({ search, page, per_page })}`, options);
export const getCategory = (id, options) => getManagerData(`categories/${encodeURIComponent(id)}`, options);
export const createCategory = name => requestManager('categories', { method: 'POST', body: { TenLoaiThuoc: name } });
export const updateCategory = (id, name) => requestManager(`categories/${encodeURIComponent(id)}`, { method: 'PUT', body: { TenLoaiThuoc: name } });
export const deleteCategory = id => requestManager(`categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
