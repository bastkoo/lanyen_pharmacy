// Native dialogs provide keyboard containment; restore focus after dismissal.
export function setupEmployeeDialog(dialog, { closeButton, canClose = () => true, onClose = () => {}, fallback } = {}) {
    let opener;
    const close = (force = false) => { if (!force && !canClose()) return; if (dialog.open) dialog.close(); dialog.hidden = true; };
    closeButton?.addEventListener('click', () => close());
    dialog.addEventListener('cancel', event => { if (!canClose()) event.preventDefault(); });
    dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || event.defaultPrevented) return;
        const controls = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]')]
            .filter(control => control.tabIndex >= 0 && control.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    dialog.addEventListener('close', () => {
        if (dialog.open) return;
        dialog.hidden = true; onClose();
        if (!document.querySelector('dialog[open]')) {
            const target = opener?.isConnected && opener.getClientRects().length ? opener : fallback;
            target?.focus();
        }
    });
    return {
        open(focusTarget) {
            if (!dialog.open) { opener = document.activeElement; dialog.hidden = false; dialog.showModal(); }
            focusTarget?.focus();
        },
        close
    };
}
