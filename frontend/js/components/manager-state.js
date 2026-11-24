const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = new URL('../../assets/icons/manager-icons.svg', import.meta.url).href;

let noticeTimer;
export function notifyManager(message) {
    const notice = document.getElementById('manager-notice');
    if (!notice || !message) return;
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.hidden = false;
    if (notice.showPopover && !notice.matches(':popover-open')) notice.showPopover();
    noticeTimer = setTimeout(() => {
        if (notice.matches(':popover-open')) notice.hidePopover();
        notice.hidden = true;
        notice.textContent = '';
    }, 5000);
}

export function managerIcon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'manager-icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `${ICONS}#${name}`);
    svg.append(use);
    return svg;
}

export function renderManagerState(container, { type, title, description }) {
    container.dataset.state = type;
    container.setAttribute('aria-busy', String(type === 'loading'));
    container.querySelector('[data-state-title]').textContent = title;
    container.querySelector('[data-state-description]').textContent = description;
    container.querySelector('[data-state-icon]').replaceChildren(managerIcon(
        type === 'loading' ? 'loader-circle' : type === 'error' ? 'circle-alert' : 'shield-check'));
}
