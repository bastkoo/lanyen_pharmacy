export const BATCH_FIELDS = [
    ['SoLoSanXuat', 'Số lô sản xuất', 'text'], ['NgaySanXuat', 'Ngày sản xuất', 'date'],
    ['HanSuDung', 'Hạn sử dụng', 'date'], ['SoLuongNhap', 'Số lượng nhập', 'text'], ['GiaNhap', 'Giá nhập (VND)', 'text']
];
export function dateValue(value) {
    if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1) return null;
    const date = new Date(0); date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(year, month - 1, day);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() : null;
}
export function formatBatchDate(value) { return dateValue(value) === null ? 'Không rõ ngày' : value.split('-').reverse().join('/'); }
export function vietnamToday() {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const value = type => parts.find(part => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
}
export function expiryText(expiry, asOf) {
    const end = dateValue(expiry), start = dateValue(asOf);
    if (end === null || start === null) return 'Không rõ hạn sử dụng';
    const days = (end - start) / 86400000;
    return days < 0 ? `Đã hết hạn ${-days} ngày` : days === 0 ? 'Hết hạn hôm nay' : `Còn ${days} ngày`;
}
export function validateBatch(values, create = true) {
    const data = {}, errors = {};
    data.SoLoSanXuat = typeof values.SoLoSanXuat === 'string' ? values.SoLoSanXuat.trim() : '';
    if (!data.SoLoSanXuat || [...data.SoLoSanXuat].length > 100 || data.SoLoSanXuat.includes('\0')) errors.SoLoSanXuat = 'Số lô phải có 1–100 ký tự, không chứa NUL.';
    for (const name of ['NgaySanXuat', 'HanSuDung']) {
        if (dateValue(values[name]) === null) errors[name] = 'Nhập ngày lịch hợp lệ theo định dạng năm-tháng-ngày.';
        else data[name] = values[name];
    }
    if (!errors.NgaySanXuat && !errors.HanSuDung && data.HanSuDung <= data.NgaySanXuat) errors.HanSuDung = 'Hạn sử dụng phải sau ngày sản xuất.';
    for (const name of create ? ['SoLuongNhap', 'GiaNhap'] : ['GiaNhap']) {
        const raw = values[name], value = Number(raw), min = name === 'SoLuongNhap' ? 1 : 0;
        if (!['string', 'number'].includes(typeof raw) || !/^\d+$/.test(String(raw)) || !Number.isSafeInteger(value) || value < min || value > 2147483647) errors[name] = `Nhập số nguyên từ ${min} đến 2.147.483.647.`;
        else data[name] = value;
    }
    return { data, errors };
}
export function stockError(error) {
    return ({
        BATCH_NOT_FOUND: 'Lô không còn tồn tại hoặc không thuộc thuốc này. Đóng hộp thoại và làm mới.',
        PRODUCT_NOT_FOUND: 'Thuốc không còn tồn tại. Vui lòng chọn thuốc khác.',
        BATCH_QUANTITY_IMMUTABLE: 'Không được thay đổi số lượng nhập sau khi tạo lô.',
        BATCH_STOCK_INCONSISTENT: 'Số lượng tồn hiện có không nhất quán với lượng nhập. Không thể cập nhật lô; hệ thống không tự điều chỉnh tồn.',
        BATCH_DELETE_UNSAFE: 'Không thể xóa lô: hệ thống chưa có lịch sử xuất kho theo lô để xác minh việc xóa an toàn. Lô được giữ nguyên.',
        FOREIGN_KEY_CONFLICT: 'Dữ liệu liên quan đã thay đổi. Vui lòng làm mới.',
        INVALID_REQUEST: 'Dữ liệu hoặc bộ lọc không hợp lệ. Vui lòng kiểm tra lại.',
        CSRF_FAILED: 'Phiên xác thực thao tác không hợp lệ. Vui lòng thử lại.',
        DATABASE_UNAVAILABLE: 'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.',
        CONNECTION_FAILED: 'Mất kết nối hoặc máy chủ phản hồi quá lâu. Chưa xác nhận thao tác thành công; làm mới trước khi gửi lại.',
        INVALID_RESPONSE: 'Phản hồi máy chủ không hợp lệ. Vui lòng thử tải lại.',
        JSON_REQUIRED: 'Máy chủ yêu cầu JSON. Vui lòng tải lại trang.'
    })[error.code] || 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
}
