import { renderAvatar } from './customer-account.js';
import { getSession } from '../api/auth.js';

export function setupAccountSidebar() {
    const main = document.getElementById('main');
    const content = document.createElement('div'); content.className = 'customer-account-content';
    content.append(...main.childNodes);
    const layout = document.createElement('div'); layout.className = 'customer-account-layout';
    const aside = document.createElement('aside'); aside.className = 'customer-account-sidebar';
    const identity = document.createElement('div'); identity.className = 'account-sidebar-identity';
    const avatar = document.createElement('div'); avatar.className = 'customer-avatar'; avatar.setAttribute('aria-hidden', 'true');
    const name = document.createElement('p'); name.textContent = 'Tài khoản của tôi'; identity.append(avatar, name);
    const nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Điều hướng tài khoản');
    for (const [file, text] of [['profile.html', 'Thông tin cá nhân'], ['points.html', 'Xu tích lũy'], ['orders.html', 'Đơn hàng của tôi'], ['addresses.html', 'Địa chỉ nhận hàng']]) {
        const link = document.createElement('a'); link.href = file; link.textContent = text;
        if (location.pathname.endsWith(`/${file}`)) link.setAttribute('aria-current', 'page'); nav.append(link);
    }
    aside.append(identity, nav); layout.append(aside, content); main.append(layout);
    let version = 0;
    function update(user) { version++; name.textContent = user?.HoTen || 'Tài khoản của tôi'; renderAvatar(avatar, user); }
    window.addEventListener('auth-changed', event => update(event.detail?.user));
    window.addEventListener('profile-updated', event => update(event.detail?.user));
    update(null);
    async function load() {
        const attempt = ++version;
        try { const data = await getSession(); if (attempt === version) update(data.user); }
        catch { if (attempt === version) update(null); }
    }
    window.addEventListener('pagehide', () => version++);
    window.addEventListener('pageshow', event => { if (event.persisted) load(); });
    load();
}
