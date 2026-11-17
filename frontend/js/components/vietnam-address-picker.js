import { getProvinces, getWards } from '../api/vietnam-addresses.js';

const normalize = value => value.trim().toLocaleLowerCase('vi-VN').replace(/^(tỉnh|thành phố|tp\.?|phường|xã)\s+/u, '');
function match(items, name) {
    if (!name) return undefined;
    const exact = items.find(item => item.name === name);
    const similar = items.filter(item => normalize(item.name) === normalize(name));
    return exact || (similar.length === 1 ? similar[0] : undefined);
}
export function setupVietnamAddressPicker({ province, ward, status, retry, changed }) {
    let controller, version = 0, loading = false, disabled = false, available = false, saved, retryWork;
    const reset = (element, label) => element.replaceChildren(new Option(label, ''));
    const legacy = (element, name) => { if (name) { const option = new Option(name, `saved:${name}`); option.selected = true; element.append(option); } };
    function sync() {
        province.disabled = disabled || loading || province.options.length < 2;
        ward.disabled = disabled || loading || ward.options.length < 2;
        changed();
    }
    function begin() { controller?.abort(); controller = new AbortController(); loading = true; retry.hidden = true; sync(); return ++version; }
    function finish(attempt) { if (attempt === version) { loading = false; sync(); } }
    async function wards(code, oldName) {
        const attempt = begin(); reset(ward, 'Chọn phường / xã'); status.textContent = 'Đang tải phường / xã…';
        retryWork = () => wards(code, oldName);
        try {
            const items = await getWards(code, { signal: controller.signal });
            if (attempt !== version) return;
            for (const item of items) ward.append(new Option(item.name, String(item.code)));
            const selected = match(items, oldName);
            if (selected) ward.value = String(selected.code); else legacy(ward, oldName);
            status.textContent = oldName && !selected ? 'Đang giữ phường/xã đã lưu. Bạn có thể chọn lại theo danh sách hiện tại.' : items.length ? '' : 'Chưa có phường/xã cho tỉnh/thành phố này.';
            available = Boolean(items.length || oldName);
        } catch (error) {
            if (attempt !== version || error.code === 'REQUEST_ABORTED') return;
            legacy(ward, oldName); available = Boolean(oldName);
            status.textContent = 'Chưa tải được phường/xã. Vui lòng thử lại.'; retry.hidden = false;
        } finally { finish(attempt); }
    }
    async function open(row) {
        saved = row; available = false;
        reset(province, 'Chọn tỉnh / thành phố'); reset(ward, 'Chọn phường / xã');
        const attempt = begin(); status.textContent = 'Đang tải tỉnh / thành phố…'; retryWork = () => open(saved);
        try {
            const items = await getProvinces({ signal: controller.signal });
            if (attempt !== version) return;
            for (const item of items) province.append(new Option(item.name, String(item.code)));
            const selected = match(items, row?.TinhThanh);
            available = true;
            if (selected) { province.value = String(selected.code); await wards(selected.code, row?.PhuongXa); return; }
            legacy(province, row?.TinhThanh); legacy(ward, row?.PhuongXa);
            status.textContent = row ? 'Đang giữ địa chỉ đã lưu. Chọn lại tỉnh/thành và phường/xã nếu cần cập nhật.' : 'Chọn tỉnh/thành phố trước để tải danh sách phường/xã.';
        } catch (error) {
            if (attempt !== version || error.code === 'REQUEST_ABORTED') return;
            legacy(province, row?.TinhThanh); legacy(ward, row?.PhuongXa); available = Boolean(row);
            status.textContent = 'Chưa tải được tỉnh/thành phố. Vui lòng thử lại.'; retry.hidden = false;
        } finally { finish(attempt); }
    }
    province.addEventListener('change', () => {
        saved = null; reset(ward, 'Chọn phường / xã');
        const code = Number(province.value);
        if (Number.isSafeInteger(code) && code > 0) wards(code);
        else { controller?.abort(); version++; loading = false; status.textContent = 'Chọn tỉnh/thành phố trước để tải danh sách phường/xã.'; sync(); }
    });
    retry.addEventListener('click', () => retryWork?.());
    reset(province, 'Chọn tỉnh / thành phố'); reset(ward, 'Chọn phường / xã');
    return {
        open,
        close() { controller?.abort(); version++; loading = false; saved = null; },
        setDisabled(value) { disabled = value; sync(); },
        canSubmit: () => !loading && available,
        values: () => ({ TinhThanh: province.value ? province.selectedOptions[0].textContent : '', PhuongXa: ward.value ? ward.selectedOptions[0].textContent : '' })
    };
}
