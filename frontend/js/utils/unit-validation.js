export function validateUnit(values) {
    const data = {}, errors = {};
    data.DonViTinh = typeof values.DonViTinh === 'string' ? values.DonViTinh.trim() : '';
    if (!data.DonViTinh || [...data.DonViTinh].length > 50 || data.DonViTinh.includes('\0')) errors.DonViTinh = 'Nhập đơn vị tính từ 1 đến 50 ký tự, không chứa NUL.';
    for (const [name, min, label] of [['GiaBan', 0, 'Giá bán'], ['SoLuongQuyDoi', 1, 'Số lượng quy đổi']]) {
        const raw = values[name];
        const valid = typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw));
        const value = Number(raw);
        if (!valid || !Number.isSafeInteger(value) || value < min || value > 2147483647) errors[name] = `${label} phải là số nguyên từ ${min} đến 2.147.483.647.`;
        else data[name] = value;
    }
    return { data, errors };
}

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
export const formatUnitPrice = value => money.format(value);
export function unitErrorMessage(error) {
    return ({
        INVALID_REQUEST: 'Dữ liệu không hợp lệ. Kiểm tra đơn vị tính, giá bán và số lượng quy đổi.',
        PRODUCT_NOT_FOUND: 'Thuốc không còn tồn tại. Vui lòng chọn thuốc khác.',
        UNIT_NOT_FOUND: 'Đơn vị giá không còn tồn tại hoặc không thuộc thuốc này. Đóng hộp thoại và làm mới danh sách.',
        UNIT_IN_USE: 'Không thể xóa: đơn vị giá đang được sử dụng trong giỏ thuốc hoặc chi tiết đơn hàng.',
        FOREIGN_KEY_CONFLICT: 'Dữ liệu liên quan đã thay đổi. Vui lòng làm mới và thử lại.',
        CSRF_FAILED: 'Phiên xác thực thao tác không hợp lệ. Vui lòng thử lại.',
        DATABASE_UNAVAILABLE: 'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.',
        CONNECTION_FAILED: 'Mất kết nối hoặc máy chủ phản hồi quá lâu. Chưa xác nhận thao tác thành công; làm mới danh sách trước khi thử lại.',
        INVALID_RESPONSE: 'Phản hồi máy chủ không hợp lệ. Vui lòng làm mới để kiểm tra dữ liệu.',
        JSON_REQUIRED: 'Máy chủ yêu cầu dữ liệu JSON. Vui lòng tải lại trang.'
    })[error.code] || 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
}
