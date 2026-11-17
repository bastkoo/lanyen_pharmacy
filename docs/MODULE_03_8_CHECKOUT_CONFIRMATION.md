# MODULE 03.8 — Xác nhận mua hàng

## Phạm vi được chọn

Người dùng xác nhận chỉ triển khai trang chọn hình thức nhận hàng, địa chỉ, ghi chú và phương thức thanh toán. Chưa tạo đơn hàng, trừ kho, sử dụng hạn mức khuyến mãi hoặc thu tiền. Nút Hoàn tất được vô hiệu hóa và có giải thích trên giao diện.

## Luồng giao diện

- Nút Mua hàng trong giỏ dẫn tới `customer/checkout.html?unit=<MaDonGia>&unit=...`, chỉ mang ID các dòng được chọn. Không mang giá, số điện thoại, địa chỉ hoặc ghi chú trong URL.
- Trang dùng lại POST `/api/cart/quote` để lấy số lượng, giá và ưu đãi hiện tại của các dòng trong giỏ thuộc phiên. Giữ tính đúng tiền khi chỉ một phần số lượng được hưởng ưu đãi. Tổng giảm bằng 0 thì không hiện dòng giảm giá.
- Dòng đã xóa/không còn trong giỏ yêu cầu trở lại chọn lại; thiếu tồn kho còn hạn được đánh dấu, không hiện tổng tiền đầy đủ giả định. Lỗi mạng có thử lại, không tự gửi lại thao tác ghi.
- Giao tận nơi dùng địa chỉ trong tài khoản: mặc định địa chỉ chính, có hộp chọn địa chỉ khác và liên kết quản lý/thêm địa chỉ. Chọn địa chỉ nhận cho trang xác nhận không sửa địa chỉ chính trong CSDL.
- Khách chưa đăng nhập vẫn xem được các dòng đã chọn và lựa chọn nhận tại nhà thuốc; giao tận nơi có nút đăng nhập để dùng địa chỉ tài khoản. Tiếp tục dùng luồng gộp giỏ khách hiện có khi đăng nhập, báo giá lại sau gộp. Ghi chú khách giữ khi đăng nhập; đổi/đăng xuất tài khoản đã đăng nhập xóa ghi chú, địa chỉ và nội dung hiển thị của phiên cũ.
- Nhận tại nhà thuốc hiển thị: **126 Dương Văn An, Phường Vỹ Dạ, TP Huế**.
- Có ghi chú tùy chọn và lưu ý do người dùng cung cấp: miễn phí giao Trung tâm TP Huế, dự kiến 2–3 giờ; phường/xã ngoài trung tâm hoặc tỉnh/thành khác dự kiến 3–4 ngày, phí phát sinh do người đặt chi trả.
- Không tự suy luận danh sách phường/xã trung tâm hay một mức phí. Giao tận nơi hiện “Xác nhận theo địa chỉ”; tạm tính chưa gồm phí giao hàng nếu có. Nhận tại nhà thuốc hiện phí giao hàng “Không áp dụng”.
- Phương thức thanh toán gồm Thanh toán khi nhận hàng và Thanh toán bằng QR. QR chỉ là lựa chọn phương thức, chưa có mã chuyển tiền/tài khoản ngân hàng hoặc xác nhận thanh toán.
- Không thêm các tính năng xuất hóa đơn, voucher riêng, ứng dụng hoặc hình thức thanh toán ngoài yêu cầu trong ảnh tham khảo.

Trang dùng Green 1.0, header/footer hiện có, bố cục nội dung và bảng tạm tính bên phải; màn hình nhỏ chuyển thành một cột. Không có thông báo nổi khi xem hoặc đổi lựa chọn trên trang.

## Tích hợp và xác minh

Không đổi backend, API contract, bảng/cột hay migrations. Tái sử dụng giỏ/báo giá, phiên/OTP và API địa chỉ hiện có. Dữ liệu dựng bằng DOM an toàn, tiền tính bằng số nguyên chính xác.

- 67 kiểm thử JavaScript đạt, gồm kiểm tra URL lựa chọn chỉ chứa ID hợp lệ.
- `node backend/tests/browser_manager.mjs --checkout` đạt luồng giỏ và xác nhận: chọn dòng, chỉnh số lượng/đơn vị, trạng thái nút mua, khách/đăng nhập-gộp giỏ, địa chỉ chính/phụ, ghi chú, nhận tại nhà thuốc, COD/QR, giảm giá một phần, hết hàng, lỗi/thử lại, lựa chọn trống/không hợp lệ, đăng xuất và bố cục 1440–320px.
- Kiểm thử trình duyệt dùng API giả lập, không ghi vào PostgreSQL hoặc gọi dịch vụ thanh toán. Backend không thay đổi nên không chạy lại bộ Python trong đợt giao diện này.
