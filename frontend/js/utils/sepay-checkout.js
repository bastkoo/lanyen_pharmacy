const environments = {
    sandbox: { action: 'https://pay-sandbox.sepay.vn/v1/checkout/init', prefix: 'LYSGTEST' },
    production: { action: 'https://pay.sepay.vn/v1/checkout/init', prefix: 'LYSGLIVE' }
};
const fieldOrder = ['order_amount', 'merchant', 'currency', 'operation', 'order_description',
    'order_invoice_number', 'customer_id', 'payment_method', 'success_url', 'error_url', 'cancel_url', 'signature'];

export function checkoutFields(payment, order) {
    const fields = payment?.fields;
    const selected = Object.hasOwn(environments, payment?.environment) ? environments[payment.environment] : null;
    const merchant = fields?.merchant || '';
    const merchantValid = payment?.environment === 'sandbox' ? /^SP-TEST-[A-Za-z0-9-]+$/.test(merchant)
        : /^[A-Za-z0-9_-]+$/.test(merchant) && !merchant.startsWith('SP-TEST-');
    if (!selected || payment.action !== selected.action || payment.method !== 'POST'
        || (order.payment_environment && order.payment_environment !== payment.environment)
        || !fields || typeof fields !== 'object' || Array.isArray(fields)
        || Object.keys(fields).some(key => !fieldOrder.includes(key) || typeof fields[key] !== 'string')
        || !/^[1-9][0-9]*$/.test(fields.order_amount || '') || fields.order_amount !== String(order.TongThanhToan)
        || fields.order_invoice_number !== `${selected.prefix}${order.MaDonHang}` || !merchantValid
        || fields.currency !== 'VND' || fields.operation !== 'PURCHASE' || fields.payment_method !== 'BANK_TRANSFER'
        || !fields.order_description || !/^[A-Za-z0-9+/]{43}=$/.test(fields.signature || '')) {
        throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
    }
    // Flask JSON keys may be sorted. Restore SePay's required input order.
    return fieldOrder.filter(key => Object.hasOwn(fields, key)).map(key => [key, fields[key]]);
}

export function submitCheckout(payment, order, newTab = false) {
    const entries = checkoutFields(payment, order);
    document.getElementById('sepay-checkout-form')?.remove();
    const form = document.createElement('form'); form.id = 'sepay-checkout-form';
    form.method = 'POST'; form.action = payment.action; form.hidden = true;
    if (newTab) { form.target = '_blank'; form.rel = 'noopener noreferrer'; }
    for (const [name, value] of entries) {
        const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.append(input);
    }
    document.body.append(form);
    HTMLFormElement.prototype.submit.call(form);
}

export function paymentMessage(error) {
    return ({ GATEWAY_NOT_CONFIGURED: 'Thanh toán SePay chưa được cấu hình. Vui lòng liên hệ nhà thuốc.',
        GATEWAY_CONFIG_INVALID: 'Cấu hình SePay chưa hợp lệ. Vui lòng liên hệ nhà thuốc.',
        GATEWAY_PRODUCTION_DISABLED: 'Thanh toán thật chưa được bật. Vui lòng liên hệ nhà thuốc.',
        ORDER_PAYMENT_ENVIRONMENT_UNKNOWN: 'Đơn cũ chưa xác định môi trường thanh toán. Vui lòng liên hệ nhà thuốc.',
        ORDER_PAYMENT_ENVIRONMENT_MISMATCH: 'Đơn thuộc môi trường thanh toán khác. Vui lòng liên hệ nhà thuốc.',
        GATEWAY_ENVIRONMENT_COLLISION: 'Cấu hình hai môi trường thanh toán chưa được tách biệt. Vui lòng liên hệ nhà thuốc.',
        ORDER_ALREADY_PAID: 'Đơn đã được thanh toán. Hãy kiểm tra lại trạng thái.',
        ORDER_NOT_PAYABLE: 'Đơn không còn ở trạng thái chờ thanh toán.',
        ORDER_EXPIRED: 'Đơn đã quá 24 giờ chưa thanh toán. Hãy kiểm tra trạng thái đơn hoặc liên hệ nhà thuốc.',
        ORDER_NOT_FOUND: 'Không tìm thấy đơn hàng thuộc tài khoản của bạn.',
        SESSION_CHANGED: 'Tài khoản đã thay đổi. Hãy tải lại trang.',
        UNAUTHENTICATED: 'Vui lòng đăng nhập lại để thanh toán.',
        INVALID_RESPONSE: 'Dữ liệu Checkout chưa hợp lệ. Chưa chuyển sang SePay.',
        CONNECTION_FAILED: 'Chưa kết nối được máy chủ. Hãy kiểm tra lại trạng thái trước khi thanh toán.' })[error.code]
        || 'Chưa mở được Checkout SePay. Bạn có thể thử lại.';
}
