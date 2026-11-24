// Isolated browser QA of the real widget. No real database or provider requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../frontend/', import.meta.url));
const fixture = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/css/base/variables.css"><link rel="stylesheet" href="/css/base/reset.css"><link rel="stylesheet" href="/css/base/global.css"></head>
<body><main><h1>Kiểm thử chatbot</h1></main><script type="module">
import {setupCustomerChat} from '/js/components/customer-chat.js';
const nativeFetch=window.fetch;
let saved=[];
window.fetch=async (url,options)=>{
 if(!String(url).includes('/api/')) return nativeFetch(url,options);
 let data;
 if(String(url).endsWith('/auth/me')) data={user:{MaNguoiDung:'12',VaiTro:0},csrf_token:'csrf'};
 else if(String(url).endsWith('/unread')) data={count:0};
 else if(String(url).endsWith('/ai/messages')) data={items:saved,has_more:false};
 else if(String(url).endsWith('/ai')) {
  const products=[{MaThuoc:7,TenThuoc:'Sản phẩm kiểm thử',PhanLoai:true,HinhAnh:'',DonViGia:[{MaDonGia:3,GiaBan:10000,DonViTinh:'Hộp',ConHang:true}]}];
  saved=[{id:'1',role:'KHACH_HANG',text:JSON.parse(options.body).text,products:[],at:'2026-11-24T10:00:00+07:00'},{id:'2',role:'AI',text:'Liên hệ với dược sĩ để được tư vấn.',products,at:'2026-11-24T10:00:01+07:00'}];
  data={text:saved[1].text,products,messages:saved};
 } else data={items:[],has_more:false};
 return new Response(JSON.stringify(data),{status:200});
};
setupCustomerChat();window.dispatchEvent(new CustomEvent('auth-changed',{detail:{user:{MaNguoiDung:'12',VaiTro:0}}}));
</script></body></html>`;
const server = createServer(async (req, res) => {
    try {
        if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(fixture); }
        const filename = path.resolve(root, '.' + new URL(req.url, 'http://fixture').pathname);
        if (!filename.startsWith(root)) { res.writeHead(403); return res.end(); }
        const content = await readFile(filename);
        res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css' })[path.extname(filename)] || 'application/octet-stream');
        res.end(content);
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const artifacts = await mkdtemp(path.join(tmpdir(), 'lanyen-ai-qa-'));
const profile = await mkdtemp(path.join(tmpdir(), 'lanyen-ai-chrome-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
    let port;
    for (let n = 0; n < 100 && !port; n++) {
        try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; }
        catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(port, 'Chrome startup');
    const meta = await (await fetch('http://127.0.0.1:' + port + '/json/version')).json();
    socket = new WebSocket(meta.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let next = 0;
    const pending = new Map(), errors = [];
    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
        if (pending.has(data.id)) { const p = pending.get(data.id); clearTimeout(p.timer); pending.delete(data.id); data.error ? p.reject(data.error) : p.resolve(data.result); }
    };
    const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++next, timer = setTimeout(() => reject(new Error(method + ' timeout')), 15000);
        pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params) => call(method, params, sessionId);
    const evaluate = async expression => {
        const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    const wait = expression => evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(${expression}){clearInterval(t);resolve(true)}else if(++n>100){clearInterval(t);reject(Error('UI timeout'))}},50)})`);
    await command('Runtime.enable'); await command('Page.enable');
    await command('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/' });
    await wait(`document.getElementById('customer-chat-button')`);
    await evaluate(`document.getElementById('customer-chat-button').click();document.querySelector('.chat-modes button').click()`);
    await evaluate(`document.getElementById('chat-ai-input').value='Hỏi thuốc';document.querySelector('.chat-ai form').requestSubmit()`);
    await wait(`document.querySelector('.chat-ai .ai-product-card')`);
    for (const [width, height] of [[1440, 900], [375, 667], [320, 568], [844, 390]]) {
        await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
        await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const geometry = await evaluate(`(()=>{const p=document.querySelector('.customer-chat').getBoundingClientRect(),s=document.querySelector('.chat-ai button[type=submit]').getBoundingClientRect(),log=document.querySelector('.chat-ai .chat-log').getBoundingClientRect();return {inside:p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight,sendVisible:s.bottom<=p.bottom&&s.top>=p.top,logHeight:log.height}})()`);
        assert.ok(geometry.inside, JSON.stringify({ width, height, geometry }));
        assert.ok(geometry.sendVisible, JSON.stringify({ width, height, geometry }));
        assert.ok(geometry.logHeight >= 36, JSON.stringify({ width, height, geometry }));
        const screenshot = await command('Page.captureScreenshot', { format: 'png' });
        await writeFile(path.join(artifacts, width + 'x' + height + '.png'), Buffer.from(screenshot.data, 'base64'));
    }
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.ai-product-action[href]')).textDecorationLine`), 'none');
    assert.equal(await evaluate(`document.querySelector('.ai-send svg')!==null`), true);
    await evaluate(`document.querySelector('.chat-ai .ai-product-card button').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('.chat-modes button')[1].getAttribute('aria-pressed')`), 'true');
    await evaluate(`document.querySelector('.chat-close').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('.chat-ai article').length`), 2);
    await evaluate(`document.getElementById('customer-chat-button').click();document.querySelector('.chat-modes button').click()`);
    await wait(`document.querySelectorAll('.chat-ai article').length===2`);
    assert.deepEqual(errors, []);
    console.log('AI browser QA passed: modes, product card, pharmacist handoff, clearing, 4 viewports. Screenshots: ' + artifacts);
} finally {
    socket?.close(); chrome.kill(); server.close();
}
