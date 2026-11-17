// Share the delay and Vietnamese IME handling across manager search controls.
export function setupLiveSearch({ input, form, onSearch = () => form.requestSubmit(), isActive, filters = [] }) {
    let timer, composing = false;
    const cancel = () => { clearTimeout(timer); timer = undefined; };
    const run = () => { cancel(); if (!composing && isActive()) onSearch(); };
    const schedule = event => {
        cancel();
        if (composing || event.isComposing || !isActive()) return;
        timer = setTimeout(run, 300);
    };
    input.addEventListener('input', schedule);
    input.addEventListener('compositionstart', () => { composing = true; cancel(); });
    input.addEventListener('compositionend', event => { composing = false; schedule(event); });
    form?.addEventListener('submit', event => {
        cancel();
        if (composing) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    form?.addEventListener('reset', cancel);
    for (const filter of filters) filter.addEventListener('change', run);
    return () => { cancel(); composing = false; };
}
