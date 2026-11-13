export function normalizePhone(value) {
    const compact = value.trim().replace(/[\s().-]/g, "");
    const phone = /^0[0-9]{9}$/.test(compact) ? `+84${compact.slice(1)}` : compact;
    if (!/^\+84[35789][0-9]{8}$/.test(phone)) throw new Error("Nhập số di động Việt Nam gồm 10 chữ số hoặc bắt đầu bằng +84.");
    return phone;
}
export function validOtp(value) { return /^[0-9]{6}$/.test(value.trim()); }
export function validName(value) { return value.trim().length > 0 && value.length <= 255 && !/[\x00-\x1f]/.test(value); }
