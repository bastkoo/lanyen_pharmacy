export function normalizeCategoryName(value) {
    if (typeof value !== 'string') return null;
    const name = value.trim().replace(/\s+/gu, ' ');
    return name && [...name].length <= 255 && !name.includes('\0') ? name : null;
}

export function categoryErrorMessage(error) {
    return {
        CATEGORY_NAME_EXISTS: 'Tên danh mục đã tồn tại. Hãy chọn tên khác; hệ thống không phân biệt hoa thường.',
        CATEGORY_IN_USE: 'Không thể xóa danh mục vì đang có thuốc sử dụng. Danh mục và thuốc liên quan vẫn được giữ nguyên.',
        CATEGORY_NOT_FOUND: 'Danh mục không còn tồn tại. Hãy tải lại danh sách.',
        INVALID_REQUEST: 'Tên danh mục phải có từ 1 đến 255 ký tự sau khi chuẩn hóa khoảng trắng.',
        CSRF_FAILED: 'Phiên bảo mật đã thay đổi. Thông tin nhập được giữ lại; vui lòng thử thao tác lại.',
        DATABASE_UNAVAILABLE: 'Chưa thể xử lý dữ liệu danh mục. Vui lòng kiểm tra lại sau.',
        CONNECTION_FAILED: 'Không thể xác nhận kết quả do mất kết nối. Hãy kiểm tra lại danh sách trước khi gửi lại thao tác.',
        INVALID_RESPONSE: 'Phản hồi từ máy chủ chưa hợp lệ. Vui lòng tải lại danh sách.'
    }[error.code] || 'Chưa thể hoàn tất thao tác. Vui lòng thử lại sau.';
}
