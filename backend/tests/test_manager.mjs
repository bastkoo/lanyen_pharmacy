import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANAGER_VIEWS, resolveManagerView, managerAccess, accountInitials } from '../../frontend/js/utils/manager-view.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const htmlPath = path.join(root, 'frontend/pages/manager/index.html');
const html = readFileSync(htmlPath, 'utf8');

test('manager access requires exact current role and unlocked status', () => {
    assert.equal(managerAccess({ VaiTro: 2, TrangThai: false }), 'allowed');
    for (const role of [0, 1, 99]) assert.equal(managerAccess({ VaiTro: role, TrangThai: false }), 'forbidden');
    assert.equal(managerAccess({ VaiTro: 2, TrangThai: true }), 'locked');
    for (const user of [null, {}, { VaiTro: '2', TrangThai: false }, { VaiTro: 2 }]) assert.equal(managerAccess(user), 'invalid');
});

test('navigation has only six valid destinations and rejects inherited keys', () => {
    assert.equal(Object.keys(MANAGER_VIEWS).length, 6);
    assert.equal(resolveManagerView(''), 'overview');
    for (const key of Object.keys(MANAGER_VIEWS)) {
        assert.equal(resolveManagerView(`#${key}`), key);
        assert.ok(html.includes(`data-manager-view="${key}"`));
    }
    for (const key of ['__proto__', 'constructor', 'unknown', '<script>']) assert.equal(resolveManagerView(`#${key}`), null);
});

test('Vietnamese account initials tolerate whitespace and missing names', () => {
    assert.equal(accountInitials('  Nguyễn Thị Yến  '), 'TY');
    assert.equal(accountInitials('Đặng'), 'Đ');
    assert.equal(accountInitials(''), 'QL');
});

test('manager assets, SVG references and HTML IDs are valid', () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, new Set(ids).size);
    const sprite = readFileSync(path.join(root, 'frontend/assets/icons/manager-icons.svg'), 'utf8');
    for (const match of html.matchAll(/(?:href|src)="(\.\.\/[^"#]+)(?:#([^"]+))?"/g)) {
        assert.ok(existsSync(path.resolve(path.dirname(htmlPath), match[1])), match[1]);
        if (match[2] && match[1].endsWith('.svg')) assert.ok(sprite.includes(`id="${match[2]}"`));
    }
    for (const input of ['phone', 'otp', 'full-name']) assert.ok(html.includes(`for="${input}"`));
    assert.match(html, /id="manager-shell"[^>]*hidden/);
    assert.match(html, /lang="vi"/);
});

test('layout uses actual session API without token storage, fabricated data or unsafe HTML', () => {
    for (const file of ['layouts/manager.js', 'utils/manager-view.js', 'components/manager-state.js']) {
        const js = readFileSync(path.join(root, 'frontend/js', file), 'utf8');
        assert.doesNotMatch(js, /localStorage|sessionStorage|innerHTML|insertAdjacentHTML|eval\(/);
    }
    const layout = readFileSync(path.join(root, 'frontend/js/layouts/manager.js'), 'utf8');
    assert.match(layout, /getSession\(\)/);
    assert.match(layout, /logoutSession\(\)/);
    assert.doesNotMatch(layout, /\/manager\/products|\/manager\/inventory|\/manager\/categories/);
});

test('critical manager text and focus token pairs meet AA contrast', () => {
    const luminance = hex => {
        const [r, g, b] = hex.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16) / 255)
            .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return .2126 * r + .7152 * g + .0722 * b;
    };
    const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
    for (const [text, bg] of [['24362F', 'FFFFFF'], ['586860', 'FFFFFF'], ['586860', 'F5F7F6'],
                            ['106B48', 'E8F5EE'], ['785313', 'FFF7E5'], ['A52D35', 'FFF1F1'],
                            ['FFFFFF', '106B48'], ['FFFFFF', '16865B']]) {
        assert.ok(ratio(text, bg) >= 4.5, `${text}/${bg}: ${ratio(text, bg)}`);
    }
    assert.ok(ratio('106B48', 'FFFFFF') >= 3);
});
