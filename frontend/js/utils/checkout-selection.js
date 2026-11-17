const validId = value => /^[1-9][0-9]*$/.test(value) && Number(value) <= 2147483647;
export function readCheckoutSelection(search) {
    const params = new URLSearchParams(search);
    if ([...params.keys()].some(key => key !== 'unit')) throw new Error('INVALID_SELECTION');
    const ids = params.getAll('unit');
    if (ids.length > 1000 || ids.some(id => !validId(id))) throw new Error('INVALID_SELECTION');
    return [...new Set(ids.map(Number))];
}
export function checkoutUrl(ids) {
    if (!ids.length || ids.length > 1000 || ids.some(id => !validId(String(id)))) throw new Error('INVALID_SELECTION');
    const params = new URLSearchParams();
    for (const id of new Set(ids)) params.append('unit', String(id));
    return `checkout.html?${params}`;
}
