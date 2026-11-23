const validId = value => /^[1-9][0-9]*$/.test(value) && Number(value) <= 2147483647;
export function checkoutRedemption(total, balance, enabled) {
    total = BigInt(total);
    balance = BigInt(balance);
    const maximum = total / 10n;
    const quantity = enabled ? (balance < 0n ? 0n : balance < maximum ? balance : maximum) : 0n;
    return { quantity, discount: quantity * 10n, total: total - quantity * 10n };
}

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

const validOrderId = value => /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
export function readChatOfferSelection(search) {
    const params = new URLSearchParams(search);
    if (!params.has('offer')) return null;
    const id = params.get('offer');
    if (params.getAll('offer').length !== 1 || [...params.keys()].some(key => key !== 'offer') || !validOrderId(id)) throw new Error('INVALID_SELECTION');
    return id;
}
export function chatOfferCheckoutUrl(messageId) {
    const params = new URLSearchParams({ offer: String(messageId) });
    readChatOfferSelection(`?${params}`);
    return `checkout.html?${params}`;
}

export function readReorderSelection(search) {
    const params = new URLSearchParams(search);
    if (!params.has('reorder')) return null;
    const orderId = params.get('reorder'), lineIds = params.getAll('line');
    if (params.getAll('reorder').length !== 1 || !validOrderId(orderId)
        || [...params.keys()].some(key => !['reorder', 'line'].includes(key))
        || !lineIds.length || lineIds.length > 1000 || lineIds.some(id => !validOrderId(id))
        || new Set(lineIds).size !== lineIds.length) throw new Error('INVALID_SELECTION');
    return { orderId, lineIds };
}
export function reorderCheckoutUrl(orderId, lineIds) {
    const params = new URLSearchParams({ reorder: String(orderId) });
    for (const id of lineIds) params.append('line', String(id));
    readReorderSelection(`?${params}`);
    return `checkout.html?${params}`;
}
