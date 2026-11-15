import { normalizePhone } from './auth-validation.js';
import { validHttps } from './product-validation.js';
export const ACCOUNT_FIELDS = [['HoTen', 'Họ tên', 'text'], ['SDT', 'Số điện thoại', 'tel'], ['VaiTro', 'Vai trò', 'select'], ['Email', 'Email', 'email'], ['AnhDaiDien', 'URL ảnh đại diện', 'url']];
export const accountRole = role => role === 2 ? 'Quản lý' : 'Nhân viên';
export function validateAccount(values) {
    const data = {}, errors = {};
    const name = typeof values.HoTen === 'string' ? values.HoTen.trim() : '';
    if (!name || [...name].length > 255 || /[\x00-\x1f]/.test(values.HoTen)) errors.HoTen = 'Họ tên từ 1–255 ký tự, không chứa ký tự điều khiển.'; else data.HoTen = name;
    try { if (typeof values.SDT !== 'string' || !values.SDT.length || values.SDT.length > 24) throw new Error(); data.SDT = normalizePhone(values.SDT); } catch { errors.SDT = 'Nhập số di động Việt Nam hợp lệ, tối đa 24 ký tự trước chuẩn hóa.'; }
    if (![1, 2, '1', '2'].includes(values.VaiTro)) errors.VaiTro = 'Chọn nhân viên hoặc quản lý.'; else data.VaiTro = Number(values.VaiTro);
    for (const key of ['Email', 'AnhDaiDien']) {
        const raw = values[key];
        if (raw !== null && raw !== undefined && typeof raw !== 'string') { errors[key] = 'Dữ liệu phải là chuỗi.'; continue; }
        const text = (raw || '').trim();
        if (typeof raw === 'string' && /[\x00-\x1f]/.test(raw)) errors[key] = 'Không chứa ký tự điều khiển.';
        else if (key === 'Email' && text && ([...text].length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))) errors[key] = 'Email không hợp lệ hoặc quá 255 ký tự.';
        else if (key === 'AnhDaiDien' && text && !validHttps(text)) errors[key] = 'Nhập URL ảnh HTTPS hợp lệ hoặc để trống.';
        else data[key] = text || null;
    }
    return { data, errors };
}
export function accountError(error) {
    return ({ ACCOUNT_PHONE_EXISTS: 'Số điện thoại đã thuộc một tài khoản trong hệ thống. Không tự chuyển hoặc nâng quyền tài khoản đó.',
        ACCOUNT_NOT_FOUND: 'Tài khoản không tồn tại hoặc không thuộc nhóm nhân viên/quản lý.',
        CANNOT_DEMOTE_SELF: 'Bạn không thể tự hạ quyền tài khoản đang đăng nhập.', CANNOT_LOCK_SELF: 'Bạn không thể tự khóa tài khoản đang đăng nhập.',
        LAST_ACTIVE_MANAGER: 'Không thể khóa hoặc hạ quyền quản lý cuối cùng đang hoạt động.',
        INVALID_REQUEST: 'Dữ liệu chưa hợp lệ. Kiểm tra tên, số điện thoại, vai trò, email và URL ảnh.',
        CSRF_FAILED: 'Phiên xác thực thao tác không hợp lệ. Vui lòng thử lại.', DATABASE_UNAVAILABLE: 'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại.',
        CONNECTION_FAILED: 'Mất kết nối hoặc phản hồi quá lâu. Chưa xác nhận thao tác thành công; làm mới trước khi gửi lại.',
        INVALID_RESPONSE: 'Phản hồi máy chủ không hợp lệ. Vui lòng thử tải lại.' })[error.code || error.message] || 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
}
