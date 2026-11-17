import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutUrl, readCheckoutSelection } from '../../frontend/js/utils/checkout-selection.js';

test('checkout selection transfers only unit identifiers and preserves selected distinct rows', () => {
    const url = checkoutUrl([21, 11, 21]);
    assert.equal(url, 'checkout.html?unit=21&unit=11');
    assert.deepEqual(readCheckoutSelection(url.slice(url.indexOf('?'))), [21, 11]);
    assert.deepEqual(readCheckoutSelection(''), []);
    assert.deepEqual(readCheckoutSelection('?unit=2147483647'), [2147483647]);
});

test('invalid, unknown and excessive checkout selection never becomes a purchase request', () => {
    for (const query of ['?unit=0', '?unit=-1', '?unit=1.5', '?unit=1e2', '?unit=01', '?unit=2147483648', '?unit=', '?unit=1&price=1', '?owner=99']) {
        assert.throws(() => readCheckoutSelection(query));
    }
    assert.throws(() => readCheckoutSelection('?' + Array(1001).fill('unit=1').join('&')));
    for (const ids of [[], [0], [-1], [NaN], [2147483648], Array(1001).fill(1)]) assert.throws(() => checkoutUrl(ids));
});
