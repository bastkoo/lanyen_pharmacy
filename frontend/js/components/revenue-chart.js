import { formatStoredDate, formatVnd } from '../utils/dashboard-format.js';

const NS = 'http://www.w3.org/2000/svg';
const compact = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const shortDay = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const element = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };

export function renderRevenueChart(container, data) {
    if (!Array.isArray(data.items) || !data.items.length) throw new Error('INVALID_RESPONSE');
    const points = data.items.map(item => {
        if (typeof item.amount !== 'string' || !/^-?\d+$/.test(item.amount)) throw new Error('INVALID_RESPONSE');
        return { ...item, value: Number(BigInt(item.amount)) };
    });
    const min = Math.min(0, ...points.map(point => point.value));
    const max = Math.max(0, ...points.map(point => point.value));
    const extent = max - min || 1;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 800 190');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Doanh thu theo ngày. Bảng dữ liệu chi tiết nằm ngay sau biểu đồ.');
    for (const y of [10, 95, 180]) {
        const line = document.createElementNS(NS, 'line');
        for (const [key, value] of Object.entries({ x1: 0, x2: 800, y1: y, y2: y, class: 'dashboard-chart-grid' })) line.setAttribute(key, value);
        svg.append(line);
    }
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'}${index * 800 / Math.max(1, points.length - 1)},${180 - (point.value - min) / extent * 170}`).join(' '));
    path.setAttribute('class', 'dashboard-chart-line');
    svg.append(path);
    const plot = element('div'); plot.className = 'dashboard-chart-plot';
    const axis = element('div'); axis.className = 'dashboard-chart-y'; axis.setAttribute('aria-hidden', 'true');
    for (const value of [max, (max + min) / 2, min]) axis.append(element('span', compact.format(value)));
    const graphic = element('div'); graphic.className = 'dashboard-chart-graphic'; graphic.append(svg);
    const dates = element('div'); dates.className = 'dashboard-chart-x'; dates.setAttribute('aria-hidden', 'true');
    for (const index of [0, Math.floor((points.length - 1) / 2), points.length - 1]) {
        dates.append(element('span', shortDay.format(new Date(points[index].date + 'T00:00:00Z'))));
    }
    graphic.append(dates); plot.append(axis, graphic);
    const details = element('details'); details.className = 'dashboard-chart-data';
    details.append(element('summary', 'Xem dữ liệu theo ngày'));
    const table = element('table'); const caption = element('caption', 'Doanh thu theo ngày (VND)');
    const head = element('thead'); const heading = element('tr');
    for (const text of ['Ngày', 'Doanh thu']) { const cell = element('th', text); cell.scope = 'col'; heading.append(cell); }
    head.append(heading); const body = element('tbody');
    for (const point of points) { const row = element('tr'); row.append(element('td', formatStoredDate(point.date)), element('td', formatVnd(point.amount))); body.append(row); }
    table.append(caption, head, body); details.append(table);
    container.replaceChildren(plot, details);
}
