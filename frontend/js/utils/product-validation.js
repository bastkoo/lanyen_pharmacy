export const PRODUCT_GROUPS = [
    { title: 'Thông tin cơ bản', fields: [['TenThuoc', 'Tên thuốc', 255], ['MaLoaiThuoc', 'Danh mục thuốc', 'category'], ['MaDuoc', 'Mã dược', 50], ['SoDangKy', 'Số đăng ký', 100], ['PhanLoai', 'Phân loại thuốc', 'boolean']] },
    { title: 'Thông tin sản xuất', fields: [['DangBaoChe', 'Dạng bào chế', 255], ['QuyCachDongGoi', 'Quy cách đóng gói', 255], ['NhaSanXuat', 'Nhà sản xuất', 255], ['NuocSanXuat', 'Nước sản xuất', 255]] },
    { title: 'Thông tin sử dụng', fields: [['MoTa', 'Mô tả', 'text'], ['CachDung', 'Cách dùng', 'text'], ['ChongChiDinh', 'Chống chỉ định', 'text'], ['BaoQuan', 'Bảo quản', 'text']] },
    { title: 'Quản lý tồn kho', fields: [['NguongTonKho', 'Ngưỡng tồn kho', 'integer']] }
];
export const PRODUCT_FIELDS = PRODUCT_GROUPS.flatMap(group => group.fields);

export function validHttps(value) {
    if (typeof value !== 'string' || /[\s\\\0]/u.test(value)) return false;
    try { const url = new URL(value); return value.startsWith('https://') && !!url.hostname && !url.username && !url.password; } catch { return false; }
}

export function validateProduct(values) {
    const data = {}, errors = {};
    for (const [name, label, type] of PRODUCT_FIELDS) {
        const value = values[name];
        if (type === 'boolean') { if (typeof value !== 'boolean') errors[name] = 'Chọn đúng phân loại thuốc.'; else data[name] = value; }
        else if (type === 'integer' || type === 'category') {
            const min = type === 'integer' ? 0 : 1;
            if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/u.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > 2147483647) errors[name] = `${label} phải là số nguyên ${min ? 'dương' : 'không âm'}, tối đa 2147483647.`;
            else data[name] = Number(value);
        } else {
            const text = typeof value === 'string' ? value.trim() : '';
            if (!text || text.includes('\0')) errors[name] = `Vui lòng nhập ${label.toLocaleLowerCase('vi')}, không chứa ký tự NUL.`;
            else if (typeof type === 'number' && [...text].length > type) errors[name] = `${label} tối đa ${type} ký tự.`;
            else data[name] = text;
        }
    }
    if (!validHttps(values.HinhAnh)) errors.HinhAnh = 'Cần URL ảnh HTTPS hợp lệ. Hãy upload ảnh hoặc nhập URL ảnh hiện có.';
    else data.HinhAnh = values.HinhAnh;
    return { data, errors };
}

export function validateImageFile(file) {
    if (!file || !file.size) return 'Ảnh không có dữ liệu. Chọn ảnh JPEG, PNG hoặc WebP.';
    if (file.size > 5 * 1024 * 1024) return 'Ảnh vượt quá 5 MiB. Vui lòng chọn ảnh nhỏ hơn.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Chỉ hỗ trợ ảnh JPEG, PNG và WebP.';
    return '';
}

export function productErrorMessage(error) {
    return {
        PRODUCT_NOT_FOUND: 'Thuốc không còn tồn tại. Hãy tải lại danh sách.',
        CATEGORY_NOT_FOUND: 'Danh mục đã không còn tồn tại. Hãy làm mới danh mục và chọn lại.',
        PRODUCT_IN_USE: 'Không thể xóa thuốc vì đang có dữ liệu liên quan (đơn hàng, đơn vị giá, lô thuốc hoặc dữ liệu khác). Dữ liệu được giữ nguyên.',
        FOREIGN_KEY_CONFLICT: 'Danh mục hoặc dữ liệu liên quan đã thay đổi. Vui lòng kiểm tra và thử lại.',
        INVALID_REQUEST: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các trường bắt buộc và giới hạn độ dài.',
        CSRF_FAILED: 'Phiên bảo mật đã thay đổi. Dữ liệu được giữ lại; vui lòng thử thao tác lại.',
        DATABASE_UNAVAILABLE: 'Chưa thể lưu hoặc đọc dữ liệu thuốc. Vui lòng thử lại sau.',
        CLOUDINARY_NOT_CONFIGURED: 'Máy chủ chưa cấu hình Cloudinary. Vui lòng kiểm tra cấu hình Backend.',
        CLOUDINARY_UNAVAILABLE: 'Chưa kết nối được Cloudinary. Vui lòng thử upload lại sau.',
        CLOUDINARY_INVALID_RESPONSE: 'Cloudinary trả về kết quả chưa hợp lệ. Chưa thể xác nhận ảnh đã upload.',
        INVALID_CLOUDINARY_URL: 'URL Cloudinary không hợp lệ hoặc không thuộc thư mục ảnh thuốc được phép.',
        CLOUDINARY_IMAGE_NOT_FOUND: 'Ảnh không còn tồn tại trên Cloudinary. Hãy upload lại ảnh.',
        IMAGE_REQUIRED: 'Vui lòng chọn một ảnh để upload.', EMPTY_IMAGE: 'Ảnh không có dữ liệu.',
        IMAGE_TOO_LARGE: 'Ảnh vượt quá 5 MiB.', UNSUPPORTED_IMAGE_FORMAT: 'Chỉ hỗ trợ JPEG, PNG và WebP.',
        IMAGE_MIME_MISMATCH: 'Nội dung ảnh không khớp định dạng file.', INVALID_IMAGE: 'File ảnh bị hỏng hoặc không phải ảnh hợp lệ.',
        UPLOAD_FAILED: 'Upload thất bại. Vui lòng thử lại sau.',
        INVALID_RESPONSE: 'Phản hồi máy chủ chưa hợp lệ. Vui lòng tải lại trước khi gửi lại thao tác.',
        CONNECTION_FAILED: 'Mất kết nối; chưa thể xác nhận kết quả. Hãy kiểm tra dữ liệu trước khi gửi lại thao tác.'
    }[error.code] || 'Chưa thể hoàn tất thao tác. Dữ liệu nhập được giữ lại để bạn kiểm tra và thử lại.';
}
