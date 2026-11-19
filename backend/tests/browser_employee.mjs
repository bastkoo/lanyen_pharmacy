import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function checkEmployee({ evaluate: run, waitFor, command, key, baseUrl, root, setScenario }) {
    const navigate = async hash => {
        await command('Page.navigate', { url: `${baseUrl}/pages/employee/index.html${hash}` });
        await new Promise(resolve => setTimeout(resolve, 80));
        await run(`window.dispatchEvent(new Event('focus'))`);
    };
    const ready = () => waitFor(`document.querySelector('#employee-workspace')?.hidden===false`);
    try {
        setScenario('employee'); await navigate('#messages'); await ready();
        assert.equal(await run(`document.querySelectorAll('[data-employee-view]').length`), 4);
        assert.equal(await run(`new Set(Array.from(document.querySelectorAll('[id]'),node=>node.id)).size===document.querySelectorAll('[id]').length`), true);
        for (const view of ['messages', 'orders', 'returns']) {
            await run(`if(innerWidth<=760&&document.querySelector('#employee-menu-toggle').getAttribute('aria-expanded')==='false')document.querySelector('#employee-menu-toggle').click()`);
            await run(`document.querySelector('[data-employee-view="${view}"]').click()`);
            await waitFor(`document.querySelector('#employee-${view}').hidden===false`);
            assert.equal(await run(`document.querySelectorAll('.employee-view:not([hidden])').length`), 1);
            assert.equal(await run(`document.querySelector('[data-employee-view="${view}"]').getAttribute('aria-current')`), 'page');
            for (const width of [1440, 1024, 768, 375, 320]) {
                await command('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
                assert.equal(await run('document.documentElement.scrollWidth<=innerWidth'), true, `${view} fits ${width}px`);
                if ([1440, 375].includes(width)) {
                    await run(`window.scrollTo({top:0,behavior:'instant'})`);
                    const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
                    await writeFile(path.join(root, 'docs', `EMPLOYEE_${view}_${width}.png`), Buffer.from(shot.data, 'base64'));
                }
            }
        }
        assert.equal(await run(`Array.from(document.querySelectorAll('#employee-messages input,#employee-messages textarea,#employee-messages button,#employee-returns input')).every(node=>node.disabled)`), true);
        assert.equal(await run(`performance.getEntriesByType('resource').some(entry=>['/api/cart','/api/orders','/api/manager','/api/messages','/api/returns'].some(prefix=>new URL(entry.name).pathname.startsWith(prefix)))`), false, 'Preview must not call business APIs');
        await navigate('#not-a-view'); await ready();
        assert.equal(await run('location.hash'), '#orders');
        await run(`document.querySelector('#employee-account summary').focus();document.querySelector('#employee-account summary').click()`);
        await key('Escape', 27);
        assert.equal(await run(`document.querySelector('#employee-account').open`), false);
        for (const [scenario, phrase] of [['manager', 'Khu vực dành cho nhân viên'], ['customer', 'Khu vực dành cho nhân viên'], ['anonymous', 'Đăng nhập để bắt đầu công việc'], ['locked', 'Tài khoản đã bị khóa'], ['error', 'Chưa thể kiểm tra tài khoản']]) {
            setScenario(scenario); await navigate('#orders');
            try { await waitFor(`document.querySelector('#employee-gate-title')?.textContent===${JSON.stringify(phrase)}`); }
            catch (error) {
                console.log('Employee gate diagnostic:', scenario, await run(`({ title:document.querySelector('#employee-gate-title')?.textContent, state:document.querySelector('#employee-state')?.textContent, workspaceHidden:document.querySelector('#employee-workspace')?.hidden })`));
                throw error;
            }
            assert.equal(await run(`document.querySelector('#employee-workspace').hidden`), true);
            if (scenario === 'anonymous') {
                await run(`document.querySelector('#employee-gate-login').click()`);
                await waitFor(`document.querySelector('#auth-dialog').open`);
                assert.equal(await run(`document.querySelector('#main').inert`), true);
                await key('Escape', 27);
                await waitFor(`!document.querySelector('#auth-dialog').open && !document.querySelector('#main').inert`);
            }
        }
        setScenario('employee'); await run(`document.querySelector('#employee-retry').click()`); await ready();
        setScenario('anonymous'); await run(`window.dispatchEvent(new Event('focus'))`);
        await waitFor(`document.querySelector('#employee-workspace').hidden && !document.querySelector('#employee-gate-login').hidden`);
        setScenario('employee'); await navigate('#returns'); await ready();
        await run(`document.querySelector('#employee-account summary').click();document.querySelector('#employee-logout').click()`);
        await waitFor(`document.querySelector('#employee-workspace').hidden && document.querySelector('#employee-account').hidden`);
        console.log('PASS: employee VaiTro=1 only; sidebar navigation; orders access with messaging/returns previews; keyboard/account/auth, role rejection, locked/expired/network/retry/logout, 1440–320px. API MOCK.');
        console.log(`Employee screenshots: ${path.join(root, 'docs')}`);
    } finally { setScenario('anonymous'); }
}
