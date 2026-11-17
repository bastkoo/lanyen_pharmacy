export function readCatalogFilters(query) {
    const params = new URLSearchParams(query);
    const keys = ['search', 'category_id', 'ke_don', 'sort_order', 'page'];
    if (keys.some(key => params.getAll(key).length > 1)) throw new Error('INVALID_QUERY');
    const filters = {
        search: (params.get('search') || '').trim(), category_id: params.get('category_id') || '',
        ke_don: params.get('ke_don') || '', sort_order: params.get('sort_order') || 'asc', page: 1
    };
    if ([...filters.search].length > 255 || filters.search.includes('\0')) throw new Error('INVALID_QUERY');
    for (const key of ['category_id', 'page']) {
        const value = params.get(key);
        if (value && (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647)) throw new Error('INVALID_QUERY');
    }
    if (!['', 'true', 'false'].includes(filters.ke_don) || !['asc', 'desc'].includes(filters.sort_order)) throw new Error('INVALID_QUERY');
    filters.page = Number(params.get('page') || 1);
    return filters;
}

export function catalogQuery(filters) {
    const params = new URLSearchParams();
    for (const key of ['search', 'category_id', 'ke_don']) if (filters[key]) params.set(key, filters[key]);
    if (filters.sort_order === 'desc') params.set('sort_order', 'desc');
    if (filters.page > 1) params.set('page', filters.page);
    return params.toString();
}

export const publicProductsUrl = filters => `products.html${catalogQuery(filters) ? '?' + catalogQuery(filters) : ''}`;
