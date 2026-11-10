// Native Chrome DevTools smoke checks; no installed browser automation dependency.
// Requires a local Chrome debugging port 9222, frontend 5500 and real Flask 5000.
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
    console.log('PASS: real Flask anonymous session, desktop/tablet/mobile layout, dialog focus, Escape, validation, labels and OTP autofill.');
    console.log(`Screenshots: ${path.join(tmpdir(), 'lanyen-desktop.png')}, ${path.join(tmpdir(), 'lanyen-mobile-auth.png')}`);
    if (process.argv.includes('--firebase')) {
        const sdkCheck = await evaluate(`Promise.race([
            import('/js/config/firebase.js').then(module => module.prepareFirebase()).then(() => 'SDK_READY').catch(error => error.code || 'SDK_LOAD_FAILED'),
            new Promise(resolve => setTimeout(() => resolve('SDK_TIMEOUT'), 12000))
        ])`);
        console.log('Firebase SDK initialization:', sdkCheck);
        assert.equal(sdkCheck, 'SDK_READY');
    }
} finally {
    await call('Target.closeTarget', { targetId });
    socket.close();
}
