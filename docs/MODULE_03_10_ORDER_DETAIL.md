# MODULE 03.10 — Chi tiết và tiến trình đơn hàng

## Luồng đã xác nhận

- COD: Hoàn tất tạo đơn/trừ kho như hiện tại, sau đó chuyển sang `customer/order-detail.html?order=<id>`.
- QR: giữ chuyển thẳng Checkout SePay sau khi tạo đơn. Các callback thành công/lỗi/hủy đều trả qua `GET /api/payments/sepay/return?order=<id>` để mở trang chi tiết. Không cập nhật trạng thái từ callback.
- API chi tiết chỉ đọc: `GET /api/orders/<id>/detail`, session khách hàng và kiểm tra quyền sở hữu. API `GET /api/orders/<id>` hiện có được giữ nguyên.
- Các giá trị BIGINT của mã/tiền được trả dạng chuỗi. Giá và số lượng lấy từ ChiTietDonHang; tên, ảnh, tên đơn vị lấy từ danh mục hiện tại. Tổng tiền và giảm giá lấy từ DonHang, không tính lại theo giá bán hiện tại.

## Tiến trình

| TrangThaiDonHang | Nhãn trên trang |
| --- | --- |
| 0 | Đặt hàng |
| 1 | Đang xử lý đơn |
| 2 | Đang giao |
| 3 | Đã giao |

Các giá trị 4/5 vẫn hiển thị Đã hủy/Đổi trả, không bị ép về tiến trình 0–3. Không đổi enum hoặc ý nghĩa trạng thái Backend.

Bước hiện tại 0/1/2 có chấm hoạt động, chưa có dấu tích hoàn tất. Chỉ những bước trước bước hiện tại có dấu tích. Trạng thái 3 là kết thúc, cả bốn bước hoàn tất. Vì vậy trạng thái 1 nghĩa là nhà thuốc đang xử lý, chưa hoàn thành xử lý.

Trạng thái 0 chưa tích Đặt hàng và không có hiệu ứng chạy. Trạng thái 1 chạy trên đoạn 0→1, trạng thái 2 trên đoạn 1→2. Trạng thái 3 (Đã giao) có đủ bốn dấu tích, các đoạn nối xanh nằm yên, không chạy trên đoạn 2→3. Các đoạn đã đi qua giữ màu xanh; đoạn đang chạy có nền trung tính để thấy vệt xanh. `prefers-reduced-motion` thay animation bằng đoạn màu tĩnh. Hiệu ứng không tự thay đổi trạng thái đơn. Trang vẫn đọc API mỗi 5 giây khi đơn ở 0/1/2, giữ nút thử lại khi có lỗi. Đã bỏ nút tạm dừng, nút cập nhật thủ công và dòng thời gian cập nhật theo yêu cầu.

## Dữ liệu và bố cục

Trang theo bố cục tham khảo, giữ Green 1.0: tiến trình/thông tin nhận bên trái, thanh toán bên phải, danh sách sản phẩm phía dưới. Mobile xếp tiến trình, thanh toán rồi sản phẩm; không ép bốn bước thành thanh cuộn ngang. Có sao chép mã đơn, nút tiếp tục thanh toán QR còn chờ và liên kết mua hàng.

Thông tin nhận hàng đọc bản chụp trong GhiChu theo định dạng luồng tạo đơn hiện có. Đơn cũ không có bản chụp hiển thị rõ thiếu thông tin, không tự lấy địa chỉ hiện tại để thay cho địa chỉ lúc đặt. Chỉ hiển thị ngày đặt có thật; không bịa thời gian các bước, ngày giao dự kiến, phí miễn phí, voucher, blockchain hoặc chức năng hủy đơn chưa có API.

Đăng xuất, mất quyền hoặc lỗi chủ sở hữu xóa dữ liệu riêng khỏi DOM. Không đưa dữ liệu API vào innerHTML.

## Callback SePay

- Điền `SEPAY_FRONTEND_ORIGIN` bằng origin Frontend nằm trong `AUTH_ALLOWED_ORIGINS`.
- Đặt `SEPAY_SUCCESS_URL`, `SEPAY_ERROR_URL`, `SEPAY_CANCEL_URL` và ba biến tương ứng `SEPAY_PRODUCTION_*` tới `https://<backend-public>/api/payments/sepay/return`. Backend tự gắn `order` vào query và ký cùng form.
- Với môi trường local hiện tại, ngrok trỏ cổng 5000 nhận callback, rồi redirect 303 tới `http://localhost:5500/pages/customer/order-detail.html?order=<id>`. Không cần expose HTML qua cùng tunnel Backend.
- Khi deploy, thay origin Frontend và callback bằng URL công khai tương ứng. Nếu ngrok đổi domain, cập nhật cả callback lẫn IPN rồi restart Flask.
- Endpoint return chỉ cho phép origin đã cấu hình/allowlist, không nhận URL redirect tùy ý và không ghi database. Trang chi tiết vẫn cần đăng nhập đúng chủ đơn.

## Kiểm thử

- Backend: API chi tiết/ownership, giá lưu trong đơn, BIGINT, callback 303 và chống redirect ra origin lạ, không commit hoặc trừ kho khi đọc/callback.
- Chrome fixture: điều hướng COD, quay về sau QR, bốn trạng thái/terminal state, đúng đoạn animation đi vào bước hiện tại và reduced-motion, tải lại BIGINT, DOM an toàn, lỗi/thử lại và responsive 1440–320px. Form SePay được chặn, không giao dịch thật.
- Chưa thực hiện giao dịch ngân hàng hoặc thanh toán SePay thật để kiểm tra callback đầu cuối.
