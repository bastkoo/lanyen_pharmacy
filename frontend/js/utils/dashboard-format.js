const integer = new Intl.NumberFormat('vi-VN');
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const timestamp = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export function formatCount(value) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('INVALID_RESPONSE');
    return integer.format(value);
}

export function formatVnd(value) {
    if (typeof value !== 'string' || !/^-?\d+$/.test(value)) throw new Error('INVALID_RESPONSE');
    return money.format(BigInt(value));
}

export function formatStoredDate(value, withTime = false) {
    if (typeof value !== 'string') return 'Không rõ thời gian';
    // Approved policy: NgayDat is Vietnam wall time. Preserve its stored clock
    // regardless of the browser timezone; UTC here is only a formatting device.
    const parsed = new Date(value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value) ? value : value + (withTime ? 'Z' : 'T00:00:00Z'));
    return Number.isNaN(parsed.getTime()) ? 'Không rõ thời gian' : (withTime ? timestamp : day).format(parsed);
}
