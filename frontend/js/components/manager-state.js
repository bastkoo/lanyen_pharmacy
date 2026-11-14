const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = new URL('../../assets/icons/manager-icons.svg', import.meta.url).href;

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
