const DAY = 86400000;
function midnight(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const time = Date.parse(`${value}T00:00:00+07:00`);
    return Number.isFinite(time) && new Date(time + 7 * 3600000).toISOString().slice(0, 10) === value ? time : NaN;
}

export function promotionCountdown(program, now = Date.now()) {
    const start = midnight(program.NgayBatDau), end = midnight(program.NgayKetThuc) + DAY;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(now)) return null;
    const state = now < start ? 'UPCOMING' : now < end ? 'ACTIVE' : 'ENDED';
    const remaining = Math.max(0, Math.ceil(((state === 'UPCOMING' ? start : end) - now) / 1000));
    const days = Math.floor(remaining / 86400);
    const digits = [Math.floor(remaining % 86400 / 3600), Math.floor(remaining % 3600 / 60), remaining % 60]
        .map(value => String(value).padStart(2, '0'));
    const clock = digits.join(':');
    return { state, label: state === 'UPCOMING' ? 'Bắt đầu sau' : state === 'ACTIVE' ? 'Kết thúc sau' : 'Đã kết thúc',
        text: `${days ? `${days} ngày ` : ''}${clock}`, parts: [String(days).padStart(2, '0'), ...digits] };
}

export function promotionBadge(promotion) {
    const percent = Number(promotion.GiaTriGiam);
    return promotion.LoaiGiamGia === true && Number.isInteger(percent) && percent >= 1 && percent <= 100
        ? `-${percent}%` : 'Ưu đãi';
}
