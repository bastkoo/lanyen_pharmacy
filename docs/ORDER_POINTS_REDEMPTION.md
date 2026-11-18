# Đổi xu khi xác nhận mua hàng

Yêu cầu được duyệt ngày 18/11/2026: thêm `DonHang.DoiDiem` boolean; hiển thị xu vàng thay đơn vị điểm; đổi 1 xu = 100đ. Khi bật đổi xu, tự dùng số xu nguyên tối đa, giới hạn bởi số dư và tiền hàng sau khuyến mãi.

- Migration `58bd14a72f93` nối tiếp `31ac74d9e206`, chỉ thêm `DoiDiem`, `NOT NULL DEFAULT false`. Các đơn cũ nhận `false`.
- Cả POST `/api/orders` và POST `/api/orders/<id>/reorder/checkout` nhận tùy chọn `DoiDiem` boolean, mặc định `false`. Các request cũ vẫn dùng được.
- Backend lấy số dư từ `DiemThuong`, cộng `SoDiem` khi `LoaiGiaoDich=true`, trừ khi `false`. Số xu đổi = `min(max(số dư, 0), tiền sau khuyến mãi // 100)`.
- Không nhận số dư hay giá trị quy đổi do client cung cấp. `TongThanhToan` là tổng sau khuyến mãi và đổi xu, được đối chiếu lại trước khi tạo đơn.
- `TienGiamGia` bao gồm cả khuyến mãi và tiền đổi xu. `DoiDiem=true` khi thực tế đã dùng xu. Chi tiết giao dịch trừ xu nằm trong `DiemThuong`, lý do có mã đơn hàng.
- Khóa tài khoản trước khi kiểm tra số dư. Ghi giao dịch trừ xu cùng transaction với đơn, kho, hạn mức khuyến mãi và giỏ hàng; không commit riêng. Mua lại trực tiếp vẫn giữ nguyên giỏ.
- Xu bị trừ khi tạo đơn thành công cho cả COD và QR, cùng thời điểm trừ kho hiện tại; IPN thanh toán không trừ xu lần nữa. Không bổ sung quy tắc tích xu hoặc hoàn xu khi hủy/đổi trả.
- Nếu số dư hoặc giá thay đổi, trả `QUOTE_CHANGED`; nếu không còn xu có thể đổi, trả `POINTS_UNAVAILABLE`. Không ghi đơn hoặc trừ xu khi có lỗi.
- Giữ giới hạn lưu tiền hiện có của database. Đơn QR có tổng bằng 0 vẫn bị từ chối bằng `QR_AMOUNT_INVALID`; khách chọn thanh toán khi nhận hàng để hoàn tất đơn 0đ.

Giao diện xác nhận chỉ hiện dòng “Sử dụng điểm: [số dư] xu” kèm nút gạt khi số dư lớn hơn 0. Nút gạt không bật sẵn; dòng giảm từ xu và tổng thanh toán cập nhật ngay. Menu avatar, sidebar và tiêu đề Xu tích lũy không có icon. Trang Xu tích lũy dùng đồng xu vàng có nhãn trợ năng, icon cạnh số dư to bằng chữ số. Trang chi tiết đơn ghi rõ khi tổng giảm bao gồm đổi xu.
