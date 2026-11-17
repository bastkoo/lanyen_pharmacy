import { validHttps } from '../utils/product-validation.js';

export function renderAvatar(element, user) {
    const initial = Array.from(user?.HoTen?.trim().split(/\s+/u).at(-1) || '?')[0].toLocaleUpperCase('vi-VN');
    element.replaceChildren(document.createTextNode(initial));
    if (validHttps(user?.AnhDaiDien)) {
        const image = document.createElement('img'); image.src = user.AnhDaiDien; image.alt = ''; image.referrerPolicy = 'no-referrer';
        image.addEventListener('error', () => { if (image.parentElement === element) element.replaceChildren(document.createTextNode(initial)); }, { once: true });
        element.replaceChildren(image);
    }
}

export function setupCustomerAccount() {
    const logout = document.getElementById('logout-button');
    const wrapper = document.createElement('div'); wrapper.className = 'customer-account'; wrapper.hidden = true;
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.id = 'account-avatar-button'; trigger.className = 'customer-avatar';
    trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'customer-account-menu');
    const menu = document.createElement('nav'); menu.id = 'customer-account-menu'; menu.className = 'customer-account-menu'; menu.hidden = true; menu.setAttribute('aria-label', 'Tài khoản của tôi');
    for (const [file, text] of [['profile.html', 'Thông tin cá nhân'], ['points.html', 'Điểm tích lũy'], ['orders.html', 'Đơn hàng của tôi'], ['addresses.html', 'Địa chỉ nhận hàng']]) {
        const link = document.createElement('a'); link.href = `../customer/${file}`; link.textContent = text; menu.append(link);
    }
    const management = document.createElement('a'); management.textContent = 'Quản lý'; management.hidden = true; management.dataset.management = ''; menu.append(management);
    logout.replaceWith(wrapper); wrapper.append(trigger, menu); menu.append(logout); logout.className = 'customer-logout';
    function close(returnFocus = false) { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (returnFocus) trigger.focus(); }
    trigger.addEventListener('click', () => { menu.hidden = !menu.hidden; trigger.setAttribute('aria-expanded', String(!menu.hidden)); });
    menu.addEventListener('click', event => { if (event.target.closest('a,button')) close(); });
    wrapper.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); close(true); } });
    document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) close(); });
    document.addEventListener('focusin', event => { if (!wrapper.contains(event.target)) close(); });
    return user => {
        wrapper.hidden = !user; logout.hidden = !user;
        management.hidden = ![1, 2].includes(user?.VaiTro);
        if (!management.hidden) management.href = user.VaiTro === 2 ? '../manager/index.html#overview' : '../employee/index.html';
        else management.removeAttribute('href');
        if (!user) { close(); return; }
        renderAvatar(trigger, user); trigger.setAttribute('aria-label', `Tài khoản của ${user.HoTen}`);
    };
}
