import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

let rows, mutations = 0;
function reset() {
    mutations = 0;
    rows = [1, 0, 0, 2].map((state, index) => ({ MaDonHang: String(501 + index), TrangThaiDonHang: state,
        TrangThaiThanhToan: state === 0 ? 0 : 1, PhuongThucThanhToan: state === 0 ? 1 : 0,
        TongTien: '30000', TienGiamGia: '4450', TongThanhToan: '25550', DoiDiem: true,
        NgayDat: index === 1 ? '2026-11-17T08:30:00+07:00' : '2026-11-19T08:30:00+07:00',
        KhachHang: { HoTen: 'Khách hàng kiểm thử', SDT: `090000000${index}` }, QuaHanThanhToan: index === 1,
        GhiChu: 'Người nhận: Khách hàng kiểm thử\nGiao tận nơi: Địa chỉ kiểm thử', XuDaCong: null,
        items: [{ MaThuoc:7, MaDonGia:3, MaChiTiet:'1', TenThuoc:'Thuốc <b>an toàn</b>', SoLuong:3, DonViTinh:'Viên', DonGia:'10000', ThanhTien:'30000' }] }));
}
reset();
const serialize = row => ({ ...row, CanPrint: [2,3].includes(row.TrangThaiDonHang) });
export async function employeeOrdersFixture(req, json) {
    const url = new URL(req.url, 'http://fixture'), parts = url.pathname.split('/'), id = parts[4];
    if (req.method === 'GET' && !id) {
        const status = url.searchParams.get('status') || 'all', search = url.searchParams.get('search') || '';
        const found = rows.filter(row => [0,1,2].includes(row.TrangThaiDonHang) && (status === 'all' || String(row.TrangThaiDonHang) === status)
            && (!search || row.MaDonHang.includes(search) || row.KhachHang.SDT.includes(search)))
            .sort((a,b) => (a.TrangThaiDonHang === 1 ? 0 : 1) - (b.TrangThaiDonHang === 1 ? 0 : 1));
        return json(200, { code:'EMPLOYEE_ORDERS_LISTED', items:found.map(serialize), total:found.length, page:1, per_page:20, status });
    }
    const row = rows.find(value => value.MaDonHang === id);
    if (!row) return json(404, { code:'ORDER_NOT_FOUND' });
    if (req.method === 'GET') return json(200, { code:'EMPLOYEE_ORDER_DETAIL', order:serialize(row) });
    assert.equal(req.headers['x-csrf-token'], 'fixture-csrf');
    let raw = ''; for await (const chunk of req) raw += chunk; const data = JSON.parse(raw);
    if (parts[5] === 'cancel') {
        assert.deepEqual(data, {});
        if (row.MaDonHang === '502') return json(409, { code:'ORDER_REFUND_REVIEW_REQUIRED' });
        if (![0,1,2].includes(row.TrangThaiDonHang)) return json(409, { code:'ORDER_NOT_CANCELLABLE' });
        row.TrangThaiDonHang=4; mutations++;
        return json(200, { code:'EMPLOYEE_ORDER_CANCELLED', order:serialize(row) });
    }
    assert.deepEqual(Object.keys(data).sort(), ['from_status','to_status']);
    if (row.TrangThaiDonHang !== data.from_status) return json(409, { code:'ORDER_STATE_CHANGED' });
    if (row.QuaHanThanhToan) return json(409, { code:'ORDER_EXPIRED' });
    row.TrangThaiDonHang=data.to_status; mutations++;
    if (data.to_status === 1 || (data.to_status === 3 && row.PhuongThucThanhToan === 0)) row.TrangThaiThanhToan=1;
    if (data.to_status === 3) row.XuDaCong=String(BigInt(row.TongThanhToan)/100n);
    return json(200, { code:'EMPLOYEE_ORDER_UPDATED', order:serialize(row) });
}

export async function checkEmployeeOrders({ evaluate:run, waitFor, command, baseUrl, root, setScenario }) {
    reset(); setScenario('employee');
    await command('Page.navigate', { url:`${baseUrl}/pages/employee/index.html#orders` });
    await new Promise(resolve=>setTimeout(resolve,80)); await run(`window.dispatchEvent(new Event('focus'))`);
    await waitFor(`document.querySelectorAll('#employee-order-rows [data-employee-order]').length===4`);
    assert.equal(await run(`document.querySelector('#employee-order-rows [data-employee-order]').dataset.employeeOrder`),'501');
    assert.equal(await run(`document.querySelector('#employee-order-rows [data-order-id="502"] .employee-overdue').textContent`),'Quá thời gian xử lý');
    for (const [filter, count] of [['1',1],['2',1],['all',4]]) {
        await run(`document.querySelector('[data-employee-order-filter="${filter}"]').click()`);
        await waitFor(`document.querySelectorAll('#employee-order-rows [data-employee-order]').length===${count} && document.querySelector('#employee-order-list').getAttribute('aria-busy')==='false'`);
    }
    await run(`document.querySelector('#employee-order-search').value='0900000002';document.querySelector('#employee-order-search-form').requestSubmit()`);
    await waitFor(`document.querySelectorAll('#employee-order-rows [data-employee-order]').length===1`);
    assert.equal(await run(`document.querySelector('#employee-order-rows [data-employee-order]').dataset.employeeOrder`),'503');
    await run(`document.querySelector('#employee-order-search').value='';document.querySelector('#employee-order-search-form').requestSubmit()`);
    await waitFor(`document.querySelectorAll('#employee-order-rows [data-employee-order]').length===4`);
    const choose = async id => { await run(`document.querySelector('[data-employee-order="${id}"]').click()`); await waitFor(`document.querySelector('#employee-order-detail-title').textContent==='Đơn hàng #${id}' && !document.querySelector('#employee-order-detail-content').hidden`); };
    await choose('503');
    await run(`document.querySelector('#employee-order-next-status').click();document.querySelector('#employee-order-action-confirm').click();document.querySelector('#employee-order-action-confirm').click()`);
    await waitFor(`document.querySelector('#employee-order-detail-content .employee-order-badge').dataset.status==='1'`);
    assert.equal(mutations,1);
    await run(`document.querySelector('#employee-order-next-status').click();document.querySelector('#employee-order-action-confirm').click()`);
    await waitFor(`document.querySelector('#employee-order-print')!==null`);
    assert.equal(await run(`document.querySelector('#employee-order-detail-content b')`),null);
    await run(`window.__employeePrints=0;window.print=()=>{window.__employeePrints++};document.querySelector('#employee-order-print').click()`);
    await waitFor(`window.__employeePrints===1`);
    assert.equal(await run(`document.querySelector('#employee-invoice b')`),null);
    assert.match(await run(`document.querySelector('#employee-invoice').textContent`),/25.550/);
    await command('Emulation.setEmulatedMedia',{ media:'print' });
    assert.equal(await run(`getComputedStyle(document.querySelector('#employee-invoice')).display`),'block');
    assert.equal(await run(`getComputedStyle(document.querySelector('.employee-header')).display`),'none');
    await command('Emulation.setEmulatedMedia',{ media:'' });
    await run(`document.querySelector('#employee-order-next-status').click();document.querySelector('#employee-order-action-confirm').click()`);
    await waitFor(`document.querySelector('.employee-earned-points')?.textContent.includes('255')`);
    assert.equal(mutations,3);
    assert.equal(await run(`document.querySelector('#employee-order-next-status')`),null);
    await choose('502'); assert.equal(await run(`document.querySelector('#employee-order-next-status').disabled`),true);
    await run(`document.querySelector('#employee-order-cancel').click();document.querySelector('#employee-order-action-confirm').click()`);
    await waitFor(`document.querySelector('#employee-order-action-state').textContent.includes('đối soát')`);
    await run(`document.querySelector('#employee-order-action-back').click()`);
    await choose('504');
    for (const width of [1440, 1024, 768, 375, 320]) {
        await command('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<768});
        assert.equal(await run(`document.documentElement.scrollWidth<=innerWidth`),true,`Employee orders fits ${width}px`);
        if ([1440,375].includes(width)) {
            await run(`window.scrollTo({top:0,behavior:'instant'})`);
            const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
            await writeFile(path.join(root,'docs',`EMPLOYEE_PROCESSING_${width}.png`),Buffer.from(shot.data,'base64'));
        }
    }
    await run(`document.querySelector('#employee-order-cancel').click();document.querySelector('#employee-order-action-confirm').click()`);
    await waitFor(`document.querySelector('#employee-order-detail-content .employee-order-badge').dataset.status==='4'`);
    assert.equal(mutations,4);
    console.log('PASS: employee order filters/search/priority/overdue, 0→1→2→3, earned coins exactly once in UI, invoice DOM/print CSS, shipping cancellation, legacy review, safe text and 1440–320px. API MOCK; no real print, payment or data changes.');
}
