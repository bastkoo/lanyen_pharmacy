import { getSession, getPoints } from '../api/auth.js';
import { authMessage } from '../components/auth-dialog.js';
import { setupAccountSidebar } from '../components/customer-account-sidebar.js';
import { rewardCoin } from '../components/reward-coin.js';

setupAccountSidebar();
const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result; };
const number = value => new Intl.NumberFormat('vi-VN').format(BigInt(value));
let user, page = 1, pages = 0, version = 0, disposed = false;
function timestamp(value) { const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u.exec(value); return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : 'Chưa có thời gian'; }
async function load() {
    if (!user || disposed) return;
    const attempt = ++version; $('points-state').textContent = 'Đang tải xu tích lũy…'; $('points-retry').hidden = true;
    $('points-prev').disabled = $('points-next').disabled = true; $('points-content').setAttribute('aria-busy', 'true');
    try {
        const data = await getPoints(page, user.MaNguoiDung);
        if (disposed || attempt !== version) return;
        if (data.code !== 'POINTS_LISTED' || !Array.isArray(data.items) || !Number.isSafeInteger(data.pages) || data.pages < 0) throw { code: 'INVALID_RESPONSE' };
        pages = data.pages;
        if (page > Math.max(1, pages)) { page = Math.max(1, pages); return load(); }
        $('points-balance').textContent = number(data.balance); $('points-history').replaceChildren();
        for (const entry of data.items) {
            const item = node('li', undefined, 'points-entry'), detail = node('div');
            detail.append(node('h3', entry.LyDo), node('p', timestamp(entry.ThoiGianTichDiem)));
            const delta = BigInt(entry.SoDiem) * (entry.LoaiGiaoDich ? 1n : -1n);
            const amount = node('strong', `${delta >= 0n ? '+' : '−'}${number(delta >= 0n ? delta : -delta)} `, delta >= 0n ? 'points-credit' : 'points-debit');
            amount.append(rewardCoin()); item.append(detail, amount); $('points-history').append(item);
        }
        $('points-content').hidden = false; $('points-state').textContent = data.items.length ? '' : 'Bạn chưa có giao dịch xu tích lũy.';
        $('points-pagination').hidden = pages <= 1; $('points-page').textContent = `Trang ${page} / ${pages}`;
        $('points-prev').disabled = page <= 1; $('points-next').disabled = page >= pages;
    } catch (error) {
        if (disposed || attempt !== version) return;
        $('points-content').hidden = true; $('points-state').textContent = authMessage(error); $('points-retry').hidden = false;
        if (['SESSION_CHANGED', 'UNAUTHENTICATED', 'ACCOUNT_LOCKED'].includes(error.code)) window.dispatchEvent(new Event('focus'));
    } finally { if (attempt === version) $('points-content').setAttribute('aria-busy', 'false'); }
}
function receive(next) {
    const changed = String(user?.MaNguoiDung) !== String(next?.MaNguoiDung); user = next || null;
    if (!changed) return;
    version++; page = 1; $('points-content').hidden = true; $('points-history').replaceChildren(); $('points-balance').textContent = '—';
    $('points-login').hidden = Boolean(user); $('points-retry').hidden = true;
    if (user) load(); else $('points-state').textContent = 'Đăng nhập để xem xu tích lũy của bạn.';
}
async function initialize() {
    const attempt = ++version;
    try { const data = await getSession(); if (!disposed && attempt === version) { if (String(user?.MaNguoiDung) === String(data.user.MaNguoiDung)) load(); else receive(data.user); } }
    catch (error) { if (disposed || attempt !== version) return; if (['UNAUTHENTICATED', 'ACCOUNT_LOCKED', 'FORBIDDEN'].includes(error.code)) { receive(null); $('points-state').textContent = 'Đăng nhập để xem xu tích lũy của bạn.'; $('points-login').hidden = false; } else { $('points-state').textContent = authMessage(error); $('points-retry').hidden = false; } }
}
$('points-prev').addEventListener('click', () => { if (page > 1) { page--; load(); } });
$('points-next').addEventListener('click', () => { if (page < pages) { page++; load(); } });
$('points-login').addEventListener('click', () => $('login-button').click());
$('points-retry').addEventListener('click', () => user ? load() : initialize());
window.addEventListener('auth-changed', event => receive(event.detail?.user));
window.addEventListener('pagehide', () => { disposed = true; version++; });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; initialize(); } });
initialize();
