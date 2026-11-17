let toast, timer;

function placeToast() {
    if (!toast || toast.hidden) return;
    const parent = document.querySelector('dialog:modal') || document.body;
    if (toast.parentElement !== parent) {
        if (toast.matches(':popover-open')) toast.hidePopover();
        parent.append(toast);
    }
    if (toast.showPopover && !toast.matches(':popover-open')) toast.showPopover();
}

function hideToast() {
    clearTimeout(timer);
    if (!toast) return;
    if (toast.matches(':popover-open')) toast.hidePopover();
    toast.hidden = true;
    toast.replaceChildren();
}

export function notify(message, type = 'success') {
    if (typeof document === 'undefined' || !document.body.classList.contains('public-home') || !message) return;
    clearTimeout(timer);
    if (!toast) {
        toast = document.createElement('div'); toast.id = 'customer-notice'; toast.className = 'customer-notice';
        toast.setAttribute('popover', 'manual'); toast.setAttribute('aria-atomic', 'true');
        document.addEventListener('close', event => { if (event.target.tagName === 'DIALOG') placeToast(); }, true);
        document.addEventListener('toggle', event => { if (event.target.tagName === 'DIALOG') placeToast(); }, true);
        window.addEventListener('pagehide', hideToast);
    }
    const variant = ['success', 'error', 'info'].includes(type) ? type : 'info';
    toast.dataset.type = variant;
    toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    const mark = document.createElement('span'); mark.className = 'customer-notice-mark'; mark.setAttribute('aria-hidden', 'true');
    mark.textContent = variant === 'success' ? '✓' : variant === 'error' ? '!' : 'i';
    const content = document.createElement('div'), title = document.createElement('strong'), text = document.createElement('p');
    title.textContent = { success: 'Thành công', error: 'Không thành công', info: 'Thông báo' }[variant];
    text.textContent = message; content.append(title, text); toast.replaceChildren(mark, content);
    toast.hidden = false; placeToast();
    timer = setTimeout(hideToast, 5000);
}
