export const MANAGER_VIEWS = Object.freeze({
    overview: { title: 'Tổng quan', section: 'Hoạt động nhà thuốc', description: 'Doanh thu, đơn hàng và những điểm cần theo dõi.', icon: 'layout-dashboard' },
    categories: { title: 'Danh mục thuốc', section: 'Dữ liệu thuốc', description: 'Tổ chức các nhóm thuốc trong danh mục của nhà thuốc.', icon: 'list-tree' },
    products: { title: 'Quản lý thuốc', section: 'Dữ liệu thuốc', description: 'Thông tin thuốc và hồ sơ sản phẩm.', icon: 'pill' },
    units: { title: 'Đơn vị tính & giá bán', section: 'Dữ liệu thuốc', description: 'Đơn vị tính, giá bán và số lượng quy đổi theo từng thuốc.', icon: 'boxes' },
    batches: { title: 'Lô thuốc', section: 'Kho nhà thuốc', description: 'Thông tin lô, ngày sản xuất và hạn sử dụng.', icon: 'package-open' },
    inventory: { title: 'Tồn kho', section: 'Kho nhà thuốc', description: 'Theo dõi số lượng tồn, hạn dùng và ngưỡng cảnh báo.', icon: 'warehouse' }
});

export function resolveManagerView(hash) {
    const key = hash.replace(/^#/, '') || 'overview';
    return Object.hasOwn(MANAGER_VIEWS, key) ? key : null;
}

export function managerAccess(user) {
    if (!user || typeof user.VaiTro !== 'number' || typeof user.TrangThai !== 'boolean') return 'invalid';
    if (user.TrangThai) return 'locked';
    return user.VaiTro === 2 ? 'allowed' : 'forbidden';
}

export function accountInitials(name) {
    return String(name || '').trim().split(/\s+/).filter(Boolean).slice(-2)
        .map(word => [...word][0]).join('').toLocaleUpperCase('vi') || 'QL';
}
