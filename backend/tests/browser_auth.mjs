// Native Chrome DevTools smoke checks; no installed browser automation dependency.
// Requires a local Chrome debugging port 9222, frontend 5500 and Flask 5000. Use --fixture only with serve_auth_fixture.py.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const version = await (await fetch('http://127.0.0.1:9222/json/version')).json();
const socket = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map();
socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
        const [resolve, reject, timer] = pending.get(data.id);
        clearTimeout(timer); pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message)); else resolve(data.result);
    }
};
function call(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
        const key = ++id;
        const timer = setTimeout(() => { pending.delete(key); reject(new Error(`Timeout: ${method}`)); }, 30000);
        pending.set(key, [resolve, reject, timer]);
        socket.send(JSON.stringify({ id: key, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
}
const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
const command = (method, params) => call(method, params, sessionId);
async function evaluate(expression) {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
}
try {
    await command('Page.enable');
    await command('Network.enable');
    await command('Network.setCacheDisabled', { cacheDisabled: true });
    if (process.argv.includes('--fixture')) {
        await command('Page.addScriptToEvaluateOnNewDocument', { source: `
            const realFetch = window.fetch.bind(window);
            window.fetch = (url, options) => realFetch(
                typeof url === 'string' ? url.replace(':5000/api/', ':5001/api/') : url, options);
        ` });
    }
    await command('Page.bringToFront');
    await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await command('Page.navigate', { url: 'http://localhost:5500/pages/customer/home.html' });
    await evaluate(`new Promise((resolve, reject) => {
        let tries = 0;
        const timer = setInterval(() => {
            if (document.querySelector('#header-status')?.textContent === 'Bạn chưa đăng nhập') { clearInterval(timer); resolve(true); }
            else if (++tries > 100) { clearInterval(timer); reject(new Error('Session check did not finish')); }
        }, 100);
    })`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
    await evaluate(`document.querySelector('#start-login').click()`);
    assert.equal(await evaluate(`document.querySelector('#auth-dialog').open`), true);
    assert.equal(await evaluate(`document.activeElement.id`), 'phone');
    assert.equal(await evaluate(`document.querySelector('main').inert`), true);
    await evaluate(`document.querySelector('#close-auth').focus()`);
    await command('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await evaluate(`document.activeElement === document.querySelector('#phone-form button[type=submit]')`), true);
    await evaluate(`document.querySelector('#phone').value='invalid'; document.querySelector('#phone-form').requestSubmit()`);
    assert.equal(await evaluate(`document.querySelector('#phone').getAttribute('aria-invalid')`), 'true');
    await command('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await evaluate('new Promise(resolve => setTimeout(resolve, 100))');
    assert.equal(await evaluate(`document.querySelector('#auth-dialog').open`), false);
    assert.equal(await evaluate(`document.activeElement.id`), 'start-login');
    assert.equal(await evaluate(`document.querySelector('main').inert`), false);
    const desktop = await command('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(tmpdir(), 'lanyen-desktop.png'), Buffer.from(desktop.data, 'base64'));
    for (const width of [768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile: true });
        assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `Page overflow at ${width}`);
        await evaluate(`document.querySelector('#login-button').click()`);
        assert.equal(await evaluate(`document.querySelector('#auth-dialog').getBoundingClientRect().width <= innerWidth`), true);
        assert.equal(await evaluate(`document.querySelector('#otp').autocomplete`), 'one-time-code');
        assert.equal(await evaluate(`document.querySelector('#phone').labels.length`), 1);
        if (width === 375) {
            const screenshot = await command('Page.captureScreenshot', { format: 'png' });
            writeFileSync(path.join(tmpdir(), 'lanyen-mobile-auth.png'), Buffer.from(screenshot.data, 'base64'));
        }
        await evaluate(`document.querySelector('#close-auth').click()`);
    }
    if (process.argv.includes('--fixture')) {
        const fixturePhone = '09' + Date.now().toString().slice(-8);
        async function waitFor(expression) {
            await evaluate(`new Promise((resolve, reject) => {
                let tries = 0;
                const timer = setInterval(() => {
                    if (${expression}) { clearInterval(timer); resolve(true); }
                    else if (++tries > 100) { clearInterval(timer); reject(new Error('UI timeout')); }
                }, 50);
            })`);
        }
        async function submit(form, field, value) {
            await evaluate(`document.getElementById('${field}').value = ${JSON.stringify(value)};
                document.getElementById('${form}').requestSubmit()`);
        }
        await evaluate(`document.querySelector('#login-button').click()`);
        await submit('phone-form', 'phone', fixturePhone);
        await waitFor(`!document.querySelector('#otp-form').hidden && !document.querySelector('#otp').disabled`);
        await submit('otp-form', 'otp', '000000');
        await waitFor(`document.querySelector('#otp').getAttribute('aria-invalid') === 'true'`);
        await waitFor(`!document.querySelector('#otp').disabled`);
        await submit('otp-form', 'otp', '123456');
        await waitFor(`!document.querySelector('#profile-form').hidden && !document.querySelector('#full-name').disabled`);
        await submit('profile-form', 'full-name', 'Nguyễn An');
        await waitFor(`!document.querySelector('#member-content').hidden`);
        assert.equal(await evaluate(`document.querySelector('#account-name').textContent`), 'Nguyễn An');
        assert.equal(await evaluate(`document.querySelector('#auth-dialog').open`), false);
        await command('Page.reload');
        await waitFor(`!document.querySelector('#member-content').hidden`);
        await evaluate(`document.querySelector('#logout-button').click()`);
        await waitFor(`!document.querySelector('#guest-content').hidden && !document.querySelector('#logout-button').disabled`);
        await evaluate(`document.querySelector('#login-button').click()`);
        await submit('phone-form', 'phone', fixturePhone);
        await waitFor(`document.querySelector('#auth-status').textContent.includes('Có quá nhiều')`);
        console.log('PASS: browser + Flask + fake Redis Lua + mock PostgreSQL: wrong OTP, registration, reload session, logout, resend throttling.');
    }
    console.log('PASS: real Flask anonymous session, desktop/tablet/mobile layout, dialog focus, Escape, validation, labels and OTP autofill.');
    console.log(`Screenshots: ${path.join(tmpdir(), 'lanyen-desktop.png')}, ${path.join(tmpdir(), 'lanyen-mobile-auth.png')}`);

} catch (error) {
    console.error(await evaluate(`JSON.stringify({ status: document.querySelector('#auth-status')?.textContent, phone: document.querySelector('#phone')?.value, page: document.querySelector('#page-status')?.textContent })`));
    throw error;
} finally {
    await call('Target.closeTarget', { targetId });
    socket.close();
}
