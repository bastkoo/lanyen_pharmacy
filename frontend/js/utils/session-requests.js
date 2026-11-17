// Cookie sessions must not be changed by overlapping cart/auth responses.
// Web Locks also coordinate tabs of the same storefront origin where supported.
let pending = Promise.resolve();
export function withSessionRequest(work) {
    const task = pending.then(() => typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request('lanyen-session', async () => work()) : work());
    pending = task.catch(() => {});
    return task;
}
