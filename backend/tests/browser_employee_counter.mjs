import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

let orders = [], requests = new Map(), created = 0, awards = 0, paid = false;
const wallet = phone => !phone || ['0900000001','0900000002'].includes(phone) ? 0 : phone==='0900000003' ? 1000 : 20;
const product = { MaThuoc:7, MaLoaiThuoc:1, TenThuoc:'Thuốc <b>quầy</b>', MaVach:'0893000000123', HinhAnh:'https://example.invalid/counter.png', DonViGia:[{ MaDonGia:3, DonViTinh:'Viên', GiaBan:10000, GiaKhuyenMai:8000, KhuyenMai:{TenChuongTrinh:'Ưu đãi tại quầy'}, ConHang:true }, {MaDonGia:4,DonViTinh:'Hộp',GiaBan:100000,GiaKhuyenMai:null,ConHang:true}] };
function order(id, total, method, name = 'Khách kiểm thử', state = 3) {
    return { MaDonHang:String(id), NgayDat:'2026-11-19T10:00:00+07:00', KenhDatHang:true, KhachHang:{ HoTen:name, SDT:'+84900000000' }, TongTien:'10000', TienGiamGia:String(10000-total), TongThanhToan:String(total), DoiDiem:total<10000,
        TrangThaiDonHang:state, TrangThaiThanhToan:state===3?1:0, PhuongThucThanhToan:method, CanPrint:state===3, payment_environment:method===1?'sandbox':undefined, GhiChu:'Bán tại quầy', XuDaCong:state===3&&total>=1000?String(Math.floor(total/1000)):null,
        items:[{ ...product, MaChiTiet:'1', SoLuong:1, DonViTinh:'Viên', DonGia:'10000', ThanhTien:'10000', MaVach:'0893000000123' }] };
}
export function counterCatalogFixture(req, json) {
    const url = new URL(req.url,'http://fixture');
    if (url.pathname==='/api/categories') return json(200,{items:[{MaLoaiThuoc:1,TenLoaiThuoc:'Thuốc kiểm thử'}],total:1});
    const search=url.searchParams.get('search')||'';
    return json(200,{items:!search||search==='0893000000123'||product.TenThuoc.includes(search)?[product]:[],total:!search||search==='0893000000123'||product.TenThuoc.includes(search)?1:0});
}
export async function counterFixture(req,json) {
    const url=new URL(req.url,'http://fixture'), parts=url.pathname.split('/'), id=parts[5];
    if (url.pathname.endsWith('/products')) return counterCatalogFixture(req,json);
    if (url.pathname.endsWith('/completed')) { const search=url.searchParams.get('search')||''; const found=orders.filter(value=>value.TrangThaiDonHang===3&&(!search||value.MaDonHang.includes(search)||value.KhachHang.SDT.includes(search))); return json(200,{items:found,total:found.length,per_page:20,page:1}); }
    if (url.pathname.endsWith('/customer')) { const phone=url.searchParams.get('phone'); return json(200,{code:'COUNTER_CUSTOMER',SDT:phone,exists:phone!=='0900000001',HoTen:phone==='0900000001'?'':'Khách kiểm thử',SoXu:String(wallet(phone))}); }
    if (url.pathname.endsWith('/pending')) return json(200,{items:orders.filter(value=>[0,1].includes(value.TrangThaiDonHang))});
    if(req.method==='GET') { const value=orders.find(value=>value.MaDonHang===id); if(paid&&value?.TrangThaiDonHang===0){value.TrangThaiDonHang=1;value.TrangThaiThanhToan=1;} return json(200,{code:'EMPLOYEE_ORDER_DETAIL',order:value}); }
    assert.equal(req.headers['x-csrf-token'],'fixture-csrf'); let raw='';for await(const chunk of req)raw+=chunk;const data=JSON.parse(raw);
    const value=orders.find(value=>value.MaDonHang===id);
    if(url.pathname.endsWith('/complete')) { assert.deepEqual(data,{}); if(value.TrangThaiThanhToan!==1)return json(409,{code:'PAYMENT_PENDING'});if(value.TrangThaiDonHang!==3){value.TrangThaiDonHang=3;value.CanPrint=true;value.XuDaCong=String(Math.floor(Number(value.TongThanhToan)/1000));awards++;} return json(200,{code:'COUNTER_COMPLETED',order:value}); }
    if(url.pathname.endsWith('/payment')) return json(200,{payment:{environment:'sandbox',action:'https://pay-sandbox.sepay.vn/v1/checkout/init',method:'POST',fields:{merchant:'SP-TEST-EXAMPLE',currency:'VND',operation:'PURCHASE',order_amount:value.TongThanhToan,order_invoice_number:`LYSGTEST${id}`,order_description:'Thanh toán kiểm thử',customer_id:'12',payment_method:'BANK_TRANSFER',signature:'A'.repeat(43)+'='}}});
    const sale=line=>line.MaDonGia===3?8000:100000, base=line=>line.MaDonGia===3?10000:100000;
    const beforeCoins=data.items.reduce((sum,line)=>sum+line.SoLuong*sale(line),0), redeemed=data.DoiDiem?Math.min(wallet(data.SDT),Math.floor(beforeCoins/10)):0, total=beforeCoins-redeemed*10;
    if(url.pathname.endsWith('/quote')) return json(200,{code:'COUNTER_QUOTED',items:data.items.map(line=>({...line,TenThuoc:product.TenThuoc,GiaBan:sale(line),GiaGoc:base(line),ThanhTien:line.SoLuong*sale(line)})),TongTien:String(data.items.reduce((sum,line)=>sum+line.SoLuong*base(line),0)),TongThanhToan:String(total),SoXu:String(wallet(data.SDT)),XuSuDung:redeemed,XuSeCong:String(Math.floor(total/1000))});
    if(requests.has(data.request_id))return json(200,{code:'COUNTER_CREATED',order:requests.get(data.request_id)});
    created++;const result=order(901+created,total,data.PhuongThucThanhToan,data.HoTen||'Khách kiểm thử',data.PhuongThucThanhToan===0?3:0);orders.push(result);requests.set(data.request_id,result);if(result.TrangThaiDonHang===3)awards++;return json(200,{code:'COUNTER_CREATED',order:result});
}
export async function checkEmployeeCounter({evaluate:run,waitFor,command,key,root,baseUrl,setScenario}) {
    orders=[order(900,10000,0,'Khách lịch sử')];requests=new Map();created=awards=0;paid=false;setScenario('employee');
    await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await command('Page.navigate',{url:`${baseUrl}/pages/employee/index.html#counter`});
    await waitFor(`document.querySelector('[data-counter-order="900"]')!==null`);
    assert.equal(await run(`document.querySelector('.employee-page-heading')`),null);
    assert.equal(await run(`document.querySelector('#employee-counter-title').classList.contains('sr-only')`),true);
    assert.equal(await run(`Math.abs(document.querySelector('#counter-history-search').getBoundingClientRect().width-document.querySelector('#employee-counter').getBoundingClientRect().width)<2`),true);
    assert.equal(await run(`document.querySelector('#counter-editor').hidden`),true);
    await run(`document.querySelector('[data-counter-order="900"]').focus();document.querySelector('[data-counter-order="900"]').click()`);
    await waitFor(`document.querySelector('#counter-print').hidden===false`);
    assert.equal(await run(`document.querySelector('#counter-bill').open`),true);
    await waitFor(`document.querySelector('#counter-bill-content img')?.naturalWidth > 0`);
    assert.equal(await run(`document.querySelector('#counter-print').closest('.employee-payment-summary')!==null`),true);
    assert.equal(await run(`document.querySelector('#counter-bill .employee-payment-summary').getBoundingClientRect().left>document.querySelector('#counter-bill-content').getBoundingClientRect().right`),true);
    for (const width of [1440,375,320]) {
        await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
        assert.equal(await run(`document.querySelector('#counter-bill').scrollWidth<=document.querySelector('#counter-bill').clientWidth`),true,`Bill dialog fits ${width}px`);
        if (width !== 320) { const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(path.join(root,'docs',`EMPLOYEE_BILL_${width}.png`),Buffer.from(shot.data,'base64')); }
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await run(`document.querySelector('#counter-print').focus()`); await key('Tab',9);
    assert.equal(await run(`document.querySelector('#counter-bill').contains(document.activeElement)`),true);
    await key('Escape',27);
    await waitFor(`document.querySelector('#counter-bill').open===false`);
    assert.equal(await run(`document.activeElement.dataset.counterOrder`),'900');
    await run(`document.querySelector('#counter-new').click()`);
    await waitFor(`document.querySelector('#counter-products button')!==null`);
    assert.equal(await run(`document.querySelector('#counter-editor').open`),true);
    assert.equal(await run(`document.querySelector('#counter-products select option').textContent`),'Viên');
    assert.equal(await run(`document.querySelector('.counter-original-price').textContent`),'10.000 ₫');
    assert.equal(await run(`document.querySelector('.counter-sale-price').textContent`),'8.000 ₫');
    await run(`document.querySelector('#counter-products select').value='4';document.querySelector('#counter-products select').dispatchEvent(new Event('change'))`);
    assert.equal(await run(`document.querySelector('.counter-original-price')`),null);
    assert.equal(await run(`document.querySelector('.counter-sale-price').textContent`),'100.000 ₫');
    await run(`document.querySelector('#counter-products select').value='3';document.querySelector('#counter-products select').dispatchEvent(new Event('change'))`);
    await run(`document.querySelector('#counter-product-search').value='0893000000123';document.querySelector('#counter-product-search').dispatchEvent(new Event('input'))`);
    await waitFor(`document.querySelector('#counter-catalog-state').textContent==='1 sản phẩm phù hợp'`);
    await run(`document.querySelector('#counter-products button').click()`);
    assert.equal(await run(`document.querySelector('#counter-lines').textContent.includes('8.000')`),true);
    await waitFor(`document.querySelector('#counter-totals').textContent.includes('8.000')`);
    assert.equal(await run(`document.querySelector('#counter-phone').value`),'');
    assert.equal(await run(`document.querySelector('#counter-finish').disabled`),true);
    assert.equal(await run(`document.querySelector('#counter-lines img').alt`),product.TenThuoc);
    assert.equal(await run(`document.querySelector('#counter-lines').textContent.includes('Đang tính giá')`),false);
    await run(`document.querySelector('#counter-lines input').value='2';document.querySelector('#counter-lines input').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#counter-totals').textContent.includes('16.000')`);
    await run(`document.querySelector('#counter-lines input').value='1';document.querySelector('#counter-lines input').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#counter-totals').textContent.includes('8.000')`);
    await run(`document.querySelector('#counter-lines select').value='4';document.querySelector('#counter-lines select').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#counter-totals').textContent.includes('100.000')`);
    await run(`document.querySelector('#counter-lines select').value='3';document.querySelector('#counter-lines select').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#counter-totals').textContent.includes('8.000')`);
    await run(`document.querySelector('#counter-products select').value='4';document.querySelector('#counter-products select').dispatchEvent(new Event('change'));document.querySelector('#counter-products button').click()`);
    await waitFor(`document.querySelectorAll('#counter-lines li').length===2&&document.querySelector('#counter-totals').textContent.includes('108.000')`);
    await run(`document.querySelector('#counter-basket-unit-4').value='3';document.querySelector('#counter-basket-unit-4').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelectorAll('#counter-lines li').length===1&&document.querySelector('#counter-lines input').value==='2'&&document.querySelector('#counter-totals').textContent.includes('16.000')`);
    await run(`document.querySelector('#counter-lines input').value='1';document.querySelector('#counter-lines input').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#counter-totals').textContent.includes('8.000')`);
    await run(`document.querySelector('#counter-phone').value='0900000002';document.querySelector('#counter-customer-form').requestSubmit()`);
    await waitFor(`document.querySelector('#counter-customer-state strong')?.textContent==='Khách kiểm thử'&&document.querySelector('#counter-balance')?.textContent.includes('(0 ')`);
    assert.equal(await run(`document.querySelector('#counter-coins-field').hidden`),true);
    await run(`document.querySelector('#counter-phone').value='0900000001';document.querySelector('#counter-customer-form').requestSubmit()`);
    await waitFor(`document.querySelector('#counter-name-field').hidden===false`);
    assert.equal(await run(`document.querySelector('#counter-coins-field').hidden`),true);
    await run(`document.querySelector('#counter-name').value='Khách mới <script>'`);
    await waitFor(`document.querySelector('#counter-finish').disabled===false`);
    assert.equal(await run(`document.querySelector('#counter-lines b')`),null);
    for(const width of [1440,1024,768,375,320]) {
        await command('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<768});
        assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`),true,`Counter fits ${width}px`);
        assert.equal(await run(`document.querySelector('#counter-editor').scrollWidth<=document.querySelector('#counter-editor').clientWidth`),true,`Counter dialog fits ${width}px`);
        if([1440,375].includes(width)) {
            await run(`document.querySelector('#counter-editor').scrollTop=0`);const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(root,'docs',`EMPLOYEE_COUNTER_${width}.png`),Buffer.from(shot.data,'base64'));
            if(width===375) { await run(`document.querySelector('#counter-editor').scrollTop=document.querySelector('#counter-editor').scrollHeight`);const catalogShot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(root,'docs','EMPLOYEE_COUNTER_PRODUCTS_375.png'),Buffer.from(catalogShot.data,'base64')); }
        }
    }
    await run(`document.querySelector('#counter-finish').click();document.querySelector('#counter-finish').click()`);
    await waitFor(`document.querySelector('#counter-editor').hidden===true&&document.querySelector('#counter-bill-title').textContent.includes('902')`);
    assert.equal(created,1);assert.equal(awards,1);assert.equal(await run(`document.querySelector('#counter-bill-content script')`),null);
    await run(`window.__counterPrint=0;window.print=()=>window.__counterPrint++;document.querySelector('#counter-print').click()`);
    await waitFor(`window.__counterPrint===1`);
    assert.doesNotMatch(await run(`document.querySelector('#employee-invoice').textContent`),/0893000000123|Mã vạch/);
    await run(`document.querySelector('#counter-bill-close').click()`);
    await run(`document.querySelector('#counter-new').click();document.querySelector('#counter-phone').value='0900000000';document.querySelector('#counter-customer-form').requestSubmit()`);
    await waitFor(`document.querySelector('#counter-coins-field').hidden===false`);
    assert.equal(await run(`document.querySelector('#counter-customer-state strong').textContent`),'Khách kiểm thử');
    assert.equal(await run(`document.querySelector('#counter-balance').textContent.includes('(20 ')`),true);
    assert.equal(await run(`getComputedStyle(document.querySelector('.counter-switch-track')).width`),'36px');
    await waitFor(`document.querySelector('#counter-products button')!==null`);
    await run(`document.querySelector('#counter-products button').click();document.querySelector('#counter-payment').value='1';document.querySelector('#counter-payment').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#counter-coins-amount').textContent.startsWith('(-20 ')&&!document.querySelector('#counter-coins').disabled`);
    await run(`document.querySelector('#counter-coins').click()`);
    await waitFor(`document.querySelector('#counter-totals').textContent.includes('7.800')&&document.querySelector('#counter-finish').disabled===false`);
    assert.equal(await run(`document.querySelector('#counter-coins-amount').textContent.startsWith('(-20 ')`),true);
    await run(`document.querySelector('#counter-finish').click()`);
    await waitFor(`document.querySelector('#counter-bill-title').textContent.includes('903')&&document.querySelector('#counter-pay').hidden===false`);
    assert.equal(awards,1);assert.equal(await run(`document.querySelector('#counter-print').hidden`),true);
    await run(`HTMLFormElement.prototype.submit=function(){window.__counterCheckout={target:this.target,action:this.action}};document.querySelector('#counter-pay').click()`);
    await waitFor(`window.__counterCheckout?.target==='_blank'`);
    assert.equal(await run(`window.__counterCheckout.action`),'https://pay-sandbox.sepay.vn/v1/checkout/init');
    paid=true;await run(`document.querySelector('#counter-payment-check').click()`);
    await waitFor(`document.querySelector('#counter-print').hidden===false&&document.querySelector('#counter-bill-rewards').textContent.includes('Đã cộng 7 ')`);
    assert.equal(created,2);assert.equal(awards,2);
    await run(`document.querySelector('#counter-payment-check').click()`);assert.equal(awards,2);
    await run(`document.querySelector('#counter-bill-close').click()`);
    await run(`document.querySelector('#counter-new').click();document.querySelector('#counter-phone').value='0900000003';document.querySelector('#counter-customer-form').requestSubmit()`);
    await waitFor(`document.querySelector('#counter-balance')?.textContent.includes('1.000')&&document.querySelector('#counter-products button')!==null`);
    await run(`document.querySelector('#counter-products button').click()`);
    await waitFor(`document.querySelector('#counter-coins-amount').textContent.startsWith('(-800 ')&&!document.querySelector('#counter-coins').disabled`);
    assert.equal(await run(`document.querySelector('#counter-coins-amount .reward-coin')!==null`),true);
    await run(`document.querySelector('#counter-coins').click()`);
    await waitFor(`document.querySelector('#counter-totals dd:last-child')!==null&&!document.querySelector('#counter-coins').disabled`);
    assert.equal(await run(`document.querySelector('#counter-coins-amount').textContent.startsWith('(-800 ')`),true);
    assert.equal(await run(`document.querySelector('#counter-totals > div:last-child dd').textContent`),'0 ₫');
    await run(`document.querySelector('#counter-lines input').value='2';document.querySelector('#counter-lines input').dispatchEvent(new Event('change'))`);
    await waitFor(`document.querySelector('#counter-coins-amount').textContent.startsWith('(-1.000 ')&&!document.querySelector('#counter-coins').disabled`);
    await run(`document.querySelector('#counter-coins').click()`);
    await waitFor(`document.querySelector('#counter-totals > div:last-child dd')?.textContent==='16.000 ₫'`);
    assert.equal(await run(`document.querySelector('#counter-coins-amount').textContent.startsWith('(-1.000 ')`),true);
    console.log('PASS: counter completed history/detail/print, new/existing customer, barcode search, basket, coins, cash, duplicate click, verified QR completion, no barcode on invoice, safe DOM and 1440–320px. MOCK APIs; no real payment/print/DB.');
}
