# Kiểm thử Checkout SePay Sandbox

> Hệ thống đã hỗ trợ hai môi trường. Đọc [SEPAY_ENVIRONMENTS.md](SEPAY_ENVIRONMENTS.md) về nhóm cấu hình riêng, cách ly database/IPN và cách bật Production có chủ đích. Các bước dưới đây dành cho Sandbox.

## Cấu hình và địa chỉ

- Flask: `http://localhost:5000`; Frontend: `http://localhost:5500`.
- Ngrok hiện tại: `https://removable-repeater-urgency.ngrok-free.dev`, forward tới `http://localhost:5000`.
- IPN trong SePay Test Mode: `https://removable-repeater-urgency.ngrok-free.dev/api/payments/sepay/ipn`.
- Chọn Auth Type `SECRET_KEY`, Content Type `application/json`; khóa IPN khớp `SEPAY_IPN_SECRET_KEY` trong `backend/.env`. Đây là khóa khác Secret Key merchant.
- Điền `SEPAY_ENV=sandbox`, Merchant ID `SP-TEST-...`, Secret Key merchant, khóa IPN. Giữ Checkout URL `https://pay-sandbox.sepay.vn/v1/checkout/init`, API Base URL `https://pgapi-sandbox.sepay.vn`.
- Khởi động lại Flask sau khi đổi `.env`; tải lại cứng trang Frontend để nhận JavaScript mới.
- Không chia sẻ `.env`, Authtoken ngrok, header khóa, chữ ký, toàn bộ request form hoặc HAR chưa che thông tin.

## Luồng kiểm thử

1. Đăng nhập khách hàng trên cùng host `localhost` cho Frontend và Backend; không đổi qua lại `127.0.0.1`, vì cookie phiên gắn với host.
2. Chọn sản phẩm, địa chỉ hoặc nhận tại nhà thuốc, chọn QR, bấm **Hoàn tất**. `POST /api/orders` trả HTTP 201 và trừ kho ngay, lưu đơn ở trạng thái 0. Lưu mã đơn tại URL `checkout.html?order=<id>`.
3. Trang **tự khởi tạo và chuyển sang Checkout SePay**, không yêu cầu bấm thêm liên kết. Không tải ảnh `qr.sepay.vn/img`. Nút mở Checkout còn lại để thử lại nếu khởi tạo lỗi hoặc khi mở lại đơn chưa thanh toán.
4. Network phải tự có `POST /api/orders/<id>/payment`, HTTP 200, `code=PAYMENT_INITIALIZED`. Request không có body và có cookie/CSRF. Backend lấy số tiền từ đơn; mở Checkout không trừ kho thêm.
5. Trình duyệt submit form POST sang `https://pay-sandbox.sepay.vn/v1/checkout/init`; SePay hiển thị trang Sandbox và QR/mô phỏng chuyển khoản. Đây là điều hướng form, không phải AJAX lấy ảnh QR.
6. Thực hiện thanh toán mô phỏng trong Sandbox. Không chuyển tiền thật. Việc ngrok online hoặc tạo đơn local chưa tự tạo IPN.
7. Kiểm tra Nhật ký IPN tại SePay. Endpoint phải trả HTTP 200. Log Flask có `sepay_ipn status=200 code=PAID`; trường hợp gửi lặp có `DUPLICATE`, trạng thái không phù hợp có `IGNORED`.
8. Quay lại tab cửa hàng hoặc mở lại URL đơn đã lưu. `GET /api/orders/<id>` phải trả `TrangThaiThanhToan=1`, `TrangThaiDonHang=1`. Nếu đang chờ, trang đọc trạng thái mỗi 5 giây và có nút **Kiểm tra thanh toán**.
9. Thử riêng COD: bấm Hoàn tất thì trừ kho ngay, tạo đơn đang xử lý, chưa thanh toán; không mở Gateway. Kiểm tra số lượng theo đơn vị nhỏ nhất và FIFO lô còn hạn. QR đã trừ kho từ lúc Hoàn tất, do đó IPN hợp lệ/lặp không được trừ thêm. Không có hoàn kho tự động sau 10 phút; không tự trừ bù các đơn cũ.

## Callback và cookie

Các biến `SEPAY_SUCCESS_URL`, `SEPAY_ERROR_URL`, `SEPAY_CANCEL_URL` và bộ Production tương ứng có thể trỏ tới `https://<backend-public>/api/payments/sepay/return`. Backend tự gắn mã đơn, callback redirect 303 về trang chi tiết tại Frontend đã cấu hình bằng `SEPAY_FRONTEND_ORIGIN` (phải nằm trong AUTH_ALLOWED_ORIGINS). Xem [trang chi tiết đơn](MODULE_03_10_ORDER_DETAIL.md).

Ngrok đang forward cổng **5000**, vì vậy URL ngrok không tự phục vụ HTML của cổng **5500**. Route return trên Backend giải quyết việc này bằng redirect tới Frontend, không cần giả định tunnel phục vụ HTML. Không đổi sang gọi API qua ngrok từ Frontend localhost mà chưa xử lý cookie/CORS. Với host local, redirect localhost chỉ phù hợp khi trình duyệt chạy trên máy có Frontend.

Tham số `status=success`, `paid=1` trên URL không được phép cập nhật đơn. Callback chỉ là điều hướng; IPN hợp lệ mới xác nhận thanh toán.

## Chẩn đoán an toàn

| Kết quả | Ý nghĩa / kiểm tra |
| --- | --- |
| GET endpoint IPN trả 405 | Bình thường: endpoint chỉ nhận POST |
| POST IPN không có khóa trả 401 | Bình thường: xác thực đang bảo vệ endpoint |
| GET ngrok trả HTML 200 | Có thể là trang cảnh báo ngrok, chưa chứng minh Flask nhận request. Khi chẩn đoán dùng header `ngrok-skip-browser-warning: 1` và kiểm tra status/content type |
| API đơn trả 401 | Phiên chưa đăng nhập/hết hạn; đăng nhập đúng host |
| API đơn trả 404 | Sai mã đơn hoặc đơn không thuộc khách hàng |
| Khởi tạo trả 503 | Xem mã `GATEWAY_NOT_CONFIGURED` hoặc `GATEWAY_CONFIG_INVALID`; không in khóa để kiểm tra |
| SePay báo chữ ký sai | Kiểm tra đúng cặp Merchant/Secret Sandbox, Flask đã restart, thứ tự input và dữ liệu chưa bị sửa. Frontend khôi phục thứ tự ký vì JSON có thể được sắp theo tên khóa |
| IPN sai khóa | So sánh cấu hình khóa IPN giữa `.env` và SePay bằng kiểm tra khớp, không in giá trị |
| IPN sai tiền/mã/tệ | Không tự sửa dữ liệu đơn để ép qua; kiểm tra mã hóa đơn `LYSGTEST<MaDonHang>` và số tiền từ Backend |
| IPN 0 bản ghi | Kiểm tra đã thực sự mở Checkout và mô phỏng thanh toán; đúng Test Mode và đúng IPN URL |

Console Frontend chỉ ghi tên thao tác, HTTP status và mã lỗi. Log Backend chỉ ghi mã kết quả và mã đơn khi khởi tạo; không ghi payload, khóa hoặc chữ ký. HTTP 200 với `IGNORED` là đã nhận thông báo nhưng không đánh dấu thanh toán.

Các kết quả thành công ghi ở mức INFO; cần bật INFO hoặc chạy chế độ development của Flask để thấy chúng. Các lỗi được ghi ở mức WARNING.

Kiểm thử tự động dùng API giả lập, không gửi form sang SePay thật: `node backend/tests/browser_manager.mjs --checkout`. Backend: từ thư mục `backend`, chạy `.venv/Scripts/python.exe -m unittest discover -s tests -p test_orders.py`.

Nguồn: [Sandbox](https://developer.sepay.vn/vi/cong-thanh-toan/sandbox), [Form Checkout](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/form-thanh-toan), [IPN](https://developer.sepay.vn/vi/cong-thanh-toan/IPN).
