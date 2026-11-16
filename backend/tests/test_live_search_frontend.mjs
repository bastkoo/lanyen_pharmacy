import test from 'node:test';
import assert from 'node:assert/strict';
import { setupLiveSearch } from '../../frontend/js/utils/live-search.js';

function fixture(t, options = {}) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const input = new EventTarget(), form = new EventTarget(), filter = new EventTarget();
    let active = true;
    const calls = [];
    form.requestSubmit = () => { form.dispatchEvent(new Event('submit')); calls.push(input.value); };
    const cancel = setupLiveSearch({ input, form, filters: [filter], isActive: () => active, ...options });
    const type = value => { input.value = value; input.dispatchEvent(new Event('input')); };
    return { input, form, filter, calls, cancel, type, deactivate: () => { active = false; } };
}

test('rapid typing sends one search with the latest text; clearing also searches', t => {
    const f = fixture(t);
    f.type('T'); t.mock.timers.tick(200); f.type('Thuốc'); t.mock.timers.tick(299);
    assert.deepEqual(f.calls, []);
    t.mock.timers.tick(1); assert.deepEqual(f.calls, ['Thuốc']);
    f.type(''); t.mock.timers.tick(300); assert.deepEqual(f.calls, ['Thuốc', '']);
});

test('Vietnamese composition waits until committed before searching', t => {
    const f = fixture(t);
    f.type('T'); f.input.dispatchEvent(new Event('compositionstart'));
    f.type('Thuố'); t.mock.timers.tick(1000); assert.deepEqual(f.calls, []);
    f.input.value = 'Thuốc'; f.input.dispatchEvent(new Event('compositionend'));
    f.type('Thuốc'); t.mock.timers.tick(300); assert.deepEqual(f.calls, ['Thuốc']);
});

test('Enter used to commit composed text does not submit a search early', t => {
    const f = fixture(t);
    let submitted = 0;
    f.form.addEventListener('submit', () => submitted++);
    f.input.dispatchEvent(new Event('compositionstart'));
    const event = new Event('submit', { cancelable: true });
    f.form.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true); assert.equal(submitted, 0);
    f.input.dispatchEvent(new Event('compositionend')); t.mock.timers.tick(300);
    assert.equal(submitted, 1);
});

test('manual submit, reset, filter changes and cancellation do not leave duplicate searches', t => {
    const f = fixture(t);
    f.type('A'); f.form.requestSubmit(); t.mock.timers.tick(300); assert.deepEqual(f.calls, ['A']);
    f.type('B'); f.form.dispatchEvent(new Event('reset')); t.mock.timers.tick(300); assert.deepEqual(f.calls, ['A']);
    f.type('C'); f.filter.dispatchEvent(new Event('change')); t.mock.timers.tick(300); assert.deepEqual(f.calls, ['A', 'C']);
    f.type('D'); f.cancel(); t.mock.timers.tick(300); assert.deepEqual(f.calls, ['A', 'C']);
});

test('leaving a page prevents pending and new searches', t => {
    const f = fixture(t);
    f.type('A'); f.deactivate(); t.mock.timers.tick(300);
    f.type('B'); f.filter.dispatchEvent(new Event('change')); t.mock.timers.tick(300);
    assert.deepEqual(f.calls, []);
});

test('dialog picker supports a callback without submitting its edit form', t => {
    let count = 0;
    const f = fixture(t, { form: undefined, onSearch: () => count++ });
    f.type('Thuốc'); t.mock.timers.tick(300);
    assert.equal(count, 1); assert.deepEqual(f.calls, []);
});
