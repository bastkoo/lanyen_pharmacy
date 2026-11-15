import { dateValue, vietnamToday } from './batch-validation.js';

export function promotionStatus(promotion, today = vietnamToday()) {
    if ([promotion.NgayBatDau, promotion.NgayKetThuc, today].some(value => dateValue(value) === null) || promotion.NgayKetThuc < promotion.NgayBatDau) throw new Error('INVALID_RESPONSE');
    return today < promotion.NgayBatDau ? 'upcoming' : today > promotion.NgayKetThuc ? 'ended' : 'active';
}
export const PROMOTION_STATUSES = { upcoming: 'Sắp diễn ra', active: 'Đang diễn ra', ended: 'Đã kết thúc' };
export function validatePromotion(values) {
    const data = { TenChuongTrinh: typeof values.TenChuongTrinh === 'string' ? values.TenChuongTrinh.trim() : '' }, errors = {};
    if (!data.TenChuongTrinh || [...data.TenChuongTrinh].length > 255 || data.TenChuongTrinh.includes('\0')) errors.TenChuongTrinh = 'Nhập tên từ 1 đến 255 ký tự, không chứa NUL.';
    for (const key of ['NgayBatDau', 'NgayKetThuc']) {
        if (dateValue(values[key]) === null) errors[key] = 'Nhập ngày lịch hợp lệ.';
        else data[key] = values[key];
    }
    if (!errors.NgayBatDau && !errors.NgayKetThuc && data.NgayKetThuc < data.NgayBatDau) errors.NgayKetThuc = 'Ngày kết thúc không được trước ngày bắt đầu.';
    return { data, errors };
}
export function validatePromotionItem(values, { create = true, quantityEditable = false } = {}) {
    const data = {}, errors = {};
    const percent = values.LoaiGiamGia === true || values.LoaiGiamGia === 'true';
    if (![true, false, 'true', 'false'].includes(values.LoaiGiamGia)) errors.LoaiGiamGia = 'Chọn loại giảm giá.';
    data.LoaiGiamGia = percent;
    const text = typeof values.GiaTriGiam === 'string' ? values.GiaTriGiam.trim() : String(values.GiaTriGiam);
    if (percent) {
        if (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 100) errors.GiaTriGiam = 'Phần trăm phải là số nguyên từ 1 đến 100.';
    } else if (!/^\d+(\.\d{1,2})?$/.test(text) || Number(text) > 9999999999.99) errors.GiaTriGiam = 'Số tiền từ 0 đến 9.999.999.999,99 VND, tối đa hai chữ số lẻ; không tự làm tròn.';
    if (!errors.GiaTriGiam) data.GiaTriGiam = Number(text);
    for (const [key, min] of [...(create ? [['MaThuoc', 1]] : []), ...((create || quantityEditable) ? [['SoLuong', create ? 1 : 0]] : [])]) {
        const value = values[key];
        if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > 2147483647) errors[key] = `Nhập số nguyên từ ${min} đến 2.147.483.647.`;
        else data[key] = Number(value);
    }
    return { data, errors };
}
export function formatPromotionDiscount(item) {
    if (typeof item.GiaTriGiam !== 'string' || !/^\d+\.\d{2}$/.test(item.GiaTriGiam) || typeof item.LoaiGiamGia !== 'boolean') throw new Error('INVALID_RESPONSE');
    const number = Number(item.GiaTriGiam);
    if (number > 9999999999.99 || (item.LoaiGiamGia && (!Number.isInteger(number) || number < 1 || number > 100))) throw new Error('INVALID_RESPONSE');
    return item.LoaiGiamGia ? `${number}%` : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: number % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(number);
}
export function promotionError(error) {
    return ({
        PROMOTION_NOT_FOUND: 'Chương trình không còn tồn tại. Vui lòng trở về danh sách và làm mới.',
        PROMOTION_IN_USE: 'Không thể xóa chương trình đang có thuốc áp dụng. Không có dữ liệu liên quan nào bị xóa.',
        PROMOTION_ITEM_NOT_FOUND: 'Thuốc không còn trong chương trình này. Đóng hộp thoại và làm mới danh sách.',
        PROMOTION_ITEM_EXISTS: 'Thuốc đã có trong chương trình này. Vui lòng chọn thuốc khác.',
        PRODUCT_NOT_FOUND: 'Thuốc không còn tồn tại. Vui lòng tìm và chọn thuốc khác.',
        FOREIGN_KEY_CONFLICT: 'Dữ liệu liên quan đã thay đổi. Làm mới và thử lại.',
        INVALID_REQUEST: 'Dữ liệu không hợp lệ. Kiểm tra tên, ngày, loại giảm, mức giảm và số lượng.',
        CSRF_FAILED: 'Phiên xác thực thao tác không hợp lệ. Vui lòng thử lại.',
        DATABASE_UNAVAILABLE: 'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại.',
        CONNECTION_FAILED: 'Mất kết nối hoặc phản hồi quá lâu. Chưa xác nhận thao tác thành công; làm mới dữ liệu trước khi gửi lại.',
        INVALID_RESPONSE: 'Phản hồi máy chủ không hợp lệ. Vui lòng thử tải lại.'
    })[error.code || error.message] || 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
}
